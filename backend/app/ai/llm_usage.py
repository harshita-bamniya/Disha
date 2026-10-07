"""Per-call LLM usage: calls and tokens by day, feature and model (Redis hash, 45-day TTL).

Tokens and calls are facts the provider returns. Money is only computed when real per-million-token prices are
supplied in `LLM_PRICES` (JSON, e.g. {"gemini-3.1-flash-lite": {"in": 0.10, "out": 0.40}}); no price is assumed.
Recording never raises: usage tracking must not break a user's request.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)
TTL_SECONDS = 45 * 24 * 3600


def _key(day: str) -> str:
    return f"llm_usage:{day}"


def record(feature: str, model: str | None, input_tokens: int | None, output_tokens: int | None) -> None:
    try:
        from app.database import get_redis_client
        r = get_redis_client()
        key = _key(f"{datetime.now(timezone.utc):%Y%m%d}")
        field = f"{feature}|{model or 'unknown'}"
        pipe = r.pipeline()
        pipe.hincrby(key, f"{field}|calls", 1)
        pipe.hincrby(key, f"{field}|in", int(input_tokens or 0))
        pipe.hincrby(key, f"{field}|out", int(output_tokens or 0))
        pipe.expire(key, TTL_SECONDS)
        pipe.execute()
    except Exception as exc:                      # tracking is best effort
        logger.debug("llm usage not recorded: %s", exc)


def record_message(feature: str, msg: Any) -> None:
    record(feature, getattr(msg, "model", None), getattr(msg, "input_tokens", None), getattr(msg, "output_tokens", None))


def prices() -> dict[str, dict[str, float]]:
    try:
        return json.loads(os.environ.get("LLM_PRICES", "") or "{}")
    except ValueError:
        return {}


def summarise(raw: dict[str, int], price_table: dict[str, dict[str, float]] | None = None) -> list[dict[str, Any]]:
    """Fold the hash into rows {feature, model, calls, in, out, usd|None}."""
    rows: dict[tuple[str, str], dict[str, Any]] = {}
    for field, value in raw.items():
        feature, model, metric = field.split("|")
        row = rows.setdefault((feature, model), {"feature": feature, "model": model, "calls": 0, "in": 0, "out": 0})
        row[metric] = int(value)
    price_table = price_table or {}
    for row in rows.values():
        p = price_table.get(row["model"])
        row["usd"] = round(row["in"] / 1e6 * p["in"] + row["out"] / 1e6 * p["out"], 4) if p and "in" in p and "out" in p else None
    return sorted(rows.values(), key=lambda r: (r["feature"], r["model"]))


def report(days: int = 1) -> list[dict[str, Any]]:
    from app.database import get_redis_client
    r = get_redis_client()
    merged: dict[str, int] = {}
    for i in range(days):
        day = f"{datetime.now(timezone.utc) - timedelta(days=i):%Y%m%d}"
        for k, v in r.hgetall(_key(day)).items():
            k = k.decode() if isinstance(k, bytes) else k
            merged[k] = merged.get(k, 0) + int(v)
    return summarise(merged, prices())
