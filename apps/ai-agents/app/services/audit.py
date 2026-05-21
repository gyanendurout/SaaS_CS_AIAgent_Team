"""Write a row to ``case_events`` — the audit trail for every claim action."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.config import get_settings
from app.services.supabase_client import get_supabase

log = logging.getLogger(__name__)


async def write_case_event(
    claim_id: str,
    event_type: str,
    actor_type: str,
    actor_id: str,
    payload: dict[str, Any] | None = None,
) -> None:
    """Insert into ``case_events``.

    Args:
        claim_id:   WC-XXXXX id.
        event_type: AI_*, CS_*, CUST_*, SYS_*.
        actor_type: AI | CS_LEAD | CUSTOMER | SYSTEM.
        actor_id:   Agent id ('intake', 'rules', ...) or user id.
        payload:    Arbitrary JSON-safe metadata.

    Wraps the synchronous supabase-py call in :func:`asyncio.to_thread` so we
    don't block the event loop.
    """

    sb = get_supabase()
    settings = get_settings()

    def _insert() -> None:
        sb.table("case_events").insert(
            {
                "claim_id": claim_id,
                "event_type": event_type,
                "actor_type": actor_type,
                "actor_id": actor_id,
                "payload": payload or {},
                "policy_version": settings.policy_version,
            }
        ).execute()

    try:
        await asyncio.to_thread(_insert)
    except Exception as e:  # noqa: BLE001
        # Audit must never break the pipeline. Log loudly but continue.
        log.exception("case_events insert failed for %s/%s: %s", claim_id, event_type, e)
