"""Employer: candidate pipeline management."""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.core.email import send_email
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.applications import (
    Application,
    ApplicationStatusHistory,
    CandidateEmailLog,
    CandidateInterviewFeedback,
    CandidateNote,
    CandidateRating,
)
from app.models.user import (
    AspirantProfile,
    JobPosting,
    KrsScore,
    PsychologicalAssessment,
    User,
)
from app.modules.matching.schemas import (
    ApplicationStatusHistoryItem,
    CandidateEmailLogOut,
    CandidateNoteOut,
    CandidateOut,
    CandidatePsychProfile,
    InterviewFeedbackOut,
    JobCandidatePipeline,
    UpdateApplicationStatusRequest,
)
from app.modules.matching.service import core

logger = logging.getLogger(__name__)

# Allowed backwards transitions (stage → earlier stage for genuine corrections).
# Only used here — PIPELINE_FORWARD_ORDER itself lives in core (shared with interviews).
_ALLOWED_BACKWARDS = {
    "shortlisted": {"screening", "applied"},
    "assessment": {"shortlisted", "screening", "applied"},
    "hr_interview": {"assessment", "shortlisted", "screening", "applied"},
    "technical_interview": {"hr_interview", "assessment", "shortlisted", "screening", "applied"},
    "manager_interview": {"technical_interview", "hr_interview", "assessment", "shortlisted", "screening", "applied"},
    "interview_scheduled": {"manager_interview", "technical_interview", "hr_interview", "assessment", "shortlisted", "screening", "applied"},
    "interview_completed": {"interview_scheduled"},
}


