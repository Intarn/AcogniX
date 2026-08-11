from fastapi import Request, HTTPException
from config import INTERNAL_SERVICE_SECRET


async def verify_internal_request(request: Request):
    """
    Dependency injected into every route. Confirms the caller is our own
    Node.js Main Backend, not an arbitrary internet client — this service
    should never be reachable directly by end users.
    """
    provided = request.headers.get("x-internal-secret")
    if provided != INTERNAL_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized internal request.")