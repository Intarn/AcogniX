import re

from db import supabase
from services.chunking_service import split_into_chunks
from services.embedding_service import embed_query, EmbeddingQuotaExceeded

DEFAULT_TOP_K = 8
DEFAULT_MATCH_THRESHOLD = 0.35
SMALL_CONTEXT_MAX_CHARS = 24000
GENERATION_CONTEXT_MAX_CHARS = 60000


class ContextLimitExceeded(ValueError):
    """Raised when a generation request exceeds the supported source-context limit."""

    def __init__(self, total_chars: int, max_chars: int):
        self.total_chars = int(total_chars)
        self.max_chars = int(max_chars)
        super().__init__(
            f"Selected Learning Material content is too large ({self.total_chars} characters; "
            f"maximum {self.max_chars})."
        )


def get_active_material_ids(project_id: str) -> list[str]:
    result = (
        supabase.table("Learning_Material")
        .select("materialId")
        .eq("projectId", project_id)
        .eq("selectedAsContext", True)
        .execute()
    )
    return [row["materialId"] for row in (result.data or [])]


def _page_from_content(content: str):
    match = re.search(r"\[Page\s+(\d+)\]", content or "", re.IGNORECASE)
    return int(match.group(1)) if match else None


def _all_chunks_for_material(material_id: str) -> list[dict]:
    documents = (
        supabase.table("Processed_Document")
        .select("documentId,extractedText")
        .eq("materialId", material_id)
        .eq("status", "COMPLETED")
        .execute()
    )
    docs = documents.data or []
    if not docs:
        return []

    document_ids = [row["documentId"] for row in docs]
    result = (
        supabase.table("Document_Chunk")
        .select("chunkId,documentId,chunkIndex,content")
        .in_("documentId", document_ids)
        .order("chunkIndex")
        .execute()
    )

    rows = []
    for row in result.data or []:
        content = row.get("content") or ""
        rows.append({
            "materialId": str(material_id),
            "documentId": str(row["documentId"]),
            "chunkId": str(row["chunkId"]),
            "chunkIndex": row.get("chunkIndex"),
            "content": content,
            "page": _page_from_content(content),
            "similarity": 1.0,
        })

    # Embedding quota may be exhausted during upload. In that case extraction is
    # still valid and Processed_Document.extractedText is the source of truth.
    # Reconstruct transient chunks locally so Quiz/Flashcard (and small Tutor
    # contexts) remain usable without requiring a second upload.
    if not rows:
        for doc in docs:
            extracted_text = doc.get("extractedText") or ""
            for index, content in enumerate(split_into_chunks(extracted_text)):
                rows.append({
                    "materialId": str(material_id),
                    "documentId": str(doc["documentId"]),
                    "chunkId": None,
                    "chunkIndex": index,
                    "content": content,
                    "page": _page_from_content(content),
                    "similarity": 1.0,
                })

    return rows


