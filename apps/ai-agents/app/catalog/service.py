"""Gated product search used by /tools/search_products (voice) and future channels.

Returns ``[]`` (never raises) when CATALOG_SOURCE is ``off``, credentials are
missing, the question has no product words, or Shopify fails.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from app.catalog.storefront import StorefrontClient, extract_keywords
from app.config import get_settings

log = logging.getLogger(__name__)

CACHE_TTL_S = 300.0
CACHE_MAX = 500
DEFAULT_LIMIT = 5
_cache: dict[tuple[str, int], tuple[float, list[dict[str, Any]]]] = {}


def catalog_enabled() -> bool:
    s = get_settings()
    return s.catalog_source == "shopify" and bool(s.shopify_store and s.shopify_storefront_token)


def get_client() -> StorefrontClient:
    s = get_settings()
    return StorefrontClient(
        store=s.shopify_store,
        token=s.shopify_storefront_token,
        api_version=s.shopify_api_version,
    )


def clear_cache() -> None:
    _cache.clear()


async def search_products(query: str, limit: int = DEFAULT_LIMIT) -> list[dict[str, Any]]:
    if not catalog_enabled():
        return []
    keywords = extract_keywords(query)
    if not keywords:
        return []

    key = (" ".join(keywords), limit)
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_TTL_S:
        return hit[1]

    try:
        results = await get_client().search(keywords, limit)
    except Exception:  # a catalogue outage must never break a call
        log.warning("Shopify product search failed for %r; continuing without it", key[0], exc_info=True)
        return []
    if len(_cache) >= CACHE_MAX:
        _cache.clear()  # simple bound; warm instances rebuild it within minutes
    _cache[key] = (time.monotonic(), results)
    return results
