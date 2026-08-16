-- ================================
-- TABLE: Course (UC-13, Classroom Management component)
-- ================================
create table "Course" (
  "courseId" uuid primary key default gen_random_uuid(),
  "educatorId" uuid not null references "User"("userId") on delete cascade,
  "subjectName" text not null,
  "courseCode" text not null,
  "description" text,
  "enrollmentCode" text not null unique,
  "status" text not null default 'ACTIVE' check ("status" in ('ACTIVE','ARCHIVED')),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index idx_course_educatorid on "Course"("educatorId");

alter table "Course" enable row level security;

create policy "Educators manage their own courses"
  on "Course" for all
  using (auth.uid() = "educatorId")
  with check (auth.uid() = "educatorId");

-- ================================
-- TABLE: TwoFactorCode (UC-12 Alt Flow 1 - Admin account deletion 2FA)
-- ================================
create table "TwoFactorCode" (
  "codeId" uuid primary key default gen_random_uuid(),
  "userId" uuid not null references "User"("userId") on delete cascade,
  "codeHash" text not null,
  "purpose" text not null,
  "targetUserId" uuid,
  "expiresAt" timestamptz not null,
  "consumedAt" timestamptz,
  "createdAt" timestamptz not null default now()
);

create index idx_twofactorcode_lookup on "TwoFactorCode"("userId", "purpose", "targetUserId");

alter table "TwoFactorCode" enable row level security;
-- No public policy needed: backend always uses the service_role key for this table.