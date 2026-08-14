DROP TABLE IF EXISTS public."TwoFactorCode" CASCADE;
DROP TABLE IF EXISTS public."Course" CASCADE;
DROP TABLE IF EXISTS public."User" CASCADE;
CREATE TABLE public."User" (
  "userId" uuid references auth.users not null primary key,
  "email" text not null unique,
  "displayName" text not null,
  "avatarUrl" text,
  "role" text not null check ("role" in ('LEARNER', 'EDUCATOR', 'SYSTEM_ADMINISTRATOR')),
  "status" text not null default 'ACTIVE' check ("status" in ('ACTIVE', 'BANNED')),
  "createdAt" timestamp with time zone default timezone('utc'::text, now()) not null,
  "updatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

-- Cho phép tất cả mọi người được đọc/ghi vào bảng này (Tạm thời để test backend dễ dàng)
CREATE POLICY "Allow all operations for backend" ON public."User"
  FOR ALL USING (true);

