from db import supabase
from services.chunking_service import split_into_chunks
from services.embedding_service import embed_texts


def index_document(document_id: str, extracted_text: str) -> int:
    """Chunks a Processed_Document's text, embeds each chunk, and stores
    them in Document_Chunk. Returns the number of chunks created."""
    chunks = split_into_chunks(extracted_text)
    if not chunks:
        return 0

    embeddings = embed_texts(chunks)

    rows = [
        {
            "documentId": document_id,
            "chunkIndex": i,
            "content": chunk,
            "embedding": embedding,
        }
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]

    supabase.table("Document_Chunk").insert(rows).execute()
    return len(rows)