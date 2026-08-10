from pydantic import BaseModel
from typing import Optional, List


class QuizRequest(BaseModel):
    projectId: str
    questionCount: int = 5
    difficulty: str = "medium"


class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correctAnswer: str


class QuizResponse(BaseModel):
    quizId: str
    questions: List[QuizQuestion]