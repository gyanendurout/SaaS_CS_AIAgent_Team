"""warranty_policy — deterministic JOOLA warranty rule engine.

Public surface is intentionally tiny: one function (:func:`evaluate`),
the input/output models, the supporting enums, and the policy version
constant. Nothing inside ``warranty_policy.rules`` is part of the public
API — those modules are implementation details.
"""

from __future__ import annotations

from warranty_policy.rules.decision_tree import evaluate
from warranty_policy.types import (
    Channel,
    ClaimInput,
    Decision,
    DecisionResult,
    EscalationReason,
    OrderSource,
    ProductType,
)

# Anchored to docs/policies/cs-knowledge-base-v1.md "Policy Version" line.
__POLICY_VERSION__ = "1.0.0"

__all__ = [
    "evaluate",
    "ClaimInput",
    "DecisionResult",
    "Decision",
    "EscalationReason",
    "ProductType",
    "OrderSource",
    "Channel",
    "__POLICY_VERSION__",
]
