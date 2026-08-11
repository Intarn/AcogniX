import io
import re

import fitz  # pymupdf
import pytesseract
from PIL import Image
from docx import Document

from config import TESSERACT_CMD

if TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

# Below this many characters, a PDF's embedded text layer is considered
# empty/unreliable — likely a scanned document — and we fall back to OCR.
MIN_TEXT_LENGTH_FOR_VALID_EXTRACTION = 20


def clean_text(text: str) -> str:
    """Basic normalization: consistent line endings, collapsed whitespace
    and blank lines. Keeps the cached Processed_Document readable and
    keeps prompt size down when this text is later sent to the LLM."""
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_text_from_pdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        raw_text = "\n".join(page.get_text() for page in doc).strip()

        if len(raw_text) >= MIN_TEXT_LENGTH_FOR_VALID_EXTRACTION:
            return clean_text(raw_text)

        # Fallback: scanned/image-only PDF — render each page and OCR it (UC-08)
        ocr_parts = []
        for page in doc:
            pixmap = page.get_pixmap(dpi=200)
            image = Image.open(io.BytesIO(pixmap.tobytes("png")))
            ocr_parts.append(pytesseract.image_to_string(image, lang="eng+vie"))
        return clean_text("\n".join(ocr_parts))
    finally:
        doc.close()


def extract_text_from_docx(file_bytes: bytes) -> str:
    document = Document(io.BytesIO(file_bytes))
    text = "\n".join(p.text for p in document.paragraphs if p.text.strip())
    return clean_text(text)


def extract_text_from_image(file_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(file_bytes))
    text = pytesseract.image_to_string(image, lang="eng+vie")
    return clean_text(text)