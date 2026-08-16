DROP TABLE IF EXISTS public."UserSession" CASCADE;
DROP TABLE IF EXISTS public."Enrollment" CASCADE;
DROP TABLE IF EXISTS public."CourseMaterial" CASCADE;
DROP TABLE IF EXISTS public."Announcement" CASCADE;
DROP TABLE IF EXISTS public."AI_Workspace" CASCADE;
DROP TABLE IF EXISTS public."AI_Project" CASCADE;
DROP TABLE IF EXISTS public."Learning_Material" CASCADE;
DROP TABLE IF EXISTS public."PersonalNote" CASCADE;

CREATE TABLE public."UserSession" (
  "sessionId" uuid primary key default gen_random_uuid(),
  "userId" uuid not null references public."User"("userId") on delete cascade,
  "tokenHash" text not null,
  "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null,
  "revokedAt" timestamptz
);
CREATE INDEX idx_usersession_token on public."UserSession"("tokenHash");

CREATE TABLE public."Enrollment" (
  "enrollmentId" uuid primary key default gen_random_uuid(),
  "courseId" uuid not null references public."Course"("courseId") on delete cascade,
  "learnerId" uuid not null references public."User"("userId") on delete cascade,
  "status" text not null default 'PENDING' check ("status" in ('PENDING', 'APPROVED', 'REJECTED', 'REMOVED')),
  "requestedAt" timestamptz not null default now(),
  "approvedAt" timestamptz,
  "rejectedAt" timestamptz,
  "removedAt" timestamptz,
  unique("courseId", "learnerId") 
);


CREATE TABLE public."CourseMaterial" (
  "materialId" uuid primary key default gen_random_uuid(),
  "courseId" uuid not null references public."Course"("courseId") on delete cascade,
  "title" text not null,
  "description" text,
  "resourceType" text not null check ("resourceType" in ('FILE', 'LINK')),
  "resourceUrl" text,
  "fileType" text,
  "sizeBytes" bigint,
  "available" boolean not null default true,
  "uploadedAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

CREATE TABLE public."Announcement" (
  "announcementId" uuid primary key default gen_random_uuid(),
  "courseId" uuid not null references public."Course"("courseId") on delete cascade,
  "title" text not null,
  "body" text not null,
  "attachmentUrls" text[], -- Use array to store list of attached file links
  "createdAt" timestamptz not null default now(),
  "publishedAt" timestamptz not null default now()
);

CREATE TABLE public."AI_Workspace" (
  "workspaceId" uuid primary key default gen_random_uuid(),
  "learnerId" uuid not null references public."User"("userId") on delete cascade unique,
  "storageUsedBytes" bigint not null default 0,
  "storageLimitBytes" bigint not null default 524288000, -- Example: 500MB
  "createdAt" timestamptz not null default now()
);

CREATE TABLE public."AI_Project" (
  "projectId" uuid primary key default gen_random_uuid(),
  "workspaceId" uuid not null references public."AI_Workspace"("workspaceId") on delete cascade,
  "courseId" uuid references public."Course"("courseId") on delete set null,
  "name" text not null,
  "type" text not null check ("type" in ('CLASS', 'PERSONAL')),
  "status" text not null default 'ACTIVE',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique("workspaceId", "name") -- Project names must be unique within the same workspace
);

CREATE TABLE public."Learning_Material" (
  "materialId" uuid primary key default gen_random_uuid(),
  "projectId" uuid not null references public."AI_Project"("projectId") on delete cascade,
  "title" text not null,
  "sourceUrl" text not null,
  "sourceType" text not null check ("sourceType" in ('COURSE', 'PERSONAL')),
  "fileType" text,
  "sizeBytes" bigint,
  "selectedAsContext" boolean not null default false,
  "addedAt" timestamptz not null default now()
);

CREATE TABLE public."PersonalNote" (
  "noteId" uuid primary key default gen_random_uuid(),
  "projectId" uuid not null references public."AI_Project"("projectId") on delete cascade,
  "title" text,
  "content" text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public."Conversation" (
  "conversationId" uuid primary key default gen_random_uuid(),
  "projectId" uuid not null references public."AI_Project"("projectId") on delete cascade,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public."Chat_Message" (
  "messageId" uuid primary key default gen_random_uuid(),
  "conversationId" uuid not null references public."Conversation"("conversationId") on delete cascade,
  "senderRole" text not null,
  "content" text not null,
  "createdAt" timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public."Assessment" (
  "assessmentId" uuid primary key default gen_random_uuid(),
  "courseId" uuid not null references public."Course"("courseId") on delete cascade,
  "title" text not null,
  "description" text,
  "type" text not null,
  "instructionFileUrl" text,
  "startTime" timestamptz,
  "deadline" timestamptz,
  "totalPoints" double precision default 0,
  "allowLateSubmission" boolean default false,
  "status" text not null default 'DRAFT',
  "createdAt" timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public."Question" (
  "questionId" uuid primary key default gen_random_uuid(),
  "assessmentId" uuid not null references public."Assessment"("assessmentId") on delete cascade,
  "content" text not null,
  "type" text not null,
  "options" text[], 
  "correctAnswer" text,
  "points" double precision not null default 1,
  "displayOrder" integer not null default 0
);

CREATE TABLE IF NOT EXISTS public."Submission" (
  "submissionId" uuid primary key default gen_random_uuid(),
  "assessmentId" uuid not null references public."Assessment"("assessmentId") on delete cascade,
  "learnerId" uuid not null references public."User"("userId") on delete cascade,
  "status" text not null default 'IN_PROGRESS',
  "startedAt" timestamptz not null default now(),
  "submittedAt" timestamptz,
  "late" boolean default false,
  "score" double precision,
  "feedback" text,
  "uploadedFileUrls" text[], 
  unique("assessmentId", "learnerId") 
);

CREATE TABLE IF NOT EXISTS public."SubmissionAnswer" (
  "answerId" uuid primary key default gen_random_uuid(),
  "submissionId" uuid not null references public."Submission"("submissionId") on delete cascade,
  "questionId" uuid not null references public."Question"("questionId") on delete cascade,
  "response" text not null,
  "awardedPoints" double precision
);

ALTER TABLE public."User" 
DROP CONSTRAINT IF EXISTS "User_userId_fkey";

ALTER TABLE public."User"
ADD CONSTRAINT "User_userId_fkey"
FOREIGN KEY ("userId") 
REFERENCES auth.users(id) 
ON DELETE CASCADE;