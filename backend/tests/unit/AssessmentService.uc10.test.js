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
const AssessmentAnalyticsIntegrationService = require('../../service/AssessmentAnalyticsIntegrationService');
const AssessmentService = require('../../service/AssessmentService');
const Assessment = require('../../entities/Assessment');
const Question = require('../../entities/Question');
const Submission = require('../../entities/Submission');
const SubmissionAnswer = require('../../entities/SubmissionAnswer');
const {
  AssessmentType,
  AssessmentStatus,
  QuestionType,
  SubmissionStatus
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

function selectEqMaybeSingle(result) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result)
  };
}

function selectEqList(result) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(result)
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

function assessmentRow(overrides = {}) {
  return {
    assessmentId: 'a-1',
    courseId: 'c-1',
    title: 'Quiz 1',
    description: null,
    assessmentType: AssessmentType.QUIZ,
    instructionFileUrl: null,
    startAt: '2026-08-10T08:00:00.000Z',
    deadline: '2026-08-10T09:00:00.000Z',
    totalPoints: 10,
    allowLateSubmission: false,
    status: AssessmentStatus.IN_PROGRESS,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides
  };
}

function submissionRow(overrides = {}) {
  return {
    submissionId: 's-1',
    assessmentId: 'a-1',
    learnerId: 'l-1',
    status: SubmissionStatus.IN_PROGRESS,
    startedAt: '2026-08-10T08:10:00.000Z',
    submittedAt: null,
    late: false,
    score: null,
    feedback: null,
    ...overrides
  };
}

