import asyncio
import json
import time
import logging

from google import genai
from google.genai import errors, types

from config import (
    GENERATION_MODEL,
    CHAT_FALLBACK_MODEL,
    CHAT_TIMEOUT_SECONDS,
    CHAT_PRIMARY_TIMEOUT_SECONDS,
)
from services.api_key_provider import api_key_provider

logger = logging.getLogger("acognix.ai_provider")


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
    raw_message = str(exc or "")
    text = raw_message.lower()

    # Keep the original provider failure visible in the AI-service terminal.
    # Do not log credentials/request payloads here.
    logger.error(
        "Gemini request failed: type=%s status=%s message=%s",
        type(exc).__name__,
        status or "unknown",
        raw_message,
    )

    # Quota/rate-limit is a distinct condition. Preserve HTTP 429 instead of
    # converting it to 503, otherwise the UI/admin cannot tell quota from an
    # actual provider outage.
    if status == 429 or any(
        token in text for token in ("resource_exhausted", "rate limit", "rate-limit", "too many requests")
    ):
        return AIProviderError(
            429,
            "AI_PROVIDER_QUOTA",
            "The AI provider is temporarily quota- or rate-limited. Please try again or use the configured backup API key.",
        )

    if status in {500, 502, 503, 504} or any(
        token in text for token in ("temporarily unavailable", "overloaded", "service unavailable", "unavailable", "deadline exceeded")
    ):
        return AIProviderError(
            503,
            "AI_PROVIDER_UNAVAILABLE",
            "The AI provider is temporarily unavailable. Please try again shortly.",
        )

    if status in {401, 403} or any(
        token in text for token in ("invalid api key", "api key not valid", "permission denied", "unauthorized", "forbidden")
    ):
        return AIProviderError(
            502,
            "AI_PROVIDER_CONFIGURATION_ERROR",
            "The AI provider rejected the configured API key or project permissions.",
        )

    if status == 400 or any(token in text for token in ("invalid_argument", "bad request")):
        return AIProviderError(
            502,
            "AI_PROVIDER_REQUEST_ERROR",
            "The AI provider rejected the generated request. Please check the configured model and request settings.",
        )

    return AIProviderError(
        502,
        "AI_PROVIDER_ERROR",
        "The AI provider returned an unexpected error.",
    )


def _generate_content_with_retry(contents, attempts: int = 3, config=None):
    """Generate content with short retries only for provider/network style failures.

    Validation/content errors are not silently retried here; callers keep their own
    generation-correction loops for malformed quiz/flashcard JSON.
    """
    client = api_key_provider.get_generation_client()
    last_exc = None
    for attempt in range(1, max(1, int(attempts)) + 1):
        try:
            return client.models.generate_content(
                model=GENERATION_MODEL,
                contents=contents,
                config=config,
            )
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
    # Quiz/flashcard generation keeps the existing retry policy because those
    # flows are not constrained by UC-02's 30-second chat timeout.
    response = _generate_content_with_retry(prompt, attempts=3)
    return str(getattr(response, "text", "") or "")


def _chat_generation_config():
    """Build a low-latency config for grounded AI Tutor answers.

    Newer google-genai releases support thinking_level="minimal".  Keep a
    compatibility fallback so an older installed SDK does not break startup.
    """
    try:
        return types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level="minimal"),
            max_output_tokens=1024,
        )
    except Exception:
        return types.GenerateContentConfig(max_output_tokens=1024)


def _fallback_chat_generation_config():
    """Low-latency config compatible with Gemini 2.5 Flash."""
    try:
        return types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0),
            max_output_tokens=1024,
        )
    except Exception:
        return types.GenerateContentConfig(max_output_tokens=1024)


def _generate_chat_with_model(prompt: str, model: str, config):
    client = api_key_provider.get_generation_client()
    try:
        return client.models.generate_content(
            model=model,
            contents=prompt,
            config=config,
        )
    except Exception as exc:
        raise _provider_error(exc) from exc


def generate_chat_text(prompt: str) -> str:
    """Synchronous chat helper retained for compatibility/tests.

    Runtime /api/chat uses generate_text_with_timeout() below so the primary model
    gets its own short latency budget before falling back.
    """
    try:
        response = _generate_chat_with_model(
            prompt,
            GENERATION_MODEL,
            _chat_generation_config(),
        )
    except AIProviderError as exc:
        if exc.code != "AI_PROVIDER_UNAVAILABLE":
            raise
        logger.warning(
            "Primary Gemini model unavailable; falling back: primary=%s fallback=%s",
            GENERATION_MODEL,
            CHAT_FALLBACK_MODEL,
        )
        response = _generate_chat_with_model(
            prompt,
            CHAT_FALLBACK_MODEL,
            _fallback_chat_generation_config(),
        )
    return str(getattr(response, "text", "") or "")


async def _generate_chat_model_async(prompt: str, model: str, config, timeout_seconds: float):
    return await asyncio.wait_for(
        asyncio.to_thread(_generate_chat_with_model, prompt, model, config),
        timeout=max(0.1, float(timeout_seconds)),
    )


async def generate_text_with_timeout(prompt: str) -> str:
    """Generate an AI Tutor reply within the UC-02 30-second budget.

    The primary model gets only CHAT_PRIMARY_TIMEOUT_SECONDS. If it is slow or
    returns a transient 503, the fallback starts immediately and receives the
    remaining part of the same 30-second budget. Quota/key/request errors are
    still surfaced directly and do not trigger model fallback.
    """
    loop = asyncio.get_running_loop()
    started_at = loop.time()
    primary_budget = min(float(CHAT_PRIMARY_TIMEOUT_SECONDS), float(CHAT_TIMEOUT_SECONDS))

    try:
        response = await _generate_chat_model_async(
            prompt,
            GENERATION_MODEL,
            _chat_generation_config(),
            primary_budget,
        )
        return str(getattr(response, "text", "") or "")

    except asyncio.TimeoutError:
        logger.warning(
            "Primary Gemini model exceeded %.1fs; falling back: primary=%s fallback=%s",
            primary_budget,
            GENERATION_MODEL,
            CHAT_FALLBACK_MODEL,
        )

    except AIProviderError as exc:
        if exc.code != "AI_PROVIDER_UNAVAILABLE":
            raise
        logger.warning(
            "Primary Gemini model unavailable; falling back: primary=%s fallback=%s",
            GENERATION_MODEL,
            CHAT_FALLBACK_MODEL,
        )

    elapsed = loop.time() - started_at
    remaining = float(CHAT_TIMEOUT_SECONDS) - elapsed
    if remaining <= 0:
        raise AITimeoutError("Connection to AI Tutor interrupted. Please try again.")

    try:
        response = await _generate_chat_model_async(
            prompt,
            CHAT_FALLBACK_MODEL,
            _fallback_chat_generation_config(),
            remaining,
        )
        return str(getattr(response, "text", "") or "")
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
