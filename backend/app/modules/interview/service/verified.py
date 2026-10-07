"""Verified Interview: employer-invited, one-attempt, consent-gated interviews.

Rules this module enforces:
  * An employer can only invite someone who applied to one of their jobs.
  * The candidate gets exactly one attempt per invitation (an admin can grant
    one retry for a documented technical failure).
  * An employer can read a result ONLY while a live share grant exists. The
    grant is created from the candidate's explicit "employer_share" consent,
    expires, and can be revoked by the candidate at any time.
  * The employer sees evidence and a fit band, never coaching content, and the
    final decision is always a human's.
  * Integrity observations are soft: shown to both sides, never scored.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.interview import InterviewConsent, InterviewSession
from app.models.interview_verified import (
    EmployerDecision,
    IntegrityEvent,
    InterviewAppeal,
    InterviewInvitation,
    InterviewTemplate,
    ShareGrant,
)
from app.models.user import AspirantProfile, EmployerProfile, User
from app.modules.interview import compliance
from app.modules.interview.schemas import CreateSessionRequest, SessionDetail
from app.modules.interview.verified_schemas import (
    AppealIn,
    DecisionIn,
    InviteIn,
    TemplateIn,
)

logger = logging.getLogger(__name__)

GRANT_DAYS = 180                     # how long a candidate's consent to share lasts
MAX_INTEGRITY_EVENTS = 300           # per interview
MUST_HAVE_WEIGHT_FACTOR = 1.5
CANDIDATE_LEVEL = "Experienced"
REQUIRED_START_CONSENTS = ("ai_processing", "employer_share")


class VerifiedError(Exception):
    """A problem the caller can understand or fix. `status` maps to HTTP."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _now() -> datetime:
    return datetime.now(timezone.utc)


def questions_for_minutes(minutes: int) -> int:
    """Planned questions (including the opening transition question)."""
    return 5 if minutes <= 10 else 7 if minutes <= 15 else 8


# ── employer side: who is the caller ──────────────────────────────────────────

def _colleague_ids(user: User, db: Session) -> list:
    """The user plus everyone on the same company, so a team shares templates
    and results."""
    from app.modules.matching.service.core import _get_employer_profile_approved

    profile = _get_employer_profile_approved(user, db)
    if not profile.company_id:
        return [user.id]
    rows = db.query(EmployerProfile.user_id).filter(EmployerProfile.company_id == profile.company_id).all()
    return [r[0] for r in rows] or [user.id]


def _company_id(user: User, db: Session):
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    return profile.company_id if profile else None


def _employer_name(user_id, db: Session) -> str:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user_id).first()
    return profile.company_name if profile and profile.company_name else "An employer"


def _candidate_name(user_id, db: Session) -> str:
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user_id).first()
    if profile and profile.full_name:
        return profile.full_name
    user = db.query(User).filter(User.id == user_id).first()
    return (user.email or user.phone or "Candidate") if user else "Candidate"


# ── templates ─────────────────────────────────────────────────────────────────