def get_job_pipeline(
    job_id: str,
    user: User,
    db: Session,
    limit: int = 100,
    offset: int = 0,
    *,
    status: Optional[str] = None,
    search: Optional[str] = None,
    knockout_triggered: Optional[bool] = None,
    knockout_action: Optional[str] = None,
    score_min: Optional[int] = None,
    score_max: Optional[int] = None,
) -> JobCandidatePipeline:
    """Return applications for a job (paginated), enriched with aspirant profiles.

    Optional ATS filters (all additive):
      status             — exact match on application status
      search             — substring match on candidate full_name (via AspirantProfile)
      knockout_triggered — True/False filter
      knockout_action    — exact match on Application.knockout_action
      score_min/max      — inclusive filter on Application.application_score
    """
    employer = core._get_employer_profile_approved(user, db)
    company_employer_ids = core._get_company_employer_ids(employer, db)
    q = db.query(JobPosting).filter(
        JobPosting.id == job_id, JobPosting.employer_id.in_(company_employer_ids)
    )
    q = core._scope_jobs_query(q, employer, user.role_name)
    job = q.first()
    if not job:
        raise NotFoundException("Job not found.")

    apps_q = (
        db.query(Application)
        .options(joinedload(Application.status_history))
        .filter(Application.job_id == job_id)
    )

    # ── ATS filters ──────────────────────────────────────────────────────────
    if status:
        apps_q = apps_q.filter(Application.status == status)
    if knockout_triggered is not None:
        apps_q = apps_q.filter(Application.knockout_triggered == knockout_triggered)
    if knockout_action:
        apps_q = apps_q.filter(Application.knockout_action == knockout_action)
    if score_min is not None:
        apps_q = apps_q.filter(Application.application_score >= score_min)
    if score_max is not None:
        apps_q = apps_q.filter(Application.application_score <= score_max)

    if search:
        # Join to AspirantProfile for name search
        search_term = f"%{search.strip()}%"
        apps_q = (
            apps_q
            .join(AspirantProfile, AspirantProfile.user_id == Application.aspirant_id)
            .filter(AspirantProfile.full_name.ilike(search_term))
        )

    apps_q = apps_q.order_by(Application.match_score.desc())
    total_applications = apps_q.count()
    apps = apps_q.offset(offset).limit(limit).all()

    by_status: dict[str, int] = {}
    candidates: list[CandidateOut] = []

    from datetime import timezone as _tz
    now = __import__("datetime").datetime.now(_tz.utc)

    app_ids = [a.id for a in apps]
    notes_by_app: dict = {}
    if app_ids:
        note_rows = (
            db.query(CandidateNote, User)
            .outerjoin(User, CandidateNote.author_id == User.id)
            .filter(CandidateNote.application_id.in_(app_ids))
            .order_by(CandidateNote.created_at.desc())
            .all()
        )
        for n, author in note_rows:
            notes_by_app.setdefault(n.application_id, []).append(
                CandidateNoteOut(
                    id=str(n.id), author_name=core._employer_display_name(author, db) if author else None,
                    note=n.note, is_internal=n.is_internal, created_at=n.created_at,
                )
            )

    ratings_by_app: dict = {}
    if app_ids:
        from sqlalchemy import func as _func
        rating_rows = (
            db.query(CandidateRating.application_id, _func.avg(CandidateRating.rating))
            .filter(CandidateRating.application_id.in_(app_ids))
            .group_by(CandidateRating.application_id)
            .all()
        )
        ratings_by_app = {aid: round(float(avg), 1) for aid, avg in rating_rows}

    feedback_by_app: dict = {}
    if app_ids:
        fb_rows = (
            db.query(CandidateInterviewFeedback, User)
            .outerjoin(User, CandidateInterviewFeedback.interviewer_id == User.id)
            .filter(CandidateInterviewFeedback.application_id.in_(app_ids))
            .order_by(CandidateInterviewFeedback.created_at.desc())
            .all()
        )
        for f, interviewer in fb_rows:
            feedback_by_app.setdefault(f.application_id, []).append(
                InterviewFeedbackOut(
                    id=str(f.id), application_id=str(f.application_id),
                    interviewer_name=core._employer_display_name(interviewer, db) if interviewer else None,
                    scheduled_at=f.scheduled_at, meeting_link=f.meeting_link, status=f.status,
                    recommendation=f.recommendation, feedback=f.feedback, created_at=f.created_at,
                )
            )

    # Batch-load to avoid N+1 queries (3 per candidate without this)
    aspirant_ids = [a.aspirant_id for a in apps]
    profiles_by_user: dict = {}
    krs_by_user: dict = {}
    psych_by_user: dict = {}
    if aspirant_ids:
        for p in db.query(AspirantProfile).filter(AspirantProfile.user_id.in_(aspirant_ids)).all():
            profiles_by_user[p.user_id] = p
        for k in db.query(KrsScore).filter(KrsScore.user_id.in_(aspirant_ids)).all():
            krs_by_user[k.user_id] = k
        for pa in db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id.in_(aspirant_ids)).all():
            psych_by_user[pa.user_id] = pa

    for app in apps:
        by_status[app.status] = by_status.get(app.status, 0) + 1

        profile = profiles_by_user.get(app.aspirant_id)
        krs = krs_by_user.get(app.aspirant_id)
        psych = psych_by_user.get(app.aspirant_id)

        applied_at = app.created_at
        if applied_at.tzinfo is None:
            applied_at = applied_at.replace(tzinfo=_tz.utc)
        days_ago = max(0, (now - applied_at).days)

        psych_out = None
        if psych:
            psych_out = CandidatePsychProfile(
                burnout_score=psych.burnout_score,
                confidence_index=psych.confidence_index,
            )

        history = [
            ApplicationStatusHistoryItem(
                from_status=h.from_status,
                to_status=h.to_status,
                note=h.note,
                created_at=h.created_at,
            )
            for h in (app.status_history or [])
        ]

        candidates.append(CandidateOut(
            application_id=str(app.id),
            aspirant_id=str(app.aspirant_id),
            full_name=profile.full_name if profile else None,
            city=profile.city if profile else None,
            state=profile.state if profile else None,
            gender=profile.gender if profile else None,
            highest_qualification=profile.highest_qualification if profile else None,
            degree=profile.degree if profile else None,
            field_of_study=profile.field_of_study if profile else None,
            institution=profile.institution if profile else None,
            graduation_year=profile.graduation_year if profile else None,
            upsc_attempts=profile.upsc_attempts if profile else None,
            highest_stage_cleared=profile.highest_stage_cleared if profile else None,
            years_preparing=profile.years_preparing if profile else None,
            optional_subject=profile.optional_subject if profile else None,
            has_work_experience=profile.has_work_experience if profile else None,
            work_experience_years=profile.work_experience_years if profile else None,
            work_experience_domain=profile.work_experience_domain if profile else None,
            last_designation=profile.last_designation if profile else None,
            skills=profile.skills or [] if profile else [],
            k_score=krs.k_score if krs else None,
            r_score=krs.r_score if krs else None,
            s_score=krs.s_score if krs else None,
            composite=krs.composite if krs else None,
            psych=psych_out,
            expected_salary_min=profile.expected_salary_min if profile else None,
            expected_salary_max=profile.expected_salary_max if profile else None,
            open_to_relocation=profile.open_to_relocation if profile else None,
            preferred_locations=profile.preferred_locations if profile else None,
            match_score=app.match_score,
            status=app.status,
            cover_note=app.cover_note,
            employer_note=app.employer_note,
            applied_at=app.created_at,
            days_ago=days_ago,
            status_history=history,
            notes=notes_by_app.get(app.id, []),
            avg_rating=ratings_by_app.get(app.id),
            interview_feedback=feedback_by_app.get(app.id, []),
            # ATS fields
            reference_number=app.reference_number,
            knockout_triggered=bool(app.knockout_triggered),
            knockout_action=app.knockout_action,
            application_score=app.application_score,
        ))

    return JobCandidatePipeline(
        job_id=str(job.id),
        job_title=job.title,
        total_applications=total_applications,
        by_status=by_status,
        candidates=candidates,
    )


