"""Per-product warranty length and replacement cap (§2.4, §2.8 step 5)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from warranty_policy.types import ProductType


@dataclass(frozen=True)
class WarrantyTerms:
    """Single row of the §2.4 matrix.

    ``period_months`` of ``None`` means the product has **no** warranty
    (e.g. PICKLEBALL_BALLS) — every claim for that SKU short-circuits to
    ``NOT_ELIGIBLE / NO_WARRANTY_PRODUCT``.

    ``max_replacements`` of ``None`` means no documented cap; the rule
    engine treats it as effectively unbounded for §2.8 step 5 purposes.
    """

    period_months: int | None
    max_replacements: int | None


# §2.4 + §2.8: every ProductType MUST appear here. The decision tree
# relies on this being total — see test_warranty_matrix.py.
WARRANTY_MATRIX: Final[dict[ProductType, WarrantyTerms]] = {
    # Pickleball — §2.4
    ProductType.PADDLE_STANDARD: WarrantyTerms(period_months=6, max_replacements=2),
    ProductType.PADDLE_NFC: WarrantyTerms(period_months=12, max_replacements=3),
    ProductType.PICKLEBALL_NETS: WarrantyTerms(period_months=12, max_replacements=None),
    ProductType.PICKLEBALL_BALLS: WarrantyTerms(period_months=None, max_replacements=None),
    ProductType.COVERS_CASES: WarrantyTerms(period_months=None, max_replacements=None),
    ProductType.BAGS: WarrantyTerms(period_months=6, max_replacements=None),
    ProductType.EYEWEAR: WarrantyTerms(period_months=12, max_replacements=2),
    ProductType.PADDLE_SETS: WarrantyTerms(period_months=None, max_replacements=None),
    # Table tennis — §2.4
    ProductType.TT_INDOOR_TABLE: WarrantyTerms(period_months=12, max_replacements=None),
    ProductType.TT_OUTDOOR_TABLE: WarrantyTerms(period_months=12, max_replacements=None),
    ProductType.TT_CUSTOMIZED_RACKET: WarrantyTerms(period_months=None, max_replacements=None),
    ProductType.TT_RACKET_SET: WarrantyTerms(period_months=3, max_replacements=None),
    ProductType.TT_RECREATIONAL_RACKET: WarrantyTerms(period_months=6, max_replacements=None),
    ProductType.IPONG_ROBOT: WarrantyTerms(period_months=12, max_replacements=None),
    # 30-day blade/rubber/ball coverage is expressed as 1 month here; the
    # decision tree converts months -> 30-day blocks so 1mo == 30 days.
    ProductType.TT_BLADES: WarrantyTerms(period_months=1, max_replacements=None),
    ProductType.TT_RUBBERS: WarrantyTerms(period_months=1, max_replacements=None),
    ProductType.TT_BALLS: WarrantyTerms(period_months=1, max_replacements=None),
    ProductType.TT_TABLE_COVERS: WarrantyTerms(period_months=6, max_replacements=None),
    ProductType.TT_NETS: WarrantyTerms(period_months=6, max_replacements=None),
    ProductType.TT_BAGS: WarrantyTerms(period_months=6, max_replacements=None),
    # Apparel & accessories — not in §2.4, default to no warranty.
    ProductType.APPAREL: WarrantyTerms(period_months=None, max_replacements=None),
    ProductType.GRIPS: WarrantyTerms(period_months=None, max_replacements=None),
    ProductType.GLUES: WarrantyTerms(period_months=None, max_replacements=None),
    ProductType.CLEANERS: WarrantyTerms(period_months=None, max_replacements=None),
    ProductType.EDGE_TAPES: WarrantyTerms(period_months=None, max_replacements=None),
    ProductType.OTHER: WarrantyTerms(period_months=None, max_replacements=None),
}

# §2.4: explicit "no warranty" set from the knowledge base — used by the
# decision tree's rule #10 to short-circuit cleanly with a precise code.
NO_WARRANTY_PRODUCTS: Final[frozenset[ProductType]] = frozenset(
    {
        ProductType.PICKLEBALL_BALLS,
        ProductType.COVERS_CASES,
        ProductType.PADDLE_SETS,
        ProductType.TT_CUSTOMIZED_RACKET,
    }
)


def get_terms(product: ProductType) -> WarrantyTerms:
    """§2.4 look-up. Total over :class:`ProductType` — see test."""
    return WARRANTY_MATRIX[product]


def has_warranty(product: ProductType) -> bool:
    """True iff §2.4 grants ANY warranty period to ``product``."""
    return WARRANTY_MATRIX[product].period_months is not None


def is_replacement_capped(product: ProductType, replacements_so_far: int) -> bool:
    """§2.8 step 5: True when the customer has hit/exceeded the cap."""
    cap = WARRANTY_MATRIX[product].max_replacements
    if cap is None:
        return False
    return replacements_so_far >= cap
