-- UC11: persist in-app notifications as independent rows instead of one
-- read/modify/write JSON blob in System_Settings.

create table if not exists public."Notification" (
  "notificationId" uuid primary key default gen_random_uuid(),
  "recipientId" uuid not null,
  "type" text not null,
  "sourceId" text not null,
  "courseId" uuid,
  "title" text not null,
  "message" text,
  "targetUrl" text,
  "createdAt" timestamptz not null default now(),
  "readAt" timestamptz,
  constraint "Notification_recipient_fk"
    foreign key ("recipientId") references public."User"("userId") on delete cascade,
  constraint "Notification_course_fk"
    foreign key ("courseId") references public."Course"("courseId") on delete cascade,
  constraint "Notification_recipient_type_source_key"
    unique ("recipientId", "type", "sourceId")
);

create index if not exists "Notification_recipient_created_idx"
  on public."Notification" ("recipientId", "createdAt" desc);

create index if not exists "Notification_recipient_unread_idx"
  on public."Notification" ("recipientId", "readAt");

alter table public."Notification" enable row level security;

-- The Node backend uses the service role and remains the authorization boundary.
-- Browser clients do not access this table directly.
revoke all on table public."Notification" from anon, authenticated;
grant select, insert, update, delete on table public."Notification" to service_role;
