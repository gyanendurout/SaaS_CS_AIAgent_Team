"""Shared pytest fixtures for the warranty_policy test suite.

The ``base_claim`` fixture builds a maximally-valid ClaimInput: original
purchaser, US, defective JOOLA-direct paddle within warranty. Individual
tests use ``claim_with(**overrides)`` to flip exactly the fields they care
about — keeping each test focused on the single rule it exercises.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date
from typing import Any

import pytest

from warranty_policy.types import ClaimInput, OrderSource, ProductType


@pytest.fixture
def base_claim() -> ClaimInput:
    """A defect-on-NFC-paddle, JOOLA-direct, in-window, original-purchaser claim.

    Acts as a 'clean room' baseline — touching any single field surfaces a
    specific rule transition without bleed from other policy areas.
    """
    return ClaimInput(
        customer_country="US",
        is_original_purchaser=True,
        product_type=ProductType.PADDLE_STANDARD,
        order_source=OrderSource.JOOLA_DIRECT,
        purchase_date=date(2026, 3, 1),
        claim_date=date(2026, 5, 17),
        is_defective=True,
    )


@pytest.fixture
def claim_with(base_claim: ClaimInput) -> Callable[..., ClaimInput]:
    """Returns a factory that clones base_claim with field overrides."""

    def _factory(**overrides: Any) -> ClaimInput:
        return base_claim.model_copy(update=overrides)

    return _factory
