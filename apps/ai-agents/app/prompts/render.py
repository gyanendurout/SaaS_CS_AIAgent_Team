"""Render the per-claim user message passed alongside the cached system prompt."""

from __future__ import annotations

import json
from typing import Any

from warranty_policy import DecisionResult


def render_user_message(
    *,
    decision: DecisionResult,
    customer: dict[str, Any],
    order: dict[str, Any] | None,
    registration: dict[str, Any] | None,
    channel: str,
    issue: str,
) -> str:
    """Build a structured user message for the GPT-4o call.

    Keeps the payload compact and shaped — the model sees JSON-ish context
    plus a one-line instruction at the bottom.
    """

    context = {
        "channel": channel,
        "customer": {
            "name": customer.get("name"),
            "email": customer.get("email"),
            "country": customer.get("country"),
        },
        "order": _order_snapshot(order),
        "nfc_registration": _registration_snapshot(registration),
        "issue_as_reported": issue.strip(),
        "rule_engine_decision": {
            "decision": decision.decision.value,
            "reason_code": decision.reason_code,
            "citation": decision.citation,
            "escalation_reason": (
                decision.escalation_reason.value if decision.escalation_reason else None
            ),
            "internal_notes": decision.notes,
            "policy_version": decision.policy_version,
        },
    }

    return (
        "Draft the customer reply for the case below. "
        "Match channel-appropriate tone (voice = spoken, conversational; "
        "email = slightly more formal but still warm). "
        "Return ONLY the JSON object specified in the system prompt.\n\n"
        "CONTEXT:\n"
        f"{json.dumps(context, indent=2, default=str)}"
    )


def _order_snapshot(order: dict[str, Any] | None) -> dict[str, Any] | None:
    if not order:
        return None
    return {
        "order_number": order.get("order_number"),
        "product_name": order.get("product_name"),
        "product_type": order.get("product_type"),
        "purchase_date": order.get("purchase_date"),
        "source": order.get("source"),
        "authorized": order.get("authorized"),
    }


def _registration_snapshot(reg: dict[str, Any] | None) -> dict[str, Any] | None:
    if not reg:
        return None
    return {
        "registered": reg.get("registered"),
        "registered_at": reg.get("registered_at"),
        "within_window": reg.get("within_window"),
        "receipt_uploaded": reg.get("receipt_uploaded"),
        "receipt_approved": reg.get("receipt_approved"),
    }