describe('AssessmentService UC-10 unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ASSESSMENT_STORAGE_BUCKET;
    AssessmentAnalyticsIntegrationService.recordAssessmentScore.mockResolvedValue({ recorded: false });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('getOpenAssessment()', () => {
    test('rejects when the assessment is not open', async () => {
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(assessmentRow());
      jest.spyOn(AssessmentService, '_assertLearnerEnrolled').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(
        assessmentRow({ status: AssessmentStatus.SCHEDULED })
      );
      jest.spyOn(AssessmentService, '_toAssessment').mockReturnValue(
        new Assessment({
          assessmentId: 'a-1',
          courseId: 'c-1',
          title: 'Quiz',
          type: AssessmentType.QUIZ,
          status: AssessmentStatus.SCHEDULED,
          startTime: '2026-08-10T08:00:00.000Z',
          deadline: '2026-08-10T09:00:00.000Z'
        })
      );
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T07:30:00.000Z'));

      await expect(
        AssessmentService.getOpenAssessment('a-1', 'l-1')
      ).rejects.toMatchObject({ statusCode: 409, code: 'ASSESSMENT_NOT_OPEN' });
    });

    test('returns open assessment and questions without correct answers', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T08:30:00.000Z'));
      const openRow = assessmentRow();
      const questions = [new Question({ questionId: 'q-1', content: 'Q?', type: QuestionType.MULTIPLE_CHOICE })];
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(openRow);
      jest.spyOn(AssessmentService, '_assertLearnerEnrolled').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(openRow);
      jest.spyOn(AssessmentService, '_loadQuestionsWithOptions').mockResolvedValue(questions);

      const result = await AssessmentService.getOpenAssessment('a-1', 'l-1');

      expect(AssessmentService._assertLearnerEnrolled).toHaveBeenCalledWith('c-1', 'l-1');
      expect(AssessmentService._loadQuestionsWithOptions).toHaveBeenCalledWith('a-1', false);
      expect(result.assessment).toBeInstanceOf(Assessment);
      expect(result.questions).toBe(questions);
    });
  });

  describe('startSubmission()', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T08:30:00.000Z'));
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(assessmentRow());
      jest.spyOn(AssessmentService, '_assertLearnerEnrolled').mockResolvedValue({});
      jest.spyOn(AssessmentService, '_synchronizeAssessmentStatus').mockResolvedValue(assessmentRow());
    });

    test('returns the existing IN_PROGRESS submission instead of creating another', async () => {
      createTableRouter({
        Submission: [selectEqMaybeSingle({ data: submissionRow(), error: null })]
      });

      const result = await AssessmentService.startSubmission('a-1', 'l-1');
      expect(result).toBeInstanceOf(Submission);
      expect(result.submissionId).toBe('s-1');
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    test('rejects when an existing submission is already finalized', async () => {
      createTableRouter({
        Submission: [selectEqMaybeSingle({
          data: submissionRow({ status: SubmissionStatus.GRADED }),
          error: null
        })]
      });

      await expect(
        AssessmentService.startSubmission('a-1', 'l-1')
      ).rejects.toMatchObject({ statusCode: 409, code: 'ASSESSMENT_ALREADY_SUBMITTED' });
    });

    test('creates a new IN_PROGRESS submission when none exists', async () => {
      const check = selectEqMaybeSingle({ data: null, error: null });
      const saved = submissionRow();
      const insert = mutationSingle({ data: saved, error: null });
      createTableRouter({ Submission: [check, insert] });

      const result = await AssessmentService.startSubmission('a-1', 'l-1');

      expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({
        assessmentId: 'a-1',
        learnerId: 'l-1',
        status: SubmissionStatus.IN_PROGRESS,
        submittedAt: null,
        late: false,
        score: null,
        feedback: null
      }));
      expect(result).toBeInstanceOf(Submission);
    });
  });

  describe('saveAnswer()', () => {
    test('rejects changes after submission is finalized', async () => {
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(
        submissionRow({ status: SubmissionStatus.GRADED })
      );

      await expect(
        AssessmentService.saveAnswer('s-1', 'l-1', 'q-1', 'answer')
      ).rejects.toMatchObject({ statusCode: 409, code: 'SUBMISSION_NOT_EDITABLE' });
    });

    test('rejects a question that does not belong to the assessment', async () => {
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(submissionRow());
      createTableRouter({
        Question: [selectEqMaybeSingle({ data: null, error: null })]
      });

      await expect(
        AssessmentService.saveAnswer('s-1', 'l-1', 'q-x', 'answer')
      ).rejects.toMatchObject({ statusCode: 404, code: 'QUESTION_NOT_FOUND' });
    });

    test('updates an existing SubmissionAnswer', async () => {
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(submissionRow());
      const questionCheck = selectEqMaybeSingle({ data: { questionId: 'q-1', assessmentId: 'a-1' }, error: null });
      const answerCheck = selectEqMaybeSingle({ data: { answerId: 'ans-1' }, error: null });
      const update = mutationSingle({
        data: { answerId: 'ans-1', submissionId: 's-1', questionId: 'q-1', response: 'new' },
        error: null
      });
      createTableRouter({ Question: [questionCheck], SubmissionAnswer: [answerCheck, update] });

      const result = await AssessmentService.saveAnswer('s-1', 'l-1', 'q-1', 'new');
      expect(update.update).toHaveBeenCalledWith({ response: 'new' });
      expect(result).toBeInstanceOf(SubmissionAnswer);
      expect(result.response).toBe('new');
    });

    test('inserts a new SubmissionAnswer and normalizes null response to empty string', async () => {
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(submissionRow());
      const questionCheck = selectEqMaybeSingle({ data: { questionId: 'q-1', assessmentId: 'a-1' }, error: null });
      const answerCheck = selectEqMaybeSingle({ data: null, error: null });
      const insert = mutationSingle({
        data: { answerId: 'ans-1', submissionId: 's-1', questionId: 'q-1', response: '' },
        error: null
      });
      createTableRouter({ Question: [questionCheck], SubmissionAnswer: [answerCheck, insert] });

      const result = await AssessmentService.saveAnswer('s-1', 'l-1', 'q-1', null);
      expect(insert.insert).toHaveBeenCalledWith({ submissionId: 's-1', questionId: 'q-1', response: '' });
      expect(result.response).toBe('');
    });
  });

  describe('uploadFiles()', () => {
    test('rejects file changes on a finalized submission', async () => {
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(
        submissionRow({ status: SubmissionStatus.PENDING_REVIEW })
      );

      await expect(
        AssessmentService.uploadFiles('s-1', 'l-1', [{ originalname: 'x.pdf' }])
      ).rejects.toMatchObject({ statusCode: 409, code: 'SUBMISSION_NOT_EDITABLE' });
    });

    test('requires at least one file', async () => {
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(submissionRow());
      await expect(
        AssessmentService.uploadFiles('s-1', 'l-1', [])
      ).rejects.toMatchObject({ statusCode: 400, code: 'SUBMISSION_FILES_REQUIRED' });
    });

    test('requires ASSESSMENT_STORAGE_BUCKET', async () => {
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(submissionRow());
      await expect(
        AssessmentService.uploadFiles('s-1', 'l-1', [{ originalname: 'x.pdf' }])
      ).rejects.toMatchObject({ statusCode: 500, code: 'ASSESSMENT_STORAGE_NOT_CONFIGURED' });
    });

    test('uploads every file and stores Submission_File metadata', async () => {
      process.env.ASSESSMENT_STORAGE_BUCKET = 'assessment-files';
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(submissionRow());
      jest.spyOn(Date, 'now').mockReturnValue(12345);

      const upload = jest.fn().mockResolvedValue({ error: null });
      supabase.storage.from.mockReturnValue({ upload });

      const db1 = mutationSingle({
        data: { submissionFileId: 'sf-1', submissionId: 's-1', fileName: 'a.pdf', fileUrl: 'submissions/s-1/12345_a.pdf', sizeBytes: 3 },
        error: null
      });
      const db2 = mutationSingle({
        data: { submissionFileId: 'sf-2', submissionId: 's-1', fileName: 'b.txt', fileUrl: 'submissions/s-1/12345_b.txt', sizeBytes: 2 },
        error: null
      });
      createTableRouter({ Submission_File: [db1, db2] });

      const files = [
        { originalname: 'a.pdf', buffer: Buffer.from('abc'), mimetype: 'application/pdf', size: 3 },
        { originalname: 'b.txt', buffer: Buffer.from('xy'), mimetype: 'text/plain', size: 2 }
      ];

      const result = await AssessmentService.uploadFiles('s-1', 'l-1', files);
      expect(upload).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(db1.insert).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'a.pdf', sizeBytes: 3 }));
      expect(db2.insert).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'b.txt', sizeBytes: 2 }));
    });
  });

  describe('submitSubmission()', () => {
    test('rejects a submission that is already finalized', async () => {
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(
        submissionRow({ status: SubmissionStatus.GRADED })
      );

      await expect(
        AssessmentService.submitSubmission('s-1', 'l-1')
      ).rejects.toMatchObject({ statusCode: 409, code: 'SUBMISSION_ALREADY_FINALIZED' });
    });

    test('rejects submission before assessment start time', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T07:00:00.000Z'));
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(submissionRow());
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(assessmentRow());

      await expect(
        AssessmentService.submitSubmission('s-1', 'l-1')
      ).rejects.toMatchObject({ statusCode: 409, code: 'ASSESSMENT_NOT_STARTED' });
    });

    test('blocks late submission when allowLateSubmission is false', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T10:00:00.000Z'));
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(submissionRow());
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(
        assessmentRow({ allowLateSubmission: false })
      );

      await expect(
        AssessmentService.submitSubmission('s-1', 'l-1')
      ).rejects.toMatchObject({ statusCode: 409, code: 'LATE_SUBMISSION_NOT_ALLOWED' });
    });

    test('auto-grades a multiple-choice quiz with no uploaded files', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T08:45:00.000Z'));
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(submissionRow());
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(assessmentRow());
      jest.spyOn(AssessmentService, '_loadQuestionsWithOptions').mockResolvedValue([
        new Question({ questionId: 'q-1', content: 'Q1', type: QuestionType.MULTIPLE_CHOICE, correctAnswer: 'o-1', points: 4 }),
        new Question({ questionId: 'q-2', content: 'Q2', type: QuestionType.MULTIPLE_CHOICE, correctAnswer: 'o-3', points: 6 })
      ]);

      const answers = selectEqList({
        data: [
          { questionId: 'q-1', response: 'o-1' },
          { questionId: 'q-2', response: 'wrong' }
        ],
        error: null
      });
      const files = selectEqList({ data: [], error: null });
      const saved = submissionRow({
        status: SubmissionStatus.GRADED,
        submittedAt: '2026-08-10T08:45:00.000Z',
        score: 4
      });
      const update = mutationSingle({ data: saved, error: null });
      createTableRouter({ SubmissionAnswer: [answers], Submission_File: [files], Submission: [update] });

      const result = await AssessmentService.submitSubmission('s-1', 'l-1');

      expect(update.update).toHaveBeenCalledWith({
        submittedAt: '2026-08-10T08:45:00.000Z',
        late: false,
        status: SubmissionStatus.GRADED,
        score: 4
      });
      expect(AssessmentAnalyticsIntegrationService.recordAssessmentScore).toHaveBeenCalledWith({
        learnerId: 'l-1', courseId: 'c-1', assessmentId: 'a-1', score: 4
      });
      expect(result.submission.status).toBe(SubmissionStatus.GRADED);
      expect(result.submission.score).toBe(4);
    });

    test('sets PENDING_REVIEW for essay/file submission and does not call analytics yet', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T08:45:00.000Z'));
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(submissionRow());
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(
        assessmentRow({ assessmentType: AssessmentType.ASSIGNMENT })
      );
      jest.spyOn(AssessmentService, '_loadQuestionsWithOptions').mockResolvedValue([
        new Question({ questionId: 'q-1', content: 'Essay', type: QuestionType.ESSAY, points: 10 })
      ]);

      const answers = selectEqList({ data: [{ questionId: 'q-1', response: 'essay answer' }], error: null });
      const files = selectEqList({ data: [{ fileUrl: 'submissions/s-1/work.pdf' }], error: null });
      const saved = submissionRow({
        status: SubmissionStatus.PENDING_REVIEW,
        submittedAt: '2026-08-10T08:45:00.000Z',
        score: null
      });
      const update = mutationSingle({ data: saved, error: null });
      createTableRouter({ SubmissionAnswer: [answers], Submission_File: [files], Submission: [update] });

      const result = await AssessmentService.submitSubmission('s-1', 'l-1');
      expect(result.submission.status).toBe(SubmissionStatus.PENDING_REVIEW);
      expect(result.submission.uploadedFileUrls).toEqual(['submissions/s-1/work.pdf']);
      expect(AssessmentAnalyticsIntegrationService.recordAssessmentScore).not.toHaveBeenCalled();
      expect(result.analytics).toBeNull();
    });

    test('accepts late submission when configured and marks isLate true', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T10:00:00.000Z'));
      jest.spyOn(AssessmentService, '_assertOwnedSubmission').mockResolvedValue(submissionRow());
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(
        assessmentRow({ assessmentType: AssessmentType.ASSIGNMENT, allowLateSubmission: true })
      );
      jest.spyOn(AssessmentService, '_loadQuestionsWithOptions').mockResolvedValue([]);

      const answers = selectEqList({ data: [], error: null });
      const files = selectEqList({ data: [{ fileUrl: 'late.pdf' }], error: null });
      const saved = submissionRow({
        status: SubmissionStatus.PENDING_REVIEW,
        submittedAt: '2026-08-10T10:00:00.000Z',
        isLate: true
      });
      const update = mutationSingle({ data: saved, error: null });
      createTableRouter({ SubmissionAnswer: [answers], Submission_File: [files], Submission: [update] });

      const result = await AssessmentService.submitSubmission('s-1', 'l-1');
      expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ isLate: true }));
      expect(result.submission.late).toBe(true);
    });
  });

  describe('gradeSubmission()', () => {
    test('returns 404 when submission does not exist', async () => {
      createTableRouter({ Submission: [selectEqMaybeSingle({ data: null, error: null })] });
      await expect(
        AssessmentService.gradeSubmission('s-x', 'e-1', 8, 'ok')
      ).rejects.toMatchObject({ statusCode: 404, code: 'SUBMISSION_NOT_FOUND' });
    });

    test('only permits PENDING_REVIEW submissions', async () => {
      createTableRouter({
        Submission: [selectEqMaybeSingle({ data: submissionRow({ status: SubmissionStatus.GRADED }), error: null })]
      });
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(assessmentRow());
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});

      await expect(
        AssessmentService.gradeSubmission('s-1', 'e-1', 8, 'ok')
      ).rejects.toMatchObject({ statusCode: 409, code: 'SUBMISSION_NOT_PENDING_REVIEW' });
    });

    test.each([-1, 11, 'not-number'])('rejects invalid score %s', async (score) => {
      createTableRouter({
        Submission: [selectEqMaybeSingle({ data: submissionRow({ status: SubmissionStatus.PENDING_REVIEW }), error: null })]
      });
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(assessmentRow({ totalPoints: 10 }));
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});

      await expect(
        AssessmentService.gradeSubmission('s-1', 'e-1', score, 'feedback')
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_SUBMISSION_SCORE' });
    });

    test('stores manual grade and sends score to analytics', async () => {
      const review = submissionRow({ status: SubmissionStatus.PENDING_REVIEW });
      const check = selectEqMaybeSingle({ data: review, error: null });
      const saved = submissionRow({ status: SubmissionStatus.GRADED, score: 8, feedback: 'Good' });
      const update = mutationSingle({ data: saved, error: null });
      createTableRouter({ Submission: [check, update] });
      jest.spyOn(AssessmentService, '_findAssessmentById').mockResolvedValue(assessmentRow({ totalPoints: 10 }));
      jest.spyOn(AssessmentService, '_assertCourseManagedBy').mockResolvedValue({});

      const result = await AssessmentService.gradeSubmission('s-1', 'e-1', '8', 'Good');

      expect(update.update).toHaveBeenCalledWith({
        status: SubmissionStatus.GRADED,
        score: 8,
        feedback: 'Good'
      });
      expect(AssessmentAnalyticsIntegrationService.recordAssessmentScore).toHaveBeenCalledWith({
        learnerId: 'l-1', courseId: 'c-1', assessmentId: 'a-1', score: 8
      });
      expect(result.submission.status).toBe(SubmissionStatus.GRADED);
      expect(result.submission.score).toBe(8);
    });
  });
});
