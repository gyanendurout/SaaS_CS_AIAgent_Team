"""§2.5 NFC eligibility predicate tests — day-boundary precision matters."""

from __future__ import annotations

from datetime import date

import pytest

from warranty_policy.rules.nfc_eligibility import (
    is_nfc_extended_eligible,
    is_nfc_product,
    registration_within_window,
)
from warranty_policy.types import ClaimInput, OrderSource, ProductType


def _nfc_claim(**overrides: object) -> ClaimInput:
    """Helper: a fully-eligible NFC paddle claim, then apply overrides."""
    base = ClaimInput(
        customer_country="US",
        is_original_purchaser=True,
        product_type=ProductType.PADDLE_NFC,
        order_source=OrderSource.JOOLA_DIRECT,
        purchase_date=date(2026, 3, 1),
        claim_date=date(2026, 5, 17),
        is_defective=True,
        nfc_registered=True,
        nfc_registration_date=date(2026, 3, 10),
        nfc_receipt_uploaded=True,
        nfc_receipt_approved=True,
    )
    return base.model_copy(update=overrides)


def test_is_nfc_product_true_for_nfc() -> None:
    assert is_nfc_product(_nfc_claim()) is True


def test_is_nfc_product_false_for_standard_paddle() -> None:
    assert is_nfc_product(_nfc_claim(product_type=ProductType.PADDLE_STANDARD)) is False


@pytest.mark.parametrize(
    "registration_date,expected",
    [
        (date(2026, 3, 1), True),  # day 0 — same day
        (date(2026, 3, 8), True),  # day 7 — middle
        (date(2026, 3, 14), True),  # day 13 — just under
        (date(2026, 3, 15), True),  # day 14 — inclusive upper bound
        (date(2026, 3, 16), False),  # day 15 — just over
        (date(2026, 4, 1), False),  # day 31 — well past
    ],
)
def test_registration_within_window_boundaries(
    registration_date: date, expected: bool
) -> None:
    """§2.5 cond. 3: window is inclusive on both ends (0..14 days)."""
    assert (
        registration_within_window(_nfc_claim(nfc_registration_date=registration_date))
        is expected
    )


def test_registration_window_false_when_date_missing() -> None:
    """A null registration date can never be inside any window."""
    assert registration_within_window(_nfc_claim(nfc_registration_date=None)) is False


def test_all_five_conditions_pass() -> None:
    assert is_nfc_extended_eligible(_nfc_claim()) is True


def test_fails_if_not_nfc_product() -> None:
    assert (
        is_nfc_extended_eligible(_nfc_claim(product_type=ProductType.PADDLE_STANDARD)) is False
    )


def test_fails_if_unauthorized_seller() -> None:
    assert is_nfc_extended_eligible(_nfc_claim(order_source=OrderSource.EBAY)) is False


def test_fails_if_not_registered() -> None:
    assert is_nfc_extended_eligible(_nfc_claim(nfc_registered=False)) is False


def test_fails_if_registration_late() -> None:
    assert (
        is_nfc_extended_eligible(_nfc_claim(nfc_registration_date=date(2026, 4, 1))) is False
    )


def test_fails_if_receipt_not_uploaded() -> None:
    assert is_nfc_extended_eligible(_nfc_claim(nfc_receipt_uploaded=False)) is False


def test_fails_if_receipt_not_approved() -> None:
    assert is_nfc_extended_eligible(_nfc_claim(nfc_receipt_approved=False)) is False
