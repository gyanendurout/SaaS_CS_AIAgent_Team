"""Policy-version constant must stay locked to 1.0.0 across the package."""

from __future__ import annotations

from datetime import date

from warranty_policy import (
    ClaimInput,
    OrderSource,
    ProductType,
    __POLICY_VERSION__,
    evaluate,
)


def test_policy_version_constant() -> None:
    """The top-level export is the single source of truth."""
    assert __POLICY_VERSION__ == "1.0.0"


def test_decision_result_default_policy_version_matches() -> None:
    """Every DecisionResult emitted by evaluate must carry the same version."""
    claim = ClaimInput(
        customer_country="US",
        is_original_purchaser=True,
        product_type=ProductType.PADDLE_STANDARD,
        order_source=OrderSource.JOOLA_DIRECT,
        purchase_date=date(2026, 3, 1),
        claim_date=date(2026, 5, 17),
        is_defective=True,
    )
    assert evaluate(claim).policy_version == __POLICY_VERSION__


def test_policy_version_is_string_not_tuple() -> None:
    """The schema column is text; storing anything else would break inserts."""
    assert isinstance(__POLICY_VERSION__, str)
    assert __POLICY_VERSION__.count(".") == 2  # semver: MAJOR.MINOR.PATCH
