"""Entry-level salary benchmark for the job-search kit, from the research catalogue.

Two sources, best first:
  1. the reference roles that grounded the blueprint (their own entry-level ranges), when at least 3 have one;
  2. the 'Salary Benchmarks' sheet: rows whose role/category share enough words with the job.
It is always labelled a research estimate: neither source is an offer or a vacancy.
"""
from __future__ import annotations

import re
import statistics
from typing import Any

from sqlalchemy.orm import Session

MIN_ROLES = 3
MIN_SHARED_WORDS = 2
_STOP = {"and", "the", "for", "with", "officer", "manager", "senior", "junior", "associate", "lead", "head"}


def _words(text: str) -> set[str]:
    return {w[:6] for w in re.findall(r"[a-z]{3,}", (text or "").lower()) if w not in _STOP}


def from_roles(ranges: list[tuple[float, float]]) -> dict[str, Any] | None:
    """Median entry-level low/high across reference roles."""
    if len(ranges) < MIN_ROLES:
        return None
    return {"min": round(statistics.median(a for a, _ in ranges), 1), "max": round(statistics.median(b for _, b in ranges), 1),
            "basis": "reference_roles", "n": len(ranges)}


def from_benchmark_rows(job_title: str, blueprint_title: str, rows: list[Any]) -> dict[str, Any] | None:
    """Entry-level ranges of the benchmark rows that share >= 2 words with the job (median when several)."""
    want = _words(job_title) | _words(blueprint_title)
    hits = [r for r in rows if len(want & _words(f"{r.role_category} {r.specific_role}")) >= MIN_SHARED_WORDS]
    if not hits:
        return None
    return {"min": round(statistics.median(float(r.entry_min) for r in hits), 1),
            "max": round(statistics.median(float(r.entry_max) for r in hits), 1),
            "basis": "benchmark_table", "n": len(hits), "rows": [f"{r.role_category}: {r.specific_role}" for r in hits[:3]]}


def entry_benchmark(db: Session, job_title: str, blueprint_title: str, sources: dict[str, Any] | None) -> dict[str, Any] | None:
    from app.models.market_role import MarketRole
    from app.models.reference_data import SalaryBenchmark
    ids = [r["id"] for r in (sources or {}).get("roles_used") or [] if r.get("id")]
    if ids:
        roles = db.query(MarketRole).filter(MarketRole.id.in_(ids)).all()
        found = from_roles([(float(r.entry_salary_min), float(r.entry_salary_max)) for r in roles
                            if r.entry_salary_min is not None and r.entry_salary_max is not None])
        if found:
            return {**found, "estimate": True, "level": "entry"}
    found = from_benchmark_rows(job_title, blueprint_title, db.query(SalaryBenchmark).all())
    return {**found, "estimate": True, "level": "entry"} if found else None
