"""Compile the LangGraph state machine for the 7-agent pipeline.

Topology:

    intake -> shopify -> warrreg -> rules -> summary -> response -> END
                                                     \\
                                                      -> esc -> END   (if needs_escalation)
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from langgraph.graph import END, StateGraph

from app.graph.nodes import escalation, intake, response, rules, shopify, summary, warrreg
from app.graph.state import PipelineState


def _route_after_summary(state: PipelineState) -> str:
    """Conditional edge: escalate or draft a reply."""
    return "esc" if state.get("needs_escalation") else "response"


def build_graph() -> Any:
    """Build + compile the graph. Returns a compiled LangGraph runnable."""

    g: StateGraph = StateGraph(PipelineState)

    g.add_node("intake", intake.run)
    g.add_node("shopify", shopify.run)
    g.add_node("warrreg", warrreg.run)
    g.add_node("rules", rules.run)
    g.add_node("summary", summary.run)
    g.add_node("response", response.run)
    g.add_node("esc", escalation.run)

    g.set_entry_point("intake")
    g.add_edge("intake", "shopify")
    g.add_edge("shopify", "warrreg")
    g.add_edge("warrreg", "rules")
    g.add_edge("rules", "summary")
    g.add_conditional_edges(
        "summary",
        _route_after_summary,
        {"esc": "esc", "response": "response"},
    )
    g.add_edge("response", END)
    g.add_edge("esc", END)

    return g.compile()


@lru_cache(maxsize=1)
def get_compiled_graph() -> Any:
    """Process-wide compiled graph (LangGraph compile is non-trivial — cache it)."""
    return build_graph()
