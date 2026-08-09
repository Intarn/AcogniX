const AssessmentType = Object.freeze({
  QUIZ: 'QUIZ',
  ASSIGNMENT: 'ASSIGNMENT'
});

const AssessmentStatus = Object.freeze({
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  CLOSED: 'CLOSED'
});

const QuestionType = Object.freeze({
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  ESSAY: 'ESSAY'
});

const SubmissionStatus = Object.freeze({
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  GRADED: 'GRADED'
});

module.exports = {
  AssessmentType,
  AssessmentStatus,
  QuestionType,
  SubmissionStatus
};