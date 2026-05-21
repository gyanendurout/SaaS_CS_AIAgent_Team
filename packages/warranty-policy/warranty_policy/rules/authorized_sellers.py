"""§2.9: which sales channels JOOLA recognises for warranty/returns."""

from __future__ import annotations

from typing import Final

from warranty_policy.types import OrderSource

# §2.9: only these two sources are covered by JOOLA's warranty + return
# policies. Everything else is treated as unauthorized per §1.7 / §4.8.
AUTHORIZED_SOURCES: Final[frozenset[OrderSource]] = frozenset(
    {OrderSource.JOOLA_DIRECT, OrderSource.AUTHORIZED_RETAILER}
)

# §1.7 / §4.8: explicit "no warranty" sources from the knowledge base.
UNAUTHORIZED_SOURCES: Final[frozenset[OrderSource]] = frozenset(
    {
        OrderSource.EBAY,
        OrderSource.FACEBOOK_MARKETPLACE,
        OrderSource.AUCTION_SITE,
        OrderSource.UNKNOWN_ONLINE,
    }
)


def is_authorized_seller(source: OrderSource) -> bool:
    """§2.9: True iff the channel grants warranty/return eligibility."""
    return source in AUTHORIZED_SOURCES


def is_unauthorized_seller(source: OrderSource) -> bool:
    """§1.7, §4.8: True iff the source is on the explicit unauthorized list.

    Note ``OrderSource.OTHER`` is neither authorized nor explicitly
    unauthorized — the decision tree routes it to HUMAN_REVIEW_REQUIRED
    via the default fallback so a CS Lead can disambiguate.
    """
    return source in UNAUTHORIZED_SOURCES
