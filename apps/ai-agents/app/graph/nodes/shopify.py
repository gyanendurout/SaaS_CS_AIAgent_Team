"""Agent 02 — Order Verifier.

Loads the claim's customer + order rows from Supabase. The dashboard demo
uses seeded Supabase data instead of a live Shopify API — the name is kept
for parity with the spec.

── ADAPTER POINT ─────────────────────────────────────────────────────────────
To connect the real Shopify storefront:
  1. Replace the `_fetch()` inner function with calls to the Shopify Admin API
     (GET /orders.json?email=... or GET /orders/{id}.json).
  2. Map the Shopify response to the same dict shape expected by downstream
     nodes:  { id, customer_id, order_number, product_name, product_sku,
               purchase_date, source, authorized }
  3. The `state["customer"]` and `state["order"]` keys must remain unchanged —
     all other pipeline nodes read from them directly.
  Everything outside `_fetch()` (audit events, state writes, error handling)
  stays as-is.
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
AGENT_ID = "shopify"


async def run(state: PipelineState) -> PipelineState:
    claim_id = state["claim_id"]
    await update_agent_state(
        AGENT_ID, state="busy", current_task_for=claim_id, load_pct=60
    )

    try:
        sb = get_supabase()

        def _fetch() -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
            claim_row = (
                sb.table("claims")
                .select("id, customer_id, order_id, channel, issue")
                .eq("id", claim_id)
                .limit(1)
                .execute()
                .data
            )
            if not claim_row:
                return None, None
            row = claim_row[0]

            customer = (
                sb.table("customers")
                .select("*")
                .eq("id", row["customer_id"])
                .limit(1)
                .execute()
                .data
            )
            order = None
            if row.get("order_id"):
                order_rows = (
                    sb.table("orders")
                    .select("*")
                    .eq("id", row["order_id"])
                    .limit(1)
                    .execute()
                    .data
                )
                order = order_rows[0] if order_rows else None

            # Fallback: if no order on the claim, attach the customer's most
            # recent order. Customers writing in about a warranty issue are
            # almost always referencing their most recent purchase.
            if not order and row.get("customer_id"):
                recent = (
                    sb.table("orders")
                    .select("*")
                    .eq("customer_id", row["customer_id"])
                    .order("purchase_date", desc=True)
                    .limit(1)
                    .execute()
                    .data
                )
                if recent:
                    order = recent[0]
                    # Backfill claims.order_id so future reads stay consistent.
                    sb.table("claims").update({"order_id": order["id"]}).eq(
                        "id", claim_id
                    ).execute()

            return (customer[0] if customer else None, order)

        customer, order = await asyncio.to_thread(_fetch)

        if not customer:
            raise RuntimeError(f"customer not found for claim {claim_id}")

        state["customer"] = customer
        state["order"] = order

        await write_case_event(
            claim_id,
            "AI_ORDER_VERIFIED",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload={
                "customer_id": customer.get("id"),
                "order_id": order.get("id") if order else None,
                "order_source": order.get("source") if order else None,
                "authorized": order.get("authorized") if order else None,
            },
        )

        await update_agent_state(AGENT_ID, state="idle", current_task_for=None, load_pct=0)
        return state

    except Exception as e:
        log.exception("shopify failed for %s", claim_id)
        await write_case_event(
            claim_id,
            "AI_ORDER_ERROR",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload={"error": str(e)},
        )
        await update_agent_state(AGENT_ID, state="error", current_task_for=None)
        state["error"] = str(e)
        raise
