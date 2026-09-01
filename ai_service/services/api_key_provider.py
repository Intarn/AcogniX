import threading
import time

from google import genai
from google.genai import types

from config import (
    GEMINI_API_KEY,
    GENERATION_MODEL,
    EMBEDDING_MODEL,
    EMBEDDING_DIMENSIONS,
)


class ApiKeyActivationError(Exception):
    pass


class ApiKeyProvider:
    """Owns the live Gemini clients and swaps them atomically after validation.

    No request handler keeps a separate global Gemini client. This lets an Admin
    rotate the key without restarting the Python process.
    """

    def __init__(self, initial_key: str):
        self._lock = threading.RLock()
        self._key = initial_key
        self._generation_client = genai.Client(api_key=initial_key)
        self._embedding_client = genai.Client(api_key=initial_key)

    def get_generation_client(self):
        with self._lock:
            return self._generation_client

    def get_embedding_client(self):
        with self._lock:
            return self._embedding_client

    @staticmethod
    def _provider_status(exc: Exception) -> int:
        for attr in ("code", "status_code", "status"):
            try:
                value = int(getattr(exc, attr, 0) or 0)
                if value:
                    return value
            except (TypeError, ValueError):
                pass
        return 0

    @classmethod
    def _safe_validation_error(cls, stage: str, exc: Exception) -> str:
        status = cls._provider_status(exc)
        text = str(exc or "").lower()
        if status == 429 or any(token in text for token in ("quota", "resource_exhausted", "rate limit")):
            return f"Gemini {stage} validation is quota-limited (HTTP {status or 429})."
        if status in {401, 403} or any(token in text for token in ("api key", "permission", "unauthorized", "forbidden")):
            return f"Gemini {stage} validation rejected the API key or project permissions (HTTP {status or 403})."
        if status == 404 or "not found" in text or "model" in text and "not" in text:
            return f"Gemini {stage} validation could not access the configured model (HTTP {status or 404})."
        if status in {500, 502, 503, 504} or any(token in text for token in ("unavailable", "overloaded", "deadline exceeded", "timeout")):
            return f"Gemini {stage} validation is temporarily unavailable (HTTP {status or 503})."
        return f"Gemini {stage} validation failed" + (f" (HTTP {status})" if status else "") + "."

    @classmethod
    def _with_retry(cls, stage: str, func, attempts: int = 3):
        last = None
        for attempt in range(1, max(1, int(attempts)) + 1):
            try:
                return func()
            except Exception as exc:
                last = exc
                status = cls._provider_status(exc)
                text = str(exc or "").lower()
                transient = status in {429, 500, 502, 503, 504} or any(
                    token in text for token in ("quota", "resource_exhausted", "rate limit", "unavailable", "overloaded", "deadline exceeded", "timeout")
                )
                if transient and attempt < attempts:
                    time.sleep(0.8 * attempt)
                    continue
                raise ApiKeyActivationError(cls._safe_validation_error(stage, exc)) from exc
        raise ApiKeyActivationError(cls._safe_validation_error(stage, last or RuntimeError("validation failed")))

    def activate(self, new_key: str, validate_embedding: bool = True) -> None:
        candidate_key = str(new_key or "").strip()
        if not candidate_key:
            raise ApiKeyActivationError("Gemini API key cannot be empty.")

        candidate_generation = genai.Client(api_key=candidate_key)
        candidate_embedding = genai.Client(api_key=candidate_key)

        generation = self._with_retry(
            "generation",
            lambda: candidate_generation.models.generate_content(
                model=GENERATION_MODEL,
                contents="Reply with exactly OK.",
            ),
        )
        if not str(getattr(generation, "text", "") or "").strip():
            raise ApiKeyActivationError("Gemini generation validation returned an empty response.")

        if validate_embedding:
            embedding = self._with_retry(
                "embedding",
                lambda: candidate_embedding.models.embed_content(
                    model=EMBEDDING_MODEL,
                    contents=["AcogniX key validation"],
                    config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSIONS),
                ),
            )
            if not getattr(embedding, "embeddings", None):
                raise ApiKeyActivationError("Gemini embedding validation returned no embedding.")

        with self._lock:
            self._key = candidate_key
            self._generation_client = candidate_generation
            self._embedding_client = candidate_embedding


api_key_provider = ApiKeyProvider(GEMINI_API_KEY)