def get_application_responses(application_id: str, user: User, db: Session):
    """Return form question responses for a single application (employer-facing).

    Returns an ApplicationResponsesOut with a list of FormResponseItem.
    The employer must own the job the application belongs to.
    """
    from app.models.ats import ApplicationResponse
    from app.modules.matching.schemas import ApplicationResponsesOut, FormResponseItem

    employer = core._get_employer_profile_approved(user, db)
    company_employer_ids = core._get_company_employer_ids(employer, db)
    job_ids = core._get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)

    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.job_id.in_(job_ids))
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")

    rows = (
        db.query(ApplicationResponse)
        .filter(ApplicationResponse.application_id == app.id)
        .order_by(ApplicationResponse.answered_at)
        .all()
    )

    items = [
        FormResponseItem(
            question_id=str(r.question_id) if r.question_id else None,
            question_label=r.question_label,
            question_type=r.question_type,
            text_value=r.text_value,
            number_value=r.number_value,
            date_value=r.date_value,
            option_values=r.option_values_json,
            has_file=r.file_attachment_id is not None,
        )
        for r in rows
    ]

    return ApplicationResponsesOut(
        application_id=str(app.id),
        reference_number=app.reference_number,
        responses=items,
    )


def export_pipeline_csv(
    job_id: str,
    user: User,
    db: Session,
    *,
    status: Optional[str] = None,
    search: Optional[str] = None,
    knockout_triggered: Optional[bool] = None,
    knockout_action: Optional[str] = None,
    score_min: Optional[int] = None,
    score_max: Optional[int] = None,
) -> str:
    """Export all matching pipeline candidates as a CSV string.

    Applies the same filters as get_job_pipeline (no pagination — exports all rows).
    Returns raw CSV text for streaming as a file download.
    """
    import csv
    import io

    pipeline = get_job_pipeline(
        job_id, user, db,
        limit=10_000, offset=0,
        status=status, search=search,
        knockout_triggered=knockout_triggered,
        knockout_action=knockout_action,
        score_min=score_min, score_max=score_max,
    )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Reference #", "Full Name", "City", "State",
        "Highest Qualification", "UPSC Attempts", "Highest Stage Cleared",
        "Skills", "Match Score", "Application Score",
        "Status", "Knockout Triggered", "Knockout Action",
        "Applied At",
    ])
    for c in pipeline.candidates:
        writer.writerow([
            c.reference_number or "",
            c.full_name or "",
            c.city or "",
            c.state or "",
            c.highest_qualification or "",
            c.upsc_attempts if c.upsc_attempts is not None else "",
            c.highest_stage_cleared or "",
            "; ".join(c.skills),
            c.match_score if c.match_score is not None else "",
            c.application_score if c.application_score is not None else "",
            c.status,
            "Yes" if c.knockout_triggered else "No",
            c.knockout_action or "",
            c.applied_at.isoformat(),
        ])
    return buf.getvalue()


