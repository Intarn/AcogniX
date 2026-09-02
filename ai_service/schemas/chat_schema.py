from pydantic import BaseModel, Field
from typing import Optional, List


class ChatRequest(BaseModel):
    projectId: str
    conversationId: Optional[str] = None
    userMessage: str
    materialIds: List[str] = Field(default_factory=list)


class ChatCitation(BaseModel):
    materialId: str
    documentId: str
    chunkId: str
    page: Optional[int] = None


class ChatResponse(BaseModel):
    conversationId: Optional[str] = None
    reply: str
    citations: List[ChatCitation] = Field(default_factory=list)