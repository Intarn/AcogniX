from db import supabase
from services.embedding_service import embed_query

DEFAULT_TOP_K = 5


def get_active_material_ids(project_id: str) -> list[str]:
    """Materials the Learner has marked as active context for this project (UC-01)."""
    result = (
        supabase.table("Learning_Material")
        .select("materialId")
        .eq("projectId", project_id)
        .eq("selectedAsContext", True)
        .execute()
    )
    return [row["materialId"] for row in result.data]


def retrieve_relevant_chunks(project_id: str, query: str, top_k: int = DEFAULT_TOP_K) -> list[str]:
    """Core RAG retrieval step: embeds the query, finds the top-k most
    similar chunks among the project's active-context materials, and
    returns their text — ready to drop into the LLM prompt."""
    material_ids = get_active_material_ids(project_id)
    if not material_ids:
        return []

    query_embedding = embed_query(query)

    result = supabase.rpc(
        "match_document_chunks",
        {
            "query_embedding": query_embedding,
            "material_ids": material_ids,
            "match_count": top_k,
        },
    ).execute()

    return [row["content"] for row in result.data]