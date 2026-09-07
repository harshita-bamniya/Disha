"""Aspirant: applications."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.applications import (
    Application,
    ApplicationStatusHistory,
    CandidateInterviewFeedback,
)
from app.models.user import (
    AspirantProfile,
    EmployerProfile,
    JobPosting,
    KrsScore,
    User,
)
from app.modules.matching.schemas import (
    ApplicationDetailOut,
    ApplicationOut,
    ApplicationStatusHistoryItem,
    ApplyRequest,
    InterviewFeedbackOut,
)
from app.modules.matching.service import core, interviews
from app.modules.recommendations.ranker import rank_jobs_for_user

logger = logging.getLogger(__name__)


def apply_to_job(
    job_id: str,
    body: ApplyRequest,
    user: User,
    db: Session,
) -> ApplicationOut:
    """Submit an application. Enforces per-user application limit."""
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.is_active == True).first()
    if not job:
        raise NotFoundException("Job not found or no longer active.")

    # Duplicate check
    existing = (
        db.query(Application)
        .filter(Application.aspirant_id == user.id, Application.job_id == job_id)
        .first()
    )
    if existing:
        raise BadRequestException("You have already applied to this job.")

    # Active application limit (withdrawn/rejected don't count)
    active_limit = core._get_platform_setting("max_applications_per_user", core._APPLICATION_LIMIT, db)
    active_count = (
        db.query(Application)
        .filter(
            Application.aspirant_id == user.id,
            Application.status.notin_(["withdrawn", "rejected"]),
        )
        .count()
    )
    if active_count >= int(active_limit):
        raise BadRequestException(
            f"You have reached the maximum of {active_limit} active applications. "
            "Withdraw an existing application before applying to a new one."
        )

    # Compute match score at time of application using the shared ranker
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    snap, _ = rank_jobs_for_user(profile, krs, db, extra_sql_filters=[JobPosting.id == job.id], limit=1)
    ms = snap[0].match_score if snap else 0

    application = Application(
        aspirant_id=user.id,
        job_id=job.id,
        match_score=ms,
        cover_note=body.cover_note,
        status="applied",
    )
    db.add(application)
    db.flush()

    # Record initial status transition
    db.add(ApplicationStatusHistory(
        application_id=application.id,
        from_status=None,
        to_status="applied",
        changed_by=user.id,
        note="Application submitted",
    ))
    db.commit()
    db.refresh(application)

    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()

    if employer:
        from app.core.notifications import new_application_email, notify
        from app.modules.inbox.service import notify_company_team
        recipient = db.query(User).filter(User.id == employer.user_id).first()
        subject, html = new_application_email(job.title, profile.full_name if profile else None)
        notify(recipient.email if recipient else None, subject, html)
        notify_company_team(
            db, employer, "new_application",
            f"New application: {job.title}",
            f"{(profile.full_name if profile else None) or 'A candidate'} applied to {job.title}.",
            f"/app/employer/pipeline/{job.id}",
        )
        db.commit()

    return ApplicationOut(
        id=str(application.id),
        job_id=str(job.id),
        job_title=job.title,
        company_name=employer.company_name if employer else "Unknown",
        status=application.status,
        match_score=application.match_score,
        cover_note=application.cover_note,
        employer_note=None,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


def list_my_applications(user: User, db: Session) -> list[ApplicationOut]:
    apps = (
        db.query(Application)
        .options(joinedload(Application.job))
        .filter(Application.aspirant_id == user.id)
        .order_by(Application.created_at.desc())
        .all()
    )
    result = []
    for app in apps:
        job = app.job
        employer = (
            db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()
            if job else None
        )
        dept = job.department if job else None
        result.append(ApplicationOut(
            id=str(app.id),
            job_id=str(app.job_id),
            job_title=job.title if job else "Unknown",
            company_name=employer.company_name if employer else "Unknown",
            department_id=str(job.department_id) if job and job.department_id else None,
            department_name=dept.name if dept else None,
            status=app.status,
            match_score=app.match_score,
            cover_note=app.cover_note,
            employer_note=app.employer_note,
            created_at=app.created_at,
            updated_at=app.updated_at,
        ))
    return result


def get_application_detail(application_id: str, user: User, db: Session) -> ApplicationDetailOut:
    app = (
        db.query(Application)
        .options(
            joinedload(Application.job),
            joinedload(Application.status_history),
        )
        .filter(Application.id == application_id, Application.aspirant_id == user.id)
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")

    job = app.job
    employer = (
        db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()
        if job else None
    )
    dept = job.department if job else None
    return ApplicationDetailOut(
        id=str(app.id),
        job_id=str(app.job_id),
        job_title=job.title if job else "Unknown",
        company_name=employer.company_name if employer else "Unknown",
        department_id=str(job.department_id) if job and job.department_id else None,
        department_name=dept.name if dept else None,
        status=app.status,
        match_score=app.match_score,
        cover_note=app.cover_note,
        employer_note=app.employer_note,
        created_at=app.created_at,
        updated_at=app.updated_at,
        status_history=[
            ApplicationStatusHistoryItem(
                from_status=h.from_status,
                to_status=h.to_status,
                note=h.note,
                created_at=h.created_at,
            )
            for h in app.status_history
        ],
    )


def withdraw_application(
    application_id: str, user: User, db: Session,
    reason: str | None = None, note: str | None = None,
) -> dict:
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.aspirant_id == user.id)
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    if app.status in ("withdrawn", "hired", "rejected", "offer_declined"):
        raise BadRequestException(f"Cannot withdraw an application with status '{app.status}'.")

    prev = app.status
    app.status = "withdrawn"
    history_note = f"Withdrawn by applicant — {reason}" if reason else "Withdrawn by applicant"
    if note:
        history_note += f": {note}"
    db.add(ApplicationStatusHistory(
        application_id=app.id,
        from_status=prev,
        to_status="withdrawn",
        changed_by=user.id,
        note=history_note,
    ))
    db.commit()
    return {"status": "withdrawn"}


def list_my_interviews(application_id: str, user: User, db: Session) -> list[InterviewFeedbackOut]:
    """Aspirant-facing interview visibility — previously a candidate could only
    learn their interview time from an email; there was no in-product view at all."""
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.aspirant_id == user.id)
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    rows = (
        db.query(CandidateInterviewFeedback)
        .filter(CandidateInterviewFeedback.application_id == app.id)
        .order_by(CandidateInterviewFeedback.scheduled_at.desc())
        .all()
    )
    out = []
    for row in rows:
        interviewer = db.query(User).filter(User.id == row.interviewer_id).first() if row.interviewer_id else None
        out.append(interviews._interview_to_out(row, interviewer, db))
    return out


def request_interview_reschedule(application_id: str, interview_id: str, note: str, user: User, db: Session) -> InterviewFeedbackOut:
    """Self-serve reschedule request — the candidate flags a conflict with a
    note; the employer team sees it on the interview card and can reschedule.
    The candidate cannot directly change the time themselves, only ask."""
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.aspirant_id == user.id)
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    row = (
        db.query(CandidateInterviewFeedback)
        .filter(CandidateInterviewFeedback.id == interview_id, CandidateInterviewFeedback.application_id == app.id)
        .first()
    )
    if not row:
        raise NotFoundException("Interview not found.")
    if row.status != "scheduled":
        raise BadRequestException("Can only request a reschedule for a scheduled interview.")

    row.reschedule_requested_at = datetime.now(timezone.utc)
    row.reschedule_note = note
    db.commit()
    db.refresh(row)

    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    if employer:
        from app.modules.inbox.service import notify_company_team
        notify_company_team(
            db, employer, "interview_reschedule_requested",
            f"Reschedule requested — {job.title}",
            f"Candidate requested a new time: \"{note}\"",
            f"/app/employer/pipeline/{job.id}",
        )
        db.commit()

    interviewer = db.query(User).filter(User.id == row.interviewer_id).first() if row.interviewer_id else None
    return interviews._interview_to_out(row, interviewer, db)


def reschedule_interview(application_id: str, interview_id: str, scheduled_at, meeting_link: str | None, user: User, db: Session) -> InterviewFeedbackOut:
    """Employer updates the time on an existing interview (rather than
    creating a duplicate row via schedule_interview) — clears any pending
    reschedule request and re-notifies the candidate with a fresh ICS."""
    row = interviews._get_employer_interview(application_id, interview_id, user, db)
    if row.status != "scheduled":
        raise BadRequestException(f"Cannot reschedule an interview with status '{row.status}'.")

    row.scheduled_at = scheduled_at
    if meeting_link is not None:
        row.meeting_link = meeting_link
    row.reschedule_requested_at = None
    row.reschedule_note = None
    db.commit()
    db.refresh(row)

    app = db.query(Application).filter(Application.id == row.application_id).first()
    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first() if app else None
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    candidate = db.query(User).filter(User.id == app.aspirant_id).first() if app else None

    if candidate and job and employer:
        from app.core.calendar import build_interview_ics
        from app.core.notifications import interview_scheduled_email, notify
        from app.modules.inbox.service import create_notification

        subject, html = interview_scheduled_email(
            job.title, employer.company_name, scheduled_at.strftime("%d %b %Y, %I:%M %p UTC"), row.meeting_link,
        )
        ics_content = None
        if candidate.email:
            ics_content = build_interview_ics(
                uid=f"interview-{row.id}@beginablai.in",
                summary=f"Interview: {job.title} at {employer.company_name}",
                description=f"Interview for {job.title} at {employer.company_name} (rescheduled).",
                scheduled_at=scheduled_at, location=row.meeting_link,
                organizer_email=user.email, attendee_email=candidate.email,
            )
        notify(candidate.email, subject, html, ics_content, "interview.ics")
        create_notification(
            db, candidate.id, "interview_scheduled",
            f"Interview rescheduled — {job.title}",
            f"Your interview for {job.title} at {employer.company_name} is now on {scheduled_at.strftime('%d %b, %I:%M %p')}.",
            "/app/jobs/applications",
        )
        db.commit()

    interviewer = db.query(User).filter(User.id == row.interviewer_id).first() if row.interviewer_id else None
    return interviews._interview_to_out(row, interviewer, db)

