def validate_quiz_items(items: list[dict]) -> list[dict]:
    """Drops/rejects malformed quiz questions instead of blindly trusting
    whatever Gemini returned — e.g. {"question": "", "options": [], "correctAnswer": ""}."""
    valid = []
    for item in items:
        if not isinstance(item, dict): continue

        question = (item.get("question") or item.get("Question") or "").strip()
        options = item.get("options") or item.get("Options") or []
        correct_answer = (item.get("correctAnswer") or item.get("CorrectAnswer") or "").strip()

        if not question or not isinstance(options, list) or len(options) < 2:
            continue
        if correct_answer not in options:
            continue

        valid.append({"question": question, "options": options, "correctAnswer": correct_answer})

    if not valid:
        raise ValueError("The AI did not return any usable quiz questions. Please try again.")
    return valid


def validate_flashcard_items(items: list[dict]) -> list[dict]:
    valid = []
    for item in items:
        if not isinstance(item, dict): continue
        
        front = (item.get("front") or item.get("Front") or "").strip()
        back = (item.get("back") or item.get("Back") or "").strip()

        if not front or not back:
            continue

        valid.append({"front": front, "back": back})

    if not valid:
        raise ValueError("The AI did not return any usable flashcards. Please try again.")
    return valid