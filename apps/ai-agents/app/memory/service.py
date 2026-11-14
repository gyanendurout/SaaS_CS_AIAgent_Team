"""Knowledge search used by the response agent and the /tools/search_knowledge endpoint.

Returns ``[]`` (never raises) when KNOWLEDGE_SOURCE is ``static``, the query is
blank, or Supabase/OpenAI fail — callers then behave exactly as before.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.config import get_settings
from app.memory.store import SupabaseKnowledgeStore
from app.services.openai_client import get_openai
from app.services.supabase_client import get_supabase

log = logging.getLogger(__name__)

MIN_SCORE = 0.3
DEFAULT_K = 3
QUERY_TIMEOUT_S = 3.0  # live replies / voice calls: fail fast, answer without memory


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts with the configured OpenAI model (ingest path)."""
    resp = get_openai().embeddings.create(model=get_settings().embedding_model, input=texts)
    return [item.embedding for item in resp.data]


def embed_query(query: str) -> list[float]:
    client = get_openai().with_options(timeout=QUERY_TIMEOUT_S, max_retries=0)
    resp = client.embeddings.create(model=get_settings().embedding_model, input=[query])
    return list(resp.data[0].embedding)


def get_store() -> SupabaseKnowledgeStore:
    return SupabaseKnowledgeStore(get_supabase())


async def search_knowledge(query: str, k: int = DEFAULT_K) -> list[dict[str, Any]]:
    if get_settings().knowledge_source != "vector" or not query.strip():
        return []

    def _search() -> list[dict[str, Any]]:
        return get_store().match(embed_query(query), k, MIN_SCORE)

    try:
        return await asyncio.to_thread(_search)
    except Exception:
        log.warning("knowledge search failed; continuing without memory", exc_info=True)
        return []
