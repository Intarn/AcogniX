CREATE UNIQUE INDEX IF NOT EXISTS "SubmissionAnswer_submission_question_unique"
  ON public."SubmissionAnswer" ("submissionId", "questionId");
