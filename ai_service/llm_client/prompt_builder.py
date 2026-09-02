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


def build_quiz_prompt(source_contexts: list[dict], question_count: int, difficulty: str, source_quotas: list[int] | None = None) -> str:
    source_quotas = source_quotas or [0] * len(source_contexts)
    source_sections = []
    coverage_rules = []
    for index, source in enumerate(source_contexts, start=1):
        quota = source_quotas[index - 1] if index - 1 < len(source_quotas) else 0
        material_id = source.get("materialId", f"source-{index}")
        content = source.get("content", "")
        source_sections.append(
            f"SOURCE {index} (materialId={material_id}, requiredQuestions={quota}):\n{content}"
        )
        if quota > 0:
            coverage_rules.append(f"- Create exactly {quota} question(s) whose answer is supported primarily by SOURCE {index}.")

    context_text = "\n\n====================\n\n".join(source_sections)
    if len(source_contexts) > question_count:
        coverage_rules.append(
            "- There are more sources than questions. Every source must still influence at least one question; "
            "a question may combine compatible concepts from multiple sources when necessary."
        )
    else:
        coverage_rules.append("- Every selected source must be represented by at least one question.")
    coverage_text = "\n".join(coverage_rules)
    return f"""
You are an educational expert. Generate a balanced quiz using ALL selected Learning Materials below.

SELECTED SOURCES:
<<<CONTEXT>>>
{context_text}
<<<END CONTEXT>>>

Generate exactly {question_count} multiple-choice questions at a {difficulty} difficulty level.
SOURCE COVERAGE REQUIREMENTS:
{coverage_text}
- Do not let one source replace or stand in for another source.
- Do not use facts outside the selected sources.
- Every question must be answerable from the source assigned to it.
- Preserve source-specific identifiers, table/column names, proper names, and numeric values exactly as written when they are relevant.
- When a source contains a distinctive identifier or controlled numeric fact, include at least one such source-specific fact in the generated quiz whenever possible.

STRICT OUTPUT REQUIREMENTS:
- Return ONLY a valid JSON array.
- Do not include any additional explanatory text or markdown formatting.
- Use this exact format: [{{"question": "question text", "options": ["A", "B", "C", "D"], "correctAnswer": "the correct option"}}]
"""

def build_flashcard_prompt(source_contexts: list[dict], flashcard_count: int, length: str, source_quotas: list[int] | None = None) -> str:
    source_quotas = source_quotas or [0] * len(source_contexts)
    source_sections = []
    coverage_rules = []
    for index, source in enumerate(source_contexts, start=1):
        quota = source_quotas[index - 1] if index - 1 < len(source_quotas) else 0
        material_id = source.get("materialId", f"source-{index}")
        content = source.get("content", "")
        source_sections.append(
            f"SOURCE {index} (materialId={material_id}, requiredFlashcards={quota}):\n{content}"
        )
        if quota > 0:
            coverage_rules.append(f"- Create exactly {quota} flashcard(s) supported primarily by SOURCE {index}.")

    context_text = "\n\n====================\n\n".join(source_sections)
    if len(source_contexts) > flashcard_count:
        coverage_rules.append(
            "- There are more sources than flashcards. Every source must still influence at least one flashcard; "
            "a card may connect compatible concepts from multiple sources when necessary."
        )
    else:
        coverage_rules.append("- Every selected source must be represented by at least one flashcard.")
    coverage_text = "\n".join(coverage_rules)
    length_instruction = (
        "Write a detailed 2-3 sentence definition on the back of each card."
        if length == "detailed"
        else "Keep the back of each card to a single concise sentence."
    )
    return f"""
Create a balanced flashcard set using ALL selected Learning Materials below.

SELECTED SOURCES:
<<<CONTEXT>>>
{context_text}
<<<END CONTEXT>>>

Create exactly {flashcard_count} flashcards.
SOURCE COVERAGE REQUIREMENTS:
{coverage_text}
- Do not let one source replace or stand in for another source.
- Do not use facts outside the selected sources.
- Every flashcard must be supported by the source assigned to it.
- Preserve source-specific identifiers, table/column names, proper names, and numeric values exactly as written when they are relevant.
- When a source contains a distinctive identifier or controlled numeric fact, include at least one such source-specific fact in the flashcard set whenever possible.
{length_instruction}

CONTENT SUITABILITY CHECK:
- First verify that the selected material contains concrete learnable facts, terms, definitions, relationships, steps, or concepts.
- If the material is too short, meaningless, repetitive, or does not contain enough information to create reliable flashcards, return exactly [] and nothing else.
- Never invent facts just to reach the requested card count.

STRICT OUTPUT REQUIREMENTS:
- Return ONLY a valid JSON array.
- Do not include any markdown formatting.
- Use this exact format: [{{"front": "term or concept", "back": "definition or explanation"}}]
"""
