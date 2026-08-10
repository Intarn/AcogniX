from pydantic import BaseModel
from typing import Optional


class ExtractionResponse(BaseModel):
    documentId: str
    materialId: str
    status: str  # COMPLETED | FAILED
    extractedText: Optional[str] = None
    errorMessage: Optional[str] = None