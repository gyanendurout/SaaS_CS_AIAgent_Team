"""Update ``agent_states`` — drives the live tiles on the CS Lead dashboard."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Final

from app.services.supabase_client import get_supabase

log = logging.getLogger(__name__)


class _Unset:
    """Sentinel singleton so callers can distinguish 'omitted' from 'explicit None'."""


_UNSET: Final = _Unset()


async def update_agent_state(
    agent_id: str,
    state: str | None = None,
    queue_depth: int | None = None,
    load_pct: int | None = None,
    current_task_for: str | None | _Unset = _UNSET,
) -> None:
    """Patch one ``agent_states`` row.

    Args:
        agent_id:         FK into ``agents`` (e.g. ``"intake"``).
        state:            ``idle`` | ``busy`` | ``blocked`` | ``error``.
        queue_depth:      Number of claims waiting on this agent.
        load_pct:         0..100, clamped server-side.
        current_task_for: Pass an explicit ``None`` to clear the in-flight
                          claim id; omit the argument to leave it untouched.
    """

    patch: dict[str, Any] = {}
    if state is not None:
        patch["state"] = state
    if queue_depth is not None:
        patch["queue_depth"] = queue_depth
    if load_pct is not None:
        patch["load_pct"] = max(0, min(100, int(load_pct)))
    if not isinstance(current_task_for, _Unset):
        patch["current_task_for"] = current_task_for

    if not patch:
        return

    sb = get_supabase()

    def _update() -> None:
        sb.table("agent_states").update(patch).eq("agent_id", agent_id).execute()

    try:
        await asyncio.to_thread(_update)
    except Exception as e:  # noqa: BLE001
        log.exception("agent_states update failed for %s: %s", agent_id, e)
