"""POST /pipeline/run — run the full 7-agent LangGraph pipeline for one claim."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.graph import PipelineState
from app.graph.build import get_compiled_graph

log = logging.getLogger(__name__)
router = APIRouter(prefix="/pipeline", tags=["pipeline"])


class PipelineRequest(BaseModel):
    """What Fastify (or any caller) sends to kick off the pipeline."""

    model_config = ConfigDict(extra="forbid")

    claim_id: str = Field(..., description="WC-XXXXX — must already exist in claims table")
    channel: str = Field(..., pattern="^(voice|email|web)$")
    raw_input: dict[str, Any] = Field(
        default_factory=dict,
        description="Free-form intake payload — gets normalized by agent 01",
    )


class PipelineResponse(BaseModel):
    claim_id: str
    decision: dict[str, Any] | None
    needs_escalation: bool
    draft_id: str | None = None
    escalation_id: str | None = None
    error: str | None = None


@router.post("/run", response_model=PipelineResponse)
async def run_pipeline(req: PipelineRequest) -> PipelineResponse:
    """Invoke the compiled LangGraph end-to-end."""

    graph = get_compiled_graph()

    initial: PipelineState = {
        "claim_id": req.claim_id,
        "channel": req.channel,
        "raw_input": req.raw_input,
    }

    try:
        final_state: dict[str, Any] = await graph.ainvoke(initial)
    except Exception as e:  # noqa: BLE001
        log.exception("pipeline failed for %s", req.claim_id)
        raise HTTPException(status_code=500, detail=f"pipeline error: {e}") from e

    decision = final_state.get("rule_engine_decision")
    return PipelineResponse(
        claim_id=req.claim_id,
        decision=(decision.model_dump(mode="json") if decision is not None else None),
        needs_escalation=bool(final_state.get("needs_escalation")),
        draft_id=final_state.get("draft_id"),
        escalation_id=final_state.get("escalation_id"),
        error=final_state.get("error"),
    )