def update_application_status(
    application_id: str,
    body: UpdateApplicationStatusRequest,
    user: User,
    db: Session,
) -> dict:
    """Employer updates the status of an application (shortlist, reject, hire)."""
    employer = core._get_employer_profile_approved(user, db)
    company_employer_ids = core._get_company_employer_ids(employer, db)

    # Verify the application belongs to one of this company's (dept-scoped) jobs
    job_ids = core._get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    app = (
        db.query(Application)
        .filter(
            Application.id == application_id,
            Application.job_id.in_(job_ids),
        )
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    if app.status in ("withdrawn", "hired", "rejected", "offer_declined"):
        raise BadRequestException(f"Cannot change status from '{app.status}'.")

    prev = app.status
    new_status = body.status

    # Guard backwards transitions — only explicitly allowed reversals are permitted
    if (
        prev in core.PIPELINE_FORWARD_ORDER
        and new_status in core.PIPELINE_FORWARD_ORDER
        and core.PIPELINE_FORWARD_ORDER.index(new_status) < core.PIPELINE_FORWARD_ORDER.index(prev)
        and new_status not in _ALLOWED_BACKWARDS.get(prev, set())
    ):
        raise BadRequestException(
            f"Cannot move an application backwards from '{prev}' to '{new_status}'. "
            "Only forward transitions are allowed."
        )

    app.status = new_status
    if body.note:
        app.employer_note = body.note

    db.add(ApplicationStatusHistory(
        application_id=app.id,
        from_status=prev,
        to_status=new_status,
        changed_by=user.id,
        note=body.note,
    ))
    db.commit()

    from app.core.notifications import application_status_email, notify
    from app.modules.inbox.service import create_notification
    candidate = db.query(User).filter(User.id == app.aspirant_id).first()
    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    if candidate and job:
        subject, html = application_status_email(job.title, employer.company_name, new_status)
        notify(candidate.email, subject, html)
        create_notification(
            db, candidate.id, "application_status_changed",
            f"Update on your application — {job.title}",
            f"Your application to {job.title} at {employer.company_name} is now: {new_status.replace('_', ' ').title()}.",
            f"/app/jobs/applications",
        )
        db.commit()

    core._audit_matching(db, "application.status_changed", user.id, "application", application_id,
                    {"from": prev, "to": new_status})
    db.commit()
    logger.info(
        "[MATCHING] Application %s: %s → %s by employer %s",
        application_id, prev, new_status, user.id
    )
    return {"application_id": application_id, "status": new_status}


def bulk_update_status(application_ids: list[str], status: str, note: str | None, user: User, db: Session) -> dict:
    """Move multiple applications to the same stage in one transaction."""
    from app.modules.inbox.service import create_notification

    employer = core._get_employer_profile_approved(user, db)
    company_employer_ids = core._get_company_employer_ids(employer, db)
    job_ids = core._get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    apps = (
        db.query(Application)
        .filter(Application.id.in_(application_ids), Application.job_id.in_(job_ids))
        .all()
    )
    jobs_by_id = {
        job.id: job
        for job in db.query(JobPosting).filter(JobPosting.id.in_({app.job_id for app in apps})).all()
    }
    updated = 0
    for app in apps:
        if app.status in ("withdrawn", "hired", "rejected", "offer_declined"):
            continue
        prev = app.status
        app.status = status
        if note:
            app.employer_note = note
        db.add(ApplicationStatusHistory(
            application_id=app.id, from_status=prev, to_status=status, changed_by=user.id, note=note,
        ))
        job = jobs_by_id.get(app.job_id)
        if job:
            create_notification(
                db, app.aspirant_id, "application_status_changed",
                f"Update on your application — {job.title}",
                f"Your application to {job.title} at {employer.company_name} is now: {status.replace('_', ' ').title()}.",
                "/app/jobs/applications",
            )
        updated += 1
    db.commit()
    return {"updated": updated, "status": status}


def add_candidate_note(application_id: str, note: str, is_internal: bool, user: User, db: Session) -> CandidateNoteOut:
    app = core._get_employer_application(application_id, user, db)
    row = CandidateNote(application_id=app.id, author_id=user.id, note=note, is_internal=is_internal)
    db.add(row)
    db.commit()
    db.refresh(row)
    return CandidateNoteOut(
        id=str(row.id), author_name=core._employer_display_name(user, db), note=row.note,
        is_internal=row.is_internal, created_at=row.created_at,
    )


async def send_candidate_email(application_id: str, subject: str, body: str, user: User, db: Session) -> CandidateEmailLogOut:
    """Recruiter emails a candidate directly from the pipeline.

    This was the single biggest gap in the product — recruiters could track a
    candidate through pipeline stages but had no way to actually contact them
    without leaving the app. Persists a log row (compliance/team visibility)
    in addition to actually sending the email.
    """
    app = core._get_employer_application(application_id, user, db)
    if not app.aspirant or not app.aspirant.email:
        raise BadRequestException("This candidate has no email address on file.")

    employer = core._get_employer_profile_approved(user, db)
    sender_name = employer.company_name or user.email or "Recruiting team"

    html = "".join(f"<p>{line}</p>" for line in body.split("\n") if line.strip())
    await send_email(app.aspirant.email, subject, html or f"<p>{body}</p>")

    row = CandidateEmailLog(
        application_id=app.id, sender_id=user.id,
        recipient_email=app.aspirant.email, subject=subject, body=body,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return CandidateEmailLogOut(
        id=str(row.id), sender_name=sender_name, recipient_email=row.recipient_email,
        subject=row.subject, body=row.body, created_at=row.created_at,
    )


def set_candidate_rating(application_id: str, rating: int, user: User, db: Session) -> dict:
    app = core._get_employer_application(application_id, user, db)
    existing = (
        db.query(CandidateRating)
        .filter(CandidateRating.application_id == app.id, CandidateRating.rater_id == user.id)
        .first()
    )
    if existing:
        existing.rating = rating
    else:
        db.add(CandidateRating(application_id=app.id, rater_id=user.id, rating=rating))
    db.commit()

    from sqlalchemy import func as _func
    avg = db.query(_func.avg(CandidateRating.rating)).filter(CandidateRating.application_id == app.id).scalar()
    return {"application_id": application_id, "avg_rating": round(float(avg), 1) if avg else None}


def list_candidate_emails(application_id: str, user: User, db: Session) -> list[CandidateEmailLogOut]:
    app = core._get_employer_application(application_id, user, db)
    rows = (
        db.query(CandidateEmailLog)
        .filter(CandidateEmailLog.application_id == app.id)
        .order_by(CandidateEmailLog.created_at.desc())
        .all()
    )
    return [
        CandidateEmailLogOut(
            id=str(r.id),
            sender_name=(r.sender.full_name or r.sender.email if r.sender else None) or "Recruiting team",
            recipient_email=r.recipient_email, subject=r.subject, body=r.body,
            created_at=r.created_at,
        )
        for r in rows
    ]

