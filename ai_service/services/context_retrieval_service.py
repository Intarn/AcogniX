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

def retrieve_relevant_chunks(
    project_id: str,
    material_ids: list[str],
    query: str,
    top_k: int = DEFAULT_TOP_K
) -> list[str]:
    if not material_ids:
        return []

    query_embedding = embed_query(query)
    all_chunks = []

    for material_id in material_ids:
        result = supabase.rpc(
            "match_document_chunks",
            {
                "query_embedding": query_embedding,
                "material_ids": [material_id],
                "match_count": top_k,
            },
        ).execute()

        all_chunks.extend(row["content"] for row in result.data)

    return all_chunks