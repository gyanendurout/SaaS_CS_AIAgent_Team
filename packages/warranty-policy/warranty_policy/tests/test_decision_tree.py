"""Decision-tree tests — one test per priority rule (§4.1–§4.13, §5.2)."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date

import pytest

from warranty_policy import (
    ClaimInput,
    Decision,
    EscalationReason,
    OrderSource,
    ProductType,
    evaluate,
)


# ── Rule 1 — §1.5, §4.10 ────────────────────────────────────────────────
def test_rule01_cancellation_request(claim_with: Callable[..., ClaimInput]) -> None:
    """§1.5: cancellation requests are a hard no."""
    result = evaluate(claim_with(is_cancellation_request=True))
    assert result.decision is Decision.NOT_ELIGIBLE
    assert result.reason_code == "CANCELLATION_NOT_ALLOWED"
    assert "§1.5" in result.citation
    assert result.escalation_reason is None


# ── Rule 2 — §1.1, §4.4 ─────────────────────────────────────────────────
def test_rule02_non_original_purchaser(claim_with: Callable[..., ClaimInput]) -> None:
    """§1.1: only the original purchaser may file a claim."""
    result = evaluate(claim_with(is_original_purchaser=False))
    assert result.decision is Decision.NOT_ELIGIBLE
    assert result.reason_code == "NON_ORIGINAL_PURCHASER"
    assert "§1.1" in result.citation
    assert "§4.4" in result.citation


# ── Rule 3 — §2.1, §4.13 ────────────────────────────────────────────────
@pytest.mark.parametrize("country", ["MX", "GB", "DE", "JP", "AU"])
def test_rule03_outside_region(claim_with: Callable[..., ClaimInput], country: str) -> None:
    """§4.13: warranty is only valid in US, CA, PR."""
    result = evaluate(claim_with(customer_country=country))
    assert result.decision is Decision.NOT_ELIGIBLE
    assert result.reason_code == "OUTSIDE_REGION"
    assert result.escalation_reason is EscalationReason.OUTSIDE_REGION


# ── Rule 4 — §1.7, §2.3, §4.8 ───────────────────────────────────────────
@pytest.mark.parametrize(
    "source",
    [
        OrderSource.EBAY,
        OrderSource.FACEBOOK_MARKETPLACE,
        OrderSource.AUCTION_SITE,
        OrderSource.UNKNOWN_ONLINE,
    ],
)
def test_rule04_unauthorized_seller(
    claim_with: Callable[..., ClaimInput], source: OrderSource
) -> None:
    """§1.7: every unauthorized channel returns NOT_ELIGIBLE / UNAUTHORIZED_SELLER."""
    result = evaluate(claim_with(order_source=source))
    assert result.decision is Decision.NOT_ELIGIBLE
    assert result.reason_code == "UNAUTHORIZED_SELLER"
    assert "§1.7" in result.citation


# ── Rule 5 — §4.9 ───────────────────────────────────────────────────────
def test_rule05_wrong_item_shipped(claim_with: Callable[..., ClaimInput]) -> None:
    """§4.9: wrong item shipped is JOOLA's error — skip shipping charge."""
    result = evaluate(claim_with(is_wrong_item_shipped=True, is_defective=False))
    assert result.decision is Decision.ELIGIBLE_FOR_DAMAGE_REVIEW
    assert result.reason_code == "JOOLA_ERROR_WRONG_ITEM"
    assert "§4.9" in result.citation


# ── Rule 6 — §2.7, §4.11 ────────────────────────────────────────────────
def test_rule06_freight_signed_for_damage(claim_with: Callable[..., ClaimInput]) -> None:
    """§2.7: signed-for damaged freight is BRAND_RISK escalation."""
    result = evaluate(
        claim_with(
            product_type=ProductType.TT_INDOOR_TABLE,
            is_damaged_in_freight=True,
            freight_was_signed_for=True,
            is_defective=False,
        )
    )
    assert result.decision is Decision.HUMAN_REVIEW_REQUIRED
    assert result.reason_code == "FREIGHT_SIGNED_FOR_DAMAGE"
    assert result.escalation_reason is EscalationReason.BRAND_RISK


# ── Rule 7 — §2.7 ───────────────────────────────────────────────────────
def test_rule07_freight_refused_damage(claim_with: Callable[..., ClaimInput]) -> None:
    """§2.7: refused damaged freight is the clean resolution path."""
    result = evaluate(
        claim_with(
            product_type=ProductType.TT_OUTDOOR_TABLE,
            is_damaged_in_freight=True,
            freight_was_signed_for=False,
            is_defective=False,
        )
    )
    assert result.decision is Decision.ELIGIBLE_FOR_DAMAGE_REVIEW
    assert result.reason_code == "FREIGHT_REFUSED_DAMAGE"


