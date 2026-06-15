"""Roadmap API router — /api/roadmap/*"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.ai.narrative_coach import evaluate_narrative
from app.database import get_db
from app.models.user import AspirantProfile, PsychologicalAssessment, User
from app.core.rbac import get_current_user
from app.modules.roadmap import service
from app.modules.roadmap.schemas import (
    GapSkillOut, GateCheckOut, JRSBreakdown, NarrativeFeedbackOut,
    NarrativeSubmitRequest, RoadmapOut, SkillCompetenceOut,
    TicketSubmitRequest, TicketSubmissionOut, TicketTemplateOut,
)

router = APIRouter(prefix="/roadmap", tags=["Roadmap"])
logger = logging.getLogger(__name__)


def _require_aspirant(user: User = Depends(get_current_user)) -> User:
    if user.role_name not in ("aspirant", "admin"):
        raise HTTPException(status_code=403, detail="Aspirants only.")
    return user


# ── Generate / get roadmap ────────────────────────────────────────────────────

@router.post("/generate/{career_track_id}", response_model=RoadmapOut, status_code=status.HTTP_201_CREATED)
def generate_roadmap(
    career_track_id: str,
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Generate (or regenerate) a roadmap for the given career track.

    Idempotent — calling again recalibrates the existing roadmap.
    """
    try:
        roadmap = service.generate_roadmap(career_track_id, user, db)
        return service.get_roadmap_out(roadmap, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/mine", response_model=RoadmapOut)
def get_my_roadmap(
    career_track_id: str | None = None,
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Fetch the user's active roadmap. Optionally filter by career_track_id."""
    roadmap = service.get_roadmap(career_track_id, user, db)
    if not roadmap:
        raise HTTPException(status_code=404, detail="No roadmap found. Generate one first.")
    return service.get_roadmap_out(roadmap, db)


# ── Job Readiness Score ───────────────────────────────────────────────────────

@router.get("/jrs", response_model=JRSBreakdown)
def get_jrs(
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Return Job Readiness Score breakdown for the dashboard meter."""
    return service.compute_jrs(user, db)


# ── Narrative (Stage 1) ───────────────────────────────────────────────────────

@router.post("/{roadmap_id}/narrative", response_model=NarrativeFeedbackOut)
async def submit_narrative(
    roadmap_id: str,
    body: NarrativeSubmitRequest,
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Submit a narrative draft. Triggers AI evaluation synchronously and saves result."""
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    psych = db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user.id).first()
    roadmap_obj = service.get_roadmap(None, user, db)
    if not roadmap_obj or str(roadmap_obj.id) != roadmap_id:
        raise HTTPException(status_code=404, detail="Roadmap not found.")

    career_track = roadmap_obj.career_track.title if roadmap_obj.career_track else "Private Sector"

    ai_feedback = await evaluate_narrative(
        narrative_text=body.narrative_text,
        upsc_attempts=profile.upsc_attempts or 0 if profile else 0,
        work_exp_years=profile.work_experience_years or 0 if profile else 0,
        career_track=career_track,
    )

    service.save_narrative(roadmap_id, body.narrative_text, ai_feedback, user, db)

    return NarrativeFeedbackOut(
        overall_score=ai_feedback.get("overall_score", 0),
        commercial_language_pct=ai_feedback.get("commercial_language_pct", 0),
        upsc_jargon_found=ai_feedback.get("upsc_jargon_found", []),
        strengths=ai_feedback.get("strengths", []),
        specific_improvements=ai_feedback.get("specific_improvements", []),
        rewritten_version=ai_feedback.get("rewritten_version", ""),
        coaching_note=ai_feedback.get("coaching_note", ""),
        error=ai_feedback.get("error"),
    )


@router.get("/{roadmap_id}/narrative/feedback", response_model=NarrativeFeedbackOut)
def get_narrative_feedback(
    roadmap_id: str,
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Return stored narrative feedback without re-evaluating."""
    roadmap_obj = service.get_roadmap(None, user, db)
    if not roadmap_obj or str(roadmap_obj.id) != roadmap_id:
        raise HTTPException(status_code=404, detail="Roadmap not found.")
    if not roadmap_obj.narrative_feedback:
        raise HTTPException(status_code=404, detail="No narrative feedback yet. Submit your narrative first.")
    fb = roadmap_obj.narrative_feedback
    return NarrativeFeedbackOut(
        overall_score=fb.get("overall_score", 0),
        commercial_language_pct=fb.get("commercial_language_pct", 0),
        upsc_jargon_found=fb.get("upsc_jargon_found", []),
        strengths=fb.get("strengths", []),
        specific_improvements=fb.get("specific_improvements", []),
        rewritten_version=fb.get("rewritten_version", ""),
        coaching_note=fb.get("coaching_note", ""),
        error=fb.get("error"),
    )


# ── Stage Gate ────────────────────────────────────────────────────────────────

@router.post("/{roadmap_id}/gate/{stage_number}", response_model=GateCheckOut)
def check_gate(
    roadmap_id: str,
    stage_number: int,
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Evaluate stage gate criteria. Returns pass/fail + per-criterion details."""
    if not 1 <= stage_number <= 6:
        raise HTTPException(status_code=400, detail="Stage must be between 1 and 6.")
    try:
        return service.check_gate(roadmap_id, stage_number, user, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{roadmap_id}/advance", response_model=RoadmapOut)
def advance_stage(
    roadmap_id: str,
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Advance to next stage (validates gate first)."""
    try:
        roadmap = service.advance_stage(roadmap_id, user, db)
        return service.get_roadmap_out(roadmap, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Tickets (Stage 4) ─────────────────────────────────────────────────────────

@router.get("/tickets", response_model=list[TicketTemplateOut])
def get_tickets(
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Return available work tickets for the user's career track."""
    roadmap = service.get_roadmap(None, user, db)
    career_track_id = str(roadmap.career_track_id) if roadmap and roadmap.career_track_id else None
    return service.get_tickets(user, career_track_id, db)


@router.post("/{roadmap_id}/tickets/submit", response_model=TicketSubmissionOut, status_code=status.HTTP_201_CREATED)
def submit_ticket(
    roadmap_id: str,
    body: TicketSubmitRequest,
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Submit a Stage 4 work ticket. Triggers async AI review."""
    try:
        sub = service.submit_ticket(roadmap_id, body.ticket_id, body.submission_text, user, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return TicketSubmissionOut(
        id=str(sub.id),
        ticket_id=str(sub.ticket_id) if sub.ticket_id else None,
        ticket_title=None,
        submission_text=sub.submission_text,
        submitted_at=sub.submitted_at,
        review_status=sub.review_status,
        ai_review_result=sub.ai_review_result,
        ai_reviewed_at=sub.ai_reviewed_at,
    )


@router.get("/{roadmap_id}/tickets/submissions", response_model=list[TicketSubmissionOut])
def get_submissions(
    roadmap_id: str,
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Return all ticket submissions for this roadmap."""
    try:
        return service.get_submissions(roadmap_id, user, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ── Skill competence ──────────────────────────────────────────────────────────

@router.get("/daily-mission")
def get_daily_mission(
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Return a single actionable mission for today."""
    return service.get_daily_mission(user, db)


@router.get("/cohort-signals")
def get_cohort_signals(
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Return social proof signals from the user's career track cohort."""
    return service.get_cohort_signals(user, db)


@router.get("/xp")
def get_xp(
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Return XP summary for the current user."""
    from app.modules.xp.service import get_xp_summary
    return get_xp_summary(user.id, db)


@router.get("/xp/transactions")
def get_xp_transactions(
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Return recent XP transaction history."""
    from app.modules.xp.service import get_recent_transactions
    return get_recent_transactions(user.id, limit=20, db=db)


@router.get("/skills/gap", response_model=list[GapSkillOut])
def get_gap_skills(
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Return prioritised gap skills with competence scores."""
    return service.get_gap_skills_with_competence(user, db)


@router.get("/skills/competence", response_model=list[SkillCompetenceOut])
def get_skill_competence(
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Return all skill competence records for the user."""
    return service.get_skill_competence(user, db)
