"""Application Submission service (Phase 4).

Implements:
  - Eligibility check (duplicate detection, job-active guard, limit check)
  - Draft start / get / save (auto-save) / discard
  - Submit: required-question validation → knockout engine → persist responses
             → generate reference number → email + recruiter notification
  - Candidate application list + detail
  - Withdrawal (only before "under_review")

The knockout engine runs entirely at submission time (not during form-fill) to
prevent candidates from gaming answers before seeing the effect.

Knockout priority (most severe wins):
  auto_reject > auto_tag > alert > label > auto_advance
"""
from __future__ import annotations

import logging
import random
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.ats import (
    ApplicationDraft, ApplicationDocument, ApplicationForm,
    ApplicationResponse, AtsQuestion, CandidateResumeFile,
    FormSection, KnockoutRule,
)
from app.models.mvp3 import (
    Application, ApplicationStatusHistory,
)
from app.models.user import AspirantProfile, EmployerProfile, JobPosting, KrsScore, User
from app.modules.applications.schemas import (
    AnswerIn, DraftSaveRequest, DraftStartRequest,
    SubmitApplicationRequest, WithdrawRequest,
)

logger = logging.getLogger(__name__)

_DRAFT_TTL_DAYS = 30
_APPLICATION_LIMIT = 10
_KNOCKOUT_PRIORITY = {"auto_reject": 5, "auto_tag": 4, "alert": 3, "label": 2, "auto_advance": 1}


# ─── helpers ──────────────────────────────────────────────────────────────────

def _ref_number() -> str:
    """Generate DISHA-{YYYY}-{6 random uppercase chars}."""
    year = datetime.now(timezone.utc).year
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"DISHA-{year}-{suffix}"


def _get_active_job(job_id: str, db: Session) -> JobPosting:
    try:
        jid = uuid.UUID(job_id)
    except ValueError:
        raise NotFoundException("Job not found.")
    job = db.query(JobPosting).filter(JobPosting.id == jid, JobPosting.is_active == True).first()
    if not job:
        raise NotFoundException("Job not found or no longer active.")
    return job


def _existing_application(job_id, user_id, db: Session) -> Optional[Application]:
    return (
        db.query(Application)
        .filter(Application.job_id == job_id, Application.aspirant_id == user_id)
        .first()
    )


