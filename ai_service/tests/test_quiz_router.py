from unittest.mock import MagicMock


def _patch_common(monkeypatch, chunks=None, generated_items=None):
    monkeypatch.setattr(
        "api.quiz_router.retrieve_relevant_chunks",
        lambda project_id, query, top_k=8: chunks if chunks is not None else ["some context chunk"],
    )
    if generated_items is not None:
        monkeypatch.setattr("api.quiz_router.generate_json_array", lambda prompt, label: generated_items)

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [{"quizId": "quiz-123"}]
    monkeypatch.setattr("api.quiz_router.supabase", mock_supabase)
    return mock_supabase


def test_generate_quiz_happy_path(client, internal_headers, monkeypatch):
    items = [{"question": "Q1?", "options": ["A", "B"], "correctAnswer": "A"}]
    mock_supabase = _patch_common(monkeypatch, generated_items=items)

    response = client.post(
        "/api/generate-quiz",
        headers=internal_headers,
        json={"projectId": "proj-1", "questionCount": 5, "difficulty": "hard"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["quizId"] == "quiz-123"
    assert len(body["questions"]) == 1
    # Practice_Quiz insert must use the normalized difficulty, not a stray raw value
    insert_call_args = mock_supabase.table.return_value.insert.call_args_list[0][0][0]
    assert insert_call_args["difficultyLevel"] == "hard"


def test_generate_quiz_rejects_missing_active_context(client, internal_headers, monkeypatch):
    _patch_common(monkeypatch, chunks=[])

    response = client.post(
        "/api/generate-quiz",
        headers=internal_headers,
        json={"projectId": "proj-1"},
    )

    assert response.status_code == 422


def test_generate_quiz_clamps_question_count(client, internal_headers, monkeypatch):
    items = [{"question": "Q?", "options": ["A", "B"], "correctAnswer": "A"}]
    _patch_common(monkeypatch, generated_items=items)

    captured_prompt = {}
    def fake_generate(prompt, label):
        captured_prompt["prompt"] = prompt
        return items
    monkeypatch.setattr("api.quiz_router.generate_json_array", fake_generate)

    client.post(
        "/api/generate-quiz",
        headers=internal_headers,
        json={"projectId": "proj-1", "questionCount": 999},  # way above MAX_QUESTIONS
    )

    assert "Generate 20 multiple-choice questions" in captured_prompt["prompt"]


def test_generate_quiz_invalid_ai_json_returns_502(client, internal_headers, monkeypatch):
    from llm_client.llm_client import AIInvalidResponseError
    _patch_common(monkeypatch)

    def raise_invalid(prompt, label):
        raise AIInvalidResponseError("bad json")
    monkeypatch.setattr("api.quiz_router.generate_json_array", raise_invalid)

    response = client.post("/api/generate-quiz", headers=internal_headers, json={"projectId": "proj-1"})
    assert response.status_code == 502


def test_generate_quiz_requires_internal_secret(client):
    response = client.post("/api/generate-quiz", json={"projectId": "proj-1"})
    assert response.status_code == 401