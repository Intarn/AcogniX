from google import genai
from google.genai import types

from config import GEMINI_API_KEY, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS

client = genai.Client(api_key=GEMINI_API_KEY)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embeds a batch of text chunks. Returns one 768-dim vector per input text,
    truncated via Matryoshka to match the Document_Chunk.embedding column."""
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSIONS),
    )
    return [e.values for e in result.embeddings]


def embed_query(query: str) -> list[float]:
    """Embeds a single search query (e.g. the Learner's chat question) using
    the same model/dimensionality so it's comparable against stored chunks."""
    return embed_texts([query])[0]