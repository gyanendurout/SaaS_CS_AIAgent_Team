"""Warranty exclusions (§2.3) — 11 named carve-outs from coverage.

These are **descriptive** codes. The decision tree exposes a small subset
that the rule engine can actually detect from a ``ClaimInput`` (e.g.
unauthorized retailer, non-original purchaser); the rest exist as
canonical strings so the response agent can cite them when a CS Lead
manually marks a claim declined.
"""

from __future__ import annotations

from enum import Enum
from typing import Final


class WarrantyExclusion(str, Enum):
    """§2.3: every named exclusion from the knowledge base."""

    NORMAL_WEAR_AND_TEAR = "NORMAL_WEAR_AND_TEAR"
    IMPROPER_USAGE = "IMPROPER_USAGE"
    NEGLIGENCE_OR_ABUSE = "NEGLIGENCE_OR_ABUSE"
    TRANSPORTATION_DAMAGE = "TRANSPORTATION_DAMAGE"
    ACTS_OF_NATURE = "ACTS_OF_NATURE"
    ACCIDENTS = "ACCIDENTS"
    FADING_OF_GRAPHICS = "FADING_OF_GRAPHICS"
    COMMERCIAL_OR_RENTAL_USE = "COMMERCIAL_OR_RENTAL_USE"
    UNAUTHORIZED_MODIFICATIONS = "UNAUTHORIZED_MODIFICATIONS"
    UNAUTHORIZED_RETAILERS = "UNAUTHORIZED_RETAILERS"
    NON_ORIGINAL_PURCHASER = "NON_ORIGINAL_PURCHASER"


# §2.3: complete set, used by validation tests and the audit-trail writer.
ALL_EXCLUSIONS: Final[frozenset[WarrantyExclusion]] = frozenset(WarrantyExclusion)
