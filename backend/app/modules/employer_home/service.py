"""Employer dashboard: what needs the hiring team now, and how hiring is going.

Everything is scoped exactly like the rest of the employer views: a company-wide viewer sees every job in the company,
a department-scoped viewer only their department's jobs. A company still awaiting approval gets empty results.

Honesty rules (same as the admin dashboard): a rate with a small denominator is shown as a count, a change is only
given when both periods are big enough, and "reached an interview" is the one shared definition.
"""
from __future__ import annotations

import statistics
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session

from app.models.applications import (
    INTERVIEW_STAGE_STATUSES,
    REACHED_INTERVIEW_STATUSES,
    Application,
    ApplicationStatusHistory,
    CandidateInterviewFeedback,
)
from app.models.company import CompanyDepartment
from app.models.platform import PlatformSetting
from app.models.user import AspirantProfile, EmployerProfile, JobPosting, User
from app.modules.admin.command_center.stats import (
    IST,
    LOW_SAMPLE_N,
    ist_day_start,
    previous_range,
    resolve_range,
    wilson,
)
from app.modules.admin.dashboard.marketplace import (  # noqa: PLC2701 (shared date helpers)
    _day_series,
    _ist_day,
)
from app.modules.matching.service import core

DEFAULT_FIRST_LOOK_DAYS = 3
STALE_INTERVIEW_AFTER = timedelta(hours=1)        # same cut-off the "did this interview happen?" nudge uses
NO_APPLICATION_AFTER_DAYS = 7
MIN_HIRES_FOR_TIME = 5                            # a median over fewer hires is shown, flagged, and never compared
COUNT_PCT_MIN_BASE = 10

PIPELINE_STAGES = [
    ("new", "New", ("applied", "under_review")),
    ("screening", "Screening", ("screening", "shortlisted", "assessment", "hold")),
    ("interview", "Interview", INTERVIEW_STAGE_STATUSES),
    ("offer", "Offer sent", ("offer_sent",)),
]

