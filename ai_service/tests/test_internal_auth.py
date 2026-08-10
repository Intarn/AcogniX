import asyncio
import pytest
from fastapi import HTTPException, Request

from middleware.internal_auth import verify_internal_request
import config


def make_request(secret_header: str | None):
    headers = {}
    if secret_header is not None:
        headers[b"x-internal-secret"] = secret_header.encode()
    scope = {"type": "http", "headers": list(headers.items())}
    return Request(scope)


def test_rejects_missing_secret():
    request = make_request(None)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(verify_internal_request(request))
    assert exc_info.value.status_code == 401


def test_rejects_wrong_secret():
    request = make_request("wrong-secret")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(verify_internal_request(request))
    assert exc_info.value.status_code == 401


def test_accepts_correct_secret():
    request = make_request(config.INTERNAL_SERVICE_SECRET)
    # Should not raise
    asyncio.run(verify_internal_request(request))