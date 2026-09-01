from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from middleware.internal_auth import verify_internal_request
from services.api_key_provider import api_key_provider, ApiKeyActivationError

router = APIRouter()


class GeminiKeyActivationRequest(BaseModel):
    apiKey: str = Field(min_length=1)
    validateEmbedding: bool = True


@router.post("/config/gemini-key/activate", dependencies=[Depends(verify_internal_request)])
async def activate_gemini_key(req: GeminiKeyActivationRequest):
    try:
        api_key_provider.activate(req.apiKey, validate_embedding=req.validateEmbedding)
    except ApiKeyActivationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {"success": True}
