from pydantic import BaseModel, Field
from typing import List


class QuizRequest(BaseModel):
    projectId: str
    materialIds: List[str] = Field(default_factory=list)
    questionCount: int = 5
    difficulty: str = "medium"


class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correctAnswer: str


class QuizResponse(BaseModel):
    quizId: str
    questions: List[QuizQuestion]