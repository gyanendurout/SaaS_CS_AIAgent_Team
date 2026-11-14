"""Speech-to-text writes the brand "JOOLA" (said "YOO-la") as Julia/Jula/Yola.

Searches must still treat those as JOOLA, so memory and catalogue lookups from
voice calls work the same as typed ones.
"""

from __future__ import annotations

import pytest

from app.brand import normalize_brand
from app.catalog.storefront import extract_keywords
from app.config import get_settings
from app.memory import service


@pytest.mark.parametrize(
    "heard",
    ["Julia", "julia", "Jula", "JULA", "Yola", "yoola", "Jolla", "Joola"],
)
def test_misheard_brand_becomes_joola(heard: str) -> None:
    assert normalize_brand(f"Does {heard} ship to Vietnam?") == "Does JOOLA ship to Vietnam?"


def test_possessive_misheard_brand_keeps_its_ending() -> None:
    assert normalize_brand("What is Julia's return policy") == "What is JOOLA's return policy"


def test_other_words_containing_the_letters_are_untouched() -> None:
    text = "Julian bought a Yolanda bag from Jolla Bay"
    assert normalize_brand(text) == "Julian bought a Yolanda bag from JOOLA Bay"
    assert normalize_brand("no brand here") == "no brand here"


def test_catalogue_keywords_drop_misheard_brand() -> None:
    assert extract_keywords("Julia Perseus 16mm") == ["perseus", "16mm"]
    assert extract_keywords("is the yola kosmos pro vee in stock") == ["kosmos", "pro", "v"]


async def test_knowledge_search_embeds_the_corrected_brand(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KNOWLEDGE_SOURCE", "vector")
    get_settings.cache_clear()
    seen: list[str] = []

    class _Store:
        def match(self, embedding: list[float], k: int, min_score: float) -> list[dict[str, object]]:
            return []

    monkeypatch.setattr(service, "get_store", lambda: _Store())
    monkeypatch.setattr(service, "embed_query", lambda q: seen.append(q) or [1.0])
    try:
        await service.search_knowledge("how long is the Julia paddle warranty")
    finally:
        get_settings.cache_clear()
    assert seen == ["how long is the JOOLA paddle warranty"]
