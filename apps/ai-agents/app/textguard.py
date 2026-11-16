"""Input cleaning for live tool requests (voice).

Ported from the Shopify chatbot's request model (CONTROL_CHARS_RE) and extended:
control characters become a space, zero-width characters are removed (they can
hide words from matching), and whitespace is collapsed. Letters in any script and
emoji are kept.
"""

from __future__ import annotations

import re

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")
_ZERO_WIDTH = re.compile(r"[​-‏⁠﻿]")
_SPACE = re.compile(r"\s+")


def clean_text(value: str) -> str:
    text = _ZERO_WIDTH.sub("", value)
    text = _CONTROL.sub(" ", text)
    return _SPACE.sub(" ", text).strip()


def clean_optional(value: object) -> object:
    """Pydantic ``mode="before"`` helper: clean strings, pass anything else through."""
    return clean_text(value) if isinstance(value, str) else value
