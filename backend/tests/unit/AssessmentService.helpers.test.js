jest.mock('../../config/supabaseClient', () => ({ from: jest.fn(), storage: { from: jest.fn() } }));
jest.mock('../../service/NotificationService', () => ({ notifyAssessmentChanged: jest.fn() }));
jest.mock('../../service/AssessmentAnalyticsIntegrationService', () => ({ recordAssessmentScore: jest.fn() }));

const supabase = require('../../config/supabaseClient');
const NotificationService = require('../../service/NotificationService');
const AssessmentService = require('../../service/AssessmentService');
const Assessment = require('../../entities/Assessment');
const Question = require('../../entities/Question');
const Submission = require('../../entities/Submission');
const {
  AssessmentType,
  AssessmentStatus,
  QuestionType,
  SubmissionStatus
} = require('../../enums/AssessmentEnums');
const { EnrollmentStatus } = require('../../enums/ClassroomEnums');

function mutationSingle(result) {
  return {
    insert: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue(result)
  };
}
function insertSelectList(result) {
  return { insert: jest.fn().mockReturnThis(), select: jest.fn().mockResolvedValue(result) };
}
function selectEqMaybeSingle(result) {
  return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue(result) };
}
function selectEqEqEqMaybeSingle(result) {
  return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue(result) };
}
function selectEqList(result) {
  return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue(result) };
}
function selectInList(result) {
  return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue(result) };
}
function createTableRouter(queues) {
  supabase.from.mockImplementation((name) => {
    const queue = queues[name];
    if (!queue || queue.length === 0) throw new Error(`Unexpected table: ${name}`);
    return queue.shift();
  });
}

function assessmentRow(overrides = {}) {
  return {
    assessmentId: 'a-1', courseId: 'c-1', title: 'Quiz', description: null,
    assessmentType: AssessmentType.QUIZ, instructionFileUrl: null,
    startAt: '2026-08-10T08:00:00.000Z', deadline: '2026-08-10T09:00:00.000Z',
    totalPoints: 10, allowLateSubmission: false, status: AssessmentStatus.SCHEDULED,
    createdAt: '2026-08-01T00:00:00.000Z', ...overrides
  };
}

