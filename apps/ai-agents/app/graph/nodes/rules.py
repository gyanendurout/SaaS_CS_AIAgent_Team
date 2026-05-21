"""Agent 04 — Rule Engine.

Builds a ``ClaimInput`` from the gathered state and delegates to the
deterministic ``warranty_policy.evaluate`` function. The DecisionResult is
persisted back to the ``claims`` row and dropped into state for downstream
agents.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime
from typing import Any

from warranty_policy import (
    ClaimInput,
    Decision,
    OrderSource,
    ProductType,
    evaluate,
)

from app.graph.state import PipelineState
from app.services.agent_state import update_agent_state
from app.services.audit import write_case_event
from app.services.supabase_client import get_supabase

log = logging.getLogger(__name__)
AGENT_ID = "rules"


def _to_date(value: Any) -> date | None:
    """Best-effort conversion of Supabase JSON dates / ISO strings to ``date``."""
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        # Tolerate ISO datetime ("2025-12-01T00:00:00+00:00") and plain date ("2025-12-01").
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _build_claim_input(state: PipelineState) -> ClaimInput:
    """Map the gathered state into the rule engine's strict input model."""

    normalized = state.get("normalized") or {}
    customer = state.get("customer") or {}
    order = state.get("order") or {}
    registration = state.get("registration") or {}

    purchase_date = _to_date(order.get("purchase_date")) or date.today()
    claim_date = date.today()

    nfc_registration_date = _to_date(registration.get("registered_at"))

    return ClaimInput(
        customer_country=(customer.get("country") or "US").upper()[:2],
        is_original_purchaser=bool(normalized.get("is_original_purchaser", True)),
        product_type=ProductType(order.get("product_type", ProductType.OTHER.value)),
        order_source=OrderSource(order.get("source", OrderSource.JOOLA_DIRECT.value)),
        purchase_date=purchase_date,
        claim_date=claim_date,
        is_defective=bool(normalized.get("is_defective", True)),
        is_wrong_item_shipped=bool(normalized.get("is_wrong_item_shipped", False)),
        is_safety_concern=bool(normalized.get("is_safety_concern", False)),
        is_damaged_in_freight=bool(normalized.get("is_damaged_in_freight", False)),
        freight_was_signed_for=normalized.get("freight_was_signed_for"),
        is_ambiguous_damage=bool(normalized.get("is_ambiguous_damage", False)),
        is_final_sale=bool(normalized.get("is_final_sale", False)),
        received_date=_to_date(normalized.get("received_date")),
        is_opened=bool(normalized.get("is_opened", False)),
        nfc_registered=bool(registration.get("registered", False)),
        nfc_registration_date=nfc_registration_date,
        nfc_receipt_uploaded=bool(registration.get("receipt_uploaded", False)),
        nfc_receipt_approved=bool(registration.get("receipt_approved", False)),
        replacements_so_far=int(normalized.get("replacements_so_far", 0)),
        is_cancellation_request=bool(normalized.get("is_cancellation_request", False)),
        wants_different_model=bool(normalized.get("wants_different_model", False)),
        wants_shipping_refund=bool(normalized.get("wants_shipping_refund", False)),
    )


async def run(state: PipelineState) -> PipelineState:
    claim_id = state["claim_id"]
    await update_agent_state(
        AGENT_ID, state="busy", current_task_for=claim_id, load_pct=80
    )

    try:
        claim_input = _build_claim_input(state)
        decision = evaluate(claim_input)

        state["rule_engine_input"] = claim_input
        state["rule_engine_decision"] = decision
        state["needs_escalation"] = decision.decision == Decision.HUMAN_REVIEW_REQUIRED
        state["escalation_reason"] = (
            decision.escalation_reason.value if decision.escalation_reason else None
        )

        # Persist the decision back to claims so the dashboard sees it live.
        sb = get_supabase()

        def _persist() -> None:
            sb.table("claims").update(
                {
                    "decision": decision.decision.value,
                    "reason_code": decision.reason_code,
                    "citation": decision.citation,
                    "policy_version": decision.policy_version,
                    "primary_agent_id": AGENT_ID,
                    "stage": "rules",
                    "status_detail": "IN_RULE_EVAL",
                }
            ).eq("id", claim_id).execute()

        await asyncio.to_thread(_persist)

        await write_case_event(
            claim_id,
            "AI_RULE_EVALUATED",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload=decision.model_dump(mode="json"),
        )

        await update_agent_state(AGENT_ID, state="idle", current_task_for=None, load_pct=0)
        return state

    except Exception as e:
        log.exception("rules failed for %s", claim_id)
        await write_case_event(
            claim_id,
            "AI_RULE_ERROR",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload={"error": str(e)},
        )
        await update_agent_state(AGENT_ID, state="error", current_task_for=None)
        state["error"] = str(e)
        raise
