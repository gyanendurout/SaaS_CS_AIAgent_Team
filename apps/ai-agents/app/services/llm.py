"""Draft-writer model call, switchable between OpenAI and Claude (LLM_PROVIDER).

- ``openai`` (default): the original GPT-4o call, unchanged (JSON mode, temperature 0.4).
- ``anthropic``: Claude (ANTHROPIC_MODEL, default the low-cost Haiku) with structured
  JSON output (same three fields), a reply cap, and the large system prompt cached.

If ``anthropic`` is chosen but ANTHROPIC_API_KEY is missing, the OpenAI call is used
so drafting never stops. Embeddings stay on OpenAI (Anthropic has no embeddings API).
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

import anthropic

from app.config import get_settings
from app.services.openai_client import get_openai

log = logging.getLogger(__name__)

DRAFT_MAX_TOKENS = 1000
TEMPERATURE = 0.4
ANTHROPIC_TIMEOUT_S = 45.0

DRAFT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "voice_reply": {"type": "string"},
        "email_subject": {"type": "string"},
        "email_body": {"type": "string"},
    },
    "required": ["voice_reply", "email_subject", "email_body"],
    "additionalProperties": False,
}


@lru_cache(maxsize=1)
def get_anthropic() -> anthropic.Anthropic:
    return anthropic.Anthropic(
        api_key=get_settings().anthropic_api_key, timeout=ANTHROPIC_TIMEOUT_S, max_retries=2
    )


def active_provider() -> str:
    s = get_settings()
    if s.llm_provider == "anthropic" and not s.anthropic_api_key:
        log.warning("LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty — using OpenAI")
        return "openai"
    return s.llm_provider


def draft_reply(system: str, user: str) -> tuple[str, str]:
    """Return (raw JSON text, model id). Blocking — call via asyncio.to_thread."""
    s = get_settings()
    if active_provider() == "anthropic":
        msg = get_anthropic().messages.create(
            model=s.anthropic_model,
            max_tokens=DRAFT_MAX_TOKENS,  # no temperature: not a Messages API parameter
            # The decision is already made by the rules engine; writing the reply needs no
            # reasoning. With default thinking, hidden reasoning used up max_tokens and the
            # JSON was cut off (QA 2026-11-16) — off is also cheaper and faster.
            thinking={"type": "disabled"},
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user}],
            output_config={"format": {"type": "json_schema", "schema": DRAFT_SCHEMA}},
        )
        if msg.stop_reason == "max_tokens":
            raise RuntimeError(f"Claude draft cut off at max_tokens={DRAFT_MAX_TOKENS}")
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        if not text:
            raise RuntimeError(f"Claude returned no text (stop_reason={msg.stop_reason})")
        return text, s.anthropic_model

    chat = get_openai().chat.completions.create(
        model=s.openai_model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format={"type": "json_object"},
        temperature=TEMPERATURE,
    )
    return chat.choices[0].message.content or "{}", s.openai_model
