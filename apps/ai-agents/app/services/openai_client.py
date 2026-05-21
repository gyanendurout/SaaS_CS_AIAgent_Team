"""Singleton OpenAI v1 client (used only by the response agent)."""

from __future__ import annotations

from functools import lru_cache

from openai import OpenAI

from app.config import get_settings


@lru_cache(maxsize=1)
def get_openai() -> OpenAI:
    """Return the process-wide OpenAI client."""
    s = get_settings()
    return OpenAI(api_key=s.openai_api_key)
