create or replace function match_document_chunks(
    query_embedding vector(768),
    material_ids uuid[],
    match_count int default 5
)
returns table (
    "chunkId" uuid,
    "documentId" uuid,
    "content" text,
    similarity float
)
language sql stable
as $$
    select
        dc."chunkId",
        dc."documentId",
        dc."content",
        1 - (dc."embedding" <=> query_embedding) as similarity
    from "Document_Chunk" dc
    join "Processed_Document" pd on pd."documentId" = dc."documentId"
    where pd."materialId" = any(material_ids)
    order by dc."embedding" <=> query_embedding
    limit match_count;
$$;