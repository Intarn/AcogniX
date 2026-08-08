jest.mock('../../config/supabaseClient', () => ({
  from: jest.fn(),
  storage: { from: jest.fn() }
}));

jest.mock('../../service/NotificationService', () => ({
  notifyAssessmentChanged: jest.fn()
}));

jest.mock('../../service/AssessmentAnalyticsIntegrationService', () => ({
  recordAssessmentScore: jest.fn()
}));

const supabase = require('../../config/supabaseClient');
const NotificationService = require('../../service/NotificationService');
const AssessmentService = require('../../service/AssessmentService');
const Assessment = require('../../entities/Assessment');
const Question = require('../../entities/Question');
const {
  AssessmentType,
  AssessmentStatus,
  QuestionType
} = require('../../enums/AssessmentEnums');

function mutationSingle(result) {
  return {
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result)
  };
}

function listByEq(result) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(result)
  };
}

function listByEqOrder(result) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(result)
  };
}

function deleteByEq(result) {
  return {
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(result)
  };
}

function deleteByIn(result) {
  return {
    delete: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue(result)
  };
}

function createTableRouter(queues) {
  supabase.from.mockImplementation((name) => {
    const queue = queues[name];
    if (!queue || queue.length === 0) {
      throw new Error(`Unexpected Supabase table call: ${name}`);
    }
    return queue.shift();
  });
}

function row(overrides = {}) {
  return {
    assessmentId: 'a-1',
    courseId: 'c-1',
    title: 'Quiz 1',
    description: null,
    assessmentType: AssessmentType.QUIZ,
    instructionFileUrl: null,
    startAt: null,
    deadline: null,
    totalPoints: 10,
    allowLateSubmission: false,
    status: AssessmentStatus.DRAFT,
    createdAt: '2026-08-08T00:00:00.000Z',
    ...overrides
  };
}

