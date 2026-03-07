import logging
from typing import Generator, Iterable, Optional

from groq import Groq

from app.core.config import settings

logger = logging.getLogger(__name__)
_client: Optional[Groq] = None
_client_init_failed = False


def _get_client() -> Groq:
    global _client, _client_init_failed

    if _client is not None:
        return _client
    if _client_init_failed:
        raise RuntimeError("Groq client initialization previously failed")

    try:
        _client = Groq(api_key=settings.GROQ_API_KEY)
        return _client
    except Exception as exc:
        _client_init_failed = True
        logger.exception("Groq client initialization failed: %s", exc)
        raise


def _fallback_response() -> str:
    return """
    {
      "summary": "Provider fallback triggered.",
      "bugs": [],
      "improvements": [],
      "corrected_code": ""
    }
    """


def call_llm(prompt: str) -> str:
    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=1400,
            stream=False,
            timeout=settings.GROQ_TIMEOUT_SECONDS,
        )
        return response.choices[0].message.content or _fallback_response()
    except Exception as exc:
        logger.exception("LLM request failed: %s", exc)
        return _fallback_response()


def stream_llm(prompt: str) -> Generator[str, None, None]:
    try:
        client = _get_client()
        response_stream: Iterable = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=1400,
            stream=True,
            timeout=settings.GROQ_TIMEOUT_SECONDS,
        )

        for chunk in response_stream:
            delta = getattr(chunk.choices[0].delta, "content", None)
            if delta:
                yield delta
    except Exception as exc:
        logger.exception("LLM streaming failed: %s", exc)
        yield _fallback_response()
