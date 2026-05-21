"""NFC chip-paddle extended warranty eligibility (§2.5).

ALL FIVE conditions must be true to extend a PADDLE_NFC from 6 → 12 months:

1. Paddle is NFC chip-enabled (caller asserts via ProductType.PADDLE_NFC).
2. Purchased from JOOLA directly or an authorized retailer.
3. Registered via the JOOLA Infinity App within 14 days of purchase.
4. A valid digital receipt was uploaded during registration.
5. The receipt was approved by manual review.
"""

from __future__ import annotations

from warranty_policy.rules.authorized_sellers import is_authorized_seller
from warranty_policy.rules.windows import NFC_REGISTRATION_WINDOW_DAYS, within_window
from warranty_policy.types import ClaimInput, ProductType


def is_nfc_product(claim: ClaimInput) -> bool:
    """§2.5 cond. 1: the SKU must actually be the NFC variant."""
    return claim.product_type is ProductType.PADDLE_NFC


def registration_within_window(claim: ClaimInput) -> bool:
    """§2.5 cond. 3: registration must land inside the 14-day window.

    A missing ``nfc_registration_date`` cannot be inside any window.
    """
    if claim.nfc_registration_date is None:
        return False
    return within_window(
        claim.purchase_date,
        claim.nfc_registration_date,
        NFC_REGISTRATION_WINDOW_DAYS,
    )


def is_nfc_extended_eligible(claim: ClaimInput) -> bool:
    """All five §2.5 conditions, combined."""
    return (
        is_nfc_product(claim)
        # Cond. 2 — authorized retailer check shares logic with the
        # general seller rule so a single source of truth governs both.
        and is_authorized_seller(claim.order_source)
        # Cond. 1 + 3 — must have actually registered, on time.
        and claim.nfc_registered
        and registration_within_window(claim)
        # Cond. 4 — receipt uploaded.
        and claim.nfc_receipt_uploaded
        # Cond. 5 — receipt approved by manual review.
        and claim.nfc_receipt_approved
    )
