"""Direct tool endpoints — called by the Fastify API which forwards Vapi tool requests.

Five tools:

| Path                                | Purpose                                                |
| ----------------------------------- | ------------------------------------------------------ |
| /tools/lookup_order                 | order lookup by order_number OR customer_email         |
| /tools/check_warranty_registration  | NFC registration lookup for an order                   |
| /tools/evaluate_eligibility         | pure delegation to warranty_policy.evaluate            |
| /tools/create_claim                 | insert into claims; optionally kicks off pipeline      |
| /tools/escalate_to_human            | insert into escalations + bump claim status            |
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from warranty_policy import ClaimInput, DecisionResult, evaluate

from app.graph.build import get_compiled_graph
from app.graph.state import PipelineState
from app.services.audit import write_case_event
from app.services.supabase_client import get_supabase

log = logging.getLogger(__name__)
router = APIRouter(prefix="/tools", tags=["tools"])


# --------------------------------------------------------------------------- #
# 1. lookup_order
# --------------------------------------------------------------------------- #


class LookupOrderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    order_number: str | None = None
    customer_email: str | None = None


class LookupOrderResponse(BaseModel):
    found: bool
    order: dict[str, Any] | None = None
    customer: dict[str, Any] | None = None


@router.post("/lookup_order", response_model=LookupOrderResponse)
async def lookup_order(req: LookupOrderRequest) -> LookupOrderResponse:
    if not (req.order_number or req.customer_email):
        raise HTTPException(400, "either order_number or customer_email is required")

    sb = get_supabase()

    def _fetch() -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        order: dict[str, Any] | None = None
        customer: dict[str, Any] | None = None

        if req.order_number:
            rows = (
                sb.table("orders")
                .select("*")
                .eq("order_number", req.order_number)
                .limit(1)
                .execute()
                .data
            )
            if rows:
                order = rows[0]
                cust_rows = (
                    sb.table("customers")
                    .select("*")
                    .eq("id", order["customer_id"])
                    .limit(1)
                    .execute()
                    .data
                )
                customer = cust_rows[0] if cust_rows else None
        elif req.customer_email:
            cust_rows = (
                sb.table("customers")
                .select("*")
                .eq("email", req.customer_email.strip().lower())
                .limit(1)
                .execute()
                .data
            )
            if cust_rows:
                customer = cust_rows[0]
                order_rows = (
                    sb.table("orders")
                    .select("*")
                    .eq("customer_id", customer["id"])
                    .order("purchase_date", desc=True)
                    .limit(1)
                    .execute()
                    .data
                )
                order = order_rows[0] if order_rows else None

        return order, customer

    order, customer = await asyncio.to_thread(_fetch)
    return LookupOrderResponse(found=bool(order), order=order, customer=customer)


# --------------------------------------------------------------------------- #
# 2. check_warranty_registration
# --------------------------------------------------------------------------- #


class CheckRegistrationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    order_number: str | None = None
    order_id: str | None = None


class CheckRegistrationResponse(BaseModel):
    found: bool
    registration: dict[str, Any] | None = None


@router.post("/check_warranty_registration", response_model=CheckRegistrationResponse)
async def check_warranty_registration(req: CheckRegistrationRequest) -> CheckRegistrationResponse:
    if not (req.order_number or req.order_id):
        raise HTTPException(400, "either order_number or order_id is required")

    sb = get_supabase()

    def _fetch() -> dict[str, Any] | None:
        order_id = req.order_id
        if not order_id and req.order_number:
            rows = (
                sb.table("orders")
                .select("id")
                .eq("order_number", req.order_number)
                .limit(1)
                .execute()
                .data
            )
            order_id = rows[0]["id"] if rows else None
        if not order_id:
            return None
        reg_rows = (
            sb.table("registrations")
            .select("*")
            .eq("order_id", order_id)
            .limit(1)
            .execute()
            .data
        )
        return reg_rows[0] if reg_rows else None

    registration = await asyncio.to_thread(_fetch)
    return CheckRegistrationResponse(found=bool(registration), registration=registration)


# --------------------------------------------------------------------------- #
# 3. evaluate_eligibility — pure delegation to the rule engine
# --------------------------------------------------------------------------- #


@router.post("/evaluate_eligibility", response_model=DecisionResult)
async def evaluate_eligibility(payload: dict[str, Any]) -> DecisionResult:
    """Stateless: synchronous, no DB write, no LLM call.

    ClaimInput is configured `strict=True` so internal Python callers must
    pass real ``date``/``ProductType`` instances. For HTTP requests we accept
    JSON primitives (date strings, enum value strings) and let Pydantic
    coerce — overriding strict for this one entry point only.
    """
    try:
        claim_input = ClaimInput.model_validate(payload, strict=False)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return evaluate(claim_input)


# --------------------------------------------------------------------------- #
# 4. create_claim
# --------------------------------------------------------------------------- #


class CreateClaimRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_id: str = Field(..., description="customers.id UUID")
    order_id: str | None = Field(default=None, description="orders.id UUID, optional")
    channel: str = Field(..., pattern="^(voice|email|web)$")
    issue: str = Field(..., min_length=1)
    raw_input: dict[str, Any] = Field(default_factory=dict)
    run_pipeline: bool = Field(
        default=False,
        description="If true, fire-and-forget the 7-agent pipeline after insert.",
    )


class CreateClaimResponse(BaseModel):
    claim_id: str
    pipeline_started: bool = False


@router.post("/create_claim", response_model=CreateClaimResponse)
async def create_claim(
    req: CreateClaimRequest, background: BackgroundTasks
) -> CreateClaimResponse:
    sb = get_supabase()

    def _insert() -> str:
        row = (
            sb.table("claims")
            .insert(
                {
                    "customer_id": req.customer_id,
                    "order_id": req.order_id,
                    "channel": req.channel,
                    "issue": req.issue,
                    "status_detail": "NEW",
                    "stage": "intake",
                }
            )
            .execute()
            .data
        )
        if not row:
            raise RuntimeError("claims insert returned no rows")
        return row[0]["id"]

    claim_id = await asyncio.to_thread(_insert)

    await write_case_event(
        claim_id,
        "CUST_CLAIM_CREATED",
        actor_type="CUSTOMER",
        actor_id=req.customer_id,
        payload={"channel": req.channel, "via": "tools.create_claim"},
    )

    if req.run_pipeline:
        background.add_task(_run_pipeline_safe, claim_id, req.channel, req.raw_input)
        return CreateClaimResponse(claim_id=claim_id, pipeline_started=True)

    return CreateClaimResponse(claim_id=claim_id, pipeline_started=False)


async def _run_pipeline_safe(claim_id: str, channel: str, raw_input: dict[str, Any]) -> None:
    """Background task wrapper — never raise out of a background task."""
    try:
        graph = get_compiled_graph()
        state: PipelineState = {
            "claim_id": claim_id,
            "channel": channel,
            "raw_input": raw_input,
        }
        await graph.ainvoke(state)
    except Exception:
        log.exception("background pipeline failed for %s", claim_id)


# --------------------------------------------------------------------------- #
# 5. escalate_to_human
# --------------------------------------------------------------------------- #


class EscalateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_id: str
    reason: str = Field(
        ...,
        description=(
            "One of REPLACEMENT_LIMIT_REACHED | OUTSIDE_REGION | DISPUTED_SELLER | "
            "AMBIGUOUS_DAMAGE | BRAND_RISK | SAFETY"
        ),
    )
    summary: str = Field(..., min_length=1)
    priority: str = Field(default="norm", pattern="^(urgent|high|norm)$")


class EscalateResponse(BaseModel):
    escalation_id: str
    priority: str


@router.post("/escalate_to_human", response_model=EscalateResponse)
async def escalate_to_human(req: EscalateRequest) -> EscalateResponse:
    sb = get_supabase()

    def _persist() -> None:
        sb.table("escalations").upsert(
            {
                "id": req.claim_id,
                "priority": req.priority,
                "reason": req.reason,
                "summary": req.summary,
                "wait_minutes": 0,
            }
        ).execute()
        sb.table("claims").update(
            {
                "primary_agent_id": "esc",
                "stage": "esc",
                "status_detail": "ESCALATED",
            }
        ).eq("id", req.claim_id).execute()

    await asyncio.to_thread(_persist)
    await write_case_event(
        req.claim_id,
        "AI_ESCALATED",
        actor_type="AI",
        actor_id="esc",
        payload={"reason": req.reason, "priority": req.priority, "via": "tools.escalate"},
    )
    return EscalateResponse(escalation_id=req.claim_id, priority=req.priority)
