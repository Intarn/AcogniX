def build_tutor_prompt(context_chunks: list[str], chat_history: list[dict], user_message: str) -> str:
    context_text = "\n\n---\n\n".join(context_chunks)

    history_text = ""
    if chat_history:
        history_text = "\n".join(
            f"{'Student' if msg['role'] == 'LEARNER' else 'AI Tutor'}: {msg['content']}"
            for msg in chat_history
        )

    return f"""
You are the AcogniX AI Study Assistant. You are a helpful, encouraging, and accurate tutor.
Answer the student's question based strictly on the provided document excerpts below.
If the answer is not contained in these excerpts, kindly say so instead of guessing.

RELEVANT DOCUMENT EXCERPTS:
\"\"\"{context_text}\"\"\"

PREVIOUS CHAT HISTORY:
{history_text}

STUDENT'S NEW QUESTION: {user_message}

AI TUTOR RESPONSE:
"""


def build_quiz_prompt(context_chunks: list[str], question_count: int, difficulty: str) -> str:
    context_text = "\n\n---\n\n".join(context_chunks)
    return f"""
You are an educational expert. Based on the following document excerpts:
\"\"\"{context_text}\"\"\"

Generate {question_count} multiple-choice questions at a {difficulty} difficulty level.
STRICT REQUIREMENTS:
- Return ONLY a valid JSON array.
- Do not include any additional explanatory text or markdown formatting (like ```json).
- Use this exact format: [{{"question": "question text", "options": ["A", "B", "C", "D"], "correctAnswer": "the correct option"}}]
"""


def build_flashcard_prompt(context_chunks: list[str], flashcard_count: int, length: str) -> str:
    context_text = "\n\n---\n\n".join(context_chunks)
    length_instruction = (
        "Write a detailed 2-3 sentence definition on the back of each card."
        if length == "detailed"
        else "Keep the back of each card to a single concise sentence."
    )
    return f"""
Based on the following document excerpts:
\"\"\"{context_text}\"\"\"

Create {flashcard_count} flashcards containing the most important terms and definitions.
{length_instruction}
STRICT REQUIREMENTS:
- Return ONLY a valid JSON array.
- Do not include any markdown formatting.
- Use this exact format: [{{"front": "term or concept", "back": "detailed definition or explanation"}}]
"""