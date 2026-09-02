"""Employer analytics + dashboard KPIs (Module 05 Phases 5 and 8)."""
from __future__ import annotations

import logging

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import AuthException
from app.models.applications import (
    Application,
    ApplicationStatusHistory,
    CandidateInterviewFeedback,
    CandidateNote,
)
from app.models.user import (
    EmployerProfile,
    JobPosting,
    User,
)
from app.modules.matching.schemas import (
    ApplicationTrendPoint,
    ApplicationTrendResponse,
    DashboardKpis,
    EmployerFunnelResponse,
    EmployerFunnelStage,
    JobPerformanceEntry,
    JobPerformanceResponse,
    RecruiterPerformanceEntry,
    RecruiterPerformanceResponse,
)
from app.modules.matching.service import core

logger = logging.getLogger(__name__)

FUNNEL_STAGE_ORDER = (
    "applied", "screening", "shortlisted",
    "assessment", "hr_interview", "technical_interview", "manager_interview",
    "interview_scheduled", "interview_completed",
    "offer_sent", "hired",
)

RESPONDED_STATUSES = (
    "screening", "shortlisted",
    "assessment", "hr_interview", "technical_interview", "manager_interview",
    "interview_scheduled", "interview_completed",
    "offer_sent", "offer_declined", "hired", "rejected",
)


def get_employer_funnel(user: User, db: Session) -> EmployerFunnelResponse:
    """Company-wide application funnel — counts at each stage are cumulative
    'reached this stage or beyond', not just currently-sitting-there counts,
    so the funnel reads as a conversion drop-off rather than a live snapshot."""
    employer = core._get_employer_profile_approved(user, db)
    company_employer_ids = core._get_company_employer_ids(employer, db)

    job_ids = core._get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    apps = (
        db.query(Application.status)
        .filter(Application.job_id.in_(job_ids))
        .all()
    )
    total = len(apps)
    status_counts: dict[str, int] = {}
    for (status,) in apps:
        status_counts[status] = status_counts.get(status, 0) + 1

    # "Reached stage N" = sum of counts for stage N and every stage after it in the pipeline.
    reached: dict[str, int] = {}
    for i, stage in enumerate(FUNNEL_STAGE_ORDER):
        reached[stage] = sum(status_counts.get(s, 0) for s in FUNNEL_STAGE_ORDER[i:])

    stages = [
        EmployerFunnelStage(
            stage=stage, count=reached[stage],
            pct_of_total=round(reached[stage] / total * 100, 1) if total else 0.0,
        )
        for stage in FUNNEL_STAGE_ORDER
    ]
    return EmployerFunnelResponse(total_applications=total, stages=stages)


def get_job_performance(user: User, db: Session) -> JobPerformanceResponse:
    """Per-job application breakdown — views aren't tracked yet, so this
    covers applications/shortlist/interview/hire/conversion only."""
    employer = core._get_employer_profile_approved(user, db)
    company_employer_ids = core._get_company_employer_ids(employer, db)

    scoped_ids = core._get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    jobs = (
        db.query(JobPosting)
        .filter(JobPosting.id.in_(scoped_ids))
        .order_by(JobPosting.created_at.desc())
        .all()
    )
    job_ids = [j.id for j in jobs]
    apps_by_job: dict = {}
    if job_ids:
        rows = db.query(Application.job_id, Application.status).filter(Application.job_id.in_(job_ids)).all()
        for job_id, status in rows:
            apps_by_job.setdefault(job_id, []).append(status)

    entries = []
    for job in jobs:
        statuses = apps_by_job.get(job.id, [])
        total = len(statuses)
        shortlisted = sum(1 for s in statuses if s in ("shortlisted", "interview_scheduled", "interview_completed", "offer_sent", "hired"))
        interviewed = sum(1 for s in statuses if s in ("interview_completed", "offer_sent", "hired"))
        hired = sum(1 for s in statuses if s == "hired")
        rejected = sum(1 for s in statuses if s == "rejected")
        entries.append(JobPerformanceEntry(
            job_id=str(job.id), title=job.title, is_active=job.is_active,
            total_applications=total, shortlisted=shortlisted, interviewed=interviewed,
            hired=hired, rejected=rejected,
            conversion_rate_pct=round(hired / total * 100, 1) if total else 0.0,
            created_at=job.created_at,
        ))
    return JobPerformanceResponse(jobs=entries)


