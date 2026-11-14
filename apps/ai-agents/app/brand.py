"""Brand-name correction for voice input.

JOOLA is said "YOO-la"; speech-to-text often writes it as Julia, Jula, Yola,
Yoola or Jolla. Search queries are corrected to "JOOLA" so a caller's question
finds the same knowledge and products as a typed one. Whole words only, so
names like "Julian" or "Yolanda" are left alone. Stored data is never changed.
"""

from __future__ import annotations

import re

_MISHEARD = re.compile(r"\b(?:julia|jula|yola|yoola|jolla|joola)\b", re.IGNORECASE)


def normalize_brand(text: str) -> str:
    return _MISHEARD.sub("JOOLA", text)
