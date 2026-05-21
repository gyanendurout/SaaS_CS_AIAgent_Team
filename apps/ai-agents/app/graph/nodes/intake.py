"""Agent 01 — Intake Normalizer.

Reads ``raw_input`` (a free-form dict produced by the upstream Fastify API
from voice/email/web), normalizes it to a canonical shape, writes an audit
event, and returns the updated state.
"""

from __future__ import annotations

import logging
from typing import Any

from app.graph.state import PipelineState
from app.services.agent_state import update_agent_state
from app.services.audit import write_case_event

log = logging.getLogger(__name__)
AGENT_ID = "intake"


async def run(state: PipelineState) -> PipelineState:
    """Normalize ``raw_input`` into ``state['normalized']``."""

    claim_id = state["claim_id"]
    await update_agent_state(
        AGENT_ID, state="busy", current_task_for=claim_id, load_pct=60
    )

    try:
        raw: dict[str, Any] = state.get("raw_input") or {}
        normalized = {
            "claim_id": claim_id,
            "channel": state.get("channel"),
            "issue": str(raw.get("issue", "")).strip(),
            "customer_email": (raw.get("customer_email") or raw.get("email") or "").strip().lower()
            or None,
            "order_number": (raw.get("order_number") or "").strip() or None,
            "is_defective": bool(raw.get("is_defective", True)),
            "is_wrong_item_shipped": bool(raw.get("is_wrong_item_shipped", False)),
            "is_safety_concern": bool(raw.get("is_safety_concern", False)),
            "is_damaged_in_freight": bool(raw.get("is_damaged_in_freight", False)),
            "freight_was_signed_for": raw.get("freight_was_signed_for"),
            "is_ambiguous_damage": bool(raw.get("is_ambiguous_damage", False)),
            "is_final_sale": bool(raw.get("is_final_sale", False)),
            "received_date": raw.get("received_date"),
            "is_opened": bool(raw.get("is_opened", False)),
            "is_cancellation_request": bool(raw.get("is_cancellation_request", False)),
            "wants_different_model": bool(raw.get("wants_different_model", False)),
            "wants_shipping_refund": bool(raw.get("wants_shipping_refund", False)),
        }
        state["normalized"] = normalized

        await write_case_event(
            claim_id,
            "AI_INTAKE_NORMALIZED",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload={"input_keys": list(raw.keys()), "channel": state.get("channel")},
        )

        await update_agent_state(AGENT_ID, state="idle", current_task_for=None, load_pct=0)
        return state

    except Exception as e:
        log.exception("intake failed for %s", claim_id)
        await write_case_event(
            claim_id,
            "AI_INTAKE_ERROR",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload={"error": str(e)},
        )
        await update_agent_state(AGENT_ID, state="error", current_task_for=None)
        state["error"] = str(e)
        raise
