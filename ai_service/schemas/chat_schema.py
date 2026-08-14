from pydantic import BaseModel, Field
from typing import Optional, List


class ChatRequest(BaseModel):
    projectId: str
    conversationId: Optional[str] = None
    userMessage: str
    materialIds: List[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    conversationId: str
    reply: str