from pydantic import BaseModel
from typing import Optional


class ChatRequest(BaseModel):
    projectId: str
    conversationId: Optional[str] = None  # None = start a new conversation
    userMessage: str


class ChatResponse(BaseModel):
    conversationId: str
    reply: str