# ── Rule 8 — §5.2 ───────────────────────────────────────────────────────
def test_rule08_safety_concern(claim_with: Callable[..., ClaimInput]) -> None:
    """§5.2: safety reports always escalate."""
    result = evaluate(claim_with(is_safety_concern=True))
    assert result.decision is Decision.HUMAN_REVIEW_REQUIRED
    assert result.reason_code == "SAFETY_CONCERN"
    assert result.escalation_reason is EscalationReason.SAFETY


# ── Rule 9 — §5.2 ───────────────────────────────────────────────────────
def test_rule09_ambiguous_damage(claim_with: Callable[..., ClaimInput]) -> None:
    """§5.2: ambiguous damage needs visual review."""
    result = evaluate(claim_with(is_ambiguous_damage=True))
    assert result.decision is Decision.HUMAN_REVIEW_REQUIRED
    assert result.reason_code == "AMBIGUOUS_DAMAGE"
    assert result.escalation_reason is EscalationReason.AMBIGUOUS_DAMAGE


# ── Rule 10 — §2.4 ──────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "product",
    [
        ProductType.PICKLEBALL_BALLS,
        ProductType.COVERS_CASES,
        ProductType.PADDLE_SETS,
        ProductType.TT_CUSTOMIZED_RACKET,
    ],
)
def test_rule10_no_warranty_product(
    claim_with: Callable[..., ClaimInput], product: ProductType
) -> None:
    """§2.4: products with no warranty period short-circuit cleanly."""
    result = evaluate(claim_with(product_type=product))
    assert result.decision is Decision.NOT_ELIGIBLE
    assert result.reason_code == "NO_WARRANTY_PRODUCT"


# ── Rule 11 — §1.8 ──────────────────────────────────────────────────────
def test_rule11_final_sale_no_defect(claim_with: Callable[..., ClaimInput]) -> None:
    """§1.8: final-sale items without a defect are not eligible."""
    result = evaluate(claim_with(is_final_sale=True, is_defective=False))
    assert result.decision is Decision.NOT_ELIGIBLE
    assert result.reason_code == "FINAL_SALE_NO_DEFECT"


# ── Rule 12 — §1.8 ──────────────────────────────────────────────────────
def test_rule12_final_sale_defect_past_7_days(claim_with: Callable[..., ClaimInput]) -> None:
    """§1.8: final-sale defect reported past 7 days of receipt → declined."""
    result = evaluate(
        claim_with(
            is_final_sale=True,
            is_defective=True,
            received_date=date(2026, 5, 1),  # claim_date is 2026-05-17 → 16 days
        )
    )
    assert result.decision is Decision.NOT_ELIGIBLE
    assert result.reason_code == "FINAL_SALE_PAST_7_DAYS"


# ── Rule 13 — §1.2, §4.7 ────────────────────────────────────────────────
@pytest.mark.parametrize(
    "product",
    [ProductType.TT_RUBBERS, ProductType.TT_NETS, ProductType.TT_BALLS],
)
def test_rule13_opened_consumable_no_defect(
    claim_with: Callable[..., ClaimInput], product: ProductType
) -> None:
    """§4.7: opened rubbers/nets/balls aren't returnable unless defective."""
    result = evaluate(claim_with(product_type=product, is_opened=True, is_defective=False))
    assert result.decision is Decision.NOT_ELIGIBLE
    assert result.reason_code == "OPENED_CONSUMABLE"


# ── Rule 14 — §1.9 ──────────────────────────────────────────────────────
def test_rule14_non_returnable_item_no_defect(claim_with: Callable[..., ClaimInput]) -> None:
    """§1.9: non-returnable items without a defect → declined."""
    result = evaluate(
        claim_with(product_type=ProductType.GRIPS, is_defective=False, is_opened=False)
    )
    assert result.decision is Decision.NOT_ELIGIBLE
    assert result.reason_code == "NON_RETURNABLE_ITEM"


# ── Rule 15 — §2.8 step 5 / §4.3 ────────────────────────────────────────
def test_rule15_replacement_limit_reached(claim_with: Callable[..., ClaimInput]) -> None:
    """§2.8: standard paddle cap is 2; the 3rd request escalates."""
    result = evaluate(
        claim_with(product_type=ProductType.PADDLE_STANDARD, replacements_so_far=2)
    )
    assert result.decision is Decision.HUMAN_REVIEW_REQUIRED
    assert result.reason_code == "REPLACEMENT_LIMIT_REACHED"
    assert result.escalation_reason is EscalationReason.REPLACEMENT_LIMIT_REACHED


