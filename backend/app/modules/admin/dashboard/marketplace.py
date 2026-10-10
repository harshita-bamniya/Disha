"""Admin dashboard, zone B: is the marketplace healthy?

Everything here is computed for one India-time date range and, optionally, the equally long range before it.
Honesty rules (see the plan, section 7): a rate with a small denominator is flagged "low sample" and shows no change;
a percentage change is only given when the earlier period is big enough for it to mean something.
"""
from __future__ import annotations

import statistics
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session

from app.models.applications import (
    REACHED_INTERVIEW_STATUSES,
    Application,
    ApplicationStatusHistory,
)
from app.models.user import JobPosting
from app.modules.admin.command_center.stats import (
    IST,
    LOW_SAMPLE_N,
    previous_range,
    resolve_range,
    wilson,
)

# A percentage change from a tiny base (1 -> 3 is "+200%") misleads, so it is only shown above this.
COUNT_PCT_MIN_BASE = 10
ZERO_APPLICATION_AFTER_DAYS = 7

HELP = {
    "live_jobs": "Jobs that are published and not past their closing date, right now. 'New' counts jobs created in the period "
                 "(a publish date is not stored yet, so a job drafted earlier but published now is not counted as new).",
    "applications": "Applications submitted in the period. 'Median per live job' is the middle value of applications received "
                    "in the period across the jobs that are live now, so a few popular jobs cannot hide quiet ones.",
    "interview_rate": "Of the applications submitted in the period, the share that has reached an interview stage, an offer, "
                      "or a hire. Applications still being screened count against it, so recent periods read lower.",
    "hires": "Applications moved to Hired during the period (by the date of the status change, not the application date).",
}


def _day_series(rows: dict[date, int], start: datetime, end: datetime) -> list[int]:
    first = start.astimezone(IST).date()
    last = (end - timedelta(seconds=1)).astimezone(IST).date()
    out, d = [], first
    while d <= last:
        out.append(int(rows.get(d, 0)))
        d += timedelta(days=1)
    return out


def _ist_day(col):
    return func.date(func.timezone("Asia/Kolkata", col))


def _live_conditions() -> tuple:
    today = datetime.now(IST).date()
    return (
        JobPosting.status == "published", JobPosting.is_active.is_(True),
        or_(JobPosting.expires_at.is_(None), JobPosting.expires_at >= today),
    )


def _live_jobs(db: Session):
    return db.query(JobPosting).filter(*_live_conditions())


def _live_job_ids():
    return select(JobPosting.id).where(*_live_conditions())


# ── building blocks ──────────────────────────────────────────────────────────────────────────

def _applications(db: Session, start: datetime, end: datetime) -> tuple[int, list[int]]:
    day = _ist_day(Application.created_at)
    rows = dict(
        db.query(day, func.count(Application.id))
        .filter(Application.created_at >= start, Application.created_at < end).group_by(day).all()
    )
    return sum(rows.values()), _day_series(rows, start, end)


def _hires(db: Session, start: datetime, end: datetime) -> tuple[int, list[int]]:
    day = _ist_day(ApplicationStatusHistory.created_at)
    rows = dict(
        db.query(day, func.count(func.distinct(ApplicationStatusHistory.application_id)))
        .filter(ApplicationStatusHistory.to_status == "hired",
                ApplicationStatusHistory.created_at >= start, ApplicationStatusHistory.created_at < end)
        .group_by(day).all()
    )
    return sum(rows.values()), _day_series(rows, start, end)


def _interview_rate(db: Session, start: datetime, end: datetime) -> dict:
    in_period = and_(Application.created_at >= start, Application.created_at < end)
    total = db.query(func.count(Application.id)).filter(in_period).scalar() or 0
    reached_via_history = exists().where(
        ApplicationStatusHistory.application_id == Application.id,
        ApplicationStatusHistory.to_status.in_(REACHED_INTERVIEW_STATUSES),
    )
    reached = db.query(func.count(Application.id)).filter(
        in_period, or_(Application.status.in_(REACHED_INTERVIEW_STATUSES), reached_via_history),
    ).scalar() or 0
    return wilson(reached, total)


def _median_per_live_job(db: Session, start: datetime, end: datetime) -> Optional[float]:
    counts = (
        db.query(func.count(Application.id))
        .select_from(JobPosting)
        .outerjoin(Application, and_(Application.job_id == JobPosting.id, Application.created_at >= start, Application.created_at < end))
        .filter(JobPosting.id.in_(_live_job_ids()))
        .group_by(JobPosting.id).all()
    )
    values = [c[0] for c in counts]
    return float(statistics.median(values)) if values else None


# ── delta helpers ────────────────────────────────────────────────────────────────────────────