def _balanced_content(rows: list[dict], budget: int) -> str:
    """Keep coverage across the whole source instead of only its first chunks."""
    chunks = [row.get("content") or "" for row in rows if row.get("content")]
    if not chunks or budget <= 0:
        return ""

    full = "\n\n".join(chunks)
    if len(full) <= budget:
        return full

    # Select chunks at evenly distributed positions (beginning/middle/end). This
    # makes a large file contribute representative knowledge throughout the file.
    avg_size = max(1, sum(len(c) for c in chunks) // len(chunks))
    target_count = max(1, min(len(chunks), budget // avg_size))
    if target_count == 1:
        indices = [0]
    else:
        indices = sorted({round(i * (len(chunks) - 1) / (target_count - 1)) for i in range(target_count)})

    selected = []
    used = 0
    for idx in indices:
        chunk = chunks[idx]
        remaining = budget - used
        if remaining <= 0:
            break
        if len(chunk) > remaining:
            chunk = chunk[:remaining]
        selected.append(chunk)
        used += len(chunk) + 2

    return "\n\n".join(selected)


def retrieve_all_material_contexts(
    material_ids: list[str],
    max_total_chars: int = GENERATION_CONTEXT_MAX_CHARS,
    reject_if_exceeds: bool = False,
) -> list[dict]:
    """Return one balanced context block for every selected material.

    For tutor/retrieval callers the content can still be balanced to a prompt
    budget. Quiz/flashcard generation passes ``reject_if_exceeds=True`` so an
    oversized source is rejected before any partial generation can occur.
    """
    material_ids = [str(value) for value in (material_ids or [])]
    if not material_ids:
        return []

    all_sources = []
    for material_id in material_ids:
        rows = _all_chunks_for_material(material_id)
        if rows:
            all_sources.append((material_id, rows))

    if not all_sources:
        return []

    # Count the complete processed source text before applying any prompt
    # balancing. Silently truncating a document makes generation appear
    # successful while omitting facts, which violates UC06-UI06.
    total_chars = sum(
        len("\n\n".join(row.get("content") or "" for row in rows if row.get("content")))
        for _, rows in all_sources
    )
    if reject_if_exceeds and total_chars > max_total_chars:
        raise ContextLimitExceeded(total_chars, max_total_chars)

    per_source_budget = max(2000, max_total_chars // len(all_sources))
    contexts = []
    for material_id, rows in all_sources:
        content = _balanced_content(rows, per_source_budget)
        if content.strip():
            contexts.append({
                "materialId": material_id,
                "chunks": rows,
                "content": content,
            })
    return contexts


def retrieve_all_chunk_records(material_ids: list[str]) -> list[dict]:
    rows: list[dict] = []
    for material_id in material_ids or []:
        rows.extend(_all_chunks_for_material(material_id))
    return rows


def retrieve_relevant_chunk_records(
    project_id: str,
    material_ids: list[str],
    query: str,
    top_k: int = DEFAULT_TOP_K,
    match_threshold: float = DEFAULT_MATCH_THRESHOLD,
    max_context_chars: int = SMALL_CONTEXT_MAX_CHARS,
    full_context_for_small: bool = True,
) -> list[dict]:
    if not material_ids:
        return []

    all_rows = retrieve_all_chunk_records(material_ids)
    if (
        full_context_for_small
        and all_rows
        and sum(len(row["content"]) for row in all_rows) <= max_context_chars
    ):
        return all_rows

    try:
        query_embedding = embed_query(query)
    except EmbeddingQuotaExceeded:
        if all_rows and sum(len(row["content"]) for row in all_rows) <= max_context_chars:
            return all_rows
        raise

    try:
        result = supabase.rpc(
            "match_document_chunks",
            {
                "query_embedding": query_embedding,
                "material_ids": material_ids,
                "match_count": top_k,
                "match_threshold": match_threshold,
            },
        ).execute()
    except Exception as exc:
        message = str(exc).lower()
        if not any(token in message for token in (
            "match_threshold", "could not find the function", "function public.match_document_chunks", "pgrst202"
        )):
            raise
        result = supabase.rpc(
            "match_document_chunks",
            {
                "query_embedding": query_embedding,
                "material_ids": material_ids,
                "match_count": top_k,
            },
        ).execute()

    records = []
    allowed_material_ids = {str(value) for value in material_ids}
    for row in result.data or []:
        material_id = str(row.get("materialId") or row.get("material_id") or "")
        if material_id not in allowed_material_ids:
            continue
        content = row.get("content") or ""
        records.append({
            "materialId": material_id,
            "documentId": str(row.get("documentId") or row.get("document_id") or ""),
            "chunkId": str(row.get("chunkId") or row.get("chunk_id") or ""),
            "chunkIndex": row.get("chunkIndex") or row.get("chunk_index"),
            "content": content,
            "page": row.get("page") or _page_from_content(content),
            "similarity": row.get("similarity"),
        })
    return records


def retrieve_relevant_chunks(project_id: str, material_ids: list[str], query: str, top_k: int = DEFAULT_TOP_K) -> list[str]:
    return [
        row["content"]
        for row in retrieve_relevant_chunk_records(project_id, material_ids, query, top_k=top_k)
    ]
