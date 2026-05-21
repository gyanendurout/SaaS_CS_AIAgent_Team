"""Agent 07 — Escalation Router.

Inserts (or upserts) a row in ``escalations`` with the rule engine's
``escalation_reason`` and a short summary for the right-panel queue.
"""

from __future__ import annotations

import asyncio
import logging

from app.graph.state import PipelineState
from app.services.agent_state import update_agent_state
from app.services.audit import write_case_event
from app.services.supabase_client import get_supabase

log = logging.getLogger(__name__)
AGENT_ID = "esc"


# Map escalation reasons to UI priority (matches dashboard expectations).
_PRIORITY_BY_REASON: dict[str, str] = {
    "SAFETY": "urgent",
    "BRAND_RISK": "urgent",
    "AMBIGUOUS_DAMAGE": "high",
    "DISPUTED_SELLER": "high",
    "REPLACEMENT_LIMIT_REACHED": "norm",
    "OUTSIDE_REGION": "norm",
}


async def run(state: PipelineState) -> PipelineState:
    claim_id = state["claim_id"]
    await update_agent_state(
        AGENT_ID, state="busy", current_task_for=claim_id, load_pct=60
    )

    try:
        reason = state.get("escalation_reason") or "DISPUTED_SELLER"
        priority = _PRIORITY_BY_REASON.get(reason, "norm")
        summary_text = state.get("internal_summary") or "Escalation requested by rule engine."

        sb = get_supabase()

        def _persist() -> None:
            sb.table("escalations").upsert(
                {
                    "id": claim_id,
                    "priority": priority,
                    "reason": reason,
                    "summary": summary_text,
                    "wait_minutes": 0,
                }
            ).execute()
            sb.table("claims").update(
                {
                    "primary_agent_id": AGENT_ID,
                    "stage": "esc",
                    "status_detail": "ESCALATED",
                }
            ).eq("id", claim_id).execute()

        await asyncio.to_thread(_persist)
        state["escalation_id"] = claim_id

        await write_case_event(
            claim_id,
            "AI_ESCALATED",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload={"reason": reason, "priority": priority},
        )

        await update_agent_state(AGENT_ID, state="idle", current_task_for=None, load_pct=0)
        return state

    except Exception as e:
        log.exception("escalation failed for %s", claim_id)
        await write_case_event(
            claim_id,
            "AI_ESCALATION_ERROR",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload={"error": str(e)},
        )
        await update_agent_state(AGENT_ID, state="error", current_task_for=None)
        state["error"] = str(e)
        raise
