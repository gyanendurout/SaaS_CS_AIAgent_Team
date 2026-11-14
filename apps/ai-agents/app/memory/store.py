"""Supabase-backed knowledge store (table ``kb_chunks`` + RPC ``match_kb_chunks``).

See migrations/memory/0001_kb_chunks.up.sql for the schema.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

if TYPE_CHECKING:
    from supabase import Client

TABLE = "kb_chunks"
MATCH_FN = "match_kb_chunks"
PAGE = 1000
DELETE_BATCH = 50


class SupabaseKnowledgeStore:
    def __init__(self, client: Client) -> None:
        self._client = client

    def existing_hashes(self) -> set[str]:
        hashes: set[str] = set()
        start = 0
        while True:  # PostgREST caps a select at 1000 rows, so page through.
            query = self._client.table(TABLE).select("content_hash")
            rows = cast(list[dict[str, Any]], query.range(start, start + PAGE - 1).execute().data)
            hashes.update(str(r["content_hash"]) for r in rows)
            if len(rows) < PAGE:
                return hashes
            start += PAGE

    def upsert(self, rows: list[dict[str, Any]]) -> None:
        if rows:
            self._client.table(TABLE).upsert(rows, on_conflict="content_hash").execute()

    def delete_hashes(self, hashes: set[str]) -> None:
        # Hashes travel in the URL query string; batch to stay under URL limits.
        ordered = sorted(hashes)
        for i in range(0, len(ordered), DELETE_BATCH):
            batch = ordered[i : i + DELETE_BATCH]
            self._client.table(TABLE).delete().in_("content_hash", batch).execute()

    def match(self, embedding: list[float], k: int, min_score: float) -> list[dict[str, Any]]:
        params = {"query_embedding": embedding, "match_count": k, "min_score": min_score}
        return cast(list[dict[str, Any]], self._client.rpc(MATCH_FN, params).execute().data or [])
