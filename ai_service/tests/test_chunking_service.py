from services.chunking_service import split_into_chunks


def test_short_text_returns_single_chunk():
    text = "This is a short paragraph about React."
    chunks = split_into_chunks(text)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_empty_text_returns_no_chunks():
    assert split_into_chunks("") == []
    assert split_into_chunks("   \n\n   ") == []


def test_long_text_splits_into_multiple_chunks():
    # Well above CHUNK_SIZE_TOKENS * 4 chars/token
    paragraph = "React is a JavaScript library for building UIs. " * 100
    text = "\n\n".join([paragraph] * 5)
    chunks = split_into_chunks(text)
    assert len(chunks) > 1
    # Every chunk should carry actual content, not be empty
    assert all(chunk.strip() for chunk in chunks)


def test_chunks_preserve_paragraph_boundaries_when_possible():
    paragraphs = [f"Paragraph {i} with some content here." for i in range(5)]
    text = "\n\n".join(paragraphs)
    chunks = split_into_chunks(text)
    # Short paragraphs should be packed together, not split mid-sentence
    joined = " ".join(chunks)
    for p in paragraphs:
        assert p in joined