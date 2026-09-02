import asyncio
import json
import time

from google import genai
from google.genai import errors

from config import GENERATION_MODEL, CHAT_TIMEOUT_SECONDS
from services.api_key_provider import api_key_provider


class AIInvalidResponseError(Exception):
    """Raised when Gemini's output can't be parsed as the expected JSON shape."""
    pass


class AITimeoutError(Exception):
    """Raised when Gemini doesn't respond within CHAT_TIMEOUT_SECONDS (UC-02 alt flow)."""
    pass


class AIProviderError(Exception):
    """Normalized transient/provider failure safe to expose through the internal API."""

    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = int(status_code)
        self.code = str(code)
        super().__init__(message)


def _provider_status(exc: Exception) -> int:
    for attr in ("code", "status_code", "status"):
        try:
            value = int(getattr(exc, attr, 0) or 0)
            if value:
                return value
        except (TypeError, ValueError):
            pass
    return 0


def _provider_error(exc: Exception) -> AIProviderError:
    status = _provider_status(exc)
    text = str(exc or "").lower()

    if status == 429 or "quota" in text or "resource_exhausted" in text or "rate limit" in text:
        return AIProviderError(
            503,
            "AI_PROVIDER_QUOTA",
            "The AI provider is temporarily quota-limited. Please try again or use the configured backup API key.",
        )

    if status in {500, 502, 503, 504} or any(
        token in text for token in ("temporarily unavailable", "overloaded", "service unavailable", "deadline exceeded")
    ):
        return AIProviderError(
            503,
            "AI_PROVIDER_UNAVAILABLE",
            "The AI provider is temporarily unavailable. Please try again shortly.",
        )

    if status in {400, 401, 403} or any(token in text for token in ("api key", "permission", "unauthorized", "forbidden")):
        return AIProviderError(
            502,
            "AI_PROVIDER_CONFIGURATION_ERROR",
            "The AI provider rejected the configured credentials or request.",
        )

    return AIProviderError(
        502,
        "AI_PROVIDER_ERROR",
        "The AI provider returned an unexpected error.",
    )


def _generate_content_with_retry(contents, attempts: int = 3):
    """Generate content with short retries only for provider/network style failures.

    Validation/content errors are not silently retried here; callers keep their own
    generation-correction loops for malformed quiz/flashcard JSON.
    """
    client = api_key_provider.get_generation_client()
    last_exc = None
    for attempt in range(1, max(1, int(attempts)) + 1):
        try:
            return client.models.generate_content(model=GENERATION_MODEL, contents=contents)
        except (errors.ServerError, errors.ClientError) as exc:
            last_exc = exc
            normalized = _provider_error(exc)
            if normalized.code not in {"AI_PROVIDER_QUOTA", "AI_PROVIDER_UNAVAILABLE"}:
                raise normalized from exc
            if attempt >= attempts:
                raise normalized from exc
            time.sleep(0.8 * attempt)
        except Exception as exc:
            # Some google-genai transport exceptions don't inherit from the public
            # API error classes. Normalize obvious transient/provider failures while
            # preserving programming/data errors as real exceptions.
            normalized = _provider_error(exc)
            if normalized.code in {"AI_PROVIDER_QUOTA", "AI_PROVIDER_UNAVAILABLE", "AI_PROVIDER_CONFIGURATION_ERROR"}:
                if normalized.code in {"AI_PROVIDER_QUOTA", "AI_PROVIDER_UNAVAILABLE"} and attempt < attempts:
                    last_exc = exc
                    time.sleep(0.8 * attempt)
                    continue
                raise normalized from exc
            raise
    raise _provider_error(last_exc or RuntimeError("AI provider request failed"))


def generate_content(contents, attempts: int = 3):
    return _generate_content_with_retry(contents, attempts=attempts)


def generate_text(prompt: str) -> str:
    response = _generate_content_with_retry(prompt, attempts=3)
    return str(getattr(response, "text", "") or "")


async def generate_text_with_timeout(prompt: str) -> str:
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(generate_text, prompt),
            timeout=CHAT_TIMEOUT_SECONDS,
        )

    except asyncio.TimeoutError:
        raise AITimeoutError(
            "Connection to AI Tutor interrupted. Please try again."
        )

    except AIProviderError:
        raise


def _extract_json_array_text(raw: str) -> str:
    cleaned = str(raw or "").replace("```json", "").replace("```", "").strip()
    if cleaned.startswith("[") and cleaned.endswith("]"):
        return cleaned
    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start >= 0 and end > start:
        return cleaned[start:end + 1]
    return cleaned


def generate_json_array(prompt: str, context_label: str, allow_empty: bool = False) -> list[dict]:
    raw = generate_text(prompt)
    cleaned = _extract_json_array_text(raw)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        raise AIInvalidResponseError(f"The AI returned an unreadable {context_label} response. Please try again.")

    if not isinstance(parsed, list):
        raise AIInvalidResponseError(f"The AI returned an unreadable {context_label} response. Please try again.")

    if len(parsed) == 0 and not allow_empty:
        raise AIInvalidResponseError(f"The AI returned an unreadable {context_label} response. Please try again.")

    return parsed