def _count_delta(cur: int, prev: Optional[int]) -> Optional[dict]:
    if prev is None:
        return None
    pct = round((cur - prev) / prev, 4) if prev >= COUNT_PCT_MIN_BASE else None
    return {"abs": cur - prev, "pct": pct}


def _rate_delta(cur: dict, prev: Optional[dict]) -> Optional[dict]:
    if prev is None or cur["low_sample"] or prev["low_sample"] or cur["rate"] is None or prev["rate"] is None:
        return None   # not enough people in one of the periods for the difference to mean anything
    return {"points": round((cur["rate"] - prev["rate"]) * 100, 1)}


# ── public ───────────────────────────────────────────────────────────────────────────────────

def overview(db: Session, days: int, compare: bool) -> dict:
    start, end = resolve_range(days, None, None)
    prev = previous_range(start, end) if compare else None
    now = datetime.now(timezone.utc)

    live = _live_jobs(db)
    live_count = live.count()
    new_jobs = db.query(func.count(JobPosting.id)).filter(
        JobPosting.created_at >= start, JobPosting.created_at < end, JobPosting.status != "draft").scalar() or 0
    new_jobs_prev = (db.query(func.count(JobPosting.id)).filter(
        JobPosting.created_at >= prev[0], JobPosting.created_at < prev[1], JobPosting.status != "draft").scalar() or 0) if prev else None

    apps, apps_series = _applications(db, start, end)
    apps_prev = _applications(db, *prev)[0] if prev else None
    median = _median_per_live_job(db, start, end)

    hires, hires_series = _hires(db, start, end)
    hires_prev = _hires(db, *prev)[0] if prev else None

    rate = _interview_rate(db, start, end)
    rate_prev = _interview_rate(db, *prev) if prev else None

    tiles = [
        {"key": "live_jobs", "label": "Live jobs", "kind": "count", "value": live_count,
         "sub": f"{new_jobs} new in this period", "delta": _count_delta(new_jobs, new_jobs_prev),
         "delta_basis": "new jobs", "series": None, "low_sample": False, "help": HELP["live_jobs"]},
        {"key": "applications", "label": "Applications", "kind": "count", "value": apps,
         "sub": f"median {median:g} per live job" if median is not None else "no live jobs", "delta": _count_delta(apps, apps_prev),
         "delta_basis": "applications", "series": apps_series, "low_sample": False, "help": HELP["applications"]},
        {"key": "interview_rate", "label": "Interview rate", "kind": "rate", "value": rate["rate"],
         "numerator": rate["numerator"], "denominator": rate["denominator"], "ci_low": rate["ci_low"], "ci_high": rate["ci_high"],
         "sub": f"{rate['numerator']} of {rate['denominator']} applications", "delta": _rate_delta(rate, rate_prev),
         "delta_basis": "points", "series": None, "low_sample": rate["low_sample"], "help": HELP["interview_rate"]},
        {"key": "hires", "label": "Hires", "kind": "count", "value": hires, "sub": None,
         "delta": _count_delta(hires, hires_prev), "delta_basis": "hires", "series": hires_series,
         "low_sample": False, "help": HELP["hires"]},
    ]

    # Where supply and demand are uneven: per sector, live jobs against the applications they received in the period.
    sector_rows = (
        db.query(JobPosting.sector, func.count(func.distinct(JobPosting.id)), func.count(Application.id))
        .outerjoin(Application, and_(Application.job_id == JobPosting.id, Application.created_at >= start, Application.created_at < end))
        .filter(JobPosting.id.in_(_live_job_ids()))
        .group_by(JobPosting.sector).all()
    )
    sectors = sorted(
        ({"sector": s, "jobs": j, "applications": a, "per_job": round(a / j, 1) if j else 0.0} for s, j, a in sector_rows),
        key=lambda r: (-r["jobs"], r["sector"]),
    )[:8]

    # Live jobs that have been up for a week and never received an application.
    cutoff = now - timedelta(days=ZERO_APPLICATION_AFTER_DAYS)
    no_apps = (
        live.filter(JobPosting.created_at <= cutoff)
        .filter(~exists().where(Application.job_id == JobPosting.id))
        .order_by(JobPosting.created_at)
    )
    zero_total = no_apps.count()
    zero_items = [
        {"id": str(j.id), "title": j.title, "sector": j.sector, "age_days": max(0, (now - j.created_at).days)}
        for j in no_apps.limit(5).all()
    ]

    return {
        "generated_at": now.isoformat(),
        "range": {"days": days, "from": start.astimezone(IST).date().isoformat(),
                  "to": (end - timedelta(seconds=1)).astimezone(IST).date().isoformat(), "compare": compare},
        "tiles": tiles,
        "sectors": sectors,
        "zero_application_jobs": {"total": zero_total, "after_days": ZERO_APPLICATION_AFTER_DAYS, "items": zero_items},
        "low_sample_n": LOW_SAMPLE_N,
    }
