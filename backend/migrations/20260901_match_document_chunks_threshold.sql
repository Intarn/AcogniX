-- UC02/UC06/UC07: strict-context semantic retrieval.
-- pgvector on this Supabase project is installed in public schema.

create or replace function public.match_document_chunks(
  query_embedding public.vector(768),
  material_ids uuid[],
  match_count integer default 8,
  match_threshold double precision default 0.35
)
returns table (
  "chunkId" uuid,
  "documentId" uuid,
  "materialId" uuid,
  "chunkIndex" integer,
  content text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    dc."chunkId",
    dc."documentId",
    pd."materialId",
    dc."chunkIndex",
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public."Document_Chunk" dc
  join public."Processed_Document" pd
    on pd."documentId" = dc."documentId"
  where pd."materialId" = any(material_ids)
    and pd.status = 'COMPLETED'
    and 1 - (dc.embedding <=> query_embedding) >= match_threshold
  order by dc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

revoke all on function public.match_document_chunks(
  public.vector,
  uuid[],
  integer,
  double precision
) from public;

grant execute on function public.match_document_chunks(
  public.vector,
  uuid[],
  integer,
  double precision
) to service_role;