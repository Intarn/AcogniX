import json
from fastapi import APIRouter, Depends, HTTPException

from middleware.internal_auth import verify_internal_request
from schemas.quiz_schema import QuizRequest, QuizResponse
from services.context_retrieval_service import retrieve_relevant_chunks
from services.validation_service import validate_quiz_items
from llm_client.prompt_builder import build_quiz_prompt
from llm_client.llm_client import generate_json_array, AIInvalidResponseError
from db import supabase

router = APIRouter()

MIN_QUESTIONS, MAX_QUESTIONS = 1, 20
VALID_DIFFICULTIES = {"easy", "medium", "hard"}

# Rough ceiling on how much source context we'll feed the model in one go (UC-06 alt flow)
MAX_CONTEXT_CHARS = 24000


@router.post("/generate-quiz", response_model=QuizResponse, dependencies=[Depends(verify_internal_request)])
async def generate_quiz(req: QuizRequest):
    safe_count = min(max(int(req.questionCount), MIN_QUESTIONS), MAX_QUESTIONS)
    safe_difficulty = req.difficulty.strip().lower() if req.difficulty.strip().lower() in VALID_DIFFICULTIES else "medium"

    if not req.materialIds:
        raise HTTPException(
            status_code=422,
            detail="Please select at least one Learning Material before generating a quiz."
    )

    context_chunks = retrieve_relevant_chunks(
        req.projectId,
        req.materialIds,
        "key concepts overview",
        top_k=4
    )

    if not context_chunks:
        raise HTTPException(
        status_code=422,
        detail="No readable content found in the selected Learning Materials."
    )

    total_context_chars = sum(len(c) for c in context_chunks)
    if total_context_chars > MAX_CONTEXT_CHARS:
        raise HTTPException(
            status_code=413,
            detail="This material is too long to generate a quiz from at once. Please select a smaller chapter or section.",
        )

    prompt = build_quiz_prompt(context_chunks, safe_count, safe_difficulty)

    try:
        raw_items = generate_json_array(prompt, "quiz")
        questions = validate_quiz_items(raw_items)
    except (AIInvalidResponseError, ValueError) as e:
        raise HTTPException(status_code=502, detail=str(e))

    quiz_insert = supabase.table("Practice_Quiz").insert({
        "projectId": req.projectId,
        "questionCount": len(questions),
        "difficultyLevel": safe_difficulty,
    }).execute()
    quiz_id = quiz_insert.data[0]["quizId"]

    supabase.table("Practice_Question").insert([
        {
            "quizId": quiz_id,
            "content": q["question"],
            "optionsJson": json.dumps(q["options"]),
            "correctAnswer": q["correctAnswer"],
        }
        for q in questions
    ]).execute()

    return QuizResponse(quizId=quiz_id, questions=questions)