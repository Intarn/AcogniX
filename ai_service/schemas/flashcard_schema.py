from pydantic import BaseModel, Field
from typing import List, Optional


class FlashcardRequest(BaseModel):
    projectId: str
    materialIds: List[str] = Field(default_factory=list)
    flashcardCount: int = Field(default=10, ge=1, le=30)
    length: str = "short"
    idempotencyKey: Optional[str] = None


class FlashcardItem(BaseModel):
    front: str
    back: str


class FlashcardResponse(BaseModel):
    flashcardSetId: str
    flashcards: List[FlashcardItem]