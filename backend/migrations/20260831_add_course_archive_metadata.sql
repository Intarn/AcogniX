-- Run once in Supabase SQL Editor before using the new Archive/Restore flow.
ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "archivedByRole" TEXT NULL,
  ADD COLUMN IF NOT EXISTS "archivedByUserId" UUID NULL,
  ADD COLUMN IF NOT EXISTS "archiveReason" TEXT NULL,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ NULL;

-- Optional integrity check for new writes. Existing rows with NULL remain valid.
ALTER TABLE "Course"
  DROP CONSTRAINT IF EXISTS course_archived_by_role_check;

ALTER TABLE "Course"
  ADD CONSTRAINT course_archived_by_role_check
  CHECK ("archivedByRole" IS NULL OR "archivedByRole" IN ('EDUCATOR', 'SYSTEM_ADMINISTRATOR'));
