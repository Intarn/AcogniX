-- UC10: one logical Submission per Learner per Assessment.
-- If this migration reports duplicate rows, resolve the data inconsistency first;
-- do not silently delete a Learner's Submission history.

create unique index if not exists "Submission_assessment_learner_unique"
  on public."Submission" ("assessmentId", "learnerId");
