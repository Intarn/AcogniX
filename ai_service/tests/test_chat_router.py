from unittest.mock import MagicMock, AsyncMock


def test_chat_rejects_missing_active_context(client, internal_headers, monkeypatch):
    monkeypatch.setattr("api.chat_router.retrieve_relevant_chunks", lambda project_id, msg: [])

    response = client.post(
        "/api/chat",
        headers=internal_headers,
        json={"projectId": "proj-1", "userMessage": "Hello?"},
    )

    assert response.status_code == 422


def test_chat_creates_new_conversation_and_saves_messages(client, internal_headers, monkeypatch):
    monkeypatch.setattr("api.chat_router.retrieve_relevant_chunks", lambda project_id, msg: ["some chunk"])
    monkeypatch.setattr("api.chat_router.generate_text_with_timeout", AsyncMock(return_value="Hi there!"))

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [{"conversationId": "conv-1"}]
    monkeypatch.setattr("api.chat_router.supabase", mock_supabase)

    response = client.post(
        "/api/chat",
        headers=internal_headers,
        json={"projectId": "proj-1", "userMessage": "React là gì?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["conversationId"] == "conv-1"
    assert body["reply"] == "Hi there!"

    # Both sides of the exchange must be persisted
    insert_calls = [c for c in mock_supabase.table.return_value.insert.call_args_list]
    chat_message_insert = insert_calls[-1][0][0]
    assert len(chat_message_insert) == 2
    assert chat_message_insert[0]["senderRole"] == "LEARNER"
    assert chat_message_insert[1]["senderRole"] == "AI_TUTOR"


def test_chat_continues_existing_conversation(client, internal_headers, monkeypatch):
    monkeypatch.setattr("api.chat_router.retrieve_relevant_chunks", lambda project_id, msg: ["some chunk"])
    monkeypatch.setattr("api.chat_router.generate_text_with_timeout", AsyncMock(return_value="Follow-up reply."))

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
        "conversationId": "conv-1", "projectId": "proj-1"
    }
    mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
        {"senderRole": "LEARNER", "content": "Earlier question"},
        {"senderRole": "AI_TUTOR", "content": "Earlier answer"},
    ]
    monkeypatch.setattr("api.chat_router.supabase", mock_supabase)

    response = client.post(
        "/api/chat",
        headers=internal_headers,
        json={"projectId": "proj-1", "conversationId": "conv-1", "userMessage": "Follow-up question"},
    )

    assert response.status_code == 200
    assert response.json()["conversationId"] == "conv-1"


def test_chat_timeout_returns_504(client, internal_headers, monkeypatch):
    from llm_client.llm_client import AITimeoutError

    monkeypatch.setattr("api.chat_router.retrieve_relevant_chunks", lambda project_id, msg: ["some chunk"])
    monkeypatch.setattr(
        "api.chat_router.generate_text_with_timeout",
        AsyncMock(side_effect=AITimeoutError("Connection to AI Tutor interrupted. Please try again.")),
    )
    monkeypatch.setattr("api.chat_router.supabase", MagicMock())

    response = client.post(
        "/api/chat",
        headers=internal_headers,
        json={"projectId": "proj-1", "userMessage": "Hello?"},
    )

    assert response.status_code == 504
    assert "interrupted" in response.json()["detail"]