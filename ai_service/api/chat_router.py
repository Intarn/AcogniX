from fastapi import APIRouter, Depends, HTTPException

from middleware.internal_auth import verify_internal_request
from schemas.chat_schema import ChatRequest, ChatResponse, ChatCitation
from services.context_retrieval_service import retrieve_relevant_chunk_records
from services.embedding_service import EmbeddingQuotaExceeded, EmbeddingServiceError
from llm_client.prompt_builder import build_tutor_prompt
from llm_client.llm_client import generate_text_with_timeout, AITimeoutError, AIProviderError
from db import supabase

router = APIRouter()
NOT_FOUND_REPLY = "I could not find this information in the selected Learning Materials. I can only answer questions based on the selected Learning Materials."


@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(verify_internal_request)])
async def chat(req: ChatRequest):
    if not req.materialIds:
        raise HTTPException(
            status_code=422,
            detail="Please select at least one Learning Material as active context before using the AI Tutor.",
        )

    try:
        records = retrieve_relevant_chunk_records(
            req.projectId,
            req.materialIds,
            req.userMessage,
            full_context_for_small=True,
        )
    except EmbeddingQuotaExceeded as exc:
        raise HTTPException(status_code=429, detail={"code": "AI_EMBEDDING_QUOTA", "message": str(exc)}) from exc
    except EmbeddingServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if not records:
        return ChatResponse(conversationId=req.conversationId, reply=NOT_FOUND_REPLY, citations=[])

    context_chunks = [row["content"] for row in records]

    if req.conversationId:
        conv = supabase.table("Conversation").select("*").eq("conversationId", req.conversationId).maybe_single().execute()
        if not conv.data or conv.data["projectId"] != req.projectId:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        conversation_id = req.conversationId
        history_result = (
            supabase.table("Chat_Message")
            .select("*")
            .eq("conversationId", conversation_id)
            .order("createdAt")
            .execute()
        )
        recent_messages = history_result.data[-10:] if len(history_result.data) > 10 else history_result.data
        chat_history = [{"role": m["senderRole"], "content": m["content"]} for m in recent_messages]
    else:
        new_conv = supabase.table("Conversation").insert({"projectId": req.projectId}).execute()
        conversation_id = new_conv.data[0]["conversationId"]
        chat_history = []

    prompt = build_tutor_prompt(context_chunks, chat_history, req.userMessage)
    try:
        reply = await generate_text_with_timeout(prompt)
        # UC02 Alternative Flow 2: Gemini may phrase a grounded refusal in many
        # ways. Normalize those refusals so the UI always communicates the
        # product rule explicitly instead of depending on provider wording.
        normalized_reply = str(reply or "").lower()
        refusal_markers = (
            "no information",
            "not contain",
            "doesn't contain",
            "does not contain",
            "not provided",
            "no mention",
            "not mentioned",
            "not in the provided",
            "not in the selected",
        )
        if any(marker in normalized_reply for marker in refusal_markers):
            reply = NOT_FOUND_REPLY
    except AITimeoutError as exc:
        raise HTTPException(status_code=504, detail={"code": "AI_TUTOR_TIMEOUT", "message": str(exc)}) from exc
    except AIProviderError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"code": exc.code, "message": str(exc)}) from exc

    supabase.table("Chat_Message").insert([
        {"conversationId": conversation_id, "senderRole": "LEARNER", "content": req.userMessage},
        {"conversationId": conversation_id, "senderRole": "AI_TUTOR", "content": reply},
    ]).execute()

    allowed = {str(mid) for mid in req.materialIds}
    citations = [
        ChatCitation(
            materialId=row["materialId"],
            documentId=row["documentId"],
            chunkId=row["chunkId"],
            page=row.get("page"),
        )
        for row in records
        if str(row.get("materialId")) in allowed and row.get("documentId") and row.get("chunkId")
    ]

    return ChatResponse(conversationId=conversation_id, reply=reply, citations=citations)
