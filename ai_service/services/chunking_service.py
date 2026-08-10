import re
from config import CHUNK_SIZE_TOKENS, CHUNK_OVERLAP_TOKENS

# Rough token estimate: ~4 characters per token for English/Vietnamese mixed text.
# Good enough for chunk-sizing purposes; we don't need exact tokenizer precision here.
CHARS_PER_TOKEN = 4


def split_into_chunks(text: str) -> list[str]:
    """Splits text into overlapping chunks, breaking on paragraph/sentence
    boundaries where possible so chunks don't cut mid-sentence."""
    chunk_size_chars = CHUNK_SIZE_TOKENS * CHARS_PER_TOKEN
    overlap_chars = CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN

    # Split on paragraph breaks first, so we can pack whole paragraphs
    # into chunks instead of cutting arbitrarily mid-word.
    paragraphs = re.split(r"\n\s*\n", text)

    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current) + len(para) + 2 <= chunk_size_chars:
            current = f"{current}\n\n{para}" if current else para
        else:
            if current:
                chunks.append(current)
            # Carry over the tail of the previous chunk as overlap context
            overlap = current[-overlap_chars:] if current else ""
            current = f"{overlap}\n\n{para}" if overlap else para

            # Paragraph itself longer than one chunk: hard-split it
            while len(current) > chunk_size_chars:
                chunks.append(current[:chunk_size_chars])
                current = current[chunk_size_chars - overlap_chars:]

    if current:
        chunks.append(current)

    return chunks