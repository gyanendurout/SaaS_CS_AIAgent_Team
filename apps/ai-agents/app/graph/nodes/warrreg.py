"""Agent 03 — Warranty Registry.

Looks up the NFC registration row for the order (when present). The schema
trigger ``set_registration_within_window`` keeps the §2.5 14-day flag fresh,
so we just read it.

── ADAPTER POINT ─────────────────────────────────────────────────────────────
To connect the real Infinity / NFC registry:
  1. Replace the `_fetch()` inner function with a call to the Infinity API
     (e.g. GET /registrations?order_id=... or a GraphQL lookup by NFC chip ID).
  2. Map the response to the same dict shape the rules node expects:
       { id, order_id, registered (bool), nfc_id, within_window (bool),
         receipt_approved (bool) }
     The `within_window` flag (§2.5 — registered within 14 days of purchase)
     must be computed here if the external API does not supply it directly.
  3. `state["registration"]` must remain the key name; the rules engine and
     the dashboard drawer both read it.
  Everything outside `_fetch()` stays as-is.
──────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.graph.state import PipelineState
from app.services.agent_state import update_agent_state
from app.services.audit import write_case_event
from app.services.supabase_client import get_supabase

log = logging.getLogger(__name__)
AGENT_ID = "warrreg"


async def run(state: PipelineState) -> PipelineState:
    claim_id = state["claim_id"]
    await update_agent_state(
        AGENT_ID, state="busy", current_task_for=claim_id, load_pct=50
    )

    try:
        order = state.get("order") or {}
        order_id = order.get("id")
        registration: dict[str, Any] | None = None

        if order_id:
            sb = get_supabase()

            def _fetch() -> dict[str, Any] | None:
                rows = (
                    sb.table("registrations")
                    .select("*")
                    .eq("order_id", order_id)
                    .limit(1)
                    .execute()
                    .data
                )
                return rows[0] if rows else None

            registration = await asyncio.to_thread(_fetch)

        state["registration"] = registration

        await write_case_event(
            claim_id,
            "AI_REGISTRY_CHECKED",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload={
                "has_registration": bool(registration),
                "registered": bool((registration or {}).get("registered")),
                "within_window": bool((registration or {}).get("within_window")),
                "receipt_approved": bool((registration or {}).get("receipt_approved")),
            },
        )

        await update_agent_state(AGENT_ID, state="idle", current_task_for=None, load_pct=0)
        return state

    except Exception as e:
        log.exception("warrreg failed for %s", claim_id)
        await write_case_event(
            claim_id,
            "AI_REGISTRY_ERROR",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload={"error": str(e)},
        )
        await update_agent_state(AGENT_ID, state="error", current_task_for=None)
        state["error"] = str(e)
        raise
