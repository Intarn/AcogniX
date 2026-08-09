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

describe('Assessment domain entities', () => {
  describe('Assessment', () => {
    test('constructor maps values and applies defaults', () => {
      const assessment = new Assessment({
        assessmentId: 'a-1',
        courseId: 'c-1',
        title: 'Quiz 1',
        type: AssessmentType.QUIZ,
        totalPoints: '10',
        allowLateSubmission: 1
      });

      expect(assessment).toMatchObject({
        assessmentId: 'a-1',
        courseId: 'c-1',
        title: 'Quiz 1',
        description: null,
        type: AssessmentType.QUIZ,
        instructionFileUrl: null,
        totalPoints: 10,
        allowLateSubmission: true,
        status: AssessmentStatus.DRAFT
      });
      expect(assessment.startTime).toBeNull();
      expect(assessment.deadline).toBeNull();
    });

    test('updateDetails() updates title and description', () => {
      const assessment = new Assessment({ title: 'Old', type: AssessmentType.QUIZ });
      assessment.updateDetails('New', 'Updated description');
      expect(assessment.title).toBe('New');
      expect(assessment.description).toBe('Updated description');
    });

    test('configureSchedule() converts inputs to Date objects', () => {
      const assessment = new Assessment({ title: 'Quiz', type: AssessmentType.QUIZ });
      assessment.configureSchedule('2026-08-10T08:00:00.000Z', '2026-08-10T09:00:00.000Z');
      expect(assessment.startTime).toBeInstanceOf(Date);
      expect(assessment.deadline).toBeInstanceOf(Date);
    });

    test.each([
      {
        name: 'sets SCHEDULED before start time',
        now: '2026-08-10T07:00:00.000Z',
        expected: AssessmentStatus.SCHEDULED
      },
      {
        name: 'sets IN_PROGRESS between start and deadline',
        now: '2026-08-10T08:30:00.000Z',
        expected: AssessmentStatus.IN_PROGRESS
      },
      {
        name: 'sets CLOSED after deadline',
        now: '2026-08-10T10:00:00.000Z',
        expected: AssessmentStatus.CLOSED
      }
    ])('publish() $name', ({ now, expected }) => {
      const assessment = new Assessment({
        title: 'Quiz',
        type: AssessmentType.QUIZ,
        startTime: '2026-08-10T08:00:00.000Z',
        deadline: '2026-08-10T09:00:00.000Z'
      });
      assessment.publish(new Date(now));
      expect(assessment.status).toBe(expected);
    });

    test('publish() throws when schedule is missing', () => {
      const assessment = new Assessment({ title: 'Quiz', type: AssessmentType.QUIZ });
      expect(() => assessment.publish()).toThrow('ASSESSMENT_SCHEDULE_REQUIRED');
    });

    test('close() sets CLOSED', () => {
      const assessment = new Assessment({ title: 'Quiz', type: AssessmentType.QUIZ });
      assessment.close();
      expect(assessment.status).toBe(AssessmentStatus.CLOSED);
    });

    test('isOpen() returns false when schedule is missing', () => {
      const assessment = new Assessment({ title: 'Quiz', type: AssessmentType.QUIZ });
      expect(assessment.isOpen(new Date('2026-08-10T08:30:00.000Z'))).toBe(false);
    });

    test('isOpen() returns false for DRAFT even inside schedule', () => {
      const assessment = new Assessment({
        title: 'Quiz',
        type: AssessmentType.QUIZ,
        status: AssessmentStatus.DRAFT,
        startTime: '2026-08-10T08:00:00.000Z',
        deadline: '2026-08-10T09:00:00.000Z'
      });
      expect(assessment.isOpen(new Date('2026-08-10T08:30:00.000Z'))).toBe(false);
    });

    test('isOpen() returns true for an active scheduled window', () => {
      const assessment = new Assessment({
        title: 'Quiz',
        type: AssessmentType.QUIZ,
        status: AssessmentStatus.IN_PROGRESS,
        startTime: '2026-08-10T08:00:00.000Z',
        deadline: '2026-08-10T09:00:00.000Z'
      });
      expect(assessment.isOpen(new Date('2026-08-10T08:30:00.000Z'))).toBe(true);
    });

    test.each([
      [AssessmentStatus.DRAFT, '2026-08-10T07:00:00.000Z', true],
      [AssessmentStatus.SCHEDULED, '2026-08-10T07:00:00.000Z', true],
      [AssessmentStatus.IN_PROGRESS, '2026-08-10T08:30:00.000Z', false],
      [AssessmentStatus.CLOSED, '2026-08-10T10:00:00.000Z', false]
    ])('isEditable() for %s returns %s', (status, now, expected) => {
      const assessment = new Assessment({
        title: 'Quiz',
        type: AssessmentType.QUIZ,
        status,
        startTime: '2026-08-10T08:00:00.000Z',
        deadline: '2026-08-10T09:00:00.000Z'
      });
      expect(assessment.isEditable(new Date(now))).toBe(expected);
    });
  });

  describe('Question', () => {
    test('constructor and updateContent() normalize points', () => {
      const question = new Question({
        questionId: 'q-1',
        assessmentId: 'a-1',
        content: 'Old?',
        type: QuestionType.ESSAY,
        points: '2'
      });
      expect(question.points).toBe(2);
      question.updateContent('New?', '5');
      expect(question.content).toBe('New?');
      expect(question.points).toBe(5);
    });

    test('isAutoGradable() is true only for MULTIPLE_CHOICE', () => {
      expect(new Question({ content: 'Q', type: QuestionType.MULTIPLE_CHOICE }).isAutoGradable()).toBe(true);
      expect(new Question({ content: 'Q', type: QuestionType.ESSAY }).isAutoGradable()).toBe(false);
    });

    test('grade() awards full points for correct multiple-choice answer', () => {
      const question = new Question({
        content: 'Q',
        type: QuestionType.MULTIPLE_CHOICE,
        correctAnswer: 'opt-2',
        points: 4
      });
      expect(question.grade('opt-2')).toBe(4);
      expect(question.grade('opt-1')).toBe(0);
    });

    test('grade() returns null for essay questions', () => {
      const question = new Question({ content: 'Explain', type: QuestionType.ESSAY, points: 5 });
      expect(question.grade('answer')).toBeNull();
    });
  });

  describe('Submission', () => {
    test('constructor applies defaults', () => {
      const submission = new Submission({ submissionId: 's-1', assessmentId: 'a-1', learnerId: 'l-1' });
      expect(submission.status).toBe(SubmissionStatus.IN_PROGRESS);
      expect(submission.late).toBe(false);
      expect(submission.score).toBeNull();
      expect(submission.uploadedFileUrls).toEqual([]);
    });

    test('addFile() appends a URL', () => {
      const submission = new Submission({});
      submission.addFile('file-1.pdf');
      expect(submission.uploadedFileUrls).toEqual(['file-1.pdf']);
    });

    test('submit() records timestamp and status', () => {
      const submission = new Submission({});
      const time = new Date('2026-08-10T09:00:00.000Z');
      submission.submit(time);
      expect(submission.submittedAt).toBe(time);
      expect(submission.status).toBe(SubmissionStatus.SUBMITTED);
    });

    test('markLate() sets late to true', () => {
      const submission = new Submission({});
      submission.markLate();
      expect(submission.late).toBe(true);
    });

    test('markPendingReview() changes status', () => {
      const submission = new Submission({});
      submission.markPendingReview();
      expect(submission.status).toBe(SubmissionStatus.PENDING_REVIEW);
    });

    test('recordScore() records score, feedback and GRADED status', () => {
      const submission = new Submission({});
      submission.recordScore('8.5', 'Good work');
      expect(submission.score).toBe(8.5);
      expect(submission.feedback).toBe('Good work');
      expect(submission.status).toBe(SubmissionStatus.GRADED);
    });
  });

  describe('SubmissionAnswer', () => {
    test('updateResponse() changes response', () => {
      const answer = new SubmissionAnswer({ answerId: 'ans-1', response: 'old' });
      answer.updateResponse('new');
      expect(answer.response).toBe('new');
    });

    test('recordPoints() stores a numeric value', () => {
      const answer = new SubmissionAnswer({ answerId: 'ans-1', response: 'x' });
      answer.recordPoints('3');
      expect(answer.awardedPoints).toBe(3);
    });
  });

  test('Assessment enums are frozen and contain the expected values', () => {
    expect(Object.isFrozen(AssessmentType)).toBe(true);
    expect(Object.isFrozen(AssessmentStatus)).toBe(true);
    expect(Object.isFrozen(QuestionType)).toBe(true);
    expect(Object.isFrozen(SubmissionStatus)).toBe(true);
    expect(AssessmentType).toEqual({ QUIZ: 'QUIZ', ASSIGNMENT: 'ASSIGNMENT' });
  });
});
