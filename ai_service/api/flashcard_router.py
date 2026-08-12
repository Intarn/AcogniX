from fastapi import APIRouter, Depends, HTTPException

from middleware.internal_auth import verify_internal_request
from schemas.flashcard_schema import FlashcardRequest, FlashcardResponse
from services.context_retrieval_service import retrieve_relevant_chunks
from services.validation_service import validate_flashcard_items
from llm_client.prompt_builder import build_flashcard_prompt
from llm_client.llm_client import generate_json_array, AIInvalidResponseError
from db import supabase

router = APIRouter()

MIN_FLASHCARDS, MAX_FLASHCARDS = 1, 30


@router.post("/generate-flashcards", response_model=FlashcardResponse, dependencies=[Depends(verify_internal_request)])
async def generate_flashcards(req: FlashcardRequest):
    safe_count = min(max(int(req.flashcardCount), MIN_FLASHCARDS), MAX_FLASHCARDS)
    safe_length = req.length if req.length in {"short", "detailed"} else "short"

    try:
        context_chunks = retrieve_relevant_chunks(
            req.projectId,
            "key terms and definitions",
            top_k=8,
            material_id=req.materialId,
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    if not context_chunks:
        raise HTTPException(
            status_code=422,
            detail="This material has no processed, readable content yet. Please extract it first.",
        )

    prompt = build_flashcard_prompt(context_chunks, safe_count, safe_length)

    try:
        raw_items = generate_json_array(prompt, "flashcard")
        cards = validate_flashcard_items(raw_items)
    except AIInvalidResponseError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail="Document is unsuitable for automatic flashcard generation. Try using the AI Tutor instead.",
        )

    set_insert = supabase.table("Flashcard_Set").insert({"projectId": req.projectId}).execute()
    flashcard_set_id = set_insert.data[0]["flashcardSetId"]

    supabase.table("Flashcard").insert([
        {
            "flashcardSetId": flashcard_set_id,
            "frontContent": c["front"],
            "backContent": c["back"],
            "position": i,
        }
        for i, c in enumerate(cards)
    ]).execute()

    return FlashcardResponse(flashcardSetId=flashcard_set_id, flashcards=cards)