def _get_draft(job_id, user_id, db: Session) -> Optional[ApplicationDraft]:
    return (
        db.query(ApplicationDraft)
        .filter(
            ApplicationDraft.job_id == job_id,
            ApplicationDraft.candidate_id == user_id,
            ApplicationDraft.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )


# ─── eligibility ──────────────────────────────────────────────────────────────

def check_eligibility(job_id: str, user: User, db: Session) -> dict:
    try:
        job = _get_active_job(job_id, db)
    except NotFoundException:
        return {"eligible": False, "reason": "job_closed",
                "existing_application_id": None, "has_draft": False, "draft_id": None}

    existing = _existing_application(job.id, user.id, db)
    if existing:
        return {
            "eligible": False,
            "reason": "already_applied",
            "existing_application_id": str(existing.id),
            "has_draft": False,
            "draft_id": None,
        }

    active_count = (
        db.query(Application)
        .filter(
            Application.aspirant_id == user.id,
            Application.status.notin_(["withdrawn", "rejected"]),
        )
        .count()
    )
    if active_count >= _APPLICATION_LIMIT:
        return {"eligible": False, "reason": "limit_reached",
                "existing_application_id": None, "has_draft": False, "draft_id": None}

    draft = _get_draft(job.id, user.id, db)
    return {
        "eligible": True,
        "reason": None,
        "existing_application_id": None,
        "has_draft": draft is not None,
        "draft_id": str(draft.id) if draft else None,
    }


# ─── draft ────────────────────────────────────────────────────────────────────

def start_or_get_draft(job_id: str, body: DraftStartRequest, user: User, db: Session) -> ApplicationDraft:
    job = _get_active_job(job_id, db)

    existing_app = _existing_application(job.id, user.id, db)
    if existing_app:
        raise BadRequestException("You have already submitted an application for this job.")

    draft = _get_draft(job.id, user.id, db)
    if draft:
        if body.selected_resume_id and not draft.selected_resume_id:
            draft.selected_resume_id = _resolve_resume_id(body.selected_resume_id, user.id, db)
            db.commit()
        return draft

    resume_id = _resolve_resume_id(body.selected_resume_id, user.id, db) if body.selected_resume_id else None

    draft = ApplicationDraft(
        job_id=job.id,
        candidate_id=user.id,
        current_step=1,
        responses_json={},
        selected_resume_id=resume_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=_DRAFT_TTL_DAYS),
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


def get_draft(job_id: str, user: User, db: Session) -> ApplicationDraft:
    job = _get_active_job(job_id, db)
    draft = _get_draft(job.id, user.id, db)
    if not draft:
        raise NotFoundException("No in-progress draft found for this job.")
    return draft


def save_draft(job_id: str, body: DraftSaveRequest, user: User, db: Session) -> ApplicationDraft:
    job = _get_active_job(job_id, db)
    draft = _get_draft(job.id, user.id, db)
    if not draft:
        raise NotFoundException("No draft found. Start the application first.")

    draft.current_step = body.current_step
    draft.responses_json = body.responses
    if body.selected_resume_id is not None:
        draft.selected_resume_id = _resolve_resume_id(body.selected_resume_id, user.id, db)
    draft.last_saved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(draft)
    return draft


def discard_draft(job_id: str, user: User, db: Session) -> None:
    job = _get_active_job(job_id, db)
    draft = _get_draft(job.id, user.id, db)
    if not draft:
        raise NotFoundException("No draft found for this job.")
    db.delete(draft)
    db.commit()


def _resolve_resume_id(resume_id: str, user_id, db: Session) -> uuid.UUID:
    try:
        rid = uuid.UUID(resume_id)
    except ValueError:
        raise BadRequestException("Invalid resume_id.")
    record = (
        db.query(CandidateResumeFile)
        .filter(
            CandidateResumeFile.id == rid,
            CandidateResumeFile.candidate_id == user_id,
            CandidateResumeFile.is_deleted == False,
        )
        .first()
    )
    if not record:
        raise NotFoundException("Resume not found in your library.")
    return rid


# ─── submission ───────────────────────────────────────────────────────────────

def submit_application(job_id: str, body: SubmitApplicationRequest, user: User, db: Session) -> Application:
    """Full submission pipeline:
      1. Validate job is active + no duplicate
      2. Validate required questions are answered
      3. Run knockout engine
      4. Persist Application + ApplicationResponse rows
      5. Generate reference number
      6. Fire confirmation email + recruiter notification (Celery)
      7. Discard draft
    """
    job = _get_active_job(job_id, db)

    # Duplicate guard
    if _existing_application(job.id, user.id, db):
        raise BadRequestException(
            "You have already applied to this job. View your application in 'My Applications'."
        )

    # Active application limit
    active_count = (
        db.query(Application)
        .filter(
            Application.aspirant_id == user.id,
            Application.status.notin_(["withdrawn", "rejected"]),
        )
        .count()
    )
    if active_count >= _APPLICATION_LIMIT:
        raise BadRequestException(
            f"You have reached the maximum of {_APPLICATION_LIMIT} active applications."
        )

    # Load published form (may not exist for older jobs — that's fine)
    form = (
        db.query(ApplicationForm)
        .filter(ApplicationForm.job_id == job.id, ApplicationForm.status == "published")
        .first()
    )

    answers_by_qid: dict[str, AnswerIn] = {a.question_id: a for a in body.answers}

    if form:
        _validate_required_questions(form, answers_by_qid, db)

    # Resolve resume
    resume_id: Optional[uuid.UUID] = None
    if body.selected_resume_id:
        resume_id = _resolve_resume_id(body.selected_resume_id, user.id, db)

    # Compute match score (reuse existing ranker)
    match_score = _compute_match_score(user, job, db)

    # Create Application row
    application = Application(
        aspirant_id=user.id,
        job_id=job.id,
        match_score=match_score,
        cover_note=body.cover_note,
        status="applied",
        resume_id=resume_id,
        form_version_id=form.id if form else None,
        knockout_triggered=False,
        knockout_action=None,
        application_score=None,
    )
    db.add(application)
    db.flush()  # get application.id

    # Persist responses
    if form:
        _persist_responses(application.id, answers_by_qid, form, db)

    # Knockout engine
    if form:
        ko_action, ko_tag = _run_knockout_engine(application, form, answers_by_qid, db)
        if ko_action:
            application.knockout_triggered = True
            application.knockout_action = ko_action
            if ko_action == "auto_reject":
                application.status = "rejected"

    # Generate unique reference number
    for _ in range(10):
        ref = _ref_number()
        if not db.query(Application).filter(Application.reference_number == ref).first():
            application.reference_number = ref
            break

    # Record initial status history entry
    db.add(ApplicationStatusHistory(
        application_id=application.id,
        from_status=None,
        to_status=application.status,
        changed_by=user.id,
        note="Application submitted",
        is_automated=False,
    ))

    # If knockout auto-rejected, add that history entry too
    if application.status == "rejected" and application.knockout_triggered:
        db.add(ApplicationStatusHistory(
            application_id=application.id,
            from_status="applied",
            to_status="rejected",
            changed_by=None,
            note="Auto-rejected by screening rule",
            is_automated=True,
        ))

    # Mark resume last_used_at
    if resume_id:
        resume_row = db.query(CandidateResumeFile).filter(CandidateResumeFile.id == resume_id).first()
        if resume_row:
            resume_row.last_used_at = datetime.now(timezone.utc)

    db.commit()

    # Discard draft silently (if one exists)
    draft = _get_draft(job.id, user.id, db)
    if draft:
        db.delete(draft)
        db.commit()

    # Fire async notifications (never blocks the response)
    _fire_notifications(application, job, user, db)

    logger.info(
        "[APPLICATION] Submitted: user=%s job=%s app=%s ref=%s knockout=%s",
        user.id, job_id, application.id, application.reference_number,
        application.knockout_action or "none",
    )

    # Reload with job+employer so response schema serialises correctly
    return (
        db.query(Application)
        .filter(Application.id == application.id)
        .options(joinedload(Application.job).joinedload(JobPosting.employer))
        .first()
    )


def _validate_required_questions(
    form: ApplicationForm,
    answers_by_qid: dict[str, AnswerIn],
    db: Session,
) -> None:
    """Raise BadRequestException listing all unanswered required questions."""
    missing: list[str] = []
    sections = db.query(FormSection).filter(FormSection.form_id == form.id).all()
    for section in sections:
        questions = db.query(AtsQuestion).filter(AtsQuestion.section_id == section.id).all()
        for q in questions:
            if q.is_required:
                answer = answers_by_qid.get(str(q.id))
                if not answer or _is_empty_answer(answer):
                    missing.append(f"'{q.label}'")
    if missing:
        raise BadRequestException(
            f"The following required questions have not been answered: {', '.join(missing)}."
        )


def _is_empty_answer(answer: AnswerIn) -> bool:
    return (
        answer.text_value is None and
        answer.number_value is None and
        answer.date_value is None and
        not answer.option_values and
        answer.file_attachment_id is None
    )


def _persist_responses(
    application_id: uuid.UUID,
    answers_by_qid: dict[str, AnswerIn],
    form: ApplicationForm,
    db: Session,
) -> None:
    """Create one ApplicationResponse row per answered question."""
    sections = db.query(FormSection).filter(FormSection.form_id == form.id).all()
    for section in sections:
        questions = db.query(AtsQuestion).filter(AtsQuestion.section_id == section.id).all()
        for q in questions:
            answer = answers_by_qid.get(str(q.id))
            if not answer or _is_empty_answer(answer):
                continue

            file_id: Optional[uuid.UUID] = None
            if answer.file_attachment_id:
                try:
                    file_id = uuid.UUID(answer.file_attachment_id)
                except ValueError:
                    pass

            response = ApplicationResponse(
                application_id=application_id,
                question_id=q.id,
                question_version=q.version,
                question_label=q.label,
                question_type=q.question_type,
                text_value=answer.text_value,
                number_value=answer.number_value,
                date_value=answer.date_value,
                option_values_json=answer.option_values,
                file_attachment_id=file_id,
            )
            db.add(response)


# ── Knockout engine ────────────────────────────────────────────────────────────

def _run_knockout_engine(
    application: Application,
    form: ApplicationForm,
    answers_by_qid: dict[str, AnswerIn],
    db: Session,
) -> tuple[Optional[str], Optional[str]]:
    """Evaluate all knockout rules and return (winning_action, tag_name).

    Rules are evaluated in priority order (higher priority wins).
    Most severe action wins across all triggered rules.
    Compliance questions are never knockout-eligible (enforced at rule creation).
    """
    rules = (
        db.query(KnockoutRule)
        .filter(KnockoutRule.form_id == form.id)
        .order_by(KnockoutRule.priority.desc())
        .all()
    )
    if not rules:
        return None, None

    triggered: list[KnockoutRule] = []
    for rule in rules:
        answer = answers_by_qid.get(str(rule.question_id))
        if answer and _rule_matches(rule, answer):
            triggered.append(rule)

    if not triggered:
        return None, None

    # Pick the most-severe action among all triggered rules
    best_rule = max(triggered, key=lambda r: _KNOCKOUT_PRIORITY.get(r.action, 0))

    logger.info(
        "[KNOCKOUT] app=%s action=%s question=%s",
        application.id, best_rule.action, best_rule.question_id,
    )
    return best_rule.action, best_rule.tag_name


def _rule_matches(rule: KnockoutRule, answer: AnswerIn) -> bool:
    """Check whether a candidate's answer triggers the knockout rule."""
    op = rule.operator
    threshold = rule.threshold_value

    # Resolve the candidate's answer to a comparable string
    candidate_value: Optional[str] = None
    if answer.text_value is not None:
        candidate_value = answer.text_value.strip().lower()
    elif answer.number_value is not None:
        candidate_value = str(answer.number_value)
    elif answer.option_values:
        candidate_value = answer.option_values[0].strip().lower() if answer.option_values else None

    if op == "is_answered":
        return not _is_empty_answer(answer)
    if op == "is_not_answered":
        return _is_empty_answer(answer)

    if candidate_value is None:
        return False

    threshold_lower = threshold.strip().lower()

    if op == "equals":
        return candidate_value == threshold_lower
    if op == "not_equals":
        return candidate_value != threshold_lower
    if op == "contains":
        return threshold_lower in candidate_value
    if op == "not_contains":
        return threshold_lower not in candidate_value
    if op in ("greater_than", "less_than"):
        try:
            cv = float(candidate_value)
            tv = float(threshold)
            return cv > tv if op == "greater_than" else cv < tv
        except ValueError:
            return False

    return False


# ── Match score ────────────────────────────────────────────────────────────────

def _compute_match_score(user: User, job: JobPosting, db: Session) -> int:
    try:
        from app.modules.recommendations.ranker import rank_jobs_for_user
        profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
        krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
        snap, _ = rank_jobs_for_user(profile, krs, db, extra_sql_filters=[JobPosting.id == job.id], limit=1)
        return snap[0].match_score if snap else 0
    except Exception as exc:
        logger.warning("[APPLICATION] Match score computation failed: %s", exc)
        return 0


# ── Notifications ──────────────────────────────────────────────────────────────

def _fire_notifications(application: Application, job: JobPosting, user: User, db: Session) -> None:
    """Fire-and-forget: confirmation email to candidate + alert to recruiter."""
    try:
        from app.tasks.application_tasks import (
            send_application_confirmation_email,
            send_recruiter_new_application_alert,
        )
        send_application_confirmation_email.delay(
            str(application.id), str(user.id), str(job.id)
        )
        send_recruiter_new_application_alert.delay(
            str(application.id), str(job.id)
        )
    except Exception as exc:
        logger.error("[APPLICATION] Failed to enqueue notification tasks: %s", exc)


# ─── candidate application list / detail ─────────────────────────────────────

def list_my_applications(user: User, db: Session) -> list[Application]:
    return (
        db.query(Application)
        .filter(Application.aspirant_id == user.id)
        .options(joinedload(Application.job).joinedload(JobPosting.employer))
        .order_by(Application.created_at.desc())
        .all()
    )


def get_application_detail(app_id: str, user: User, db: Session) -> Application:
    try:
        aid = uuid.UUID(app_id)
    except ValueError:
        raise NotFoundException("Application not found.")
    app = (
        db.query(Application)
        .filter(Application.id == aid, Application.aspirant_id == user.id)
        .options(
            joinedload(Application.job).joinedload(JobPosting.employer),
            joinedload(Application.status_history),
        )
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    return app


# ─── withdrawal ───────────────────────────────────────────────────────────────

_WITHDRAWAL_BLOCKED_STATUSES = {"under_review", "screening", "shortlisted",
                                 "interview_scheduled", "interview_completed",
                                 "offer_sent", "hired", "rejected", "withdrawn"}


def withdraw_application(app_id: str, body: WithdrawRequest, user: User, db: Session) -> Application:
    """Withdraw an application. Blocked once it reaches 'under_review' or later."""
    try:
        aid = uuid.UUID(app_id)
    except ValueError:
        raise NotFoundException("Application not found.")

    app = (
        db.query(Application)
        .filter(Application.id == aid, Application.aspirant_id == user.id)
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")

    if app.status in _WITHDRAWAL_BLOCKED_STATUSES:
        raise BadRequestException(
            f"Your application is currently '{app.status}' and can no longer be withdrawn. "
            "Please contact the employer directly."
        )

    prev_status = app.status
    app.status = "withdrawn"
    db.add(ApplicationStatusHistory(
        application_id=app.id,
        from_status=prev_status,
        to_status="withdrawn",
        changed_by=user.id,
        note=body.reason or "Withdrawn by candidate",
        is_automated=False,
    ))
    db.commit()
    db.refresh(app)

    logger.info("[APPLICATION] Withdrawn: app=%s user=%s", app_id, user.id)
    return app
