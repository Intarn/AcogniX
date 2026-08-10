from unittest.mock import MagicMock


def _patch_common(monkeypatch, chunks=None, generated_items=None):
    monkeypatch.setattr(
        "api.flashcard_router.retrieve_relevant_chunks",
        lambda project_id, query, top_k=8: chunks if chunks is not None else ["some context chunk"],
    )
    if generated_items is not None:
        monkeypatch.setattr("api.flashcard_router.generate_json_array", lambda prompt, label: generated_items)

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [{"flashcardSetId": "set-123"}]
    monkeypatch.setattr("api.flashcard_router.supabase", mock_supabase)
    return mock_supabase


def test_generate_flashcards_happy_path(client, internal_headers, monkeypatch):
    items = [{"front": "React", "back": "A JS library."}]
    _patch_common(monkeypatch, generated_items=items)

    response = client.post(
        "/api/generate-flashcards",
        headers=internal_headers,
        json={"projectId": "proj-1", "flashcardCount": 5},
    )

    assert response.status_code == 200
    assert response.json()["flashcardSetId"] == "set-123"


def test_generate_flashcards_rejects_missing_active_context(client, internal_headers, monkeypatch):
    _patch_common(monkeypatch, chunks=[])

    response = client.post("/api/generate-flashcards", headers=internal_headers, json={"projectId": "proj-1"})
    assert response.status_code == 422


def test_generate_flashcards_insufficient_content_returns_specific_message(client, internal_headers, monkeypatch):
    # Model returns only malformed/empty cards -> validate_flashcard_items raises ValueError
    _patch_common(monkeypatch, generated_items=[{"front": "", "back": ""}])

    response = client.post("/api/generate-flashcards", headers=internal_headers, json={"projectId": "proj-1"})

    assert response.status_code == 422
    assert "unsuitable for automatic flashcard generation" in response.json()["detail"]