from google import genai
from google.genai import types
from google.genai.errors import ClientError

from config import EMBEDDING_MODEL, EMBEDDING_DIMENSIONS
from services.api_key_provider import api_key_provider


class EmbeddingQuotaExceeded(RuntimeError):
    """Raised when Gemini embedding quota is temporarily exhausted."""


class EmbeddingServiceError(RuntimeError):
    """Raised for non-quota embedding provider failures."""


def _is_quota_error(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None)
    message = str(exc).upper()
    return status_code == 429 or "RESOURCE_EXHAUSTED" in message or "QUOTA EXCEEDED" in message


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embeds a batch of text chunks.

    Quota exhaustion is classified explicitly so callers can fall back safely
    instead of turning a temporary provider limit into an unhandled HTTP 500.
    """
    if not texts:
        return []

    client = api_key_provider.get_embedding_client()
    try:
        result = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=texts,
            config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSIONS),
        )
    except ClientError as exc:
        if _is_quota_error(exc):
            raise EmbeddingQuotaExceeded(
                "Gemini embedding quota is temporarily exhausted. Please try again shortly."
            ) from exc
        raise EmbeddingServiceError("Gemini embedding request failed.") from exc
    except Exception as exc:
        if _is_quota_error(exc):
            raise EmbeddingQuotaExceeded(
                "Gemini embedding quota is temporarily exhausted. Please try again shortly."
            ) from exc
        raise EmbeddingServiceError("Gemini embedding request failed.") from exc

    embeddings = getattr(result, "embeddings", None) or []
    if len(embeddings) != len(texts):
        raise EmbeddingServiceError("Gemini embedding response was incomplete.")

    return [embedding.values for embedding in embeddings]


def embed_query(query: str) -> list[float]:
    """Embeds one search query using the same model/dimensionality as chunks."""
    return embed_texts([query])[0]
