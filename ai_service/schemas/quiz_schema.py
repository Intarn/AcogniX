from pydantic import BaseModel, Field
from typing import List, Optional


class QuizRequest(BaseModel):
    projectId: str
    materialIds: List[str] = Field(default_factory=list)
    questionCount: int = Field(default=5, ge=1, le=20)
    difficulty: str = "medium"
    idempotencyKey: Optional[str] = None


class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correctAnswer: str


class QuizResponse(BaseModel):
    quizId: str
    questions: List[QuizQuestion]