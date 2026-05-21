"""§2.4 matrix: total over ProductType + per-product expectations."""

from __future__ import annotations

import pytest

from warranty_policy.rules.warranty_matrix import (
    NO_WARRANTY_PRODUCTS,
    WARRANTY_MATRIX,
    WarrantyTerms,
    get_terms,
    has_warranty,
    is_replacement_capped,
)
from warranty_policy.types import ProductType


def test_matrix_is_total_over_product_type() -> None:
    """Every ProductType MUST have an entry — the decision tree relies on this."""
    missing = set(ProductType) - set(WARRANTY_MATRIX.keys())
    assert missing == set(), f"Missing matrix entries for: {missing}"


@pytest.mark.parametrize(
    "product,expected",
    [
        (ProductType.PADDLE_STANDARD, WarrantyTerms(6, 2)),
        (ProductType.PADDLE_NFC, WarrantyTerms(12, 3)),
        (ProductType.PICKLEBALL_NETS, WarrantyTerms(12, None)),
        (ProductType.BAGS, WarrantyTerms(6, None)),
        (ProductType.EYEWEAR, WarrantyTerms(12, 2)),
        (ProductType.TT_INDOOR_TABLE, WarrantyTerms(12, None)),
        (ProductType.TT_OUTDOOR_TABLE, WarrantyTerms(12, None)),
        (ProductType.TT_RACKET_SET, WarrantyTerms(3, None)),
        (ProductType.TT_RECREATIONAL_RACKET, WarrantyTerms(6, None)),
        (ProductType.IPONG_ROBOT, WarrantyTerms(12, None)),
        (ProductType.TT_BLADES, WarrantyTerms(1, None)),
        (ProductType.TT_RUBBERS, WarrantyTerms(1, None)),
        (ProductType.TT_BALLS, WarrantyTerms(1, None)),
        (ProductType.TT_TABLE_COVERS, WarrantyTerms(6, None)),
        (ProductType.TT_NETS, WarrantyTerms(6, None)),
        (ProductType.TT_BAGS, WarrantyTerms(6, None)),
    ],
)
def test_warranty_periods_match_section_2_4(
    product: ProductType, expected: WarrantyTerms
) -> None:
    """Spot-check the §2.4 knowledge-base values against the matrix."""
    assert get_terms(product) == expected


@pytest.mark.parametrize(
    "product",
    [
        ProductType.PICKLEBALL_BALLS,
        ProductType.COVERS_CASES,
        ProductType.PADDLE_SETS,
        ProductType.TT_CUSTOMIZED_RACKET,
    ],
)
def test_no_warranty_products_set(product: ProductType) -> None:
    """§2.4: explicit 'no warranty' set must contain each named product."""
    assert product in NO_WARRANTY_PRODUCTS
    assert has_warranty(product) is False


def test_has_warranty_true_for_paddle_standard() -> None:
    assert has_warranty(ProductType.PADDLE_STANDARD) is True


def test_standard_paddle_cap_is_two() -> None:
    """§2.8 step 5: 2 replacements is the cap; 2 reached means capped."""
    assert is_replacement_capped(ProductType.PADDLE_STANDARD, 0) is False
    assert is_replacement_capped(ProductType.PADDLE_STANDARD, 1) is False
    assert is_replacement_capped(ProductType.PADDLE_STANDARD, 2) is True
    assert is_replacement_capped(ProductType.PADDLE_STANDARD, 3) is True


def test_nfc_paddle_cap_is_three() -> None:
    """§2.8 step 5: NFC cap is 3 replacements."""
    assert is_replacement_capped(ProductType.PADDLE_NFC, 2) is False
    assert is_replacement_capped(ProductType.PADDLE_NFC, 3) is True


def test_uncapped_product_never_returns_capped() -> None:
    """Products with no max_replacements should never be capped."""
    assert is_replacement_capped(ProductType.BAGS, 999) is False
