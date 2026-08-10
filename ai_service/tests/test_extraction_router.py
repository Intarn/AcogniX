from unittest.mock import MagicMock
import io
import api.extraction_router

def test_extract_rejects_unsupported_file_type(client, internal_headers):
    response = client.post(
        "/api/extract",
        headers=internal_headers,
        data={"materialId": "mat-1"},
        files={"file": ("notes.txt", io.BytesIO(b"plain text"), "text/plain")},
    )
    assert response.status_code == 400


def test_extract_pdf_success_saves_and_indexes(client, internal_headers, monkeypatch):
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [{"documentId": "doc-1"}]
    monkeypatch.setattr("api.extraction_router.supabase", mock_supabase)
    monkeypatch.setitem(api.extraction_router.SUPPORTED_MIME_TYPES, "application/pdf", lambda file_bytes: "Some extracted text.")
    monkeypatch.setattr("api.extraction_router.index_document", lambda doc_id, text: 3)

    response = client.post(
        "/api/extract",
        headers=internal_headers,
        data={"materialId": "mat-1"},
        files={"file": ("report.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "COMPLETED"
    assert body["extractedText"] == "Some extracted text."

    update_call = mock_supabase.table.return_value.update.call_args_list[-1][0][0]
    assert update_call["status"] == "COMPLETED"


def test_extract_empty_text_marks_document_failed(client, internal_headers, monkeypatch):
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [{"documentId": "doc-1"}]
    monkeypatch.setattr("api.extraction_router.supabase", mock_supabase)
    monkeypatch.setitem(api.extraction_router.SUPPORTED_MIME_TYPES, "application/pdf", lambda file_bytes: "   ")

    response = client.post(
        "/api/extract",
        headers=internal_headers,
        data={"materialId": "mat-1"},
        files={"file": ("scan.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
    )

    assert response.status_code == 422
    update_call = mock_supabase.table.return_value.update.call_args_list[-1][0][0]
    assert update_call["status"] == "FAILED"