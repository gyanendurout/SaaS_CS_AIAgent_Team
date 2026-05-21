"""Agent 05 — Claim Summary.

Builds an internal CS Lead summary, decides whether to route to escalation
or to draft, and stamps the claim's ``stage``/``status_detail``.
"""

from __future__ import annotations

import asyncio
import logging

from app.graph.state import PipelineState
from app.services.agent_state import update_agent_state
from app.services.audit import write_case_event
from app.services.supabase_client import get_supabase

log = logging.getLogger(__name__)
AGENT_ID = "summary"


def _build_summary(state: PipelineState) -> str:
    decision = state.get("rule_engine_decision")
    customer = state.get("customer") or {}
    order = state.get("order") or {}
    normalized = state.get("normalized") or {}

    lines = [
        f"Customer: {customer.get('name')} <{customer.get('email')}> ({customer.get('country')})",
        f"Channel: {state.get('channel')}",
        f"Issue:   {normalized.get('issue') or '(none reported)'}",
    ]
    if order:
        lines.append(
            f"Order:   #{order.get('order_number')} | {order.get('product_name')} "
            f"({order.get('product_type')}) | purchased {order.get('purchase_date')} | "
            f"source={order.get('source')}"
        )
    if decision is not None:
        lines.append(
            f"Decision: {decision.decision.value}  reason={decision.reason_code}  "
            f"cite={decision.citation}"
        )
        if decision.notes:
            lines.append(f"Note:    {decision.notes}")
    return "\n".join(lines)


async def run(state: PipelineState) -> PipelineState:
    claim_id = state["claim_id"]
    await update_agent_state(
        AGENT_ID, state="busy", current_task_for=claim_id, load_pct=50
    )

    try:
        summary_text = _build_summary(state)
        state["internal_summary"] = summary_text

        # Pre-set the next-stage status so the dashboard reflects where we are.
        next_stage = "esc" if state.get("needs_escalation") else "draft"
        next_status = "ESCALATED" if state.get("needs_escalation") else "DRAFT_PENDING_APPROVAL"

        sb = get_supabase()

        def _persist() -> None:
            sb.table("claims").update(
                {"stage": next_stage, "status_detail": next_status}
            ).eq("id", claim_id).execute()

        await asyncio.to_thread(_persist)

        await write_case_event(
            claim_id,
            "AI_SUMMARY_BUILT",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload={
                "needs_escalation": bool(state.get("needs_escalation")),
                "escalation_reason": state.get("escalation_reason"),
                "summary_chars": len(summary_text),
            },
        )

        await update_agent_state(AGENT_ID, state="idle", current_task_for=None, load_pct=0)
        return state

    except Exception as e:
        log.exception("summary failed for %s", claim_id)
        await write_case_event(
            claim_id,
            "AI_SUMMARY_ERROR",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload={"error": str(e)},
        )
        await update_agent_state(AGENT_ID, state="error", current_task_for=None)
        state["error"] = str(e)
        raise
