"""Interview scheduling (Module 05 Phase 9)."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.applications import (
    Application,
    ApplicationStatusHistory,
    CandidateEmailLog,
    CandidateInterviewFeedback,
)
from app.models.user import (
    EmployerProfile,
    JobPosting,
    User,
)
from app.modules.matching.schemas import (
    InterviewFeedbackOut,
    UpcomingInterviewEntry,
)
from app.modules.matching.service import core

logger = logging.getLogger(__name__)


def _advance_status_if_earlier(app: Application, to_status: str, user: User, db: Session) -> None:
    """Moves the application forward in the pipeline to to_status, but never
    backward and never out of a terminal state (rejected/withdrawn/hired)."""
    if app.status not in core.PIPELINE_FORWARD_ORDER:
        return   # terminal state (rejected/withdrawn) — leave it alone
    if core.PIPELINE_FORWARD_ORDER.index(to_status) <= core.PIPELINE_FORWARD_ORDER.index(app.status):
        return   # already at or past this stage
    prev = app.status
    app.status = to_status
    db.add(ApplicationStatusHistory(
        application_id=app.id, from_status=prev, to_status=to_status, changed_by=user.id,
        note=f"Auto-advanced by {to_status.replace('_', ' ')}.",
    ))


def _interview_to_out(row: CandidateInterviewFeedback, interviewer: User | None, db: Session | None = None) -> InterviewFeedbackOut:
    if db is not None:
        interviewer_name = core._employer_display_name(interviewer, db)
    else:
        interviewer_name = (interviewer.email or interviewer.phone) if interviewer else None
    return InterviewFeedbackOut(
        id=str(row.id), application_id=str(row.application_id),
        interviewer_name=interviewer_name,
        scheduled_at=row.scheduled_at, meeting_link=row.meeting_link, status=row.status,
        recommendation=row.recommendation, feedback=row.feedback, created_at=row.created_at,
        reschedule_requested_at=row.reschedule_requested_at, reschedule_note=row.reschedule_note,
        proposed_slots=row.proposed_slots, scorecard_ratings=row.scorecard_ratings,
    )


def schedule_interview(application_id: str, scheduled_at, meeting_link: str | None, user: User, db: Session) -> InterviewFeedbackOut:
    app = core._get_employer_application(application_id, user, db)
    row = CandidateInterviewFeedback(
        application_id=app.id, interviewer_id=user.id, scheduled_at=scheduled_at,
        meeting_link=meeting_link, status="scheduled",
    )
    db.add(row)
    _advance_status_if_earlier(app, "interview_scheduled", user, db)
    db.commit()
    db.refresh(row)

    from app.core.calendar import build_interview_ics
    from app.core.notifications import interview_scheduled_email, notify
    candidate = db.query(User).filter(User.id == app.aspirant_id).first()
    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    if candidate and job and employer:
        subject, html = interview_scheduled_email(
            job.title, employer.company_name, scheduled_at.strftime("%d %b %Y, %I:%M %p UTC"), meeting_link,
        )
        ics_content = None
        if candidate.email:
            ics_content = build_interview_ics(
                uid=f"interview-{row.id}@beginablai.in",
                summary=f"Interview: {job.title} at {employer.company_name}",
                description=f"Interview for {job.title} at {employer.company_name}." + (f"\nJoin: {meeting_link}" if meeting_link else ""),
                scheduled_at=scheduled_at,
                location=meeting_link,
                organizer_email=user.email,
                attendee_email=candidate.email,
            )
        notify(candidate.email, subject, html, ics_content, "interview.ics")

        from app.modules.inbox.service import create_notification, notify_company_team
        notify_company_team(
            db, employer, "interview_scheduled",
            f"Interview scheduled: {job.title}",
            f"Interview with {candidate.email or 'a candidate'} on {scheduled_at.strftime('%d %b, %I:%M %p')}.",
            f"/app/employer/pipeline/{job.id}",
        )
        create_notification(
            db, candidate.id, "interview_scheduled",
            f"Interview scheduled — {job.title}",
            f"Your interview for {job.title} at {employer.company_name} is on {scheduled_at.strftime('%d %b, %I:%M %p')}." + (f" Meeting link: {meeting_link}" if meeting_link else ""),
            "/app/jobs/applications",
        )
        db.commit()

    # Push to recruiter's Google Calendar if they've connected
    _push_interview_to_google_calendar(row, user, db)

    return _interview_to_out(row, user, db)


def offer_interview_slots(
    application_id: str, slots: list, meeting_link: str | None, user: User, db: Session,
) -> InterviewFeedbackOut:
    """Candidate self-booking: instead of picking one fixed time, the employer
    offers several options and the candidate books one themselves (see
    book_interview_slot in matching/service/applications.py). scheduled_at
    stays NULL until then; status is 'pending_booking'."""
    app = core._get_employer_application(application_id, user, db)
    row = CandidateInterviewFeedback(
        application_id=app.id, interviewer_id=user.id, scheduled_at=None,
        meeting_link=meeting_link, status="pending_booking",
        proposed_slots=[s.isoformat() for s in slots],
    )
    db.add(row)
    _advance_status_if_earlier(app, "interview_scheduled", user, db)
    db.commit()
    db.refresh(row)

    from app.core.notifications import interview_slots_offered_email, notify
    candidate = db.query(User).filter(User.id == app.aspirant_id).first()
    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    if candidate and job and employer:
        subject, html = interview_slots_offered_email(job.title, employer.company_name, len(slots))
        notify(candidate.email, subject, html)

        from app.modules.inbox.service import create_notification
        create_notification(
            db, candidate.id, "interview_slots_offered",
            f"Pick your interview time — {job.title}",
            f"{employer.company_name} offered {len(slots)} time options for your interview. Pick one that works for you.",
            "/app/jobs/applications",
        )
        db.commit()

    return _interview_to_out(row, user, db)


def mark_interview_no_show(application_id: str, interview_id: str, user: User, db: Session) -> InterviewFeedbackOut:
    """A deliberate HR action, not an automated detection — there's no call
    telemetry to tell a genuine no-show apart from feedback simply not being
    logged yet, so the Celery sweep only nudges HR to check (see
    app.tasks.worker.flag_stale_interviews); HR confirms it here.

    First no-show for an application: candidate is emailed a one-time rebook
    offer, application status is untouched. Second no-show for the same
    application: auto-rejects the application, same as a knockout rule."""
    row = _get_employer_interview(application_id, interview_id, user, db)
    if row.status != "scheduled":
        raise BadRequestException(f"Cannot mark a '{row.status}' interview as a no-show.")

    prior_no_shows = (
        db.query(CandidateInterviewFeedback)
        .filter(
            CandidateInterviewFeedback.application_id == row.application_id,
            CandidateInterviewFeedback.status == "no_show",
        )
        .count()
    )
    row.status = "no_show"
    db.commit()
    db.refresh(row)

    app = db.query(Application).filter(Application.id == row.application_id).first()
    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first() if app else None
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    candidate = db.query(User).filter(User.id == app.aspirant_id).first() if app else None

    if app and job and employer and candidate:
        from app.modules.inbox.service import create_notification
        if prior_no_shows == 0:
            from app.core.notifications import interview_no_show_rebook_email, notify
            subject, html = interview_no_show_rebook_email(job.title, employer.company_name)
            notify(candidate.email, subject, html)
            create_notification(
                db, candidate.id, "interview_no_show",
                f"We missed you — {job.title}",
                f"Your interview for {job.title} didn't happen. Request a new time from your applications.",
                "/app/jobs/applications",
            )
        elif app.status not in ("withdrawn", "hired", "rejected", "offer_declined"):
            from app.core.notifications import application_status_email, notify
            prev = app.status
            app.status = "rejected"
            db.add(ApplicationStatusHistory(
                application_id=app.id, from_status=prev, to_status="rejected",
                changed_by=user.id, note="Auto-rejected: second interview no-show", is_automated=True,
            ))
            subject, html = application_status_email(job.title, employer.company_name, "rejected")
            notify(candidate.email, subject, html)
            create_notification(
                db, candidate.id, "application_status_changed",
                f"Update on your application — {job.title}",
                f"Your application to {job.title} at {employer.company_name} is now: Rejected.",
                "/app/jobs/applications",
            )
        db.commit()

    core._audit_matching(db, "interview.no_show", user.id, "interview", interview_id,
                    {"application_id": application_id, "prior_no_shows": prior_no_shows})
    db.commit()

    return _interview_to_out(row, user, db)


def _push_interview_to_google_calendar(interview_row, user: User, db: Session) -> None:
    """Best-effort push to Google Calendar — never raises, never blocks the request."""
    import json as _json
    try:
        from app.models.integrations import GoogleCalendarToken
        token_row = db.query(GoogleCalendarToken).filter(GoogleCalendarToken.user_id == user.id).first()
        if not token_row:
            return

        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build as gcal_build

        from app.config import get_settings as _gs

        s = _gs()
        creds_data = _json.loads(token_row.token)
        creds = Credentials(
            token=creds_data.get("token"),
            refresh_token=creds_data.get("_refresh_token") or creds_data.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=s.google_calendar_client_id,
            client_secret=s.google_calendar_client_secret,
            scopes=creds_data.get("scopes", []),
        )

        service = gcal_build("calendar", "v3", credentials=creds, cache_discovery=False)

        app_row = db.query(Application).filter(Application.id == interview_row.application_id).first()
        job = db.query(JobPosting).filter(JobPosting.id == app_row.job_id).first() if app_row else None
        candidate = db.query(User).filter(User.id == app_row.aspirant_id).first() if app_row else None

        start = interview_row.scheduled_at
        from datetime import timedelta
        end = start + timedelta(minutes=45)

        event = {
            "summary": f"Interview: {job.title if job else 'Candidate'}" + (f" — {candidate.full_name}" if candidate and candidate.full_name else ""),
            "description": "Interview scheduled via BeginablAI AI Platform." + (f"\nMeeting link: {interview_row.meeting_link}" if interview_row.meeting_link else ""),
            "start": {"dateTime": start.isoformat(), "timeZone": "Asia/Kolkata"},
            "end":   {"dateTime": end.isoformat(),   "timeZone": "Asia/Kolkata"},
        }
        if interview_row.meeting_link:
            event["location"] = interview_row.meeting_link
        if candidate and candidate.email:
            event["attendees"] = [{"email": candidate.email}]

        created = service.events().insert(calendarId="primary", body=event, sendUpdates="all").execute()
        logger.info("[GCAL] Event created: %s", created.get("id"))

        # Persist refreshed token if it was auto-refreshed
        if creds.token != creds_data.get("token"):
            token_row.token = creds.to_json()
            db.commit()

    except Exception as exc:
        logger.warning("[GCAL] Could not push interview to Google Calendar (non-fatal): %s", exc)


def send_test_invite(
    application_id: str, message: str | None, test_link: str | None, user: User, db: Session,
) -> dict:
    """The direct 2nd-phase invite for jobs that don't require a resume (see
    applications/service.py submit_application — those applications skip
    shortlisting entirely). HR picks this instead of schedule_interview when
    the next step is a test rather than an interview. Moves the application
    to the existing 'assessment' pipeline stage rather than a new status."""
    from app.core.notifications import notify, test_invite_email

    app = core._get_employer_application(application_id, user, db)
    if app.status in ("withdrawn", "hired", "rejected", "offer_declined"):
        raise BadRequestException(f"Cannot send a test invite — application is {app.status}.")
    if not app.aspirant or not app.aspirant.email:
        raise BadRequestException("This candidate has no email address on file.")

    employer = core._get_employer_profile_approved(user, db)
    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    if not job:
        raise NotFoundException("Job not found.")

    _advance_status_if_earlier(app, "assessment", user, db)
    db.commit()

    subject, html = test_invite_email(job.title, employer.company_name, message, test_link)
    notify(app.aspirant.email, subject, html)
    db.add(CandidateEmailLog(
        application_id=app.id, sender_id=user.id,
        recipient_email=app.aspirant.email, subject=subject,
        body=message or "You've been invited to complete a test." + (f" {test_link}" if test_link else ""),
    ))

    from app.modules.inbox.service import create_notification
    create_notification(
        db, app.aspirant_id, "application_status_changed",
        f"Next step for your application — {job.title}",
        f"{employer.company_name or 'The employer'} invited you to complete a test for {job.title}.",
        "/app/jobs/applications",
    )
    core._audit_matching(db, "application.test_invite_sent", user.id, "application", application_id,
                    {"job_id": str(job.id)})
    db.commit()

    return {"application_id": application_id, "status": app.status}


def bulk_send_test_invite(
    application_ids: list[str], message: str | None, test_link: str | None, user: User, db: Session,
) -> dict:
    """Same as send_test_invite, for multiple candidates at once (HR sends
    the 2nd-phase test invite to a batch of no-resume-required applicants)."""
    from app.core.notifications import notify, test_invite_email

    employer = core._get_employer_profile_approved(user, db)
    company_employer_ids = core._get_company_employer_ids(employer, db)
    job_ids = core._get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    apps = (
        db.query(Application)
        .filter(Application.id.in_(application_ids), Application.job_id.in_(job_ids))
        .all()
    )
    jobs_by_id = {
        j.id: j for j in db.query(JobPosting).filter(JobPosting.id.in_({a.job_id for a in apps})).all()
    }

    from app.modules.inbox.service import create_notification
    sent = 0
    skipped = 0
    for app in apps:
        job = jobs_by_id.get(app.job_id)
        if app.status in ("withdrawn", "hired", "rejected", "offer_declined"):
            skipped += 1
            continue
        if not job or not app.aspirant or not app.aspirant.email:
            skipped += 1
            continue
        _advance_status_if_earlier(app, "assessment", user, db)
        subject, html = test_invite_email(job.title, employer.company_name, message, test_link)
        notify(app.aspirant.email, subject, html)
        db.add(CandidateEmailLog(
            application_id=app.id, sender_id=user.id,
            recipient_email=app.aspirant.email, subject=subject,
            body=message or "You've been invited to complete a test." + (f" {test_link}" if test_link else ""),
        ))
        create_notification(
            db, app.aspirant_id, "application_status_changed",
            f"Next step for your application — {job.title}",
            f"{employer.company_name or 'The employer'} invited you to complete a test for {job.title}.",
            "/app/jobs/applications",
        )
        sent += 1

    if sent:
        db.commit()

    return {"sent": sent, "skipped": skipped}


def _get_employer_interview(application_id: str, interview_id: str, user: User, db: Session) -> CandidateInterviewFeedback:
    app = core._get_employer_application(application_id, user, db)
    row = db.query(CandidateInterviewFeedback).filter(
        CandidateInterviewFeedback.id == interview_id, CandidateInterviewFeedback.application_id == app.id,
    ).first()
    if not row:
        raise NotFoundException("Interview not found.")
    return row


def get_interview_ics(application_id: str, interview_id: str, user: User, db: Session) -> str:
    """Lets the recruiter download the same calendar invite that was emailed
    to the candidate — useful for adding it to their own calendar, or
    resending if the original email landed in spam."""
    row = _get_employer_interview(application_id, interview_id, user, db)
    if not row.scheduled_at:
        raise BadRequestException("This interview has no scheduled time.")

    app = db.query(Application).filter(Application.id == row.application_id).first()
    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first() if app else None
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    candidate = db.query(User).filter(User.id == app.aspirant_id).first() if app else None

    from app.core.calendar import build_interview_ics
    return build_interview_ics(
        uid=f"interview-{row.id}@beginablai.in",
        summary=f"Interview: {job.title if job else 'Candidate'} at {employer.company_name if employer else ''}",
        description=f"Interview for {job.title if job else 'a role'}." + (f"\nJoin: {row.meeting_link}" if row.meeting_link else ""),
        scheduled_at=row.scheduled_at,
        location=row.meeting_link,
        organizer_email=user.email,
        attendee_email=candidate.email if candidate else None,
    )


def submit_interview_feedback(
    application_id: str, interview_id: str, recommendation: str | None, feedback: str | None,
    user: User, db: Session, ratings: dict | None = None,
) -> InterviewFeedbackOut:
    row = _get_employer_interview(application_id, interview_id, user, db)
    row.recommendation = recommendation
    row.feedback = feedback
    row.scorecard_ratings = ratings
    row.status = "completed"

    app = db.query(Application).filter(Application.id == row.application_id).first()
    if app:
        _advance_status_if_earlier(app, "interview_completed", user, db)
    db.commit()
    db.refresh(row)
    return _interview_to_out(row, user, db)


def cancel_interview(application_id: str, interview_id: str, user: User, db: Session) -> InterviewFeedbackOut:
    row = _get_employer_interview(application_id, interview_id, user, db)
    row.status = "canceled"
    db.commit()
    db.refresh(row)
    return _interview_to_out(row, user, db)


def list_upcoming_interviews(user: User, db: Session, limit: int = 20) -> list["UpcomingInterviewEntry"]:
    from datetime import datetime, timezone

    from app.models.user import AspirantProfile as _AspirantProfile

    employer = core._get_employer_profile_or_pending(user, db)
    if not employer:
        return []
    company_employer_ids = core._get_company_employer_ids(employer, db)

    job_ids = core._get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    rows = (
        db.query(CandidateInterviewFeedback, Application, JobPosting, User)
        .join(Application, CandidateInterviewFeedback.application_id == Application.id)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .outerjoin(User, CandidateInterviewFeedback.interviewer_id == User.id)
        .filter(
            Application.job_id.in_(job_ids),
            CandidateInterviewFeedback.status == "scheduled",
            CandidateInterviewFeedback.scheduled_at >= datetime.now(timezone.utc),
        )
        .order_by(CandidateInterviewFeedback.scheduled_at)
        .limit(limit)
        .all()
    )

    aspirant_ids = [a.aspirant_id for _, a, _, _ in rows]
    names: dict = {}
    if aspirant_ids:
        for profile in db.query(_AspirantProfile).filter(_AspirantProfile.user_id.in_(aspirant_ids)).all():
            names[profile.user_id] = profile.full_name

    return [
        UpcomingInterviewEntry(
            id=str(interview.id), application_id=str(app.id),
            candidate_name=names.get(app.aspirant_id), job_id=str(job.id), job_title=job.title,
            scheduled_at=interview.scheduled_at, meeting_link=interview.meeting_link,
            interviewer_name=(interviewer.email or interviewer.phone) if interviewer else None,
        )
        for interview, app, job, interviewer in rows
    ]