def get_recruiter_performance(user: User, db: Session) -> RecruiterPerformanceResponse:
    """Per-teammate activity across the company's jobs — there was previously
    no way to see whether a recruiter seat was actually being used. Built
    entirely from existing audit tables (status_history, notes, interview
    feedback); no new model needed.
    """
    employer = core._get_employer_profile_approved(user, db)
    company_employer_ids = core._get_company_employer_ids(employer, db)

    team = (
        db.query(EmployerProfile.user_id)
        .filter(EmployerProfile.id.in_(company_employer_ids))
        .all()
    )
    team_user_ids = [t[0] for t in team]
    if not team_user_ids:
        return RecruiterPerformanceResponse(recruiters=[])

    job_ids = core._get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)

    members_by_id = {m.id: m for m in db.query(User).filter(User.id.in_(team_user_ids)).all()}

    moved_by_uid: dict = {}
    interviews_by_uid: dict = {}
    notes_by_uid: dict = {}
    hire_events_by_uid: dict = {}

    if job_ids:
        moved_rows = (
            db.query(ApplicationStatusHistory.changed_by, func.count())
            .join(Application, ApplicationStatusHistory.application_id == Application.id)
            .filter(ApplicationStatusHistory.changed_by.in_(team_user_ids), Application.job_id.in_(job_ids))
            .group_by(ApplicationStatusHistory.changed_by)
            .all()
        )
        moved_by_uid = dict(moved_rows)

        interview_rows = (
            db.query(CandidateInterviewFeedback.interviewer_id, func.count())
            .join(Application, CandidateInterviewFeedback.application_id == Application.id)
            .filter(CandidateInterviewFeedback.interviewer_id.in_(team_user_ids), Application.job_id.in_(job_ids))
            .group_by(CandidateInterviewFeedback.interviewer_id)
            .all()
        )
        interviews_by_uid = dict(interview_rows)

        note_rows = (
            db.query(CandidateNote.author_id, func.count())
            .join(Application, CandidateNote.application_id == Application.id)
            .filter(CandidateNote.author_id.in_(team_user_ids), Application.job_id.in_(job_ids))
            .group_by(CandidateNote.author_id)
            .all()
        )
        notes_by_uid = dict(note_rows)

        hire_rows = (
            db.query(ApplicationStatusHistory.changed_by, ApplicationStatusHistory.created_at, Application.created_at)
            .join(Application, ApplicationStatusHistory.application_id == Application.id)
            .filter(
                ApplicationStatusHistory.changed_by.in_(team_user_ids),
                ApplicationStatusHistory.to_status == "hired",
                Application.job_id.in_(job_ids),
            )
            .all()
        )
        for uid, hired_at, applied_at in hire_rows:
            hire_events_by_uid.setdefault(uid, []).append((hired_at, applied_at))

    entries: list[RecruiterPerformanceEntry] = []
    for uid in team_user_ids:
        member = members_by_id.get(uid)
        if not member:
            continue

        hire_events = hire_events_by_uid.get(uid, [])
        hires_closed = len(hire_events)
        avg_days_to_hire = None
        if hire_events:
            total_days = sum((hired_at - applied_at).total_seconds() / 86400 for hired_at, applied_at in hire_events)
            avg_days_to_hire = round(total_days / len(hire_events), 1)

        entries.append(RecruiterPerformanceEntry(
            user_id=str(uid),
            name=member.full_name or member.email or member.phone,
            applications_moved=moved_by_uid.get(uid, 0), interviews_conducted=interviews_by_uid.get(uid, 0),
            notes_added=notes_by_uid.get(uid, 0), hires_closed=hires_closed, avg_days_to_hire=avg_days_to_hire,
        ))

    entries.sort(key=lambda e: e.hires_closed, reverse=True)
    return RecruiterPerformanceResponse(recruiters=entries)


