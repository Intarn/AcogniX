from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from middleware.internal_auth import verify_internal_request
from schemas.chat_schema import ChatRequest, ChatResponse
from services.context_retrieval_service import retrieve_relevant_chunks
from llm_client.prompt_builder import build_tutor_prompt
from llm_client.llm_client import generate_text_with_timeout, AITimeoutError
from db import supabase

router = APIRouter()


@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(verify_internal_request)])
async def chat(req: ChatRequest):
    # UC-02 precondition: at least one active-context material is required —
    # the AI Tutor must be grounded in something, not a bare, ungrounded chat.
    context_chunks = retrieve_relevant_chunks(req.projectId, req.userMessage)
    if not context_chunks:
        raise HTTPException(
            status_code=422,
            detail="Please select at least one Learning Material as active context before using the AI Tutor.",
        )

    # Resolve or create the Conversation
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
    except AITimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))

    # Persist both sides of the exchange as separate Chat_Message rows
    supabase.table("Chat_Message").insert([
        {"conversationId": conversation_id, "senderRole": "LEARNER", "content": req.userMessage},
        {"conversationId": conversation_id, "senderRole": "AI_TUTOR", "content": reply},
    ]).execute()

    return ChatResponse(conversationId=conversation_id, reply=reply)