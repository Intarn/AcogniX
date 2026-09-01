-- UC05/UC16: keep Storage identity separately from presentation URLs.
-- Existing resourceUrl/fileType columns stay in place for backward compatibility.

alter table public."CourseMaterial"
  add column if not exists "originalFileName" text,
  add column if not exists "storageBucket" text,
  add column if not exists "storagePath" text,
  add column if not exists "mimeType" text;

create index if not exists "CourseMaterial_storage_locator_idx"
  on public."CourseMaterial" ("storageBucket", "storagePath")
  where "storagePath" is not null;
