"""Time-based constants for the warranty policy.

Every window is expressed in calendar days because the source document
(``cs-knowledge-base-v1.md``) speaks in calendar days, not business days.
Helpers operate purely on :class:`datetime.date` — no clocks, no zones.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Final

# §1.1: 30 calendar days from purchase to return/exchange (JOOLA-direct only).
RETURN_WINDOW_DAYS: Final[int] = 30

# §1.8: final-sale defects must be reported within 7 days of receipt.
FINAL_SALE_REPORT_WINDOW_DAYS: Final[int] = 7

# §2.5: NFC registration must happen within 14 days of purchase to extend.
NFC_REGISTRATION_WINDOW_DAYS: Final[int] = 14

# §2.4: standard paddle warranty.
STANDARD_PADDLE_WARRANTY_MONTHS: Final[int] = 6

# §2.4: NFC-registered extended warranty.
NFC_EXTENDED_WARRANTY_MONTHS: Final[int] = 12

# §2.6: Infinity App premium trial.
INFINITY_TRIAL_DAYS: Final[int] = 30

# §1.10: new-product promotion blackout.
NEW_PRODUCT_DISCOUNT_BLACKOUT_DAYS: Final[int] = 90


def days_between(start: date, end: date) -> int:
    """Return inclusive day count from ``start`` to ``end`` (can be negative)."""
    return (end - start).days


def months_to_days(months: int) -> int:
    """Approximate months as 30-day blocks.

    The knowledge base speaks in months ("6 months", "1 year"); we use a
    fixed 30-day month so the engine is purely arithmetic and matches
    Shopify's expiry calculations.
    """
    return months * 30


def within_window(start: date, end: date, window_days: int) -> bool:
    """True when ``end`` falls within ``window_days`` calendar days of ``start``.

    The window is *inclusive* on both ends — a 14-day NFC window means days
    0 through 14 (15 total) are accepted, matching §2.5's "within 14 days".
    A negative gap (end before start) is never within the window.
    """
    gap = days_between(start, end)
    return 0 <= gap <= window_days


def add_days(d: date, days: int) -> date:
    """Pure helper so callers never construct timedelta in business code."""
    return d + timedelta(days=days)
