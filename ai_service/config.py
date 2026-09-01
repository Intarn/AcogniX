import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# Shared secret Node.js must send in the X-Internal-Secret header.
# This service is never exposed to the public internet directly —
# only the Main Backend (Node.js) calls it — but the secret is a
# cheap extra guard in case network isolation is ever misconfigured.
INTERNAL_SERVICE_SECRET = os.environ["AI_SERVICE_INTERNAL_SECRET"]

GENERATION_MODEL = "gemini-3.6-flash"
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSIONS = 768  # must match the Document_Chunk.embedding column (vector(768))

CHUNK_SIZE_TOKENS = 700
CHUNK_OVERLAP_TOKENS = 100

CHAT_TIMEOUT_SECONDS = 30  # per UC-02 alt flow

TESSERACT_CMD = os.environ.get("TESSERACT_CMD")
if not TESSERACT_CMD and os.name == "nt":
    for candidate in (
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ):
        if Path(candidate).exists():
            TESSERACT_CMD = candidate
            break