# ── Rule 16 — §2.5 ──────────────────────────────────────────────────────
def test_rule16_nfc_extended_warranty(claim_with: Callable[..., ClaimInput]) -> None:
    """§2.5: NFC paddle, all 5 conditions met, within 12 months → review."""
    result = evaluate(
        claim_with(
            product_type=ProductType.PADDLE_NFC,
            nfc_registered=True,
            nfc_registration_date=date(2026, 3, 10),  # within 14 days of 2026-03-01
            nfc_receipt_uploaded=True,
            nfc_receipt_approved=True,
        )
    )
    assert result.decision is Decision.ELIGIBLE_FOR_DAMAGE_REVIEW
    assert result.reason_code == "NFC_EXTENDED_WARRANTY"
    assert "§2.5" in result.citation


# ── Rule 17 — §2.5, §4.5 ────────────────────────────────────────────────
def test_rule17_nfc_missed_registration_falls_to_standard(
    claim_with: Callable[..., ClaimInput],
) -> None:
    """§4.5: missed 14-day window → standard 6-month warranty if in-window."""
    result = evaluate(
        claim_with(
            product_type=ProductType.PADDLE_NFC,
            nfc_registered=True,
            nfc_registration_date=date(2026, 4, 1),  # 31 days after purchase
            nfc_receipt_uploaded=True,
            nfc_receipt_approved=True,
        )
    )
    assert result.decision is Decision.ELIGIBLE_FOR_DAMAGE_REVIEW
    assert result.reason_code == "STANDARD_6MO_WARRANTY"


# ── Rule 18 — §2.4 ──────────────────────────────────────────────────────
def test_rule18_past_warranty_window(claim_with: Callable[..., ClaimInput]) -> None:
    """§2.4: 6-month paddle, claim filed at 10 months → WARRANTY_EXPIRED."""
    result = evaluate(
        claim_with(
            product_type=ProductType.PADDLE_STANDARD,
            purchase_date=date(2025, 7, 1),
            claim_date=date(2026, 5, 17),
        )
    )
    assert result.decision is Decision.WARRANTY_EXPIRED
    assert result.reason_code == "PAST_WARRANTY_WINDOW"


# ── Rule 19 — §2.2 ──────────────────────────────────────────────────────
def test_rule19_in_warranty_defect_authorized_seller(
    claim_with: Callable[..., ClaimInput],
) -> None:
    """§2.2: defect in-window from authorized seller → damage review."""
    result = evaluate(claim_with())  # baseline IS this exact case
    assert result.decision is Decision.ELIGIBLE_FOR_DAMAGE_REVIEW
    assert result.reason_code == "WARRANTY_DEFECT"
    assert "§2.2" in result.citation


# ── Rule 20 — §4.2 ──────────────────────────────────────────────────────
def test_rule20_upgrade_not_permitted(claim_with: Callable[..., ClaimInput]) -> None:
    """§4.2: wants different model → declined.

    Construct a claim that survives rules 1–19: BAGS has a 6-month warranty but
    no defect claimed and no other condition fires, so the tree falls through
    to rule 20.
    """
    result = evaluate(
        claim_with(
            product_type=ProductType.BAGS,
            is_defective=False,
            wants_different_model=True,
        )
    )
    assert result.decision is Decision.NOT_ELIGIBLE
    assert result.reason_code == "UPGRADE_NOT_PERMITTED"


# ── Rule 21 — fallback ──────────────────────────────────────────────────
def test_rule21_default_fallback_unhandled(claim_with: Callable[..., ClaimInput]) -> None:
    """Default fallback: no rule matched → HUMAN_REVIEW_REQUIRED."""
    # OTHER has no warranty matrix entry that fires, and the claim has no
    # defect / no special signals — nothing else can match.
    result = evaluate(
        claim_with(
            product_type=ProductType.APPAREL,
            is_defective=False,
            wants_different_model=False,
        )
    )
    assert result.decision is Decision.HUMAN_REVIEW_REQUIRED
    assert result.reason_code == "UNHANDLED_CASE"
    assert result.citation == "fallback"


# ── Cross-cutting: policy_version is stamped on every result ────────────
def test_every_decision_stamps_policy_version(claim_with: Callable[..., ClaimInput]) -> None:
    """Every DecisionResult must carry policy_version=1.0.0 for audit."""
    result = evaluate(claim_with())
    assert result.policy_version == "1.0.0"


# ── Cross-cutting: final-sale defect within 7 days proceeds to warranty ─
def test_final_sale_defect_within_7_days_proceeds(
    claim_with: Callable[..., ClaimInput],
) -> None:
    """§1.8 exception: final-sale defect reported within 7 days is honored."""
    result = evaluate(
        claim_with(
            is_final_sale=True,
            is_defective=True,
            received_date=date(2026, 5, 12),  # 5 days before claim_date
        )
    )
    # Falls through to standard warranty handling (rule 19).
    assert result.decision is Decision.ELIGIBLE_FOR_DAMAGE_REVIEW
