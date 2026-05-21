"""Replacement-policy helpers (§2.8 step 4 + §4.2, §4.3).

The deep logic — same-model only, inherited warranty period, replacement
cap — is enforced inside :mod:`warranty_policy.rules.decision_tree`. The
helpers here are pure predicates that the tree composes.
"""

from __future__ import annotations

from warranty_policy.rules.warranty_matrix import is_replacement_capped
from warranty_policy.types import ClaimInput


def replacement_must_be_same_model(claim: ClaimInput) -> bool:
    """§4.2: upgrades are never permitted under warranty.

    True iff the customer wants a different model — the caller turns this
    into a NOT_ELIGIBLE / UPGRADE_NOT_PERMITTED outcome.
    """
    return claim.wants_different_model


def has_hit_replacement_cap(claim: ClaimInput) -> bool:
    """§2.8 step 5 / §4.3: True when the customer is past the cap."""
    return is_replacement_capped(claim.product_type, claim.replacements_so_far)
