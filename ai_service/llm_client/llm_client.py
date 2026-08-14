import asyncio
import json

from google import genai
from google.genai import errors

from config import GEMINI_API_KEY, GENERATION_MODEL, CHAT_TIMEOUT_SECONDS

client = genai.Client(api_key=GEMINI_API_KEY)


class AIInvalidResponseError(Exception):
    """Raised when Gemini's output can't be parsed as the expected JSON shape."""
    pass


class AITimeoutError(Exception):
    """Raised when Gemini doesn't respond within CHAT_TIMEOUT_SECONDS (UC-02 alt flow)."""
    pass


def generate_text(prompt: str) -> str:
    response = client.models.generate_content(model=GENERATION_MODEL, contents=prompt)
    return response.text


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

    except errors.ServerError as e:
        if e.code == 503:
            raise AITimeoutError(
                "AI Tutor is temporarily busy. Please try again in a moment."
            )
        raise


def generate_json_array(prompt: str, context_label: str) -> list[dict]:
    raw = generate_text(prompt)
    cleaned = raw.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        raise AIInvalidResponseError(f"The AI returned an unreadable {context_label} response. Please try again.")

    if not isinstance(parsed, list) or len(parsed) == 0:
        raise AIInvalidResponseError(f"The AI returned an unreadable {context_label} response. Please try again.")

    return parsed