"""Return-condition rules (§1.2) and the opened-consumable carve-out (§4.7)."""

from __future__ import annotations

from typing import Final

from warranty_policy.types import ProductType

# §1.2 / §4.7: TT rubbers, nets, and balls cannot be returned once opened,
# unless they are defective. The same rule applies to pickleball nets and
# balls by analogy in §1.9.
OPEN_SENSITIVE_PRODUCTS: Final[frozenset[ProductType]] = frozenset(
    {
        ProductType.TT_RUBBERS,
        ProductType.TT_NETS,
        ProductType.TT_BALLS,
        ProductType.PICKLEBALL_NETS,
        ProductType.PICKLEBALL_BALLS,
    }
)


def is_open_sensitive(product: ProductType) -> bool:
    """§1.2, §4.7: True iff opening the item bars a non-defect return."""
    return product in OPEN_SENSITIVE_PRODUCTS
