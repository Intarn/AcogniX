import json
from fastapi import APIRouter, Depends, HTTPException

from middleware.internal_auth import verify_internal_request
from schemas.quiz_schema import QuizRequest, QuizResponse
from services.context_retrieval_service import retrieve_all_material_contexts, ContextLimitExceeded
from services.validation_service import validate_quiz_items
from llm_client.prompt_builder import build_quiz_prompt
from llm_client.llm_client import generate_json_array, AIInvalidResponseError, AIProviderError
from db import supabase

router = APIRouter()

def _is_missing_generation_rpc(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(token in message for token in (
        "create_practice_quiz_with_questions",
        "could not find the function",
        "pgrst202",
    ))


def _save_quiz_legacy(project_id: str, questions: list[dict], difficulty: str) -> str:
    quiz_insert = supabase.table("Practice_Quiz").insert({
        "projectId": project_id,
        "questionCount": len(questions),
        "difficultyLevel": difficulty,
    }).execute()
    quiz_id = quiz_insert.data[0]["quizId"]
    try:
        supabase.table("Practice_Question").insert([
            {
                "quizId": quiz_id,
                "content": question["question"],
                "optionsJson": json.dumps(question["options"]),
                "correctAnswer": question["correctAnswer"],
            }
            for question in questions
        ]).execute()
    except Exception:
        try:
            supabase.table("Practice_Quiz").delete().eq("quizId", quiz_id).execute()
        except Exception:
            pass
        raise
    return quiz_id


VALID_DIFFICULTIES = {"easy", "medium", "hard"}
MAX_CONTEXT_CHARS = 60000


@router.post("/generate-quiz", response_model=QuizResponse, dependencies=[Depends(verify_internal_request)])
async def generate_quiz(req: QuizRequest):
    difficulty = req.difficulty.strip().lower()
    if difficulty not in VALID_DIFFICULTIES:
        raise HTTPException(status_code=422, detail="difficulty must be easy, medium, or hard.")

    if not req.materialIds:
        raise HTTPException(status_code=422, detail="Please select at least one Learning Material before generating a quiz.")

    # Generation intentionally does not use semantic embeddings. We use all
    # processed chunks so Quiz generation is independent of Gemini embedding
    # quota and cannot omit facts outside a top-k retrieval window.
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
                "message": "The selected document is too large for automatic quiz generation. Please select a smaller chapter or section and try again.",
            },
        ) from exc

    if len(source_contexts) != len(req.materialIds):
        raise HTTPException(status_code=422, detail="One or more selected Learning Materials have no processed readable content yet.")



    base, remainder = divmod(req.questionCount, len(source_contexts))
    source_quotas = [base + (1 if index < remainder else 0) for index in range(len(source_contexts))]
    prompt = build_quiz_prompt(source_contexts, req.questionCount, difficulty, source_quotas)
    questions = []
    seen_questions = set()
    last_generation_error = None

    # Generative APIs occasionally return one item too many/few. Keep only valid
    # unique questions and ask only for the missing remainder. Nothing is saved
    # until the configured count is reached, preventing partial repository data.
    for attempt in range(3):
        missing = req.questionCount - len(questions)
        if missing <= 0:
            break

        if attempt == 0:
            attempt_prompt = prompt
        else:
            existing = "\n".join(
                f"- {question['question']}" for question in questions
            ) or "- none"
            attempt_prompt = (
                prompt
                + f"\nRETRY CORRECTION: For this retry, ignore the earlier total-count instruction and return exactly {missing} ADDITIONAL unique question(s), "
                  "not a replacement for the valid questions already accepted below. "
                  "Each question must have exactly four distinct non-empty options, and correctAnswer must exactly match one option. "
                  "Preserve source-specific identifiers and numeric values exactly.\n"
                  f"ALREADY ACCEPTED QUESTIONS (do not repeat):\n{existing}"
            )

        try:
            raw_items = generate_json_array(attempt_prompt, "quiz")
            candidates = validate_quiz_items(raw_items)
            for candidate in candidates:
                identity = " ".join(candidate["question"].casefold().split())
                if identity in seen_questions:
                    continue
                seen_questions.add(identity)
                questions.append(candidate)
                if len(questions) == req.questionCount:
                    break

            if len(questions) == req.questionCount:
                break

            last_generation_error = ValueError(
                f"The AI returned only {len(questions)} valid unique questions out of {req.questionCount}."
            )
        except AIProviderError as exc:
            raise HTTPException(
                status_code=exc.status_code,
                detail={"code": exc.code, "message": str(exc)},
            ) from exc
        except (AIInvalidResponseError, ValueError) as exc:
            last_generation_error = exc

    if len(questions) != req.questionCount:
        raise HTTPException(
            status_code=502,
            detail="The AI did not generate the configured number of unique questions. Please try again.",
        ) from last_generation_error

    payload = [{
        "content": q["question"],
        "options": q["options"],
        "correctAnswer": q["correctAnswer"],
    } for q in questions]

    try:
        result = supabase.rpc("create_practice_quiz_with_questions", {
            "p_project_id": req.projectId,
            "p_question_count": req.questionCount,
            "p_difficulty_level": difficulty,
            "p_questions": payload,
            "p_idempotency_key": req.idempotencyKey,
        }).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Unable to save the generated quiz.")
        quiz_id = result.data.get("quizId") if isinstance(result.data, dict) else result.data[0].get("quizId")
    except HTTPException:
        raise
    except Exception as exc:
        if not _is_missing_generation_rpc(exc):
            raise HTTPException(status_code=500, detail="Unable to save the generated quiz.") from exc
        # Temporary compatibility path for a deployment where application code is
        # updated before the SQL migration. Once the RPC exists, the transactional
        # branch above is always preferred.
        try:
            quiz_id = _save_quiz_legacy(req.projectId, questions, difficulty)
        except Exception as save_exc:
            raise HTTPException(status_code=500, detail="Unable to save the generated quiz.") from save_exc

    return QuizResponse(quizId=quiz_id, questions=questions)
