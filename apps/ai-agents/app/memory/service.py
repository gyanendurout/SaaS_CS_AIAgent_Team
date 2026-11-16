"""Knowledge search used by the response agent and the /tools/search_knowledge endpoint.

Returns ``[]`` (never raises) when KNOWLEDGE_SOURCE is ``static``, the query is
blank, or Supabase/OpenAI fail — callers then behave exactly as before.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from functools import lru_cache
from typing import Any

from supabase import Client, ClientOptions, create_client

from app.brand import normalize_brand
from app.config import get_settings
from app.memory.store import SupabaseKnowledgeStore
from app.services.openai_client import get_openai
from app.services.supabase_client import get_supabase
from app.textguard import clean_text

log = logging.getLogger(__name__)

MIN_SCORE = 0.3
DEFAULT_K = 3
QUERY_TIMEOUT_S = 3.0  # live replies / voice calls: fail fast, answer without memory
# Whole search (embedding + Supabase RPC). The RPC has no timeout of its own, so a
# hung database would otherwise stall the reply; stays under the API's 5 s voice cap.
SEARCH_BUDGET_S = 4.0
# Hard HTTP timeout on the search's own Supabase client. The asyncio budget above only
# stops *waiting*; this makes the worker thread itself give up, so a hung database
# can't pile up threads that the claim pipeline also needs (asyncio.to_thread pool).
DB_TIMEOUT_S = 3.0


# Repeat-question cache (KNOWLEDGE_CACHE_TTL_S > 0): the same normalised question
# reuses the last non-empty result — no embedding call, no DB search. Ported from
# the Shopify chatbot's answer cache policy: empty answers are never cached.
CACHE_MAX = 1000
_cache: dict[tuple[str, int], tuple[float, list[dict[str, Any]]]] = {}
_NON_WORD = re.compile(r"[^\w\s]")


def cache_key(query: str) -> str:
    """'How long is the JOOLA warranty?' == 'how long is the julia   warranty'."""
    text = normalize_brand(clean_text(query)).lower()
    return " ".join(_NON_WORD.sub(" ", text).split())


def clear_cache() -> None:
    _cache.clear()


@lru_cache(maxsize=1)
def get_memory_supabase() -> Client:
    """Supabase client for live searches only (ingest keeps the default client)."""
    s = get_settings()
    return create_client(
        s.supabase_url,
        s.supabase_secret_key,
        options=ClientOptions(postgrest_client_timeout=DB_TIMEOUT_S),
    )


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts with the configured OpenAI model (ingest path)."""
    resp = get_openai().embeddings.create(model=get_settings().embedding_model, input=texts)
    return [item.embedding for item in resp.data]


def embed_query(query: str) -> list[float]:
    client = get_openai().with_options(timeout=QUERY_TIMEOUT_S, max_retries=0)
    resp = client.embeddings.create(model=get_settings().embedding_model, input=[query])
    return list(resp.data[0].embedding)


def get_store() -> SupabaseKnowledgeStore:
    """Store for live searches (short DB timeout)."""
    return SupabaseKnowledgeStore(get_memory_supabase())


def get_ingest_store() -> SupabaseKnowledgeStore:
    """Store for bulk ingest (default timeout: batches of 100 vectors take longer)."""
    return SupabaseKnowledgeStore(get_supabase())


async def search_knowledge(query: str, k: int = DEFAULT_K) -> list[dict[str, Any]]:
    if get_settings().knowledge_source != "vector" or not query.strip():
        return []

    ttl = get_settings().knowledge_cache_ttl_s
    key = (cache_key(query), k)
    hit = _cache.get(key) if ttl else None
    if hit and time.monotonic() - hit[0] < ttl:
        return hit[1]

    def _search() -> list[dict[str, Any]]:
        return get_store().match(embed_query(normalize_brand(query)), k, MIN_SCORE)

    try:
        hits = await asyncio.wait_for(asyncio.to_thread(_search), timeout=SEARCH_BUDGET_S)
    except TimeoutError:
        log.warning("knowledge search exceeded %.1fs; continuing without memory", SEARCH_BUDGET_S)
        return []
    except Exception:
        log.warning("knowledge search failed; continuing without memory", exc_info=True)
        return []
    if ttl and hits:
        if len(_cache) >= CACHE_MAX:
            _cache.clear()  # simple bound; warm instances refill within minutes
        _cache[key] = (time.monotonic(), hits)
    return hits
