jest.mock('../../service/AssessmentService', () => ({
  createAssessment: jest.fn(),
  getManagedAssessments: jest.fn(),
  updateAssessment: jest.fn(),
  deleteAssessment: jest.fn(),
  addQuestion: jest.fn(),
  scheduleAssessment: jest.fn(),
  publishAssessment: jest.fn(),
  uploadInstructionFile: jest.fn(),
  getOpenAssessment: jest.fn(),
  startSubmission: jest.fn(),
  saveAnswer: jest.fn(),
  uploadFiles: jest.fn(),
  submitSubmission: jest.fn(),
  gradeSubmission: jest.fn()
}));

const AssessmentController = require('../../controllers/AssessmentController');
const AssessmentService = require('../../service/AssessmentService');
const AppError = require('../../error/AppError');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function baseReq(overrides = {}) {
  return {
    params: {},
    body: {},
    user: { userId: 'user-1', role: 'LEARNER' },
    file: undefined,
    files: undefined,
    ...overrides
  };
}

describe('AssessmentController unit tests', () => {
  let consoleErrorSpy;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(() => consoleErrorSpy.mockRestore());
  beforeEach(() => jest.clearAllMocks());

  test('createAssessment() calls Service and returns 201', async () => {
    const result = { assessment: { assessmentId: 'a-1' }, questions: [{ questionId: 'q-1' }] };
    AssessmentService.createAssessment.mockResolvedValue(result);
    const req = baseReq({ params: { courseId: 'c-1' }, body: { title: 'Quiz' }, user: { userId: 'e-1' } });
    const res = mockRes();

    await AssessmentController.createAssessment(req, res);

    expect(AssessmentService.createAssessment).toHaveBeenCalledWith('c-1', 'e-1', req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Assessment created successfully.',
      assessment: result.assessment,
      questions: result.questions
    });
  });

  test('getManagedAssessments() returns 200', async () => {
    const assessments = [{ assessmentId: 'a-1' }];
    AssessmentService.getManagedAssessments.mockResolvedValue(assessments);
    const req = baseReq({ params: { courseId: 'c-1' }, user: { userId: 'e-1' } });
    const res = mockRes();
    await AssessmentController.getManagedAssessments(req, res);
    expect(AssessmentService.getManagedAssessments).toHaveBeenCalledWith('c-1', 'e-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ assessments });
  });

  test('updateAssessment() returns updated assessment', async () => {
    const assessment = { assessmentId: 'a-1', title: 'New' };
    AssessmentService.updateAssessment.mockResolvedValue(assessment);
    const req = baseReq({ params: { assessmentId: 'a-1' }, body: { title: 'New' }, user: { userId: 'e-1' } });
    const res = mockRes();
    await AssessmentController.updateAssessment(req, res);
    expect(AssessmentService.updateAssessment).toHaveBeenCalledWith('a-1', 'e-1', req.body);
    expect(res.json).toHaveBeenCalledWith({ message: 'Assessment updated successfully.', assessment });
  });

  test('deleteAssessment() returns success message', async () => {
    AssessmentService.deleteAssessment.mockResolvedValue(undefined);
    const req = baseReq({ params: { assessmentId: 'a-1' }, user: { userId: 'e-1' } });
    const res = mockRes();
    await AssessmentController.deleteAssessment(req, res);
    expect(AssessmentService.deleteAssessment).toHaveBeenCalledWith('a-1', 'e-1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Assessment deleted successfully.' });
  });

  test('addQuestion() returns 201', async () => {
    const question = { questionId: 'q-1' };
    AssessmentService.addQuestion.mockResolvedValue(question);
    const req = baseReq({ params: { assessmentId: 'a-1' }, body: { content: 'Q?' }, user: { userId: 'e-1' } });
    const res = mockRes();
    await AssessmentController.addQuestion(req, res);
    expect(AssessmentService.addQuestion).toHaveBeenCalledWith('a-1', 'e-1', req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Question added successfully.', question });
  });

  test('scheduleAssessment() forwards startTime and deadline', async () => {
    const assessment = { assessmentId: 'a-1', status: 'SCHEDULED' };
    AssessmentService.scheduleAssessment.mockResolvedValue(assessment);
    const req = baseReq({
      params: { assessmentId: 'a-1' },
      body: { startTime: 'start', deadline: 'end' },
      user: { userId: 'e-1' }
    });
    const res = mockRes();
    await AssessmentController.scheduleAssessment(req, res);
    expect(AssessmentService.scheduleAssessment).toHaveBeenCalledWith('a-1', 'e-1', 'start', 'end');
    expect(res.json).toHaveBeenCalledWith({ message: 'Assessment schedule updated successfully.', assessment });
  });

  test('publishAssessment() returns published assessment', async () => {
    const assessment = { assessmentId: 'a-1', status: 'SCHEDULED' };
    AssessmentService.publishAssessment.mockResolvedValue(assessment);
    const req = baseReq({ params: { assessmentId: 'a-1' }, user: { userId: 'e-1' } });
    const res = mockRes();
    await AssessmentController.publishAssessment(req, res);
    expect(AssessmentService.publishAssessment).toHaveBeenCalledWith('a-1', 'e-1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Assessment published successfully.', assessment });
  });

  test('uploadInstructionFile() returns only assessmentId and instructionFileUrl', async () => {
    const assessment = { assessmentId: 'a-1', instructionFileUrl: 'instructions/a-1/file.pdf', extra: 'hidden' };
    AssessmentService.uploadInstructionFile.mockResolvedValue(assessment);
    const file = { originalname: 'file.pdf' };
    const req = baseReq({ params: { assessmentId: 'a-1' }, user: { userId: 'e-1' }, file });
    const res = mockRes();
    await AssessmentController.uploadInstructionFile(req, res);
    expect(AssessmentService.uploadInstructionFile).toHaveBeenCalledWith('a-1', 'e-1', file);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Assessment file uploaded successfully.',
      assessmentId: 'a-1',
      instructionFileUrl: 'instructions/a-1/file.pdf'
    });
  });

  test('getOpenAssessment() returns Service result', async () => {
    const result = { assessment: { assessmentId: 'a-1' }, questions: [] };
    AssessmentService.getOpenAssessment.mockResolvedValue(result);
    const req = baseReq({ params: { assessmentId: 'a-1' }, user: { userId: 'l-1' } });
    const res = mockRes();
    await AssessmentController.getOpenAssessment(req, res);
    expect(AssessmentService.getOpenAssessment).toHaveBeenCalledWith('a-1', 'l-1');
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test('startSubmission() returns 201', async () => {
    const submission = { submissionId: 's-1', status: 'IN_PROGRESS' };
    AssessmentService.startSubmission.mockResolvedValue(submission);
    const req = baseReq({ params: { assessmentId: 'a-1' }, user: { userId: 'l-1' } });
    const res = mockRes();
    await AssessmentController.startSubmission(req, res);
    expect(AssessmentService.startSubmission).toHaveBeenCalledWith('a-1', 'l-1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Assessment attempt started.', submission });
  });

  test('saveAnswer() forwards response', async () => {
    const answer = { answerId: 'ans-1', response: 'o-2' };
    AssessmentService.saveAnswer.mockResolvedValue(answer);
    const req = baseReq({
      params: { submissionId: 's-1', questionId: 'q-1' },
      body: { response: 'o-2' }, user: { userId: 'l-1' }
    });
    const res = mockRes();
    await AssessmentController.saveAnswer(req, res);
    expect(AssessmentService.saveAnswer).toHaveBeenCalledWith('s-1', 'l-1', 'q-1', 'o-2');
    expect(res.json).toHaveBeenCalledWith({ message: 'Answer saved.', answer });
  });

  test('uploadSubmissionFiles() filters file response', async () => {
    const files = [
      { submissionFileId: 'sf-1', fileName: 'a.pdf', fileUrl: 'secret-path-a' },
      { submissionFileId: 'sf-2', fileName: 'b.pdf', fileUrl: 'secret-path-b' }
    ];
    AssessmentService.uploadFiles.mockResolvedValue(files);
    const reqFiles = [{ originalname: 'a.pdf' }];
    const req = baseReq({ params: { submissionId: 's-1' }, user: { userId: 'l-1' }, files: reqFiles });
    const res = mockRes();
    await AssessmentController.uploadSubmissionFiles(req, res);
    expect(AssessmentService.uploadFiles).toHaveBeenCalledWith('s-1', 'l-1', reqFiles);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Submission files uploaded successfully.',
      files: [
        { submissionFileId: 'sf-1', fileName: 'a.pdf' },
        { submissionFileId: 'sf-2', fileName: 'b.pdf' }
      ]
    });
  });

  test.each([
    ['GRADED', 'Assessment submitted and graded successfully.'],
    ['PENDING_REVIEW', 'Assessment submitted and is pending review.']
  ])('submitSubmission() returns correct message for %s', async (status, message) => {
    AssessmentService.submitSubmission.mockResolvedValue({
      submission: {
        submissionId: 's-1', status, submittedAt: 'time', late: false, score: status === 'GRADED' ? 8 : null,
        internal: 'hidden'
      },
      analytics: { internal: true }
    });
    const req = baseReq({ params: { submissionId: 's-1' }, user: { userId: 'l-1' } });
    const res = mockRes();
    await AssessmentController.submitSubmission(req, res);
    expect(res.json).toHaveBeenCalledWith({
      message,
      submission: {
        submissionId: 's-1', status, submittedAt: 'time', late: false,
        score: status === 'GRADED' ? 8 : null
      }
    });
  });

  test('gradeSubmission() filters analytics/internal fields from response', async () => {
    AssessmentService.gradeSubmission.mockResolvedValue({
      submission: { submissionId: 's-1', status: 'GRADED', score: 9, feedback: 'Good', learnerId: 'l-1' },
      analytics: { recorded: false }
    });
    const req = baseReq({ params: { submissionId: 's-1' }, body: { score: 9, feedback: 'Good' }, user: { userId: 'e-1' } });
    const res = mockRes();
    await AssessmentController.gradeSubmission(req, res);
    expect(AssessmentService.gradeSubmission).toHaveBeenCalledWith('s-1', 'e-1', 9, 'Good');
    expect(res.json).toHaveBeenCalledWith({
      message: 'Submission graded successfully.',
      submission: { submissionId: 's-1', status: 'GRADED', score: 9, feedback: 'Good' }
    });
  });

  test.each([
    ['createAssessment', () => baseReq({ params: { courseId: 'c-1' }, user: { userId: 'e-1' } })],
    ['getManagedAssessments', () => baseReq({ params: { courseId: 'c-1' }, user: { userId: 'e-1' } })],
    ['updateAssessment', () => baseReq({ params: { assessmentId: 'a-1' }, user: { userId: 'e-1' } })],
    ['deleteAssessment', () => baseReq({ params: { assessmentId: 'a-1' }, user: { userId: 'e-1' } })],
    ['addQuestion', () => baseReq({ params: { assessmentId: 'a-1' }, user: { userId: 'e-1' } })],
    ['scheduleAssessment', () => baseReq({ params: { assessmentId: 'a-1' }, user: { userId: 'e-1' } })],
    ['publishAssessment', () => baseReq({ params: { assessmentId: 'a-1' }, user: { userId: 'e-1' } })],
    ['uploadInstructionFile', () => baseReq({ params: { assessmentId: 'a-1' }, user: { userId: 'e-1' } })],
    ['getOpenAssessment', () => baseReq({ params: { assessmentId: 'a-1' }, user: { userId: 'l-1' } })],
    ['startSubmission', () => baseReq({ params: { assessmentId: 'a-1' }, user: { userId: 'l-1' } })],
    ['saveAnswer', () => baseReq({ params: { submissionId: 's-1', questionId: 'q-1' }, user: { userId: 'l-1' } })],
    ['uploadSubmissionFiles', () => baseReq({ params: { submissionId: 's-1' }, user: { userId: 'l-1' } })],
    ['submitSubmission', () => baseReq({ params: { submissionId: 's-1' }, user: { userId: 'l-1' } })],
    ['gradeSubmission', () => baseReq({ params: { submissionId: 's-1' }, user: { userId: 'e-1' } })]
  ])('%s() converts AppError to its HTTP status/code', async (controllerMethod, reqFactory) => {
    const serviceName = controllerMethod === 'uploadSubmissionFiles' ? 'uploadFiles' : controllerMethod;
    AssessmentService[serviceName].mockRejectedValue(new AppError(409, 'TEST_APP_ERROR', 'Test error'));
    const res = mockRes();
    await AssessmentController[controllerMethod](reqFactory(), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ code: 'TEST_APP_ERROR', message: 'Test error' });
  });

  test('unexpected Service error becomes generic 500', async () => {
    AssessmentService.createAssessment.mockRejectedValue(new Error('DB secret'));
    const req = baseReq({ params: { courseId: 'c-1' }, user: { userId: 'e-1' } });
    const res = mockRes();
    await AssessmentController.createAssessment(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.'
    });
  });
});
