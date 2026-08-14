from pydantic import BaseModel, Field
from typing import List


class FlashcardRequest(BaseModel):
    projectId: str
    materialIds: List[str] = Field(default_factory=list)
    flashcardCount: int = 10
    length: str = "short"


class FlashcardItem(BaseModel):
    front: str
    back: str


class FlashcardResponse(BaseModel):
    flashcardSetId: str
    flashcards: List[FlashcardItem]