alter table "Conversation" drop column if exists "messages";
alter table "Conversation" drop column if exists "updatedAt";
alter table "Conversation" add column if not exists "title" text;

create table if not exists "Processed_Document" (
    "documentId" uuid primary key default gen_random_uuid(),
    "materialId" uuid not null references "Learning_Material"("materialId") on delete cascade,
    "extractedText" text,
    "status" text not null default 'PENDING', -- PENDING | PROCESSING | COMPLETED | FAILED
    "errorMessage" text,
    "processedAt" timestamptz
);
create index if not exists "idx_processed_document_materialId" on "Processed_Document" ("materialId");

drop table if exists "Quiz";

create table if not exists "Practice_Quiz" (
    "quizId" uuid primary key default gen_random_uuid(),
    "projectId" uuid not null references "AI_Project"("projectId") on delete cascade,
    "title" text,
    "questionCount" integer not null,
    "difficultyLevel" text not null default 'medium',
    "score" double precision,
    "generatedAt" timestamptz not null default now(),
    "completedAt" timestamptz
);
create index if not exists "idx_practice_quiz_projectId" on "Practice_Quiz" ("projectId");

create table if not exists "Practice_Question" (
    "practiceQuestionId" uuid primary key default gen_random_uuid(),
    "quizId" uuid not null references "Practice_Quiz"("quizId") on delete cascade,
    "content" text not null,
    "optionsJson" text not null, -- JSON-encoded array of option strings
    "correctAnswer" text not null
);
create index if not exists "idx_practice_question_quizId" on "Practice_Question" ("quizId");

drop table if exists "Flashcard";

create table if not exists "Flashcard_Set" (
    "flashcardSetId" uuid primary key default gen_random_uuid(),
    "projectId" uuid not null references "AI_Project"("projectId") on delete cascade,
    "title" text,
    "generatedAt" timestamptz not null default now()
);
create index if not exists "idx_flashcard_set_projectId" on "Flashcard_Set" ("projectId");

create table if not exists "Flashcard" (
    "flashcardId" uuid primary key default gen_random_uuid(),
    "flashcardSetId" uuid not null references "Flashcard_Set"("flashcardSetId") on delete cascade,
    "frontContent" text not null,
    "backContent" text not null,
    "position" integer not null default 0
);
create index if not exists "idx_flashcard_flashcardSetId" on "Flashcard" ("flashcardSetId");

NOTIFY pgrst, 'reload schema';