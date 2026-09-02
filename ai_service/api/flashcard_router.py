from fastapi import APIRouter, Depends, HTTPException

from middleware.internal_auth import verify_internal_request
from schemas.flashcard_schema import FlashcardRequest, FlashcardResponse
from services.context_retrieval_service import retrieve_all_material_contexts, ContextLimitExceeded
from services.validation_service import validate_flashcard_items
from llm_client.prompt_builder import build_flashcard_prompt
from llm_client.llm_client import generate_json_array, AIInvalidResponseError, AIProviderError
from db import supabase

router = APIRouter()

def _is_missing_generation_rpc(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(token in message for token in (
        "create_flashcard_set_with_cards",
        "could not find the function",
        "pgrst202",
    ))


def _save_flashcards_legacy(project_id: str, cards: list[dict]) -> str:
    set_insert = supabase.table("Flashcard_Set").insert({"projectId": project_id}).execute()
    set_id = set_insert.data[0]["flashcardSetId"]
    try:
        supabase.table("Flashcard").insert([
            {
                "flashcardSetId": set_id,
                "frontContent": card["front"],
                "backContent": card["back"],
                "position": index,
            }
            for index, card in enumerate(cards)
        ]).execute()
    except Exception:
        try:
            supabase.table("Flashcard_Set").delete().eq("flashcardSetId", set_id).execute()
        except Exception:
            pass
        raise
    return set_id


MAX_CONTEXT_CHARS = 60000


@router.post("/generate-flashcards", response_model=FlashcardResponse, dependencies=[Depends(verify_internal_request)])
async def generate_flashcards(req: FlashcardRequest):
    length = req.length.strip().lower()
    if length not in {"short", "detailed"}:
        raise HTTPException(status_code=422, detail="length must be short or detailed.")

    if not req.materialIds:
        raise HTTPException(status_code=422, detail="Please select at least one Learning Material before generating flashcards.")

    # Flashcard generation uses all processed chunks and therefore does not
    # consume embedding quota. Large selections are rejected below with a clear
    # request to choose a smaller chapter/material set.
    try:
        source_contexts = retrieve_all_material_contexts(
            req.materialIds,
            max_total_chars=MAX_CONTEXT_CHARS,
            reject_if_exceeds=True,
        )
    except ContextLimitExceeded as exc:
        raise HTTPException(
            status_code=413,
            detail={
                "code": "CONTEXT_TOO_LARGE",
                "message": "The selected document is too large for automatic flashcard generation. Please select a smaller chapter or section and try again.",
            },
        ) from exc

    if len(source_contexts) != len(req.materialIds):
        raise HTTPException(status_code=422, detail="One or more selected Learning Materials have no processed readable content yet.")

    # Deterministic suitability guard for trivially empty/meaningless documents.
    # UC07-UI05 must not depend on a generative provider call to discover that a
    # document like 'Hello.' cannot support an automatic flashcard set.
    meaningful_words = [
        token
        for context in source_contexts
        for token in str(context.get("content", "")).replace("\n", " " ).split()
        if any(ch.isalnum() for ch in token)
    ]
    if len(meaningful_words) < 8:
        raise HTTPException(
            status_code=422,
            detail="Document is unsuitable for automatic flashcard generation. Try using the AI Tutor instead.",
        )

    base, remainder = divmod(req.flashcardCount, len(source_contexts))
    source_quotas = [base + (1 if index < remainder else 0) for index in range(len(source_contexts))]
    prompt = build_flashcard_prompt(source_contexts, req.flashcardCount, length, source_quotas)
    cards = []
    seen_cards = set()
    last_generation_error = None

    for attempt in range(3):
        missing = req.flashcardCount - len(cards)
        if missing <= 0:
            break

        if attempt == 0:
            attempt_prompt = prompt
        else:
            existing = "\n".join(
                f"- {card['front']} :: {card['back']}" for card in cards
            ) or "- none"
            attempt_prompt = (
                prompt
                + f"\nRETRY CORRECTION: For this retry, ignore the earlier total-count instruction and return exactly {missing} ADDITIONAL unique flashcard(s), "
                  "not replacements for the valid cards already accepted below. Do not invent unsupported facts. "
                  "Preserve source-specific identifiers and numeric values exactly.\n"
                  f"ALREADY ACCEPTED FLASHCARDS (do not repeat):\n{existing}"
            )

        try:
            raw_items = generate_json_array(attempt_prompt, "flashcard", allow_empty=True)
            if not raw_items:
                # On the first attempt, [] is the model's explicit suitability signal.
                # On a retry it also means the source cannot support the remaining cards.
                raise HTTPException(
                    status_code=422,
                    detail="Document is unsuitable for automatic flashcard generation. Try using the AI Tutor instead.",
                )
            candidates = validate_flashcard_items(raw_items)
            for candidate in candidates:
                identity = (
                    " ".join(candidate["front"].casefold().split()),
                    " ".join(candidate["back"].casefold().split()),
                )
                if identity in seen_cards:
                    continue
                seen_cards.add(identity)
                cards.append(candidate)
                if len(cards) == req.flashcardCount:
                    break

            if len(cards) == req.flashcardCount:
                break

            last_generation_error = ValueError(
                f"The AI returned only {len(cards)} valid unique flashcards out of {req.flashcardCount}."
            )
        except HTTPException:
            raise
        except AIProviderError as exc:
            raise HTTPException(
                status_code=exc.status_code,
                detail={"code": exc.code, "message": str(exc)},
            ) from exc
        except (AIInvalidResponseError, ValueError) as exc:
            last_generation_error = exc

    if len(cards) != req.flashcardCount:
        # If the model explicitly signals insufficient source data, the empty-array
        # branch above returns the UC07-UI05 message. Other malformed/count errors
        # are transient AI-generation failures and can be retried by the learner.
        raise HTTPException(
            status_code=502,
            detail="The AI did not generate the configured number of unique flashcards. Please try again.",
        ) from last_generation_error

    try:
        result = supabase.rpc("create_flashcard_set_with_cards", {
            "p_project_id": req.projectId,
            "p_cards": cards,
            "p_idempotency_key": req.idempotencyKey,
        }).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Unable to save the generated flashcards.")
        set_id = result.data.get("flashcardSetId") if isinstance(result.data, dict) else result.data[0].get("flashcardSetId")
    except HTTPException:
        raise
    except Exception as exc:
        if not _is_missing_generation_rpc(exc):
            raise HTTPException(status_code=500, detail="Unable to save the generated flashcards.") from exc
        try:
            set_id = _save_flashcards_legacy(req.projectId, cards)
        except Exception as save_exc:
            raise HTTPException(status_code=500, detail="Unable to save the generated flashcards.") from save_exc

    return FlashcardResponse(flashcardSetId=set_id, flashcards=cards)
