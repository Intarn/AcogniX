import pytest
from services.validation_service import validate_quiz_items, validate_flashcard_items


def test_validate_quiz_items_keeps_well_formed_items():
    items = [
        {"question": "What is React?", "options": ["A library", "A car", "A food", "A game"], "correctAnswer": "A library"}
    ]
    result = validate_quiz_items(items)
    assert len(result) == 1
    assert result[0]["correctAnswer"] == "A library"


def test_validate_quiz_items_drops_empty_question():
    items = [{"question": "", "options": [], "correctAnswer": ""}]
    with pytest.raises(ValueError):
        validate_quiz_items(items)


def test_validate_quiz_items_drops_item_where_correct_answer_not_in_options():
    items = [
        {"question": "Valid?", "options": ["A", "B"], "correctAnswer": "C"},  # invalid: dropped
        {"question": "Also valid?", "options": ["X", "Y"], "correctAnswer": "X"},  # valid: kept
    ]
    result = validate_quiz_items(items)
    assert len(result) == 1
    assert result[0]["question"] == "Also valid?"


def test_validate_quiz_items_accepts_capitalized_keys_from_model():
    items = [{"Question": "Capitalized key?", "Options": ["A", "B"], "CorrectAnswer": "A"}]
    result = validate_quiz_items(items)
    assert len(result) == 1
    assert result[0]["question"] == "Capitalized key?"


def test_validate_flashcard_items_drops_incomplete_cards():
    items = [
        {"front": "Term", "back": ""},       # dropped: empty back
        {"front": "", "back": "Definition"},  # dropped: empty front
        {"front": "Term2", "back": "Def2"},   # kept
    ]
    result = validate_flashcard_items(items)
    assert len(result) == 1
    assert result[0]["front"] == "Term2"


def test_validate_flashcard_items_raises_when_none_valid():
    with pytest.raises(ValueError):
        validate_flashcard_items([{"front": "", "back": ""}])