HELP = {
    "open_jobs": "Jobs that are published and not past their closing date, right now. 'New' counts jobs created in the period.",
    "applications": "Applications received in the period for your jobs.",
    "interview_rate": "Of the applications received in the period, the share that has reached an interview stage, an offer, or "
                      "a hire. Applications still being screened count against it, so recent periods read lower.",
    "hires": "Candidates moved to Hired during the period, by the date of the change.",
    "time_to_hire": "Median days from application to being marked Hired, for hires made in the period. The median is used so one "
                    "slow hire cannot distort it. Shown with the number of hires behind it.",
    "offer_acceptance": "Offers accepted (marked Hired) divided by offers resolved (accepted or declined) in the period. "
                        "Offers still waiting for an answer are not counted.",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _first_look_days(db: Session) -> int:
    row = db.query(PlatformSetting).filter(PlatformSetting.key == "application_first_look_days").first()
    try:
        value = int(row.value) if row and row.value is not None else DEFAULT_FIRST_LOOK_DAYS
    except (TypeError, ValueError):
        value = DEFAULT_FIRST_LOOK_DAYS
    return value if value > 0 else DEFAULT_FIRST_LOOK_DAYS


class Scope:
    """The jobs this viewer may see, as SQL conditions (never a Python list of ids)."""

    def __init__(self, db: Session, user: User):
        self.employer: Optional[EmployerProfile] = core._get_employer_profile_or_pending(user, db)
        self.approved = self.employer is not None
        self._conditions: list = []
        if self.employer is not None:
            company_ids = core._get_company_employer_ids(self.employer, db)
            self._conditions.append(JobPosting.employer_id.in_(company_ids))
            if not core._is_company_wide(self.employer, user.role_name):
                self._conditions.append(JobPosting.department_id == self.employer.department_id)

    def jobs(self):
        return select(JobPosting.id).where(*self._conditions)

    def open_jobs(self):
        today = datetime.now(IST).date()
        return select(JobPosting.id).where(
            *self._conditions, JobPosting.status == "published", JobPosting.is_active.is_(True),
            or_(JobPosting.expires_at.is_(None), JobPosting.expires_at >= today),
        )


def _age_hours(oldest: Optional[datetime], now: datetime) -> Optional[float]:
    return None if oldest is None else round(max(0.0, (now - oldest).total_seconds() / 3600), 1)


# ── needs attention ──────────────────────────────────────────────────────────────────────────

def attention(db: Session, user: User) -> dict:
    now = _now()
    first_look = _first_look_days(db)
    base = {"generated_at": now.isoformat(), "targets": {"first_look_days": first_look}, "approved": True, "rows": []}
    scope = Scope(db, user)
    if not scope.approved:
        return {**base, "approved": False}

    rows: list[dict] = []

    def add(key, label, count, link, oldest=None, overdue=0, urgent=False, note=None, parts=None):
        if count > 0:
            rows.append({
                "key": key, "label": label, "count": count, "overdue": overdue,
                "level": "urgent" if (overdue > 0 or urgent) else "normal", "oldest_age_hours": _age_hours(oldest, now),
                "note": note, "parts": [{"label": name, "count": n} for name, n in (parts or []) if n > 0], "link": link,
            })

    # 1. Applications nobody has looked at yet (still "applied") on jobs that are open.
    waiting = db.query(Application).filter(Application.status == "applied", Application.job_id.in_(scope.open_jobs()))
    n_waiting = waiting.count()
    if n_waiting:
        oldest = waiting.with_entities(func.min(Application.created_at)).scalar()
        overdue = waiting.filter(Application.created_at < now - timedelta(days=first_look)).count()
        add("new_applications", "New applications", n_waiting, "/app/employer/applicants?status=applied", oldest, overdue)

    interviews = (
        db.query(CandidateInterviewFeedback)
        .join(Application, Application.id == CandidateInterviewFeedback.application_id)
        .filter(Application.job_id.in_(scope.jobs()), CandidateInterviewFeedback.status == "scheduled")
    )

    # 2. Interviews whose time has passed with nothing logged: feedback, or a deliberate no-show.
    stale = interviews.filter(CandidateInterviewFeedback.scheduled_at.isnot(None),
                              CandidateInterviewFeedback.scheduled_at <= now - STALE_INTERVIEW_AFTER)
    n_stale = stale.count()
    if n_stale:
        add("needs_feedback", "Interviews waiting for feedback", n_stale, "/app/employer/interviews",
            stale.with_entities(func.min(CandidateInterviewFeedback.scheduled_at)).scalar(), urgent=True)

    # 3. Candidates asking for a different time.
    resched = interviews.filter(CandidateInterviewFeedback.reschedule_requested_at.isnot(None))
    n_resched = resched.count()
    if n_resched:
        add("reschedule_requests", "Reschedule requests", n_resched, "/app/employer/interviews",
            resched.with_entities(func.min(CandidateInterviewFeedback.reschedule_requested_at)).scalar())

    # 4. Offers sent that the candidate has not answered.
    offer_apps = db.query(Application.id).filter(Application.status == "offer_sent", Application.job_id.in_(scope.jobs()))
    n_offers = offer_apps.count()
    if n_offers:
        sent_at = (
            db.query(func.max(ApplicationStatusHistory.created_at))
            .filter(ApplicationStatusHistory.application_id.in_(offer_apps.subquery().select()),
                    ApplicationStatusHistory.to_status == "offer_sent")
            .group_by(ApplicationStatusHistory.application_id).all()
        )
        oldest = min((r[0] for r in sent_at if r[0] is not None), default=None)
        add("offers_waiting", "Offers waiting for an answer", n_offers, "/app/employer/offers", oldest)

    # 5. Interviews happening today (India time), with when the next one is.
    day_start = ist_day_start(datetime.now(IST).date())
    today = interviews.filter(CandidateInterviewFeedback.scheduled_at >= day_start,
                              CandidateInterviewFeedback.scheduled_at < day_start + timedelta(days=1))
    n_today = today.count()
    if n_today:
        upcoming = today.filter(CandidateInterviewFeedback.scheduled_at >= now) \
            .with_entities(func.min(CandidateInterviewFeedback.scheduled_at)).scalar()
        note = f"next at {upcoming.astimezone(IST).strftime('%I:%M %p').lstrip('0').lower()}" if upcoming else "all earlier today"
        add("interviews_today", "Interviews today", n_today, "/app/employer/calendar", note=note)

    rows.sort(key=lambda r: (r["level"] != "urgent", -(r["oldest_age_hours"] or 0)))
    return {**base, "rows": rows}


# ── overview: tiles, pipeline, jobs ──────────────────────────────────────────────────────────

def _count_delta(cur: int, prev: Optional[int]) -> Optional[dict]:
    if prev is None:
        return None
    return {"abs": cur - prev, "pct": round((cur - prev) / prev, 4) if prev >= COUNT_PCT_MIN_BASE else None}


def _rate_delta(cur: dict, prev: Optional[dict]) -> Optional[dict]:
    if prev is None or cur["low_sample"] or prev["low_sample"] or cur["rate"] is None or prev["rate"] is None:
        return None
    return {"points": round((cur["rate"] - prev["rate"]) * 100, 1)}


def _applications(db: Session, scope: Scope, start: datetime, end: datetime) -> tuple[int, list[int]]:
    day = _ist_day(Application.created_at)
    rows = dict(
        db.query(day, func.count(Application.id))
        .filter(Application.job_id.in_(scope.jobs()), Application.created_at >= start, Application.created_at < end)
        .group_by(day).all()
    )
    return sum(rows.values()), _day_series(rows, start, end)


def _hires(db: Session, scope: Scope, start: datetime, end: datetime) -> tuple[int, list[int], list[float]]:
    """Hires by the date of the change, with how many days each took from application."""
    rows = (
        db.query(ApplicationStatusHistory.application_id, func.min(ApplicationStatusHistory.created_at), Application.created_at)
        .join(Application, Application.id == ApplicationStatusHistory.application_id)
        .filter(Application.job_id.in_(scope.jobs()), ApplicationStatusHistory.to_status == "hired",
                ApplicationStatusHistory.created_at >= start, ApplicationStatusHistory.created_at < end)
        .group_by(ApplicationStatusHistory.application_id, Application.created_at).all()
    )
    per_day: dict[date, int] = {}
    days_taken: list[float] = []
    for _app_id, hired_at, applied_at in rows:
        d = hired_at.astimezone(IST).date()
        per_day[d] = per_day.get(d, 0) + 1
        days_taken.append(max(0.0, (hired_at - applied_at).total_seconds() / 86400))
    return len(rows), _day_series(per_day, start, end), days_taken


def _interview_rate(db: Session, scope: Scope, start: datetime, end: datetime) -> dict:
    in_period = and_(Application.job_id.in_(scope.jobs()), Application.created_at >= start, Application.created_at < end)
    total = db.query(func.count(Application.id)).filter(in_period).scalar() or 0
    via_history = exists().where(ApplicationStatusHistory.application_id == Application.id,
                                 ApplicationStatusHistory.to_status.in_(REACHED_INTERVIEW_STATUSES))
    reached = db.query(func.count(Application.id)).filter(
        in_period, or_(Application.status.in_(REACHED_INTERVIEW_STATUSES), via_history)).scalar() or 0
    return wilson(reached, total)


def _offer_outcomes(db: Session, scope: Scope, start: datetime, end: datetime) -> dict:
    counts = dict(
        db.query(ApplicationStatusHistory.to_status, func.count(func.distinct(ApplicationStatusHistory.application_id)))
        .join(Application, Application.id == ApplicationStatusHistory.application_id)
        .filter(Application.job_id.in_(scope.jobs()), ApplicationStatusHistory.to_status.in_(("hired", "offer_declined")),
                ApplicationStatusHistory.created_at >= start, ApplicationStatusHistory.created_at < end)
        .group_by(ApplicationStatusHistory.to_status).all()
    )
    accepted, declined = counts.get("hired", 0), counts.get("offer_declined", 0)
    return wilson(accepted, accepted + declined)


def _tile(key, label, kind, value, sub, delta, series=None, low_sample=False, **extra) -> dict:
    return {"key": key, "label": label, "kind": kind, "value": value, "sub": sub, "delta": delta, "series": series,
            "low_sample": low_sample, "help": HELP[key], **extra}


def overview(db: Session, user: User, days: int, compare: bool) -> dict:
    now = _now()
    start, end = resolve_range(days, None, None)
    prev = previous_range(start, end) if compare else None
    scope = Scope(db, user)
    range_info = {"days": days, "from": start.astimezone(IST).date().isoformat(),
                  "to": (end - timedelta(seconds=1)).astimezone(IST).date().isoformat(), "compare": compare}
    if not scope.approved:
        return {"generated_at": now.isoformat(), "approved": False, "range": range_info, "tiles": [], "pipeline": [],
                "jobs": {"total_open": 0, "items": []}, "upcoming_interviews": [], "recent_applicants": [],
                "low_sample_n": LOW_SAMPLE_N}

    open_ids = scope.open_jobs()
    open_count = db.query(func.count(JobPosting.id)).filter(JobPosting.id.in_(open_ids)).scalar() or 0
    new_jobs = db.query(func.count(JobPosting.id)).filter(
        JobPosting.id.in_(scope.jobs()), JobPosting.created_at >= start, JobPosting.created_at < end, JobPosting.status != "draft").scalar() or 0
    new_jobs_prev = (db.query(func.count(JobPosting.id)).filter(
        JobPosting.id.in_(scope.jobs()), JobPosting.created_at >= prev[0], JobPosting.created_at < prev[1], JobPosting.status != "draft",
    ).scalar() or 0) if prev else None

    apps, apps_series = _applications(db, scope, start, end)
    apps_prev = _applications(db, scope, *prev)[0] if prev else None
    hires, hires_series, days_taken = _hires(db, scope, start, end)
    hires_prev_data = _hires(db, scope, *prev) if prev else None
    rate = _interview_rate(db, scope, start, end)
    rate_prev = _interview_rate(db, scope, *prev) if prev else None
    offers = _offer_outcomes(db, scope, start, end)
    offers_prev = _offer_outcomes(db, scope, *prev) if prev else None

    median_days = round(statistics.median(days_taken), 1) if days_taken else None
    time_low = len(days_taken) < MIN_HIRES_FOR_TIME
    prev_median = (round(statistics.median(hires_prev_data[2]), 1) if hires_prev_data and hires_prev_data[2] else None)
    prev_time_low = bool(hires_prev_data) and len(hires_prev_data[2]) < MIN_HIRES_FOR_TIME
    time_delta = ({"days": round(median_days - prev_median, 1)}
                  if prev and median_days is not None and prev_median is not None and not time_low and not prev_time_low else None)

    tiles = [
        _tile("open_jobs", "Open jobs", "count", open_count, f"{new_jobs} new in this period", _count_delta(new_jobs, new_jobs_prev), delta_basis="new jobs"),
        _tile("applications", "Applications", "count", apps, None, _count_delta(apps, apps_prev), series=apps_series, delta_basis="applications"),
        _tile("interview_rate", "Interview rate", "rate", rate["rate"], f"{rate['numerator']} of {rate['denominator']} applications",
              _rate_delta(rate, rate_prev), low_sample=rate["low_sample"], numerator=rate["numerator"], denominator=rate["denominator"]),
        _tile("hires", "Hires", "count", hires, None, _count_delta(hires, hires_prev_data[0] if hires_prev_data else None),
              series=hires_series, delta_basis="hires"),
        _tile("time_to_hire", "Time to hire", "days", median_days, f"median of {hires} {'hire' if hires == 1 else 'hires'}" if hires else "no hires yet",
              time_delta, low_sample=time_low and bool(days_taken), numerator=len(days_taken)),
        _tile("offer_acceptance", "Offer acceptance", "rate", offers["rate"], f"{offers['numerator']} of {offers['denominator']} offers answered",
              _rate_delta(offers, offers_prev), low_sample=offers["low_sample"], numerator=offers["numerator"], denominator=offers["denominator"]),
    ]

    # Where candidates are right now, across open jobs.
    status_counts = dict(
        db.query(Application.status, func.count(Application.id))
        .filter(Application.job_id.in_(open_ids)).group_by(Application.status).all()
    )
    pipeline = [{"key": key, "label": label, "count": sum(status_counts.get(s, 0) for s in statuses)} for key, label, statuses in PIPELINE_STAGES]

    # The open jobs themselves: who is waiting, how long it has been open, which ones nobody applied to.
    awaiting = func.count(Application.id).filter(Application.status == "applied")
    interviewing = func.count(Application.id).filter(Application.status.in_(INTERVIEW_STAGE_STATUSES))
    screening = func.count(Application.id).filter(Application.status.in_(PIPELINE_STAGES[1][2]))
    offered = func.count(Application.id).filter(Application.status == "offer_sent")
    rows = (
        db.query(JobPosting, func.count(Application.id), awaiting, interviewing, screening, offered)
        .outerjoin(Application, Application.job_id == JobPosting.id)
        .filter(JobPosting.id.in_(open_ids)).group_by(JobPosting.id)
        .order_by(awaiting.desc(), JobPosting.created_at).limit(8).all()
    )
    dept_names = {d.id: d.name for d in db.query(CompanyDepartment).filter(CompanyDepartment.id.in_(
        [j.department_id for j, *_ in rows if j.department_id] or [None])).all()}
    items = []
    today = datetime.now(IST).date()
    for job, total, wait, interview, screen, offer in rows:
        age = max(0, (now - job.created_at).days)
        items.append({"id": str(job.id), "title": job.title, "department": dept_names.get(job.department_id),
                      "age_days": age, "applicants": total, "awaiting": wait, "screening": screen, "in_interview": interview,
                      "offer": offer, "closes_in_days": (job.expires_at - today).days if job.expires_at else None,
                      "no_applications": total == 0 and age >= NO_APPLICATION_AFTER_DAYS})

    name = func.coalesce(AspirantProfile.full_name, User.full_name, User.email)

    # The next interviews on the calendar.
    upcoming = [
        {"application_id": str(app_id), "job_id": str(job_id), "candidate": who, "job_title": title,
         "scheduled_at": when.isoformat(), "reschedule_requested": asked is not None}
        for app_id, job_id, who, title, when, asked in (
            db.query(Application.id, Application.job_id, name, JobPosting.title,
                     CandidateInterviewFeedback.scheduled_at, CandidateInterviewFeedback.reschedule_requested_at)
            .select_from(CandidateInterviewFeedback)
            .join(Application, Application.id == CandidateInterviewFeedback.application_id)
            .join(JobPosting, JobPosting.id == Application.job_id)
            .join(User, User.id == Application.aspirant_id)
            .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
            .filter(Application.job_id.in_(scope.jobs()), CandidateInterviewFeedback.status == "scheduled",
                    CandidateInterviewFeedback.scheduled_at >= now)
            .order_by(CandidateInterviewFeedback.scheduled_at).limit(5).all()
        )
    ]

    # Who applied most recently, with the resume fit score the employer already sees elsewhere.
    recent = [
        {"application_id": str(app_id), "job_id": str(job_id), "candidate": who, "job_title": title,
         "applied_at": at.isoformat(), "match_score": score, "status": status}
        for app_id, job_id, who, title, at, score, status in (
            db.query(Application.id, Application.job_id, name, JobPosting.title, Application.created_at,
                     Application.match_score, Application.status)
            .join(JobPosting, JobPosting.id == Application.job_id)
            .join(User, User.id == Application.aspirant_id)
            .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
            .filter(Application.job_id.in_(scope.jobs()))
            .order_by(Application.created_at.desc()).limit(6).all()
        )
    ]

    return {"generated_at": now.isoformat(), "approved": True, "range": range_info, "tiles": tiles, "pipeline": pipeline,
            "jobs": {"total_open": open_count, "no_application_after_days": NO_APPLICATION_AFTER_DAYS, "items": items},
            "upcoming_interviews": upcoming, "recent_applicants": recent,
            "low_sample_n": LOW_SAMPLE_N, "min_hires_for_time": MIN_HIRES_FOR_TIME}
