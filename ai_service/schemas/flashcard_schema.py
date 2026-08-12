from pydantic import BaseModel
from typing import Optional, List


class FlashcardRequest(BaseModel):
    projectId: str
    materialId: str
    flashcardCount: int = 10
    length: str = "short"


class FlashcardItem(BaseModel):
    front: str
    back: str


class FlashcardResponse(BaseModel):
    flashcardSetId: str
    flashcards: List[FlashcardItem]