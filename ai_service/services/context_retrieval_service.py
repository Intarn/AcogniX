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


def _verify_material_belongs_to_project(project_id: str, material_id: str) -> None:
    """Guards against a client passing a materialId from a different
    project to read chunks it shouldn't have access to."""
    result = (
        supabase.table("Learning_Material")
        .select("materialId")
        .eq("materialId", material_id)
        .eq("projectId", project_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise ValueError("This material does not belong to the given project.")


def retrieve_relevant_chunks(
    project_id: str,
    query: str,
    top_k: int = DEFAULT_TOP_K,
    material_id: str | None = None,
) -> list[str]:
    """Core RAG retrieval step. If material_id is given, restrict search
    to just that one material (e.g. 'generate flashcards from this file').
    Otherwise, fall back to the project's active-context materials (UC-01)."""
    if material_id:
        _verify_material_belongs_to_project(project_id, material_id)
        material_ids = [material_id]
    else:
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