describe('AssessmentService UC-09 unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ASSESSMENT_STORAGE_BUCKET;
    NotificationService.notifyAssessmentChanged.mockResolvedValue({ sent: false });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('createAssessment()', () => {
    test('rejects missing title or invalid type', async () => {
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});

      await expect(
        AssessmentService.createAssessment('c-1', 'e-1', {
          title: '',
          type: 'UNKNOWN'
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_ASSESSMENT_DATA'
      });
    });

    test('rejects when only one schedule field is supplied', async () => {
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});

      await expect(
        AssessmentService.createAssessment('c-1', 'e-1', {
          title: 'Quiz',
          type: AssessmentType.QUIZ,
          startTime: '2026-08-10T08:00:00.000Z'
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INCOMPLETE_ASSESSMENT_SCHEDULE'
      });
    });

    test('creates a DRAFT assessment without a schedule', async () => {
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_notifyCourseLearners').mockResolvedValue({ sent: false });
      const insertChain = mutationSingle({ data: row(), error: null });
      createTableRouter({ Assessment: [insertChain] });

      const result = await AssessmentService.createAssessment('c-1', 'e-1', {
        title: 'Quiz 1',
        type: AssessmentType.QUIZ,
        totalPoints: '10'
      });

      expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
        courseId: 'c-1',
        title: 'Quiz 1',
        assessmentType: AssessmentType.QUIZ,
        totalPoints: 10,
        status: AssessmentStatus.DRAFT
      }));
      expect(result.assessment).toBeInstanceOf(Assessment);
      expect(result.questions).toEqual([]);
      expect(AssessmentService._notifyCourseLearners).toHaveBeenCalledWith({
        courseId: 'c-1',
        assessmentId: 'a-1',
        action: 'CREATED'
      });
    });

    test('creates a SCHEDULED assessment and inserts every supplied question', async () => {
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_notifyCourseLearners').mockResolvedValue({ sent: false });
      jest.spyOn(AssessmentService, '_insertQuestion')
        .mockResolvedValueOnce(new Question({ questionId: 'q-1', content: 'Q1', type: QuestionType.ESSAY }))
        .mockResolvedValueOnce(new Question({ questionId: 'q-2', content: 'Q2', type: QuestionType.ESSAY }));

      const saved = row({
        startAt: '2026-08-10T08:00:00.000Z',
        deadline: '2026-08-10T09:00:00.000Z',
        status: AssessmentStatus.SCHEDULED
      });
      createTableRouter({ Assessment: [mutationSingle({ data: saved, error: null })] });

      const result = await AssessmentService.createAssessment('c-1', 'e-1', {
        title: 'Quiz 1',
        type: AssessmentType.QUIZ,
        startTime: saved.startAt,
        deadline: saved.deadline,
        questions: [
          { content: 'Q1', type: QuestionType.ESSAY },
          { content: 'Q2', type: QuestionType.ESSAY }
        ]
      });

      expect(AssessmentService._insertQuestion).toHaveBeenCalledTimes(2);
      expect(result.assessment.status).toBe(AssessmentStatus.SCHEDULED);
      expect(result.questions).toHaveLength(2);
    });

    test('propagates an Assessment insert database error', async () => {
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      const dbError = new Error('DB_DOWN');
      createTableRouter({ Assessment: [mutationSingle({ data: null, error: dbError })] });

      await expect(
        AssessmentService.createAssessment('c-1', 'e-1', {
          title: 'Quiz',
          type: AssessmentType.QUIZ
        })
      ).rejects.toBe(dbError);
    });
  });

  describe('getManagedAssessments()', () => {
    test('returns mapped assessments after synchronizing every row', async () => {
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus')
        .mockImplementation(async value => value);

      const rows = [row({ assessmentId: 'a-1' }), row({ assessmentId: 'a-2' })];
      const chain = listByEqOrder({ data: rows, error: null });
      createTableRouter({ Assessment: [chain] });

      const result = await AssessmentService.getManagedAssessments('c-1', 'e-1');

      expect(chain.eq).toHaveBeenCalledWith('courseId', 'c-1');
      expect(chain.order).toHaveBeenCalledWith('startAt', { ascending: false });
      expect(AssessmentService._synchronizeAssessmentStatus).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Assessment);
    });
  });

  describe('updateAssessment()', () => {
    test('blocks an active assessment', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(
        row({ status: AssessmentStatus.IN_PROGRESS })
      );

      await expect(
        AssessmentService.updateAssessment('a-1', 'e-1', { title: 'New' })
      ).rejects.toMatchObject({ statusCode: 409, code: 'ASSESSMENT_NOT_EDITABLE' });
    });

    test('rejects a blank updated title', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(row());

      await expect(
        AssessmentService.updateAssessment('a-1', 'e-1', { title: '   ' })
      ).rejects.toMatchObject({ statusCode: 400, code: 'ASSESSMENT_TITLE_REQUIRED' });
    });

    test('rejects an invalid updated type', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(row());

      await expect(
        AssessmentService.updateAssessment('a-1', 'e-1', { type: 'UNKNOWN' })
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_ASSESSMENT_TYPE' });
    });

    test('updates requested fields and notifies Learners', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_notifyCourseLearners').mockResolvedValue({ sent: false });

      const saved = row({ title: 'Updated', assessmentType: AssessmentType.ASSIGNMENT, totalPoints: 20 });
      const chain = mutationSingle({ data: saved, error: null });
      createTableRouter({ Assessment: [chain] });

      const result = await AssessmentService.updateAssessment('a-1', 'e-1', {
        title: ' Updated ',
        description: '',
        type: AssessmentType.ASSIGNMENT,
        totalPoints: '20',
        allowLateSubmission: 1
      });

      expect(chain.update).toHaveBeenCalledWith({
        title: 'Updated',
        description: null,
        assessmentType: AssessmentType.ASSIGNMENT,
        totalPoints: 20,
        allowLateSubmission: true
      });
      expect(result).toBeInstanceOf(Assessment);
      expect(AssessmentService._notifyCourseLearners).toHaveBeenCalledWith({
        courseId: 'c-1', assessmentId: 'a-1', action: 'UPDATED'
      });
    });
  });

  describe('deleteAssessment()', () => {
    test('blocks deletion of an active assessment', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(
        row({ status: AssessmentStatus.IN_PROGRESS })
      );

      await expect(
        AssessmentService.deleteAssessment('a-1', 'e-1')
      ).rejects.toMatchObject({ statusCode: 409, code: 'ASSESSMENT_NOT_EDITABLE' });
    });

    test('deletes options, questions, assessment and sends notification', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_notifyCourseLearners').mockResolvedValue({ sent: false });

      const questionList = listByEq({ data: [{ questionId: 'q-1' }, { questionId: 'q-2' }], error: null });
      const optionDelete = deleteByIn({ error: null });
      const questionDelete = deleteByEq({ error: null });
      const assessmentDelete = deleteByEq({ error: null });
      createTableRouter({
        Question: [questionList, questionDelete],
        Question_Option: [optionDelete],
        Assessment: [assessmentDelete]
      });

      await expect(AssessmentService.deleteAssessment('a-1', 'e-1')).resolves.toBeUndefined();
      expect(optionDelete.in).toHaveBeenCalledWith('questionId', ['q-1', 'q-2']);
      expect(questionDelete.eq).toHaveBeenCalledWith('assessmentId', 'a-1');
      expect(assessmentDelete.eq).toHaveBeenCalledWith('assessmentId', 'a-1');
      expect(AssessmentService._notifyCourseLearners).toHaveBeenCalledWith({
        courseId: 'c-1', assessmentId: 'a-1', action: 'DELETED'
      });
    });

    test('skips Question_Option deletion when there are no questions', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_notifyCourseLearners').mockResolvedValue({});
      createTableRouter({
        Question: [listByEq({ data: [], error: null })],
        Assessment: [deleteByEq({ error: null })]
      });

      await AssessmentService.deleteAssessment('a-1', 'e-1');
      expect(supabase.from).not.toHaveBeenCalledWith('Question_Option');
    });
  });

  describe('addQuestion()', () => {
    test('blocks question changes after assessment becomes active', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(
        row({ status: AssessmentStatus.IN_PROGRESS })
      );

      await expect(
        AssessmentService.addQuestion('a-1', 'e-1', { content: 'Q?', type: QuestionType.ESSAY })
      ).rejects.toMatchObject({ statusCode: 409, code: 'ASSESSMENT_NOT_EDITABLE' });
    });

    test('delegates valid insertion to _insertQuestion()', async () => {
      const expected = new Question({ questionId: 'q-1', content: 'Q?', type: QuestionType.ESSAY });
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_insertQuestion').mockResolvedValue(expected);

      const input = { content: 'Q?', type: QuestionType.ESSAY };
      await expect(AssessmentService.addQuestion('a-1', 'e-1', input)).resolves.toBe(expected);
      expect(AssessmentService._insertQuestion).toHaveBeenCalledWith('a-1', input);
    });
  });

  describe('scheduleAssessment()', () => {
    test('blocks rescheduling after activation', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(
        row({ status: AssessmentStatus.CLOSED })
      );

      await expect(
        AssessmentService.scheduleAssessment('a-1', 'e-1', '2026-08-10T08:00:00Z', '2026-08-10T09:00:00Z')
      ).rejects.toMatchObject({ statusCode: 409, code: 'ASSESSMENT_NOT_EDITABLE' });
    });

    test('stores ISO schedule, sets SCHEDULED and notifies Learners', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_notifyCourseLearners').mockResolvedValue({});

      const saved = row({
        startAt: '2026-08-10T08:00:00.000Z',
        deadline: '2026-08-10T09:00:00.000Z',
        status: AssessmentStatus.SCHEDULED
      });
      const chain = mutationSingle({ data: saved, error: null });
      createTableRouter({ Assessment: [chain] });

      const result = await AssessmentService.scheduleAssessment(
        'a-1', 'e-1', '2026-08-10T08:00:00Z', '2026-08-10T09:00:00Z'
      );

      expect(chain.update).toHaveBeenCalledWith({
        startAt: '2026-08-10T08:00:00.000Z',
        deadline: '2026-08-10T09:00:00.000Z',
        status: AssessmentStatus.SCHEDULED
      });
      expect(result.status).toBe(AssessmentStatus.SCHEDULED);
    });
  });

  describe('publishAssessment()', () => {
    test('requires a configured schedule', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});

      await expect(
        AssessmentService.publishAssessment('a-1', 'e-1')
      ).rejects.toMatchObject({ statusCode: 400, code: 'ASSESSMENT_SCHEDULE_REQUIRED' });
    });

    test.each([
      {
        name: 'SCHEDULED before start',
        now: '2026-08-10T07:00:00.000Z',
        expected: AssessmentStatus.SCHEDULED
      },
      {
        name: 'IN_PROGRESS during window',
        now: '2026-08-10T08:30:00.000Z',
        expected: AssessmentStatus.IN_PROGRESS
      },
      {
        name: 'CLOSED after deadline',
        now: '2026-08-10T10:00:00.000Z',
        expected: AssessmentStatus.CLOSED
      }
    ])('publishes as $name', async ({ now, expected }) => {
      jest.useFakeTimers().setSystemTime(new Date(now));
      const original = row({
        startAt: '2026-08-10T08:00:00.000Z',
        deadline: '2026-08-10T09:00:00.000Z',
        status: AssessmentStatus.DRAFT
      });
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(original);
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_notifyCourseLearners').mockResolvedValue({});
      const chain = mutationSingle({ data: row({ ...original, status: expected }), error: null });
      createTableRouter({ Assessment: [chain] });

      const result = await AssessmentService.publishAssessment('a-1', 'e-1');
      expect(chain.update).toHaveBeenCalledWith({ status: expected });
      expect(result.status).toBe(expected);
    });
  });

  describe('uploadInstructionFile()', () => {
    const file = {
      originalname: 'assignment.pdf',
      buffer: Buffer.from('abc'),
      mimetype: 'application/pdf'
    };

    test('rejects missing file', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(row());

      await expect(
        AssessmentService.uploadInstructionFile('a-1', 'e-1', null)
      ).rejects.toMatchObject({ statusCode: 400, code: 'ASSESSMENT_FILE_REQUIRED' });
    });

    test('rejects when storage bucket is not configured', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(row());

      await expect(
        AssessmentService.uploadInstructionFile('a-1', 'e-1', file)
      ).rejects.toMatchObject({ statusCode: 500, code: 'ASSESSMENT_STORAGE_NOT_CONFIGURED' });
    });

    test('uploads file, stores path and returns updated Assessment', async () => {
      process.env.ASSESSMENT_STORAGE_BUCKET = 'assessment-files';
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(row());
      jest.spyOn(AssessmentService, '_notifyCourseLearners').mockResolvedValue({});
      jest.spyOn(Date, 'now').mockReturnValue(12345);

      const upload = jest.fn().mockResolvedValue({ error: null });
      supabase.storage.from.mockReturnValue({ upload });
      const saved = row({ instructionFileUrl: 'instructions/a-1/12345_assignment.pdf' });
      const chain = mutationSingle({ data: saved, error: null });
      createTableRouter({ Assessment: [chain] });

      const result = await AssessmentService.uploadInstructionFile('a-1', 'e-1', file);

      expect(supabase.storage.from).toHaveBeenCalledWith('assessment-files');
      expect(upload).toHaveBeenCalledWith(
        'instructions/a-1/12345_assignment.pdf',
        file.buffer,
        { contentType: 'application/pdf', upsert: false }
      );
      expect(chain.update).toHaveBeenCalledWith({
        instructionFileUrl: 'instructions/a-1/12345_assignment.pdf'
      });
      expect(result.instructionFileUrl).toBe('instructions/a-1/12345_assignment.pdf');
    });
  });
});
