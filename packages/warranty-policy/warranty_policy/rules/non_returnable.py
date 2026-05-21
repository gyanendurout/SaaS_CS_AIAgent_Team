"""§1.9: items that are non-returnable / non-exchangeable unless defective."""

from __future__ import annotations

from typing import Final

from warranty_policy.types import ProductType

# §1.9: explicit list, mapped to schema ProductType values.
# Note: "Assembled Rackets" maps to TT_CUSTOMIZED_RACKET + TT_RACKET_SET +
# TT_RECREATIONAL_RACKET — the most conservative interpretation.
NON_RETURNABLE_PRODUCTS: Final[frozenset[ProductType]] = frozenset(
    {
        # Assembled Rackets
        ProductType.TT_CUSTOMIZED_RACKET,
        ProductType.TT_RACKET_SET,
        ProductType.TT_RECREATIONAL_RACKET,
        # Tables
        ProductType.TT_INDOOR_TABLE,
        ProductType.TT_OUTDOOR_TABLE,
        # Rubbers
        ProductType.TT_RUBBERS,
        # Blades
        ProductType.TT_BLADES,
        # Balls
        ProductType.TT_BALLS,
        ProductType.PICKLEBALL_BALLS,
        # Covers + Cases
        ProductType.COVERS_CASES,
        ProductType.TT_TABLE_COVERS,
        # Grips
        ProductType.GRIPS,
        # Glues
        ProductType.GLUES,
        # Cleaners
        ProductType.CLEANERS,
        # Edge Tapes
        ProductType.EDGE_TAPES,
    }
)


def is_non_returnable(product: ProductType) -> bool:
    """§1.9: True iff the product is on the non-returnable list."""
    return product in NON_RETURNABLE_PRODUCTS
