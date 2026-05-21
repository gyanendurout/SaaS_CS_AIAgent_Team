"""Tests for the time-window helpers — boundary correctness is critical."""

from __future__ import annotations

from datetime import date

import pytest

from warranty_policy.rules.windows import (
    FINAL_SALE_REPORT_WINDOW_DAYS,
    NFC_REGISTRATION_WINDOW_DAYS,
    NFC_EXTENDED_WARRANTY_MONTHS,
    RETURN_WINDOW_DAYS,
    STANDARD_PADDLE_WARRANTY_MONTHS,
    add_days,
    days_between,
    months_to_days,
    within_window,
)


def test_known_constants() -> None:
    """Spot-check the four windows the knowledge base names explicitly."""
    assert RETURN_WINDOW_DAYS == 30  # §1.1
    assert FINAL_SALE_REPORT_WINDOW_DAYS == 7  # §1.8
    assert NFC_REGISTRATION_WINDOW_DAYS == 14  # §2.5
    assert STANDARD_PADDLE_WARRANTY_MONTHS == 6  # §2.4
    assert NFC_EXTENDED_WARRANTY_MONTHS == 12  # §2.4


def test_days_between_simple() -> None:
    assert days_between(date(2026, 1, 1), date(2026, 1, 31)) == 30


def test_days_between_negative_when_end_before_start() -> None:
    """Future-dated 'purchase' vs past 'claim' should return a negative gap."""
    assert days_between(date(2026, 5, 17), date(2026, 5, 1)) == -16


def test_months_to_days_uses_30_day_blocks() -> None:
    """Months are modeled as 30 days each — purely arithmetic."""
    assert months_to_days(6) == 180
    assert months_to_days(12) == 360
    assert months_to_days(0) == 0


@pytest.mark.parametrize(
    "start,end,window,expected",
    [
        # Same-day registration is always in-window.
        (date(2026, 3, 1), date(2026, 3, 1), 14, True),
        # Last day of inclusive window.
        (date(2026, 3, 1), date(2026, 3, 15), 14, True),
        # Just past inclusive window.
        (date(2026, 3, 1), date(2026, 3, 16), 14, False),
        # End before start → never in window.
        (date(2026, 3, 1), date(2026, 2, 28), 14, False),
        # 30-day return window — day 30 is in, day 31 is out.
        (date(2026, 3, 1), date(2026, 3, 31), 30, True),
        (date(2026, 3, 1), date(2026, 4, 1), 30, False),
    ],
)
def test_within_window_boundaries(
    start: date, end: date, window: int, expected: bool
) -> None:
    """Inclusive on both ends — matches "within N days" wording."""
    assert within_window(start, end, window) is expected


def test_add_days_pure_helper() -> None:
    assert add_days(date(2026, 3, 1), 14) == date(2026, 3, 15)
    assert add_days(date(2026, 3, 1), 0) == date(2026, 3, 1)
    assert add_days(date(2026, 3, 1), -1) == date(2026, 2, 28)