describe('AssessmentService helper unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NotificationService.notifyAssessmentChanged.mockResolvedValue({ sent: false });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('_insertQuestion()', () => {
    test('rejects missing content or invalid type', async () => {
      await expect(
        AssessmentService._insertQuestion('a-1', { content: '', type: 'UNKNOWN' })
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_QUESTION_DATA' });
    });

    test('rejects multiple-choice with fewer than two options', async () => {
      await expect(
        AssessmentService._insertQuestion('a-1', {
          content: 'Q?', type: QuestionType.MULTIPLE_CHOICE,
          options: [{ content: 'A', isCorrect: true }]
        })
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_MULTIPLE_CHOICE_OPTIONS' });
    });

    test('rejects multiple-choice without exactly one correct option', async () => {
      await expect(
        AssessmentService._insertQuestion('a-1', {
          content: 'Q?', type: QuestionType.MULTIPLE_CHOICE,
          options: [
            { content: 'A', isCorrect: true },
            { content: 'B', isCorrect: true }
          ]
        })
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_MULTIPLE_CHOICE_OPTIONS' });
    });

    test('inserts essay question without options', async () => {
      const qChain = mutationSingle({
        data: { questionId: 'q-1', assessmentId: 'a-1', content: 'Explain', type: QuestionType.ESSAY, points: 5 },
        error: null
      });
      createTableRouter({ Question: [qChain] });

      const result = await AssessmentService._insertQuestion('a-1', {
        content: 'Explain', type: QuestionType.ESSAY, points: '5'
      });
      expect(result).toBeInstanceOf(Question);
      expect(result.options).toEqual([]);
      expect(result.correctAnswer).toBeNull();
      expect(supabase.from).not.toHaveBeenCalledWith('Question_Option');
    });

    test('inserts multiple-choice options and exposes only optionId/content in returned entity', async () => {
      const qChain = mutationSingle({
        data: { questionId: 'q-1', assessmentId: 'a-1', content: '2+2?', type: QuestionType.MULTIPLE_CHOICE, points: 2 },
        error: null
      });
      const optionChain = insertSelectList({
        data: [
          { optionId: 'o-1', questionId: 'q-1', content: '3', isCorrect: false },
          { optionId: 'o-2', questionId: 'q-1', content: '4', isCorrect: true }
        ],
        error: null
      });
      createTableRouter({ Question: [qChain], Question_Option: [optionChain] });

      const result = await AssessmentService._insertQuestion('a-1', {
        content: '2+2?', type: QuestionType.MULTIPLE_CHOICE, points: 2,
        options: [
          { content: '3', isCorrect: false },
          { content: '4', isCorrect: true }
        ]
      });

      expect(result.correctAnswer).toBe('o-2');
      expect(result.options).toEqual([
        { optionId: 'o-1', content: '3' },
        { optionId: 'o-2', content: '4' }
      ]);
      expect(result.options[1]).not.toHaveProperty('isCorrect');
    });
  });

  describe('_loadQuestionsWithOptions()', () => {
    test('returns [] when no questions exist', async () => {
      createTableRouter({ Question: [selectEqList({ data: [], error: null })] });
      await expect(AssessmentService._loadQuestionsWithOptions('a-1', false)).resolves.toEqual([]);
      expect(supabase.from).not.toHaveBeenCalledWith('Question_Option');
    });

    test('hides correct answer information for learner view', async () => {
      createTableRouter({
        Question: [selectEqList({
          data: [{ questionId: 'q-1', assessmentId: 'a-1', content: 'Q?', type: QuestionType.MULTIPLE_CHOICE, points: 2 }],
          error: null
        })],
        Question_Option: [selectInList({
          data: [
            { optionId: 'o-1', questionId: 'q-1', content: 'A', isCorrect: false },
            { optionId: 'o-2', questionId: 'q-1', content: 'B', isCorrect: true }
          ],
          error: null
        })]
      });

      const [question] = await AssessmentService._loadQuestionsWithOptions('a-1', false);
      expect(question.correctAnswer).toBeNull();
      expect(question.options).toEqual([
        { optionId: 'o-1', content: 'A' },
        { optionId: 'o-2', content: 'B' }
      ]);
    });

    test('includes correct option information for internal grading', async () => {
      createTableRouter({
        Question: [selectEqList({
          data: [{ questionId: 'q-1', assessmentId: 'a-1', content: 'Q?', type: QuestionType.MULTIPLE_CHOICE, points: 2 }],
          error: null
        })],
        Question_Option: [selectInList({
          data: [
            { optionId: 'o-1', questionId: 'q-1', content: 'A', isCorrect: false },
            { optionId: 'o-2', questionId: 'q-1', content: 'B', isCorrect: true }
          ],
          error: null
        })]
      });

      const [question] = await AssessmentService._loadQuestionsWithOptions('a-1', true);
      expect(question.correctAnswer).toBe('o-2');
      expect(question.options[1]).toEqual({ optionId: 'o-2', content: 'B', isCorrect: true });
    });
  });

  describe('_findAssessmentById()', () => {
    test('returns row when found', async () => {
      const found = assessmentRow();
      createTableRouter({ Assessment: [selectEqMaybeSingle({ data: found, error: null })] });
      await expect(AssessmentService._findAssessmentById('a-1')).resolves.toBe(found);
    });

    test('returns ASSESSMENT_NOT_FOUND when missing', async () => {
      createTableRouter({ Assessment: [selectEqMaybeSingle({ data: null, error: null })] });
      await expect(AssessmentService._findAssessmentById('x')).rejects.toMatchObject({
        statusCode: 404, code: 'ASSESSMENT_NOT_FOUND'
      });
    });
  });

  describe('_assertCourseManagedBy()', () => {
    test('returns course for owner', async () => {
      createTableRouter({ Course: [selectEqMaybeSingle({ data: { courseId: 'c-1', educatorId: 'e-1' }, error: null })] });
      await expect(AssessmentService._assertCourseManagedBy('c-1', 'e-1')).resolves.toMatchObject({ courseId: 'c-1' });
    });

    test('returns COURSE_NOT_FOUND when course is missing', async () => {
      createTableRouter({ Course: [selectEqMaybeSingle({ data: null, error: null })] });
      await expect(AssessmentService._assertCourseManagedBy('x', 'e-1')).rejects.toMatchObject({
        statusCode: 404, code: 'COURSE_NOT_FOUND'
      });
    });

    test('returns COURSE_ACCESS_DENIED for another educator', async () => {
      createTableRouter({ Course: [selectEqMaybeSingle({ data: { courseId: 'c-1', educatorId: 'e-2' }, error: null })] });
      await expect(AssessmentService._assertCourseManagedBy('c-1', 'e-1')).rejects.toMatchObject({
        statusCode: 403, code: 'COURSE_ACCESS_DENIED'
      });
    });
  });

  describe('_assertLearnerEnrolled()', () => {
    test('requires an APPROVED enrollment', async () => {
      const chain = selectEqEqEqMaybeSingle({ data: { enrollmentId: 'en-1', status: EnrollmentStatus.APPROVED }, error: null });
      createTableRouter({ Enrollment: [chain] });
      await AssessmentService._assertLearnerEnrolled('c-1', 'l-1');
      expect(chain.eq).toHaveBeenNthCalledWith(1, 'courseId', 'c-1');
      expect(chain.eq).toHaveBeenNthCalledWith(2, 'learnerId', 'l-1');
      expect(chain.eq).toHaveBeenNthCalledWith(3, 'status', EnrollmentStatus.APPROVED);
    });

    test('returns COURSE_MEMBERSHIP_REQUIRED when no approved enrollment exists', async () => {
      createTableRouter({ Enrollment: [selectEqEqEqMaybeSingle({ data: null, error: null })] });
      await expect(AssessmentService._assertLearnerEnrolled('c-1', 'l-1')).rejects.toMatchObject({
        statusCode: 403, code: 'COURSE_MEMBERSHIP_REQUIRED'
      });
    });
  });

  describe('_assertOwnedSubmission()', () => {
    test('returns owned submission', async () => {
      const found = { submissionId: 's-1', learnerId: 'l-1' };
      createTableRouter({ Submission: [selectEqMaybeSingle({ data: found, error: null })] });
      await expect(AssessmentService._assertOwnedSubmission('s-1', 'l-1')).resolves.toBe(found);
    });

    test('returns SUBMISSION_NOT_FOUND when learner does not own it or it does not exist', async () => {
      createTableRouter({ Submission: [selectEqMaybeSingle({ data: null, error: null })] });
      await expect(AssessmentService._assertOwnedSubmission('s-x', 'l-1')).rejects.toMatchObject({
        statusCode: 404, code: 'SUBMISSION_NOT_FOUND'
      });
    });
  });

  describe('_validateSchedule()', () => {
    test.each([
      ['bad-date', '2026-08-10T09:00:00Z'],
      ['2026-08-10T10:00:00Z', 'bad-date'],
      ['2026-08-10T10:00:00Z', '2026-08-10T09:00:00Z'],
      ['2026-08-10T09:00:00Z', '2026-08-10T09:00:00Z']
    ])('rejects invalid schedule %s -> %s', (start, end) => {
      try {
        AssessmentService._validateSchedule(start, end);
        throw new Error('Expected _validateSchedule() to throw');
      } catch (error) {
        expect(error).toMatchObject({
          code: 'INVALID_ASSESSMENT_SCHEDULE',
          statusCode: 400
        });
      }
    });

    test('accepts deadline after start', () => {
      expect(() => AssessmentService._validateSchedule(
        '2026-08-10T08:00:00Z', '2026-08-10T09:00:00Z'
      )).not.toThrow();
    });
  });

  describe('_synchronizeAssessmentStatus()', () => {
    test('does not synchronize DRAFT or missing schedule', async () => {
      const draft = assessmentRow({ status: AssessmentStatus.DRAFT });
      await expect(AssessmentService._synchronizeAssessmentStatus(draft)).resolves.toBe(draft);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    test.each([
      ['2026-08-10T07:00:00.000Z', AssessmentStatus.SCHEDULED],
      ['2026-08-10T08:30:00.000Z', AssessmentStatus.IN_PROGRESS],
      ['2026-08-10T10:00:00.000Z', AssessmentStatus.CLOSED]
    ])('synchronizes status at %s to %s', async (now, expected) => {
      jest.useFakeTimers().setSystemTime(new Date(now));
      const current = assessmentRow({ status: AssessmentStatus.SCHEDULED });

      if (expected === AssessmentStatus.SCHEDULED) {
        await expect(AssessmentService._synchronizeAssessmentStatus(current)).resolves.toBe(current);
        expect(supabase.from).not.toHaveBeenCalled();
        return;
      }

      const updated = assessmentRow({ status: expected });
      const chain = mutationSingle({ data: updated, error: null });
      createTableRouter({ Assessment: [chain] });
      const result = await AssessmentService._synchronizeAssessmentStatus(current);
      expect(chain.update).toHaveBeenCalledWith({ status: expected });
      expect(result.status).toBe(expected);
    });
  });

  describe('_notifyCourseLearners()', () => {
    test('loads approved learner ids and calls NotificationService', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      };
      chain.eq
        .mockReturnValueOnce(chain)
        .mockResolvedValueOnce({ data: [{ learnerId: 'l-1' }, { learnerId: 'l-2' }], error: null });
      createTableRouter({ Enrollment: [chain] });
      NotificationService.notifyAssessmentChanged.mockResolvedValue({ sent: false });

      await AssessmentService._notifyCourseLearners({ courseId: 'c-1', assessmentId: 'a-1', action: 'UPDATED' });

      expect(chain.eq).toHaveBeenNthCalledWith(1, 'courseId', 'c-1');
      expect(chain.eq).toHaveBeenNthCalledWith(2, 'status', EnrollmentStatus.APPROVED);
      expect(NotificationService.notifyAssessmentChanged).toHaveBeenCalledWith({
        learnerIds: ['l-1', 'l-2'], courseId: 'c-1', assessmentId: 'a-1', action: 'UPDATED'
      });
    });
  });

  describe('_toAssessment() / _toSubmission()', () => {
    test('_toAssessment() maps database names to entity names', () => {
      const result = AssessmentService._toAssessment(assessmentRow());
      expect(result).toBeInstanceOf(Assessment);
      expect(result.type).toBe(AssessmentType.QUIZ);
      expect(result.startTime.toISOString()).toBe('2026-08-10T08:00:00.000Z');
    });

    test('_toSubmission() maps isLate and fileUrl list', () => {
      const result = AssessmentService._toSubmission({
        submissionId: 's-1', assessmentId: 'a-1', learnerId: 'l-1',
        status: SubmissionStatus.PENDING_REVIEW, startedAt: 'x', submittedAt: 'y',
        isLate: true, score: null, feedback: null
      }, [{ fileUrl: 'a.pdf' }, { fileUrl: 'b.pdf' }]);

      expect(result).toBeInstanceOf(Submission);
      expect(result.late).toBe(true);
      expect(result.uploadedFileUrls).toEqual(['a.pdf', 'b.pdf']);
    });
  });
});
