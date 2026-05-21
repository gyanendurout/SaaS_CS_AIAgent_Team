"""Master decision tree — the single entry point of the rule engine.

Priority order matters: the first rule whose precondition matches wins
and the function returns. The numbering below mirrors the spec in
``packages/warranty-policy/README.md`` and the CS knowledge base.

Pure function — no I/O, no clocks, no randomness. Given the same
``ClaimInput``, ``evaluate`` returns the same ``DecisionResult``.
"""

from __future__ import annotations

from typing import Final

from warranty_policy.rules.authorized_sellers import (
    is_authorized_seller,
    is_unauthorized_seller,
)
from warranty_policy.rules.conditions import is_open_sensitive
from warranty_policy.rules.nfc_eligibility import is_nfc_extended_eligible, is_nfc_product
from warranty_policy.rules.non_returnable import is_non_returnable
from warranty_policy.rules.replacement import (
    has_hit_replacement_cap,
    replacement_must_be_same_model,
)
from warranty_policy.rules.warranty_matrix import (
    NO_WARRANTY_PRODUCTS,
    get_terms,
    has_warranty,
)
from warranty_policy.rules.windows import (
    FINAL_SALE_REPORT_WINDOW_DAYS,
    days_between,
    months_to_days,
    within_window,
)
from warranty_policy.types import ClaimInput, Decision, DecisionResult, EscalationReason

# §2.1, §4.13: warranty is valid only in these three regions.
WARRANTY_REGIONS: Final[frozenset[str]] = frozenset({"US", "CA", "PR"})


