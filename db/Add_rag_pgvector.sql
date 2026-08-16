drop table if exists "Document_Chunk";

create table "Document_Chunk" (
    "chunkId" uuid primary key default gen_random_uuid(),
    "documentId" uuid not null references "Processed_Document"("documentId") on delete cascade,
    "chunkIndex" integer not null,
    "content" text not null,
    "embedding" vector(768),
    "createdAt" timestamptz not null default now()
);
create index "idx_document_chunk_documentId" on "Document_Chunk" ("documentId");

create index "idx_document_chunk_embedding"
    on "Document_Chunk"
    using hnsw ("embedding" vector_cosine_ops);

NOTIFY pgrst, 'reload schema';