from fastapi import APIRouter, Depends, UploadFile, Form, HTTPException
from datetime import datetime, timezone

from middleware.internal_auth import verify_internal_request
from services import document_extraction_service as extraction
from schemas.extraction_schema import ExtractionResponse
from db import supabase
from services.indexing_service import index_document
from services.embedding_service import EmbeddingQuotaExceeded, EmbeddingServiceError

router = APIRouter()

SUPPORTED_MIME_TYPES = {
    "application/pdf": extraction.extract_text_from_pdf,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": extraction.extract_text_from_docx,
    "image/jpeg": extraction.extract_text_from_image,
    "image/png": extraction.extract_text_from_image,
    "image/webp": extraction.extract_text_from_image,
}


@router.post("/extract", response_model=ExtractionResponse, dependencies=[Depends(verify_internal_request)])
async def extract_document(materialId: str = Form(...), file: UploadFile = None):
    if file is None:
        raise HTTPException(status_code=400, detail="Missing file.")

    extractor = SUPPORTED_MIME_TYPES.get(file.content_type)
    if extractor is None:
        raise HTTPException(status_code=415, detail={"code": "UNSUPPORTED_DOCUMENT_TYPE", "message": f"Unsupported file type: {file.content_type}"})

    file_bytes = await file.read()

    # Create the Processed_Document row up front as PROCESSING, then update it —
    # so a status is always queryable even if extraction later fails or crashes.
    doc_insert = supabase.table("Processed_Document").insert({
        "materialId": materialId,
        "status": "PROCESSING",
    }).execute()
    document_id = doc_insert.data[0]["documentId"]

    try:
        extracted_text = extractor(file_bytes)

        if not extracted_text.strip():
            supabase.table("Processed_Document").update({
                "status": "FAILED",
                "errorMessage": "No readable text was found in this file.",
                "processedAt": datetime.now(timezone.utc).isoformat(),
            }).eq("documentId", document_id).execute()
            raise HTTPException(status_code=422, detail="No readable text was found in this file.")

        supabase.table("Processed_Document").update({
            "status": "COMPLETED",
            "extractedText": extracted_text,
            "processedAt": datetime.now(timezone.utc).isoformat(),
        }).eq("documentId", document_id).execute()

        # Index when embedding quota is available. If Google temporarily returns
        # 429, extraction must still succeed: Processed_Document.extractedText is
        # persisted and generation can reconstruct transient chunks from it.
        try:
            index_document(document_id, extracted_text)
        except (EmbeddingQuotaExceeded, EmbeddingServiceError) as embedding_error:
            # Extraction is complete and extractedText is already persisted.
            # Indexing/embedding is an optimization for retrieval, not a reason to
            # reject an otherwise valid PDF/DOCX. Context retrieval can rebuild
            # transient chunks from Processed_Document.extractedText.
            print(
                f"[extract] Embedding/indexing unavailable; document {document_id} "
                f"remains usable from extractedText: {embedding_error}"
            )

        return ExtractionResponse(
            documentId=document_id,
            materialId=materialId,
            status="COMPLETED",
            extractedText=extracted_text,
        )

    except HTTPException:
        raise
    except extraction.ExtractionError as e:
        supabase.table("Processed_Document").update({
            "status": "FAILED",
            "errorMessage": str(e),
            "processedAt": datetime.now(timezone.utc).isoformat(),
        }).eq("documentId", document_id).execute()
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": str(e)},
        )
    except Exception as e:
        supabase.table("Processed_Document").update({
            "status": "FAILED",
            "errorMessage": str(e),
            "processedAt": datetime.now(timezone.utc).isoformat(),
        }).eq("documentId", document_id).execute()
        raise HTTPException(status_code=500, detail="Server error during document extraction.")