def _template_out(t: InterviewTemplate) -> dict:
    return {
        "id": str(t.id), "title": t.title, "role": t.role, "language": t.language,
        "duration_minutes": t.duration_minutes, "job_id": str(t.job_id) if t.job_id else None,
        "competencies": t.competencies, "custom_questions": t.custom_questions, "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _competencies_from(body: TemplateIn) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for c in body.competencies:
        key = c.skill.strip().casefold()
        if key in seen:
            raise VerifiedError(f"Competency \"{c.skill}\" is listed twice.", 422)
        seen.add(key)
        out.append({"skill": c.skill.strip(), "weight": float(c.weight), "must_have": bool(c.must_have)})
    return out


def _clean_questions(body: TemplateIn) -> list[str]:
    try:
        return compliance.validate_custom_questions(body.custom_questions)
    except ValueError as exc:
        raise VerifiedError(str(exc), 422)


async def draft_competencies(role: str) -> list[dict]:
    """A suggested competency matrix for the employer to edit, from the same
    taxonomy the practice interviews use."""
    from app.ai.dynamic_interview_engine import resolve_competencies

    comps = await resolve_competencies(role)
    return [{"skill": c["skill"], "weight": float(c["weight"]), "must_have": False} for c in comps]


def create_template(user: User, body: TemplateIn, db: Session) -> dict:
    _colleague_ids(user, db)   # raises if not an approved employer
    template = InterviewTemplate(
        employer_user_id=user.id, company_id=_company_id(user, db), job_id=body.job_id,
        title=body.title.strip(), role=body.role.strip(), language=body.language,
        duration_minutes=body.duration_minutes, competencies=_competencies_from(body),
        custom_questions=_clean_questions(body),
    )
    db.add(template)
    db.commit()
    return _template_out(template)


def _owned_template(user: User, template_id: str, db: Session) -> InterviewTemplate:
    template = (
        db.query(InterviewTemplate)
        .filter(InterviewTemplate.id == template_id, InterviewTemplate.employer_user_id.in_(_colleague_ids(user, db)))
        .first()
    )
    if not template:
        raise VerifiedError("Interview template not found.", 404)
    return template


def update_template(user: User, template_id: str, body: TemplateIn, db: Session) -> dict:
    template = _owned_template(user, template_id, db)
    if db.query(func.count(InterviewInvitation.id)).filter(InterviewInvitation.template_id == template.id).scalar():
        raise VerifiedError(
            "This interview has already been sent to candidates, so it can't be edited. "
            "Create a new one so everyone is assessed on the same questions.", 409,
        )
    template.title, template.role, template.language = body.title.strip(), body.role.strip(), body.language
    template.duration_minutes, template.job_id = body.duration_minutes, body.job_id
    template.competencies = _competencies_from(body)
    template.custom_questions = _clean_questions(body)
    db.commit()
    return _template_out(template)


def archive_template(user: User, template_id: str, db: Session) -> None:
    _owned_template(user, template_id, db).status = "archived"
    db.commit()


def list_templates(user: User, db: Session) -> list[dict]:
    rows = (
        db.query(InterviewTemplate)
        .filter(InterviewTemplate.employer_user_id.in_(_colleague_ids(user, db)), InterviewTemplate.status == "active")
        .order_by(InterviewTemplate.created_at.desc())
        .all()
    )
    return [_template_out(t) for t in rows]


# ── invitations ───────────────────────────────────────────────────────────────

def effective_status(inv: InterviewInvitation, now: datetime | None = None) -> str:
    now = now or _now()
    if inv.status == "invited" and inv.expires_at is not None and inv.expires_at < now:
        return "expired"
    return inv.status


def invite(user: User, body: InviteIn, db: Session) -> dict:
    from app.modules.inbox.service import create_notification
    from app.modules.matching.service.core import _get_employer_application

    template = _owned_template(user, body.template_id, db)
    if template.status != "active":
        raise VerifiedError("This interview template is archived.", 400)
    # Raises NotFound if the application isn't on one of this employer's jobs.
    application = _get_employer_application(body.application_id, user, db)
    if template.job_id and application.job_id != template.job_id:
        raise VerifiedError("This interview is for a different job than the candidate applied to.", 400)

    existing = (
        db.query(InterviewInvitation.id)
        .filter(InterviewInvitation.template_id == template.id, InterviewInvitation.candidate_user_id == application.aspirant_id)
        .first()
    )
    if existing:
        raise VerifiedError("This candidate has already been invited to this interview.", 409)

    invitation = InterviewInvitation(
        template_id=template.id, employer_user_id=user.id, candidate_user_id=application.aspirant_id,
        application_id=application.id, expires_at=_now() + timedelta(days=body.expires_in_days),
    )
    db.add(invitation)
    db.flush()
    create_notification(
        db, application.aspirant_id, "verified_interview_invite",
        f"{_employer_name(user.id, db)} invited you to an interview",
        f"A Verified Interview for {template.role}. Review what's assessed and who will see your result before you start.",
        f"/app/interview/invitations/{invitation.id}",
    )
    db.commit()
    return _invitation_for_employer_out(invitation, template, db)


def _invitation_for_employer_out(inv: InterviewInvitation, template: InterviewTemplate, db: Session) -> dict:
    out = {
        "id": str(inv.id), "template_id": str(template.id), "template_title": template.title, "role": template.role,
        "candidate_name": _candidate_name(inv.candidate_user_id, db), "application_id": str(inv.application_id) if inv.application_id else None,
        "status": effective_status(inv), "expires_at": inv.expires_at.isoformat(),
        "completed_at": inv.completed_at.isoformat() if inv.completed_at else None,
        "result_available": False, "fit_band": None, "needs_human_review": False, "decision": None,
    }
    if inv.session_id and inv.status == "completed":
        grant = _active_grant(inv.session_id, inv.employer_user_id, db)
        if grant:
            session = db.query(InterviewSession).filter(InterviewSession.id == inv.session_id).first()
            report = (session.job_readiness_report or {}) if session else {}
            out.update({
                "result_available": True, "fit_band": report.get("fit_band"),
                "needs_human_review": bool(report.get("needs_human_review")),
            })
            decision = db.query(EmployerDecision).filter(EmployerDecision.session_id == inv.session_id).first()
            out["decision"] = decision.decision if decision else None
    return out


def list_invitations_for_employer(user: User, db: Session) -> list[dict]:
    rows = (
        db.query(InterviewInvitation, InterviewTemplate)
        .join(InterviewTemplate, InterviewInvitation.template_id == InterviewTemplate.id)
        .filter(InterviewInvitation.employer_user_id.in_(_colleague_ids(user, db)))
        .order_by(InterviewInvitation.created_at.desc())
        .limit(200)
        .all()
    )
    return [_invitation_for_employer_out(inv, t, db) for inv, t in rows]


# ── candidate side ────────────────────────────────────────────────────────────

def _invitation_for_candidate_out(inv: InterviewInvitation, template: InterviewTemplate, db: Session) -> dict:
    return {
        "id": str(inv.id), "status": effective_status(inv), "employer_name": _employer_name(inv.employer_user_id, db),
        "title": template.title, "role": template.role, "language": template.language,
        "duration_minutes": template.duration_minutes,
        # What is assessed is shown (the competencies); the questions are not.
        "competencies": [c["skill"] for c in template.competencies],
        "has_employer_questions": bool(template.custom_questions),
        "expires_at": inv.expires_at.isoformat(), "session_id": str(inv.session_id) if inv.session_id else None,
        "retention_days": GRANT_DAYS,
    }


def list_my_invitations(user: User, db: Session) -> list[dict]:
    rows = (
        db.query(InterviewInvitation, InterviewTemplate)
        .join(InterviewTemplate, InterviewInvitation.template_id == InterviewTemplate.id)
        .filter(InterviewInvitation.candidate_user_id == user.id)
        .order_by(InterviewInvitation.created_at.desc())
        .all()
    )
    return [_invitation_for_candidate_out(inv, t, db) for inv, t in rows]


def _my_invitation(user: User, invitation_id: str, db: Session):
    row = (
        db.query(InterviewInvitation, InterviewTemplate)
        .join(InterviewTemplate, InterviewInvitation.template_id == InterviewTemplate.id)
        .filter(InterviewInvitation.id == invitation_id, InterviewInvitation.candidate_user_id == user.id)
        .first()
    )
    if not row:
        raise VerifiedError("Invitation not found.", 404)
    return row


def get_my_invitation(user: User, invitation_id: str, db: Session) -> dict:
    inv, template = _my_invitation(user, invitation_id, db)
    return _invitation_for_candidate_out(inv, template, db)


def decline_invitation(user: User, invitation_id: str, db: Session) -> None:
    inv, _ = _my_invitation(user, invitation_id, db)
    if effective_status(inv) != "invited":
        raise VerifiedError("This invitation can no longer be declined.", 409)
    inv.status = "declined"
    db.commit()


def build_plan(template: InterviewTemplate) -> dict:
    """The employer's competencies (must-haves weigh more) and own questions,
    in the shape session creation takes."""
    return {
        "competencies": [
            {"skill": c["skill"], "weight": float(c["weight"]) * (MUST_HAVE_WEIGHT_FACTOR if c.get("must_have") else 1)}
            for c in template.competencies
        ],
        "custom_questions": list(template.custom_questions or []),
    }


async def start_invitation(user: User, invitation_id: str, consents: list[str], db: Session) -> SessionDetail:
    from app.modules.interview.service.session_setup import create_session
    from app.modules.interview.service.sessions import get_session, record_consents

    inv, template = _my_invitation(user, invitation_id, db)
    status = effective_status(inv)
    if status == "expired":
        raise VerifiedError("This invitation has expired.", 410)
    if status == "declined":
        raise VerifiedError("You declined this invitation.", 409)
    if status == "completed":
        raise VerifiedError("You have already completed this interview. Each invitation is one attempt.", 409)
    if status == "started":
        existing = db.query(InterviewSession).filter(InterviewSession.id == inv.session_id).first() if inv.session_id else None
        if existing and existing.status in ("scheduled", "in_progress"):
            return get_session(str(existing.id), user, db)   # resume, same attempt
        raise VerifiedError("This interview attempt has ended.", 409)

    missing = [c for c in REQUIRED_START_CONSENTS if c not in consents]
    if missing:
        raise VerifiedError(
            "To start, you need to agree to AI processing of your answers and to sharing the result with the employer.", 400,
        )

    body = CreateSessionRequest(
        session_type="full_mock", total_questions=questions_for_minutes(template.duration_minutes),
        job_role=template.role, experience_level=CANDIDATE_LEVEL, language=template.language,
        job_description=f"Employer-defined interview for {template.role}. Competencies assessed: "
                        + ", ".join(c["skill"] for c in template.competencies) + ".",
        consents=consents,
    )
    detail = await create_session(body, user, db, build_plan(template))

    session = db.query(InterviewSession).filter(InterviewSession.id == detail.id).first()
    session.mode = "verified"
    inv.status, inv.session_id, inv.started_at = "started", session.id, _now()
    db.commit()
    record_consents(detail.id, user, consents, db)
    return detail


# ── grading hook: consent becomes a share grant ───────────────────────────────

def on_graded(session_id: str, db: Session) -> None:
    """Called when grading finishes. For a verified interview: close the
    invitation, create the share grant from the candidate's consent, and tell
    the employer. Safe to call twice."""
    from app.modules.inbox.service import create_notification

    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session or session.mode != "verified":
        return
    inv = db.query(InterviewInvitation).filter(InterviewInvitation.session_id == session.id).first()
    if not inv:
        return

    first_time = inv.status != "completed"
    inv.status, inv.completed_at = "completed", inv.completed_at or _now()

    consented = (
        db.query(InterviewConsent.id)
        .filter(InterviewConsent.session_id == session.id, InterviewConsent.kind == "employer_share",
                InterviewConsent.revoked_at.is_(None))
        .first()
    )
    has_grant = db.query(ShareGrant.id).filter(ShareGrant.session_id == session.id).first()
    if consented and not has_grant:
        db.add(ShareGrant(
            session_id=session.id, invitation_id=inv.id, employer_user_id=inv.employer_user_id,
            expires_at=_now() + timedelta(days=GRANT_DAYS),
        ))
    if first_time and consented:
        create_notification(
            db, inv.employer_user_id, "verified_interview_done",
            f"{_candidate_name(inv.candidate_user_id, db)} completed the interview",
            "Their result is ready to review.", f"/app/employer/verified-interviews/{inv.id}",
        )
    db.commit()


# ── share grants ──────────────────────────────────────────────────────────────

def _active_grant(session_id, employer_user_id, db: Session, now: datetime | None = None) -> ShareGrant | None:
    now = now or _now()
    return (
        db.query(ShareGrant)
        .filter(
            ShareGrant.session_id == session_id,
            ShareGrant.employer_user_id == employer_user_id,
            ShareGrant.revoked_at.is_(None),
            ShareGrant.expires_at > now,
        )
        .first()
    )


def revoke_share(user: User, session_id: str, db: Session) -> int:
    """The candidate withdraws consent: every grant for this interview ends and
    the employer can no longer open the result."""
    session = _my_verified_session(user, session_id, db)
    revoked = (
        db.query(ShareGrant)
        .filter(ShareGrant.session_id == session.id, ShareGrant.revoked_at.is_(None))
        .update({"revoked_at": _now()}, synchronize_session=False)
    )
    db.query(InterviewConsent).filter(
        InterviewConsent.session_id == session.id, InterviewConsent.kind == "employer_share",
        InterviewConsent.revoked_at.is_(None),
    ).update({"revoked_at": _now()}, synchronize_session=False)
    db.commit()
    return revoked


def _my_verified_session(user: User, session_id: str, db: Session) -> InterviewSession:
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise VerifiedError("Interview not found.", 404)
    if session.mode != "verified":
        raise VerifiedError("This is a practice interview.", 400)
    return session


# ── employer: reading a result ────────────────────────────────────────────────

def _feedback_for_employer(session_id, db: Session) -> list[dict]:
    from app.modules.interview.service.feedback import feedback_items

    return [
        {
            "question": i.question_text, "skill": i.skill_assessed, "answer": i.original_response,
            "overall_score": i.overall_score, "is_unscored": i.is_fallback,
            "scores": {
                "clarity": i.clarity_score, "conciseness": i.conciseness_score, "impact": i.impact_score,
                "relevance": i.relevance_score, "structure": i.star_adherence,
            },
            "evidence_quote": i.evidence_quote,
            "scoring_passes_disagreed": bool(i.judge_disagreement_note),
        }
        for i in feedback_items(session_id, db)
    ]


def _integrity_out(session_id, db: Session) -> list[dict]:
    rows = db.query(IntegrityEvent).filter(IntegrityEvent.session_id == session_id).order_by(IntegrityEvent.started_ms).all()
    labels = {
        "tab_hidden": "Switched to another tab", "window_blur": "Left the interview window",
        "face_missing": "Face not visible", "multiple_faces": "More than one face visible",
    }
    return [
        {"observation": labels.get(r.kind, r.kind), "kind": r.kind, "from_ms": r.started_ms, "to_ms": r.ended_ms}
        for r in rows
    ]


def get_result(user: User, invitation_id: str, db: Session) -> dict:
    """The employer's scorecard. Requires a live share grant."""
    inv = (
        db.query(InterviewInvitation)
        .filter(InterviewInvitation.id == invitation_id, InterviewInvitation.employer_user_id.in_(_colleague_ids(user, db)))
        .first()
    )
    if not inv:
        raise VerifiedError("Result not found.", 404)
    if inv.status != "completed" or not inv.session_id:
        raise VerifiedError("This interview hasn't been completed yet.", 409)
    grant = _active_grant(inv.session_id, inv.employer_user_id, db)
    if not grant:
        raise VerifiedError("This result isn't available: the candidate hasn't shared it, or has withdrawn it.", 403)

    session = db.query(InterviewSession).filter(InterviewSession.id == inv.session_id).first()
    report = session.job_readiness_report or {}
    template = db.query(InterviewTemplate).filter(InterviewTemplate.id == inv.template_id).first()
    decision = db.query(EmployerDecision).filter(EmployerDecision.session_id == session.id).first()

    grant.view_count = (grant.view_count or 0) + 1
    grant.last_viewed_at = _now()
    db.commit()
    logger.info("[VERIFIED] result %s viewed by user=%s (view #%s)", inv.id, user.id, grant.view_count)

    return {
        "invitation_id": str(inv.id), "candidate_name": _candidate_name(inv.candidate_user_id, db),
        "role": template.role if template else session.job_role, "completed_at": inv.completed_at.isoformat() if inv.completed_at else None,
        "language": session.language,
        "fit_band": report.get("fit_band"), "overall_score": report.get("overall_readiness_score"),
        "needs_human_review": bool(report.get("needs_human_review")), "review_reasons": report.get("review_reasons") or [],
        "skill_scores": report.get("skill_scores") or {}, "competencies": report.get("competencies") or [],
        "summary": report.get("candidate_summary"), "strengths": report.get("strengths") or [],
        "areas_to_probe": report.get("critical_gaps") or [],
        "answers": _feedback_for_employer(session.id, db),
        "integrity_observations": _integrity_out(session.id, db),
        "shared_until": grant.expires_at.isoformat(),
        "decision": ({"decision": decision.decision, "reason_code": decision.reason_code, "note": decision.note} if decision else None),
        "recording_available": bool(_audio_files(session.id)),
    }


def _audio_files(session_id) -> list[str]:
    from app.modules.interview import audio_store

    return audio_store.list_answer_audio(str(session_id))


def employer_audio(user: User, invitation_id: str, name: str | None, db: Session):
    """List (name=None) or fetch one answer recording, grant-checked."""
    from app.modules.interview import audio_store

    inv = (
        db.query(InterviewInvitation)
        .filter(InterviewInvitation.id == invitation_id, InterviewInvitation.employer_user_id.in_(_colleague_ids(user, db)))
        .first()
    )
    if not inv or not inv.session_id or not _active_grant(inv.session_id, inv.employer_user_id, db):
        raise VerifiedError("Recording not available.", 403)
    if name is None:
        return _audio_files(inv.session_id)
    found = audio_store.resolve_answer_audio(str(inv.session_id), name)
    if found is None:
        raise VerifiedError("Recording not found.", 404)
    return found


def decide(user: User, invitation_id: str, body: DecisionIn, db: Session) -> dict:
    """Record the employer's (human) decision. Needs a live grant, because
    deciding on a result you can no longer see isn't meaningful."""
    inv = (
        db.query(InterviewInvitation)
        .filter(InterviewInvitation.id == invitation_id, InterviewInvitation.employer_user_id.in_(_colleague_ids(user, db)))
        .first()
    )
    if not inv or not inv.session_id:
        raise VerifiedError("Result not found.", 404)
    if not _active_grant(inv.session_id, inv.employer_user_id, db):
        raise VerifiedError("This result isn't available to record a decision on.", 403)
    row = (
        db.query(EmployerDecision)
        .filter(EmployerDecision.session_id == inv.session_id, EmployerDecision.employer_user_id == user.id)
        .first()
    )
    if row:
        row.decision, row.reason_code, row.note = body.decision, body.reason_code, body.note
    else:
        db.add(EmployerDecision(
            session_id=inv.session_id, employer_user_id=user.id,
            decision=body.decision, reason_code=body.reason_code, note=body.note,
        ))
    db.commit()
    return {"decision": body.decision, "reason_code": body.reason_code}


# ── integrity and appeals ─────────────────────────────────────────────────────

def record_integrity_events(user: User, session_id: str, events: list, db: Session) -> int:
    session = _my_verified_session(user, session_id, db)
    if session.status not in ("scheduled", "in_progress"):
        raise VerifiedError("This interview is not active.", 400)
    existing = db.query(func.count(IntegrityEvent.id)).filter(IntegrityEvent.session_id == session.id).scalar() or 0
    room = max(0, MAX_INTEGRITY_EVENTS - existing)
    accepted = events[:room]
    for e in accepted:
        db.add(IntegrityEvent(session_id=session.id, kind=e.kind, started_ms=e.started_ms, ended_ms=e.ended_ms))
    db.commit()
    return len(accepted)


def my_integrity_events(user: User, session_id: str, db: Session) -> list[dict]:
    """Candidates see exactly what the employer sees."""
    session = _my_verified_session(user, session_id, db)
    return _integrity_out(session.id, db)


def file_appeal(user: User, session_id: str, body: AppealIn, db: Session) -> dict:
    session = _my_verified_session(user, session_id, db)
    if session.status != "completed" or session.grading_status not in (None, "done"):
        raise VerifiedError("You can appeal once your result is ready.", 409)
    open_appeal = (
        db.query(InterviewAppeal.id)
        .filter(InterviewAppeal.session_id == session.id, InterviewAppeal.status == "open")
        .first()
    )
    if open_appeal:
        raise VerifiedError("You already have an appeal under review for this interview.", 409)
    appeal = InterviewAppeal(session_id=session.id, user_id=user.id, reason=body.reason.strip())
    db.add(appeal)
    db.commit()
    return {"id": str(appeal.id), "status": "open"}


def my_appeals(user: User, session_id: str, db: Session) -> list[dict]:
    session = _my_verified_session(user, session_id, db)
    rows = db.query(InterviewAppeal).filter(InterviewAppeal.session_id == session.id).order_by(InterviewAppeal.created_at.desc()).all()
    return [{
        "id": str(a.id), "status": a.status, "reason": a.reason, "resolution_note": a.resolution_note,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    } for a in rows]


# ── admin: appeals, retries, retention ───────────────────────────────────────

def list_appeals(db: Session, status: str | None = None) -> list[dict]:
    q = db.query(InterviewAppeal).order_by(InterviewAppeal.created_at.desc())
    if status:
        q = q.filter(InterviewAppeal.status == status)
    return [{
        "id": str(a.id), "session_id": str(a.session_id), "user_id": str(a.user_id), "status": a.status,
        "reason": a.reason, "resolution_note": a.resolution_note,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    } for a in q.limit(200).all()]


def resolve_appeal(admin: User, appeal_id: str, note: str, db: Session) -> None:
    appeal = db.query(InterviewAppeal).filter(InterviewAppeal.id == appeal_id).first()
    if not appeal:
        raise VerifiedError("Appeal not found.", 404)
    if appeal.status == "resolved":
        raise VerifiedError("This appeal is already resolved.", 409)
    appeal.status, appeal.resolution_note = "resolved", note.strip()
    appeal.resolved_by, appeal.resolved_at = admin.id, _now()
    db.commit()


def allow_retry(invitation_id: str, db: Session) -> None:
    """One more attempt after a documented technical failure. The old attempt
    is closed and its result withdrawn from the employer."""
    inv = db.query(InterviewInvitation).filter(InterviewInvitation.id == invitation_id).first()
    if not inv:
        raise VerifiedError("Invitation not found.", 404)
    if inv.retry_granted:
        raise VerifiedError("A retry has already been granted for this invitation.", 409)
    if inv.status not in ("started", "completed"):
        raise VerifiedError("Only a started or completed attempt can be retried.", 400)
    if inv.session_id:
        db.query(ShareGrant).filter(ShareGrant.session_id == inv.session_id, ShareGrant.revoked_at.is_(None)).update(
            {"revoked_at": _now()}, synchronize_session=False
        )
        old = db.query(InterviewSession).filter(InterviewSession.id == inv.session_id).first()
        if old and old.status in ("scheduled", "in_progress"):
            old.status = "abandoned"
    inv.retry_granted, inv.status, inv.session_id = True, "invited", None
    inv.completed_at = inv.started_at = None
    inv.expires_at = max(inv.expires_at, _now() + timedelta(days=3))
    db.commit()


def purge_expired(db: Session, retention_days: int) -> int:
    """Delete verified interviews older than the retention period, with
    everything attached (answers, report, audio)."""
    from app.modules.interview.service.sessions import delete_session_row

    cutoff = _now() - timedelta(days=retention_days)
    old = (
        db.query(InterviewSession)
        .filter(InterviewSession.mode == "verified", InterviewSession.completed_at.isnot(None), InterviewSession.completed_at < cutoff)
        .all()
    )
    for session in old:
        delete_session_row(session, db)
    return len(old)