def evaluate(claim: ClaimInput) -> DecisionResult:
    """Deterministic warranty decision for a normalized claim.

    Returns one of: PROCESSING, ELIGIBLE_FOR_DAMAGE_REVIEW, NOT_ELIGIBLE,
    HUMAN_REVIEW_REQUIRED, WARRANTY_EXPIRED. Every result is stamped with
    a reason code and a §-citation for audit.
    """

    # Rule 1 — §1.5, §4.10: orders cannot be cancelled or modified once placed.
    if claim.is_cancellation_request:
        return DecisionResult(
            decision=Decision.NOT_ELIGIBLE,
            reason_code="CANCELLATION_NOT_ALLOWED",
            citation="§1.5",
            notes="Hard policy. Advise customer to wait for delivery and initiate a return if eligible.",
        )

    # Rule 2 — §1.1, §4.4: only the original purchaser may claim.
    if not claim.is_original_purchaser:
        return DecisionResult(
            decision=Decision.NOT_ELIGIBLE,
            reason_code="NON_ORIGINAL_PURCHASER",
            citation="§1.1, §4.4",
            notes="Original purchaser must contact JOOLA directly with proof of purchase.",
        )

    # Rule 3 — §2.1, §4.13: warranty is regional. Only fires for warranty cases.
    is_warranty_case = claim.is_defective or claim.is_damaged_in_freight
    if is_warranty_case and claim.customer_country not in WARRANTY_REGIONS:
        return DecisionResult(
            decision=Decision.NOT_ELIGIBLE,
            reason_code="OUTSIDE_REGION",
            citation="§2.1, §4.13",
            escalation_reason=EscalationReason.OUTSIDE_REGION,
            notes="Warranty valid only in US, CA, PR.",
        )

    # Rule 4 — §1.7, §2.3, §4.8: unauthorized retailers are firmly excluded.
    if is_unauthorized_seller(claim.order_source):
        return DecisionResult(
            decision=Decision.NOT_ELIGIBLE,
            reason_code="UNAUTHORIZED_SELLER",
            citation="§1.7, §2.3, §4.8",
            notes="No warranty for eBay / Facebook Marketplace / auction-site purchases.",
        )

    # Rule 5 — §4.9: wrong item shipped is JOOLA's error — no return-shipping charge.
    if claim.is_wrong_item_shipped:
        return DecisionResult(
            decision=Decision.ELIGIBLE_FOR_DAMAGE_REVIEW,
            reason_code="JOOLA_ERROR_WRONG_ITEM",
            citation="§4.9",
            notes="Skip return-shipping charge per §1.3. Request photos of received vs. ordered.",
        )

    # Rule 6 — §2.7, §4.11: freight damage that was signed-for needs human eyes.
    if claim.is_damaged_in_freight and claim.freight_was_signed_for is True:
        return DecisionResult(
            decision=Decision.HUMAN_REVIEW_REQUIRED,
            reason_code="FREIGHT_SIGNED_FOR_DAMAGE",
            citation="§2.7, §4.11",
            escalation_reason=EscalationReason.BRAND_RISK,
            notes="Signed-for freight damage — escalate; returns may not be accepted.",
        )

    # Rule 7 — §2.7: refused freight is a clean JOOLA-side resolution path.
    if claim.is_damaged_in_freight and claim.freight_was_signed_for is False:
        return DecisionResult(
            decision=Decision.ELIGIBLE_FOR_DAMAGE_REVIEW,
            reason_code="FREIGHT_REFUSED_DAMAGE",
            citation="§2.7",
            notes="Customer refused delivery of damaged freight — proceed to damage review.",
        )

    # Rule 8 — §5.2: safety concerns always go to a human.
    if claim.is_safety_concern:
        return DecisionResult(
            decision=Decision.HUMAN_REVIEW_REQUIRED,
            reason_code="SAFETY_CONCERN",
            citation="§5.2",
            escalation_reason=EscalationReason.SAFETY,
            notes="Safety report — escalate to live CS rep immediately.",
        )

    # Rule 9 — §5.2: ambiguous damage needs a human decision.
    if claim.is_ambiguous_damage:
        return DecisionResult(
            decision=Decision.HUMAN_REVIEW_REQUIRED,
            reason_code="AMBIGUOUS_DAMAGE",
            citation="§5.2",
            escalation_reason=EscalationReason.AMBIGUOUS_DAMAGE,
            notes="Damage determination unclear — escalate for visual review.",
        )

    # Rule 10 — §2.4: products with no warranty period at all.
    if claim.product_type in NO_WARRANTY_PRODUCTS:
        return DecisionResult(
            decision=Decision.NOT_ELIGIBLE,
            reason_code="NO_WARRANTY_PRODUCT",
            citation="§2.4",
            notes=f"{claim.product_type.value} carries no warranty per §2.4.",
        )

    # Rule 11 — §1.8: final-sale, no defect claim → no remedy.
    if claim.is_final_sale and not claim.is_defective and not claim.is_wrong_item_shipped:
        return DecisionResult(
            decision=Decision.NOT_ELIGIBLE,
            reason_code="FINAL_SALE_NO_DEFECT",
            citation="§1.8",
            notes="Final-sale items are not eligible for return without a defect.",
        )

    # Rule 12 — §1.8: final-sale defect must be reported within 7 days of receipt.
    if claim.is_final_sale and claim.is_defective:
        if claim.received_date is None or not within_window(
            claim.received_date, claim.claim_date, FINAL_SALE_REPORT_WINDOW_DAYS
        ):
            return DecisionResult(
                decision=Decision.NOT_ELIGIBLE,
                reason_code="FINAL_SALE_PAST_7_DAYS",
                citation="§1.8",
                notes="Final-sale defect not reported within 7 days of receipt.",
            )

    # Rule 13 — §1.2, §4.7: opened consumables (rubbers/nets/balls) can't return
    # unless defective.
    if is_open_sensitive(claim.product_type) and claim.is_opened and not claim.is_defective:
        return DecisionResult(
            decision=Decision.NOT_ELIGIBLE,
            reason_code="OPENED_CONSUMABLE",
            citation="§1.2, §4.7",
            notes="Rubbers / nets / balls cannot be returned once opened unless defective.",
        )

    # Rule 14 — §1.9: non-returnable items, no defect claim.
    if is_non_returnable(claim.product_type) and not claim.is_defective:
        return DecisionResult(
            decision=Decision.NOT_ELIGIBLE,
            reason_code="NON_RETURNABLE_ITEM",
            citation="§1.9",
            notes="Item is on the §1.9 non-returnable list and no defect was claimed.",
        )

    # Rule 15 — §2.8 step 5 / §4.3: replacement cap reached.
    if has_hit_replacement_cap(claim):
        return DecisionResult(
            decision=Decision.HUMAN_REVIEW_REQUIRED,
            reason_code="REPLACEMENT_LIMIT_REACHED",
            citation="§2.8, §5.2",
            escalation_reason=EscalationReason.REPLACEMENT_LIMIT_REACHED,
            notes="Customer hit replacement cap; escalate per §5.2 if compelling case.",
        )

    # Rule 16 — §2.5: NFC paddle with all 5 conditions, within the 12mo window.
    if is_nfc_product(claim) and is_nfc_extended_eligible(claim):
        extended_days = months_to_days(get_terms(claim.product_type).period_months or 0)
        if within_window(claim.purchase_date, claim.claim_date, extended_days):
            return DecisionResult(
                decision=Decision.ELIGIBLE_FOR_DAMAGE_REVIEW,
                reason_code="NFC_EXTENDED_WARRANTY",
                citation="§2.5",
                notes="NFC paddle fully eligible for extended 12-month coverage.",
            )

    # Rule 17 — §2.5, §4.5: NFC paddle but registration missed window OR receipt
    # not approved. Falls back to standard 6-month warranty if claim is in-window
    # and seller is authorized.
    if is_nfc_product(claim) and is_authorized_seller(claim.order_source):
        standard_days = months_to_days(6)
        if within_window(claim.purchase_date, claim.claim_date, standard_days):
            if claim.is_defective:
                return DecisionResult(
                    decision=Decision.ELIGIBLE_FOR_DAMAGE_REVIEW,
                    reason_code="STANDARD_6MO_WARRANTY",
                    citation="§2.5, §4.5",
                    notes="NFC extended coverage missed — defaulting to standard 6-month warranty.",
                )

    # Rule 18 — §2.4: past warranty window for a product that does have one.
    if has_warranty(claim.product_type):
        period_days = months_to_days(get_terms(claim.product_type).period_months or 0)
        if days_between(claim.purchase_date, claim.claim_date) > period_days:
            return DecisionResult(
                decision=Decision.WARRANTY_EXPIRED,
                reason_code="PAST_WARRANTY_WINDOW",
                citation="§2.4",
                notes=(
                    f"Claim filed {days_between(claim.purchase_date, claim.claim_date)} days "
                    f"after purchase; warranty is {period_days} days."
                ),
            )

    # Rule 19 — §2.2: in-warranty defect, authorized seller, original purchaser.
    if (
        claim.is_defective
        and is_authorized_seller(claim.order_source)
        and has_warranty(claim.product_type)
    ):
        period_days = months_to_days(get_terms(claim.product_type).period_months or 0)
        if within_window(claim.purchase_date, claim.claim_date, period_days):
            return DecisionResult(
                decision=Decision.ELIGIBLE_FOR_DAMAGE_REVIEW,
                reason_code="WARRANTY_DEFECT",
                citation="§2.2",
                notes="Defect within warranty window from an authorized seller — proceed to review.",
            )

    # Rule 20 — §4.2: upgrades are not permitted.
    if replacement_must_be_same_model(claim):
        return DecisionResult(
            decision=Decision.NOT_ELIGIBLE,
            reason_code="UPGRADE_NOT_PERMITTED",
            citation="§4.2",
            notes="Warranty replacements are same-model only; upgrades not permitted.",
        )

    # Rule 21 — default fallback: nothing matched cleanly, ask a human.
    return DecisionResult(
        decision=Decision.HUMAN_REVIEW_REQUIRED,
        reason_code="UNHANDLED_CASE",
        citation="fallback",
        escalation_reason=EscalationReason.DISPUTED_SELLER,
        notes="No rule matched; escalating per §5.2 'doesn't fit neatly into policy'.",
    )
