"""Agent 06 — Customer Reply Drafter.

Only LLM call in the pipeline. Sends the cached system prompt + a per-claim
user message to the draft model (GPT-4o, or Claude when LLM_PROVIDER=anthropic —
see app/services/llm.py); expects strict JSON back; inserts a ``drafts`` row
in ``pending_approval`` state.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from app.config import get_settings
from app.graph.state import PipelineState
from app.memory.service import search_knowledge
from app.prompts import SYSTEM_PROMPT, render_user_message
from app.services.agent_state import update_agent_state
from app.services.audit import write_case_event
from app.services.llm import draft_reply
from app.services.supabase_client import get_supabase

log = logging.getLogger(__name__)
AGENT_ID = "response"


def _parse_reply(raw: str) -> dict[str, str]:
    """Tolerantly parse the JSON reply, stripping common ```json fences."""

    candidate = raw.strip()
    if candidate.startswith("```"):
        # Strip leading ```json (or ```), and trailing ```
        candidate = candidate.split("\n", 1)[1] if "\n" in candidate else candidate[3:]
        if candidate.endswith("```"):
            candidate = candidate[: -3]
        candidate = candidate.strip()

    parsed: dict[str, Any] = json.loads(candidate)
    return {
        "voice_reply": str(parsed.get("voice_reply", "")).strip(),
        "email_subject": str(parsed.get("email_subject", "")).strip(),
        "email_body": str(parsed.get("email_body", "")).strip(),
    }


async def run(state: PipelineState) -> PipelineState:
    claim_id = state["claim_id"]
    await update_agent_state(
        AGENT_ID, state="busy", current_task_for=claim_id, load_pct=90
    )

    try:
        decision = state["rule_engine_decision"]
        settings = get_settings()
        issue = (state.get("normalized") or {}).get("issue", "")
        knowledge = (
            await search_knowledge(issue) if settings.knowledge_source == "vector" else None
        )
        user_msg = render_user_message(
            decision=decision,
            customer=state.get("customer") or {},
            order=state.get("order"),
            registration=state.get("registration"),
            channel=state.get("channel", "email"),
            issue=issue,
            knowledge=knowledge,
        )

        raw_reply, model_used = await asyncio.to_thread(draft_reply, SYSTEM_PROMPT, user_msg)
        reply = _parse_reply(raw_reply)

        state["voice_reply"] = reply["voice_reply"]
        state["email_subject"] = reply["email_subject"]
        state["email_body"] = reply["email_body"]

        sb = get_supabase()

        def _persist() -> str:
            draft_row = (
                sb.table("drafts")
                .insert(
                    {
                        "claim_id": claim_id,
                        "voice_text": reply["voice_reply"],
                        "email_subject": reply["email_subject"],
                        "email_body": reply["email_body"],
                        "internal_summary": state.get("internal_summary"),
                        "status": "pending_approval",
                    }
                )
                .execute()
                .data
            )
            sb.table("claims").update(
                {
                    "primary_agent_id": AGENT_ID,
                    "stage": "draft",
                    "status_detail": "DRAFT_PENDING_APPROVAL",
                }
            ).eq("id", claim_id).execute()
            return draft_row[0]["id"] if draft_row else ""

        draft_id = await asyncio.to_thread(_persist)
        state["draft_id"] = draft_id

        await write_case_event(
            claim_id,
            "AI_DRAFT_GENERATED",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload={
                "draft_id": draft_id,
                "voice_chars": len(reply["voice_reply"]),
                "email_chars": len(reply["email_body"]),
                "model": model_used,
            },
        )

        await update_agent_state(AGENT_ID, state="idle", current_task_for=None, load_pct=0)
        return state

    except Exception as e:
        log.exception("response failed for %s", claim_id)
        await write_case_event(
            claim_id,
            "AI_DRAFT_ERROR",
            actor_type="AI",
            actor_id=AGENT_ID,
            payload={"error": str(e)},
        )
        await update_agent_state(AGENT_ID, state="error", current_task_for=None)
        state["error"] = str(e)
        raise
