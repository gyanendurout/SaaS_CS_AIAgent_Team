"""End-to-end test of the compiled LangGraph pipeline."""

from __future__ import annotations

import pytest

from app.graph.build import build_graph
from app.graph.state import PipelineState


@pytest.mark.asyncio
async def test_pipeline_runs_end_to_end_for_in_warranty_nfc(
    seeded_supabase, fake_openai
) -> None:
    """Defective NFC paddle from JOOLA_DIRECT → ELIGIBLE_FOR_DAMAGE_REVIEW → draft path."""

    graph = build_graph()

    initial: PipelineState = {
        "claim_id": "WC-10001",
        "channel": "voice",
        "raw_input": {
            "issue": "Paddle face cracked",
            "is_defective": True,
        },
    }

    final = await graph.ainvoke(initial)

    assert final["claim_id"] == "WC-10001"
    assert "rule_engine_decision" in final
    decision = final["rule_engine_decision"]
    # NFC within 14 days + receipt approved + within 12 months → eligible for damage review.
    assert decision.decision.value == "ELIGIBLE_FOR_DAMAGE_REVIEW"
    assert final.get("needs_escalation") is False
    assert final.get("voice_reply"), "response agent should produce a voice reply"
    assert final.get("email_subject"), "response agent should produce an email subject"
    assert final.get("draft_id"), "response agent should insert a drafts row"


@pytest.mark.asyncio
async def test_pipeline_routes_to_escalation_for_safety(
    seeded_supabase, fake_openai
) -> None:
    """Safety concern → HUMAN_REVIEW_REQUIRED → esc node, not response."""

    graph = build_graph()

    initial: PipelineState = {
        "claim_id": "WC-10001",
        "channel": "email",
        "raw_input": {
            "issue": "Paddle gave off smoke",
            "is_defective": True,
            "is_safety_concern": True,
        },
    }

    final = await graph.ainvoke(initial)

    decision = final["rule_engine_decision"]
    assert decision.decision.value == "HUMAN_REVIEW_REQUIRED"
    assert final["needs_escalation"] is True
    assert final.get("escalation_id") == "WC-10001"
    # response node should NOT have run on the escalation branch.
    assert "voice_reply" not in final or not final.get("voice_reply")
