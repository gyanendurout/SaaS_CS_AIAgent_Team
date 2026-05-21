"""Shared state object passed between LangGraph nodes."""

from __future__ import annotations

from typing import Any, TypedDict

from warranty_policy import ClaimInput, DecisionResult


class PipelineState(TypedDict, total=False):
    """Mutable bag of values produced and consumed by the 7 agents.

    ``total=False`` so each node only needs to populate the fields it owns —
    LangGraph merges partial dict updates into the running state.
    """

    # --- intake input ---
    claim_id: str  # WC-XXXXX
    channel: str  # 'voice' | 'email' | 'web'
    raw_input: dict[str, Any]  # whatever the upstream Fastify API passed in

    # --- intake output ---
    normalized: dict[str, Any]

    # --- shopify output ---
    customer: dict[str, Any]
    order: dict[str, Any] | None

    # --- warrreg output ---
    registration: dict[str, Any] | None

    # --- rules output ---
    rule_engine_input: ClaimInput
    rule_engine_decision: DecisionResult

    # --- summary output ---
    internal_summary: str
    needs_escalation: bool
    escalation_reason: str | None

    # --- response output ---
    voice_reply: str
    email_subject: str
    email_body: str
    draft_id: str  # uuid of drafts row

    # --- escalation output ---
    escalation_id: str  # same as claim_id (escalations.id = claim_id)

    # --- error path ---
    error: str
