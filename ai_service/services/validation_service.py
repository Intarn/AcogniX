import re


def _normalize_identity(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().casefold())


def validate_quiz_items(items: list[dict]) -> list[dict]:
    """Return only complete, unique four-option multiple-choice questions."""
    valid = []
    seen_questions = set()

    for item in items:
        if not isinstance(item, dict):
            continue

        question = (item.get("question") or item.get("Question") or "").strip()
        options = item.get("options") or item.get("Options") or []
        correct_answer = (item.get("correctAnswer") or item.get("CorrectAnswer") or "").strip()

        if not question or not isinstance(options, list) or len(options) != 4:
            continue

        normalized_options = [str(option or "").strip() for option in options]
        if any(not option for option in normalized_options):
            continue
        if len({_normalize_identity(option) for option in normalized_options}) != 4:
            continue
        if correct_answer not in normalized_options:
            continue

        identity = _normalize_identity(question)
        if identity in seen_questions:
            continue
        seen_questions.add(identity)

        valid.append({
            "question": question,
            "options": normalized_options,
            "correctAnswer": correct_answer,
        })

    if not valid:
        raise ValueError("The AI did not return any usable quiz questions. Please try again.")
    return valid


def validate_flashcard_items(items: list[dict]) -> list[dict]:
    valid = []
    seen_cards = set()

    for item in items:
        if not isinstance(item, dict):
            continue

        front = (item.get("front") or item.get("Front") or "").strip()
        back = (item.get("back") or item.get("Back") or "").strip()

        if not front or not back:
            continue

        identity = (_normalize_identity(front), _normalize_identity(back))
        if identity in seen_cards:
            continue
        seen_cards.add(identity)
        valid.append({"front": front, "back": back})

    if not valid:
        raise ValueError("The AI did not return any usable flashcards. Please try again.")
    return valid