def get_dashboard_kpis(user: User, db: Session) -> DashboardKpis:
    from datetime import datetime, timezone

    # Return zeroed KPIs for pending employers — throwing 404 here blanks the dashboard.
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise AuthException("Employer profile not found.")
    if not profile.is_approved:
        return DashboardKpis(
            active_jobs=0, draft_jobs=0, paused_jobs=0, closed_jobs=0, archived_jobs=0,
            applications_today=0, total_applications=0, interviews_scheduled=0,
            offers_sent=0, hires=0, response_rate_pct=0.0, avg_time_to_hire_days=None,
        )
    employer = profile
    company_employer_ids = core._get_company_employer_ids(employer, db)

    jobs_q = db.query(JobPosting.status, JobPosting.id).filter(
        JobPosting.employer_id.in_(company_employer_ids)
    )
    jobs_q = core._scope_jobs_query(jobs_q, employer, user.role_name)
    jobs_rows = jobs_q.all()

    job_status_counts: dict[str, int] = {}
    job_ids = []
    for status, jid in jobs_rows:
        job_status_counts[status] = job_status_counts.get(status, 0) + 1
        job_ids.append(jid)

    if not job_ids:
        return DashboardKpis(
            active_jobs=0, draft_jobs=0, paused_jobs=0, closed_jobs=0, archived_jobs=0,
            applications_today=0, total_applications=0, interviews_scheduled=0,
            offers_sent=0, hires=0, response_rate_pct=0.0, avg_time_to_hire_days=None,
        )

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    apps = db.query(Application.status, Application.created_at).filter(Application.job_id.in_(job_ids)).all()
    total_applications = len(apps)
    applications_today = sum(1 for _, created_at in apps if created_at and created_at >= today_start)
    interviews_scheduled = sum(1 for status, _ in apps if status == "interview_scheduled")
    offers_sent = sum(1 for status, _ in apps if status in ("offer_sent", "hired"))
    hires = sum(1 for status, _ in apps if status == "hired")
    rejected_count = sum(1 for status, _ in apps if status == "rejected")
    responded = sum(1 for status, _ in apps if status in RESPONDED_STATUSES)
    response_rate_pct = round(responded / total_applications * 100, 1) if total_applications else 0.0

    # Average time-to-hire: created_at -> the timestamp of the 'hired' transition,
    # computed from ApplicationStatusHistory (the source of truth for transition times).
    hired_durations = (
        db.query(Application.created_at, ApplicationStatusHistory.created_at)
        .join(ApplicationStatusHistory, ApplicationStatusHistory.application_id == Application.id)
        .filter(Application.job_id.in_(job_ids), ApplicationStatusHistory.to_status == "hired")
        .all()
    )
    avg_time_to_hire_days = None
    if hired_durations:
        days = [(hired_at - applied_at).total_seconds() / 86400 for applied_at, hired_at in hired_durations]
        avg_time_to_hire_days = round(sum(days) / len(days), 1)

    return DashboardKpis(
        active_jobs=job_status_counts.get("published", 0),
        draft_jobs=job_status_counts.get("draft", 0),
        paused_jobs=job_status_counts.get("paused", 0),
        closed_jobs=job_status_counts.get("closed", 0),
        archived_jobs=job_status_counts.get("archived", 0),
        applications_today=applications_today,
        total_applications=total_applications,
        interviews_scheduled=interviews_scheduled,
        offers_sent=offers_sent,
        hires=hires,
        rejected_count=rejected_count,
        response_rate_pct=response_rate_pct,
        avg_time_to_hire_days=avg_time_to_hire_days,
    )


def get_application_trend(user: User, db: Session, days: int = 30) -> ApplicationTrendResponse:
    from datetime import datetime, timedelta, timezone

    employer = core._get_employer_profile_approved(user, db)
    company_employer_ids = core._get_company_employer_ids(employer, db)
    job_ids = core._get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    counts_by_day: dict[str, int] = {}
    if job_ids:
        rows = (
            db.query(func.date_trunc("day", Application.created_at), func.count())
            .filter(Application.job_id.in_(job_ids), Application.created_at >= start)
            .group_by(func.date_trunc("day", Application.created_at))
            .all()
        )
        counts_by_day = {day.date().isoformat(): count for day, count in rows}

    series = [
        ApplicationTrendPoint(date=(start + timedelta(days=i)).date().isoformat(),
                               count=counts_by_day.get((start + timedelta(days=i)).date().isoformat(), 0))
        for i in range(days)
    ]
    return ApplicationTrendResponse(days=days, series=series)

