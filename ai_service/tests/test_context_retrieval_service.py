from unittest.mock import MagicMock


def test_returns_empty_when_no_active_context_material(monkeypatch):
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
    monkeypatch.setattr("services.context_retrieval_service.supabase", mock_supabase)

    from services.context_retrieval_service import retrieve_relevant_chunks
    result = retrieve_relevant_chunks("project-1", "some question")

    assert result == []


def test_retrieves_top_k_chunks_via_rpc(monkeypatch):
    mock_supabase = MagicMock()
    # get_active_material_ids -> one material
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {"materialId": "mat-1"}
    ]
    # rpc(match_document_chunks) -> two chunks
    mock_supabase.rpc.return_value.execute.return_value.data = [
        {"content": "chunk A"},
        {"content": "chunk B"},
    ]
    monkeypatch.setattr("services.context_retrieval_service.supabase", mock_supabase)
    monkeypatch.setattr("services.context_retrieval_service.embed_query", lambda q: [0.1] * 768)

    from services.context_retrieval_service import retrieve_relevant_chunks
    result = retrieve_relevant_chunks("project-1", "some question", top_k=2)

    assert result == ["chunk A", "chunk B"]
    mock_supabase.rpc.assert_called_once()
    called_args = mock_supabase.rpc.call_args[0][1]
    assert called_args["material_ids"] == ["mat-1"]
    assert called_args["match_count"] == 2