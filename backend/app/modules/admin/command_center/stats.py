"""Statistics and India-time helpers shared by the command-center charts."""
from __future__ import annotations

import math
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
Z95 = 1.96
LOW_SAMPLE_N = 30        # a rate whose denominator is below this is drawn as "low sample"
SUPPRESS_N = 10          # a group below this is hidden entirely


def wilson(successes: int, n: int) -> dict[str, Any]:
    """Rate with its 95% Wilson interval. n == 0 gives a null-rate result."""
    if n <= 0:
        return {"numerator": successes, "denominator": n, "rate": None, "ci_low": None, "ci_high": None, "low_sample": True}
    # A rate above 100% can't be a valid proportion; clamp so the interval can't hit a negative sqrt.
    # (Callers still show the raw numerator and flag the inconsistency.)
    p = min(1.0, max(0.0, successes / n))
    z2 = Z95 * Z95
    denom = 1 + z2 / n
    center = (p + z2 / (2 * n)) / denom
    margin = Z95 * math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / denom
    return {
        "numerator": successes, "denominator": n, "rate": round(p, 4),
        "ci_low": round(max(0.0, center - margin), 4), "ci_high": round(min(1.0, center + margin), 4),
        "low_sample": n < LOW_SAMPLE_N,
    }


def two_proportion_p_value(x1: int, n1: int, x0: int, n0: int) -> float | None:
    """Two-sided p-value of a two-proportion z-test (pooled)."""
    if n1 <= 0 or n0 <= 0:
        return None
    pooled = (x1 + x0) / (n1 + n0)
    se = math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n0))
    if se == 0:
        return 1.0
    z = (x1 / n1 - x0 / n0) / se
    return round(math.erfc(abs(z) / math.sqrt(2)), 6)


def ist_day_start(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=IST).astimezone(timezone.utc)


def resolve_range(days: int, from_date: str | None, to_date: str | None) -> tuple[datetime, datetime]:
    """[start, end) in UTC covering whole India-time days. `end` is exclusive."""
    if from_date and to_date:
        start_d, end_d = date.fromisoformat(from_date), date.fromisoformat(to_date)
    else:
        end_d = datetime.now(IST).date()
        start_d = end_d - timedelta(days=days - 1)
    return ist_day_start(start_d), ist_day_start(end_d + timedelta(days=1))


def previous_range(start: datetime, end: datetime) -> tuple[datetime, datetime]:
    return start - (end - start), start


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())
