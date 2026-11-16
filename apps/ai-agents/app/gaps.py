"""Gap log: questions the voice tools could not answer (GAP_LOG=on).

Rows go to ``public.kb_gaps`` (migrations/memory/0002_kb_gaps.up.sql) so the CS
team can see what knowledge or products are missing. Ported from the Shopify
chatbot's gap_logs. Never stores an email or postcode: order gaps keep only the
order-number digits and the outcome. Logging must never break or slow a call —
it is bounded by a short timeout and every failure is swallowed.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from app.config import get_settings
from app.services.supabase_client import get_supabase

log = logging.getLogger(__name__)

TABLE = "kb_gaps"
MAX_QUERY_CHARS = 300
INSERT_BUDGET_S = 1.5


def gap_log_enabled() -> bool:
    return get_settings().gap_log == "on"


def _insert(row: dict[str, Any]) -> None:
    get_supabase().table(TABLE).insert(row).execute()


def _select(days: int, limit: int) -> list[dict[str, Any]]:
    since = (datetime.now(UTC) - timedelta(days=days)).isoformat()
    res = (
        get_supabase()
        .table(TABLE)
        .select("created_at, channel, tool, gap_type, query, detail")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return list(res.data or [])


async def record_gap(
    tool: str,
    gap_type: str,
    *,
    query: str | None = None,
    detail: dict[str, Any] | None = None,
    channel: str = "voice",
) -> None:
    if not gap_log_enabled():
        return
    row = {
        "channel": channel,
        "tool": tool,
        "gap_type": gap_type,
        "query": query[:MAX_QUERY_CHARS] if query else None,
        "detail": detail or {},
    }
    try:
        await asyncio.wait_for(asyncio.to_thread(_insert, row), timeout=INSERT_BUDGET_S)
    except Exception:  # a gap log must never affect the caller
        log.warning("gap log insert failed (%s/%s); continuing", tool, gap_type, exc_info=True)


def list_gaps(days: int, limit: int) -> dict[str, Any]:
    rows = _select(days, limit)
    summary: dict[str, int] = {}
    for row in rows:
        summary[row["gap_type"]] = summary.get(row["gap_type"], 0) + 1
    return {"gaps": rows, "summary": summary}
