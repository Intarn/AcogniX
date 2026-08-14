from unittest.mock import MagicMock


def test_returns_empty_when_no_materials_selected(monkeypatch):
    mock_supabase = MagicMock()

    monkeypatch.setattr(
        "services.context_retrieval_service.supabase",
        mock_supabase
    )

    from services.context_retrieval_service import retrieve_relevant_chunks

    result = retrieve_relevant_chunks(
        "project-1",
        [],
        "some question"
    )

    assert result == []
    mock_supabase.rpc.assert_not_called()


def test_retrieves_chunks_from_each_selected_material(monkeypatch):
    mock_supabase = MagicMock()

    mock_supabase.rpc.return_value.execute.side_effect = [
        MagicMock(data=[
            {"content": "material 1 chunk A"},
            {"content": "material 1 chunk B"},
        ]),
        MagicMock(data=[
            {"content": "material 2 chunk A"},
        ]),
    ]

    monkeypatch.setattr(
        "services.context_retrieval_service.supabase",
        mock_supabase
    )

    monkeypatch.setattr(
        "services.context_retrieval_service.embed_query",
        lambda q: [0.1] * 768
    )

    from services.context_retrieval_service import retrieve_relevant_chunks

    result = retrieve_relevant_chunks(
        "project-1",
        ["mat-1", "mat-2"],
        "some question",
        top_k=2
    )

    assert result == [
        "material 1 chunk A",
        "material 1 chunk B",
        "material 2 chunk A",
    ]

    assert mock_supabase.rpc.call_count == 2

    first_call = mock_supabase.rpc.call_args_list[0][0][1]
    second_call = mock_supabase.rpc.call_args_list[1][0][1]

    assert first_call["material_ids"] == ["mat-1"]
    assert second_call["material_ids"] == ["mat-2"]

    assert first_call["match_count"] == 2
    assert second_call["match_count"] == 2