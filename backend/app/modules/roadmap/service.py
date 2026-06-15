"""Roadmap Intelligence Service — core business logic.

Responsibilities:
  1. generate_roadmap()   — build a UserRoadmap from KRS gap analysis
  2. get_roadmap()        — fetch active roadmap with computed stage statuses
  3. compute_jrs()        — compute the Job Readiness Score (0-100)
  4. submit_narrative()   — save narrative and trigger AI evaluation
  5. get_gate_status()    — evaluate stage gate criteria
  6. advance_stage()      — move user to next stage after passing gate
  7. get_tickets()        — return available tickets for user's track
  8. submit_ticket()      — save submission and dispatch async AI review
  9. get_submissions()    — fetch user's ticket submissions
  10. recalibrate()       — weekly job: update gap_skills from fresh job data
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.roadmap import (
    StageGateEvaluation, TicketSubmission, TicketTemplate,
    UserRoadmap, UserSkillCompetence,
)
from app.models.user import (
    AspirantProfile, CareerTrack, JobPosting, KrsScore,
    PsychologicalAssessment, User, UserCareerSelection,
)
from app.modules.roadmap.personalization import get_personalization_from_user
from app.models.mvp2 import (
    InterviewFeedback, InterviewSession, LearningPath,
    LessonCompletion, PathModule, Resume, UserLearningEnrollment,
)
from app.modules.krs.skill_gap import compute_gap
from app.modules.roadmap.schemas import (
    GapSkillOut, GateCheckOut, JRSBreakdown, RoadmapOut,
    SkillCompetenceOut, StageStatus, TicketSubmissionOut, TicketTemplateOut,
)

logger = logging.getLogger(__name__)

# Stage metadata — titles and descriptions are fixed per stage
_STAGE_META = {
    1: {
        "title": "Identity Reframe",
        "description": "Transform your UPSC experience into a private-sector narrative that resonates with hiring managers.",
        "estimated_days": 14,
    },
    2: {
        "title": "Skill Foundation",
        "description": "Build the specific technical and functional skills your target roles require.",
        "estimated_days": 42,
    },
    3: {
        "title": "Applied Practice",
        "description": "Move from understanding to doing — exercises, case studies, and debugging tasks.",
        "estimated_days": 42,
    },
    4: {
        "title": "Real-World Simulation",
        "description": "Work on industry-style tickets in a simulated private-sector environment.",
        "estimated_days": 35,
    },
    5: {
        "title": "Job Market Activation",
        "description": "Resume optimisation, LinkedIn prep, and three rounds of AI mock interviews.",
        "estimated_days": 21,
    },
    6: {
        "title": "Offer Pipeline",
        "description": "Apply, track, and iterate until you have an offer in hand.",
        "estimated_days": None,
    },
}

# Minimum requirements to pass each stage gate (soft gates in MVP)
_GATE_CRITERIA = {
    1: [
        {"type": "narrative_submitted", "label": "Narrative submitted", "min_value": 1},
        {"type": "narrative_score", "label": "Narrative score", "min_value": 60},
    ],
    2: [
        {"type": "lessons_completed_pct", "label": "Lessons completed", "min_value": 70},
    ],
    3: [
        {"type": "exercises_completed", "label": "Exercises completed", "min_value": 3},
    ],
    4: [
        {"type": "tickets_completed", "label": "Tickets submitted with AI review", "min_value": 2},
        {"type": "ticket_avg_score", "label": "Average ticket score", "min_value": 60},
    ],
    5: [
        {"type": "resume_ats_score", "label": "Resume ATS score", "min_value": 70},
        {"type": "interview_sessions_completed", "label": "Mock interview rounds", "min_value": 2},
    ],
    6: [],  # No gate — stage 6 is always open once stage 5 passes
}


# ─────────────────────────────────────────────────────────────────────────────
# GENERATE / GET ROADMAP
# ─────────────────────────────────────────────────────────────────────────────

def generate_roadmap(career_track_id: str, user: User, db: Session) -> UserRoadmap:
    """Generate or regenerate a roadmap for the given career track.

    Algorithm:
    1. Load user profile + KRS scores.
    2. Fetch career track + top-5 active jobs for that track.
    3. Compute skill gap (semantic, using existing skill_gap.py).
    4. Prioritise gap skills by frequency across jobs.
    5. Build stage_config linking Stage 2 to relevant learning paths.
    6. Upsert UserRoadmap and compute initial JRS.
    """
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    track = db.query(CareerTrack).filter(CareerTrack.id == career_track_id).first()

    if not track:
        raise ValueError("Career track not found.")
    if not profile:
        raise ValueError("Onboarding not complete.")

    # Top 5 active jobs for this track (by sector match)
    target_jobs = (
        db.query(JobPosting)
        .filter(JobPosting.is_active == True, JobPosting.sector == track.sector)
        .order_by(JobPosting.created_at.desc())
        .limit(5)
        .all()
    )

    # Aggregate required skills: career track required_skills + job required_skills
    all_required: list[str] = list(track.required_skills or [])
    job_skill_freq: dict[str, int] = {}
    for job in target_jobs:
        for skill in (job.required_skills or []):
            key = skill.lower().strip()
            job_skill_freq[key] = job_skill_freq.get(key, 0) + 1
            if skill not in all_required:
                all_required.append(skill)

    user_skills = list(profile.skills or [])
    _, gap_skills, _ = compute_gap(user_skills, all_required, db)

    # Sort gap skills: skills appearing in more jobs come first
    gap_skills.sort(key=lambda s: job_skill_freq.get(s.lower().strip(), 0), reverse=True)

    # Build stage_config
    stage_config = _build_stage_config(gap_skills, track, target_jobs, db)

    target_job_ids = [str(j.id) for j in target_jobs]

    # Upsert roadmap
    existing = (
        db.query(UserRoadmap)
        .filter(UserRoadmap.user_id == user.id, UserRoadmap.career_track_id == career_track_id)
        .first()
    )
    if existing:
        existing.target_job_ids = target_job_ids
        existing.gap_skills = gap_skills
        existing.stage_config = stage_config
        existing.last_recalibrated = datetime.now(timezone.utc)
        existing.is_active = True
        roadmap = existing
    else:
        roadmap = UserRoadmap(
            user_id=user.id,
            career_track_id=career_track_id,
            target_job_ids=target_job_ids,
            gap_skills=gap_skills,
            stage_config=stage_config,
            current_stage=1,
        )
        db.add(roadmap)

    db.flush()

    # Apply personalization config and store in stage_config
    try:
        pcfg = get_personalization_from_user(user, db)
        if isinstance(stage_config, dict):
            stage_config["personalization"] = pcfg.to_dict()
            roadmap.stage_config = stage_config
    except Exception as e:
        logger.warning("[ROADMAP] Personalization failed: %s", e)

    # Compute and persist initial JRS
    jrs = _compute_jrs_internal(user, roadmap, db)
    roadmap.job_readiness_score = jrs
    db.commit()
    db.refresh(roadmap)

    logger.info(
        "[ROADMAP] Generated for user=%s track=%s gap_skills=%d JRS=%d",
        user.id, track.slug, len(gap_skills), jrs,
    )
    return roadmap


def get_roadmap(career_track_id: str | None, user: User, db: Session) -> UserRoadmap | None:
    """Fetch the user's active roadmap. If career_track_id is None, return the most recent."""
    q = db.query(UserRoadmap).filter(
        UserRoadmap.user_id == user.id, UserRoadmap.is_active == True
    )
    if career_track_id:
        q = q.filter(UserRoadmap.career_track_id == career_track_id)
    else:
        q = q.order_by(UserRoadmap.generated_at.desc())
    return q.first()


def get_roadmap_out(roadmap: UserRoadmap, db: Session) -> RoadmapOut:
    """Build the full RoadmapOut response with computed stage statuses."""
    from app.models.user import AspirantProfile, JobPosting
    track = db.query(CareerTrack).filter(CareerTrack.id == roadmap.career_track_id).first()
    stages = [_build_stage_status(i, roadmap, db) for i in range(1, 7)]

    # Resolve active prep job for Stage 2 job-specific roadmap
    active_prep_job_id = None
    active_prep_job_title = None
    active_prep_job_company = None
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == roadmap.user_id).first()
    if profile and profile.active_prep_job_id:
        job = db.query(JobPosting).filter(JobPosting.id == profile.active_prep_job_id).first()
        if job:
            active_prep_job_id = str(job.id)
            active_prep_job_title = job.title
            active_prep_job_company = job.employer.company_name if job.employer else None

    return RoadmapOut(
        id=str(roadmap.id),
        career_track_id=str(roadmap.career_track_id) if roadmap.career_track_id else None,
        career_track_name=track.title if track else None,
        current_stage=roadmap.current_stage,
        gap_skills=roadmap.gap_skills or [],
        job_readiness_score=roadmap.job_readiness_score,
        narrative_score=roadmap.narrative_score,
        narrative_feedback=roadmap.narrative_feedback,
        stages=stages,
        generated_at=roadmap.generated_at,
        last_recalibrated=roadmap.last_recalibrated,
        active_prep_job_id=active_prep_job_id,
        active_prep_job_title=active_prep_job_title,
        active_prep_job_company=active_prep_job_company,
    )


# ─────────────────────────────────────────────────────────────────────────────
# JOB READINESS SCORE
# ─────────────────────────────────────────────────────────────────────────────

def compute_jrs(user: User, db: Session) -> JRSBreakdown:
    """Compute JRS breakdown for display on the dashboard."""
    roadmap = get_roadmap(None, user, db)
    total = _compute_jrs_internal(user, roadmap, db)
    breakdown = _jrs_breakdown(user, roadmap, db)
    return breakdown


def _compute_jrs_internal(user: User, roadmap: UserRoadmap | None, db: Session) -> int:
    breakdown = _jrs_breakdown(user, roadmap, db)
    return breakdown.total


def _jrs_breakdown(user: User, roadmap: UserRoadmap | None, db: Session) -> JRSBreakdown:
    # 1. Profile completeness (0–10)
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    if profile and profile.is_completed:
        profile_score = 10.0
    elif profile:
        profile_score = min(9.0, profile.current_step * 1.4)
    else:
        profile_score = 0.0

    # 2. Skill coverage (0–25) — gap skills covered by competence records ≥ 60
    skill_score = 0.0
    if roadmap and roadmap.gap_skills:
        gap_set = {s.lower().strip() for s in roadmap.gap_skills}
        competent_skills = (
            db.query(UserSkillCompetence)
            .filter(
                UserSkillCompetence.user_id == user.id,
                UserSkillCompetence.competence_score >= 60,
            )
            .all()
        )
        covered = sum(1 for sc in competent_skills if sc.skill_text in gap_set)
        skill_score = round((covered / len(gap_set)) * 25, 1)

    # 3. Competence average (0–20)
    competence_score = 0.0
    all_competence = (
        db.query(func.avg(UserSkillCompetence.competence_score))
        .filter(UserSkillCompetence.user_id == user.id)
        .scalar()
    )
    if all_competence:
        competence_score = round((float(all_competence) / 100) * 20, 1)

    # 4. Narrative score (0–15)
    narrative_score_val = 0.0
    if roadmap and roadmap.narrative_score is not None:
        narrative_score_val = round((roadmap.narrative_score / 100) * 15, 1)

    # 5. Resume ATS score (0–15) — best ATS score from all user resumes
    resume_score = 0.0
    best_ats = (
        db.query(func.max(Resume.ats_score))
        .filter(Resume.user_id == user.id, Resume.deleted_at == None)
        .scalar()
    )
    if best_ats is not None:
        resume_score = round((best_ats / 100) * 15, 1)

    # 6. Interview average (0–15) — avg overall_score across completed sessions
    interview_score = 0.0
    avg_interview = (
        db.query(func.avg(InterviewFeedback.overall_score))
        .join(InterviewSession, InterviewFeedback.session_id == InterviewSession.id)
        .filter(
            InterviewSession.user_id == user.id,
            InterviewSession.status == "completed",
        )
        .scalar()
    )
    if avg_interview is not None:
        interview_score = round((float(avg_interview) / 100) * 15, 1)

    total = int(min(100, profile_score + skill_score + competence_score + narrative_score_val + resume_score + interview_score))
    return JRSBreakdown(
        total=total,
        profile_score=profile_score,
        skill_coverage_score=skill_score,
        competence_score=competence_score,
        narrative_score=narrative_score_val,
        resume_score=resume_score,
        interview_score=interview_score,
    )


# ─────────────────────────────────────────────────────────────────────────────
# NARRATIVE (Stage 1)
# ─────────────────────────────────────────────────────────────────────────────

def save_narrative(
    roadmap_id: str,
    narrative_text: str,
    ai_feedback: dict,
    user: User,
    db: Session,
) -> UserRoadmap:
    """Persist narrative text + AI feedback on the roadmap record."""
    roadmap = _get_owned_roadmap(roadmap_id, user, db)
    roadmap.narrative_text = narrative_text
    roadmap.narrative_feedback = ai_feedback
    roadmap.narrative_score = ai_feedback.get("overall_score", 0)

    # Recompute JRS
    roadmap.job_readiness_score = _compute_jrs_internal(user, roadmap, db)
    db.commit()
    db.refresh(roadmap)
    return roadmap


# ─────────────────────────────────────────────────────────────────────────────
# GATE CHECK + STAGE ADVANCE
# ─────────────────────────────────────────────────────────────────────────────

def check_gate(roadmap_id: str, stage_number: int, user: User, db: Session) -> GateCheckOut:
    """Evaluate whether the user meets stage gate criteria."""
    roadmap = _get_owned_roadmap(roadmap_id, user, db)
    criteria = _GATE_CRITERIA.get(stage_number, [])
    results = _evaluate_gate_criteria(criteria, stage_number, roadmap, user, db)

    all_passed = all(r["passed"] for r in results)
    status = "passed" if all_passed else "failed"

    # Persist gate evaluation
    gate_eval = StageGateEvaluation(
        roadmap_id=roadmap.id,
        stage_number=stage_number,
        status=status,
        gate_criteria=criteria,
        gate_results={"items": results},
    )
    db.add(gate_eval)
    db.commit()

    msg = (
        f"Stage {stage_number} gate passed. You can advance to Stage {stage_number + 1}."
        if all_passed
        else f"Not quite there yet. Complete the remaining requirements to unlock Stage {stage_number + 1}."
    )
    return GateCheckOut(
        stage_number=stage_number,
        can_advance=all_passed,
        status=status,
        criteria=results,
        message=msg,
    )


def advance_stage(roadmap_id: str, user: User, db: Session) -> UserRoadmap:
    """Advance roadmap to next stage. Validates gate first."""
    roadmap = _get_owned_roadmap(roadmap_id, user, db)
    if roadmap.current_stage >= 6:
        raise ValueError("Already at Stage 6 — the final stage.")

    gate = check_gate(roadmap_id, roadmap.current_stage, user, db)
    if not gate.can_advance:
        raise ValueError(f"Stage {roadmap.current_stage} gate not yet passed.")

    roadmap.current_stage += 1
    roadmap.job_readiness_score = _compute_jrs_internal(user, roadmap, db)
    db.commit()
    db.refresh(roadmap)

    # Award XP for completing a stage
    try:
        from app.modules.xp.service import award_xp
        award_xp(user.id, "stage_complete", ref_id=roadmap_id,
                 note=f"Completed Stage {roadmap.current_stage - 1}", db=db)
        db.commit()
    except Exception as exc:
        logger.warning("[ROADMAP] XP award failed on stage advance: %s", exc)

    return roadmap


# ─────────────────────────────────────────────────────────────────────────────
# TICKETS (Stage 4)
# ─────────────────────────────────────────────────────────────────────────────

def get_tickets(user: User, career_track_id: str | None, db: Session) -> list[TicketTemplateOut]:
    """Return available tickets for the user's career track."""
    q = db.query(TicketTemplate).filter(TicketTemplate.is_active == True)
    if career_track_id:
        q = q.filter(
            (TicketTemplate.career_track_id == career_track_id) |
            (TicketTemplate.career_track_id == None)
        )
    tickets = q.order_by(TicketTemplate.difficulty).all()

    out = []
    for t in tickets:
        track_name = None
        if t.career_track_id:
            tr = db.query(CareerTrack).filter(CareerTrack.id == t.career_track_id).first()
            track_name = tr.title if tr else None
        out.append(TicketTemplateOut(
            id=str(t.id),
            title=t.title,
            context=t.context,
            deliverable=t.deliverable,
            difficulty=t.difficulty,
            estimated_hours=t.estimated_hours or 3,
            evaluation_rubric=t.evaluation_rubric or {},
            career_track_name=track_name,
        ))
    return out


def submit_ticket(
    roadmap_id: str,
    ticket_id: str,
    submission_text: str,
    user: User,
    db: Session,
) -> TicketSubmission:
    """Save a ticket submission and queue async AI review."""
    roadmap = _get_owned_roadmap(roadmap_id, user, db)
    ticket = db.query(TicketTemplate).filter(
        TicketTemplate.id == ticket_id, TicketTemplate.is_active == True
    ).first()
    if not ticket:
        raise ValueError("Ticket not found.")

    submission = TicketSubmission(
        roadmap_id=roadmap.id,
        user_id=user.id,
        ticket_id=ticket.id,
        submission_text=submission_text,
        review_status="pending",
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # Dispatch async AI review
    try:
        from app.tasks.roadmap_tasks import review_ticket_async
        review_ticket_async.delay(str(submission.id))
    except Exception as exc:
        logger.warning("[ROADMAP] Could not dispatch ticket review for %s: %s", submission.id, exc)

    return submission


def get_submissions(roadmap_id: str, user: User, db: Session) -> list[TicketSubmissionOut]:
    """Return all ticket submissions for this roadmap."""
    roadmap = _get_owned_roadmap(roadmap_id, user, db)
    subs = (
        db.query(TicketSubmission)
        .filter(TicketSubmission.roadmap_id == roadmap.id)
        .order_by(TicketSubmission.submitted_at.desc())
        .all()
    )
    out = []
    for s in subs:
        ticket_title = None
        if s.ticket_id:
            t = db.query(TicketTemplate).filter(TicketTemplate.id == s.ticket_id).first()
            ticket_title = t.title if t else None
        out.append(TicketSubmissionOut(
            id=str(s.id),
            ticket_id=str(s.ticket_id) if s.ticket_id else None,
            ticket_title=ticket_title,
            submission_text=s.submission_text,
            submitted_at=s.submitted_at,
            review_status=s.review_status,
            ai_review_result=s.ai_review_result,
            ai_reviewed_at=s.ai_reviewed_at,
        ))
    return out


# ─────────────────────────────────────────────────────────────────────────────
# SKILL COMPETENCE
# ─────────────────────────────────────────────────────────────────────────────

def update_skill_competence(
    user_id: str,
    skill_text: str,
    quiz_score: float | None,
    exercise_score: float | None,
    db: Session,
) -> UserSkillCompetence:
    """Update (or create) a UserSkillCompetence record with new score data.

    Uses running average: new_avg = (old_avg * n + new_score) / (n + 1)
    """
    norm = skill_text.lower().strip()
    rec = (
        db.query(UserSkillCompetence)
        .filter(UserSkillCompetence.user_id == user_id, UserSkillCompetence.skill_text == norm)
        .first()
    )
    if not rec:
        rec = UserSkillCompetence(user_id=user_id, skill_text=norm)
        db.add(rec)

    n = rec.attempts

    if quiz_score is not None:
        old = rec.quiz_score_avg or 0.0
        rec.quiz_score_avg = (old * n + quiz_score) / (n + 1)
    if exercise_score is not None:
        old = rec.exercise_score_avg or 0.0
        rec.exercise_score_avg = (old * n + exercise_score) / (n + 1)

    rec.attempts = n + 1
    rec.competence_score = (
        (rec.quiz_score_avg * 0.4) +
        (rec.exercise_score_avg * 0.4) +
        min(rec.attempts, 10) * 2  # consistency bonus, max 20
    )
    rec.competence_score = min(100.0, rec.competence_score)
    rec.last_assessed = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rec)
    return rec


def get_skill_competence(user: User, db: Session) -> list[SkillCompetenceOut]:
    recs = (
        db.query(UserSkillCompetence)
        .filter(UserSkillCompetence.user_id == user.id)
        .order_by(UserSkillCompetence.competence_score.desc())
        .all()
    )
    return [SkillCompetenceOut(
        skill_text=r.skill_text,
        competence_score=r.competence_score,
        quiz_score_avg=r.quiz_score_avg,
        exercise_score_avg=r.exercise_score_avg,
        attempts=r.attempts,
        last_assessed=r.last_assessed,
    ) for r in recs]


def get_gap_skills_with_competence(user: User, db: Session) -> list[GapSkillOut]:
    roadmap = get_roadmap(None, user, db)
    if not roadmap:
        return []

    gap_skills = roadmap.gap_skills or []
    competence_map: dict[str, float] = {}
    if gap_skills:
        recs = (
            db.query(UserSkillCompetence)
            .filter(
                UserSkillCompetence.user_id == user.id,
                UserSkillCompetence.skill_text.in_([s.lower().strip() for s in gap_skills]),
            )
            .all()
        )
        competence_map = {r.skill_text: r.competence_score for r in recs}

    return [
        GapSkillOut(
            skill=skill,
            priority_rank=i + 1,
            competence_score=competence_map.get(skill.lower().strip()),
        )
        for i, skill in enumerate(gap_skills)
    ]


# ─────────────────────────────────────────────────────────────────────────────
# RECALIBRATION (called by Celery weekly task)
# ─────────────────────────────────────────────────────────────────────────────

def recalibrate_roadmap(roadmap: UserRoadmap, db: Session) -> None:
    """Update gap_skills ordering from fresh job data and recompute JRS."""
    track = db.query(CareerTrack).filter(CareerTrack.id == roadmap.career_track_id).first()
    if not track:
        return

    target_jobs = (
        db.query(JobPosting)
        .filter(JobPosting.is_active == True, JobPosting.sector == track.sector)
        .order_by(JobPosting.created_at.desc())
        .limit(5)
        .all()
    )

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == roadmap.user_id).first()
    user_skills = list(profile.skills or []) if profile else []

    all_required: list[str] = list(track.required_skills or [])
    job_skill_freq: dict[str, int] = {}
    for job in target_jobs:
        for skill in (job.required_skills or []):
            key = skill.lower().strip()
            job_skill_freq[key] = job_skill_freq.get(key, 0) + 1
            if skill not in all_required:
                all_required.append(skill)

    _, gap_skills, _ = compute_gap(user_skills, all_required, db)
    gap_skills.sort(key=lambda s: job_skill_freq.get(s.lower().strip(), 0), reverse=True)

    roadmap.gap_skills = gap_skills
    roadmap.target_job_ids = [str(j.id) for j in target_jobs]
    roadmap.last_recalibrated = datetime.now(timezone.utc)

    # Recompute JRS using lazy import to avoid circular dependency
    from app.models.user import User as UserModel
    user_obj = db.query(UserModel).filter(UserModel.id == roadmap.user_id).first()
    if user_obj:
        roadmap.job_readiness_score = _compute_jrs_internal(user_obj, roadmap, db)

    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# DAILY MISSION
# ─────────────────────────────────────────────────────────────────────────────

def get_daily_mission(user: User, db: Session) -> dict:
    """Return a single actionable mission for today based on current stage and gaps.

    Logic:
      Stage 1 → write/revise narrative
      Stage 2 → complete the next lesson in top gap skill
      Stage 3 → complete an exercise (case study or quiz)
      Stage 4 → submit or review a work ticket
      Stage 5 → do a mock interview session or polish resume
      Stage 6 → apply to a job from the target list
    """
    roadmap = get_roadmap(None, user, db)
    if not roadmap:
        return {
            "type": "setup",
            "title": "Generate Your Roadmap",
            "description": "Start by generating your personalised 6-stage roadmap.",
            "cta_label": "Generate Roadmap",
            "cta_path": "/app/roadmap",
            "xp_reward": 0,
        }

    stage = roadmap.current_stage
    gap_skills = roadmap.gap_skills or []
    top_gap = gap_skills[0] if gap_skills else "your target skill"

    if stage == 1:
        has_narrative = bool(roadmap.narrative_text)
        if not has_narrative:
            return {
                "type": "narrative",
                "title": "Write Your Career Narrative",
                "description": "Craft a 150-200 word story that reframes your UPSC experience in private-sector language.",
                "cta_label": "Start Narrative",
                "cta_path": "/app/roadmap",
                "xp_reward": 80,
            }
        else:
            return {
                "type": "narrative_improve",
                "title": "Improve Your Career Narrative",
                "description": f"Your narrative scored {roadmap.narrative_score or 0}/100. Review the AI feedback and submit an improved draft.",
                "cta_label": "Revise Narrative",
                "cta_path": "/app/roadmap",
                "xp_reward": 50,
            }

    if stage == 2:
        # Find next incomplete lesson in enrolled paths
        enrolled = db.query(UserLearningEnrollment).filter(
            UserLearningEnrollment.user_id == user.id,
            UserLearningEnrollment.status.in_(["enrolled", "in_progress"]),
        ).first()
        if enrolled:
            path = db.query(LearningPath).filter(LearningPath.id == enrolled.learning_path_id).first()
            completed_ids = {str(r.lesson_id) for r in
                             db.query(LessonCompletion).filter(LessonCompletion.user_id == user.id).all()}
            next_lesson = None
            for module in (path.modules if path else []):
                for lesson in module.lessons:
                    if str(lesson.id) not in completed_ids and lesson.is_active:
                        next_lesson = lesson
                        break
                if next_lesson:
                    break
            if next_lesson and path:
                return {
                    "type": "lesson",
                    "title": f"Complete: {next_lesson.title}",
                    "description": f"This lesson builds {top_gap} — a skill required by your target roles.",
                    "cta_label": "Start Lesson",
                    "cta_path": f"/app/learn/{path.id}/lessons/{next_lesson.id}",
                    "xp_reward": 10,
                }
        return {
            "type": "enroll",
            "title": f"Enroll in a Learning Path",
            "description": f"Find and enroll in a path that covers {top_gap}.",
            "cta_label": "Browse Paths",
            "cta_path": "/app/learn",
            "xp_reward": 10,
        }

    if stage == 3:
        return {
            "type": "exercise",
            "title": f"Complete a Practice Exercise",
            "description": f"Apply your {top_gap} knowledge through a hands-on case study or exercise.",
            "cta_label": "Browse Exercises",
            "cta_path": "/app/roadmap?tab=exercises",
            "xp_reward": 50,
        }

    if stage == 4:
        pending_subs = db.query(TicketSubmission).filter(
            TicketSubmission.roadmap_id == roadmap.id,
            TicketSubmission.review_status == "pending",
        ).count()
        if pending_subs > 0:
            return {
                "type": "ticket_awaiting",
                "title": "Ticket Under Review",
                "description": "You have a ticket being reviewed. Start another to build momentum.",
                "cta_label": "View Tickets",
                "cta_path": "/app/roadmap?tab=tickets",
                "xp_reward": 100,
            }
        return {
            "type": "ticket",
            "title": "Submit a Work Ticket",
            "description": "Demonstrate your skills through a real-world work simulation ticket.",
            "cta_label": "View Tickets",
            "cta_path": "/app/roadmap?tab=tickets",
            "xp_reward": 100,
        }

    if stage == 5:
        return {
            "type": "interview",
            "title": "Practice a Mock Interview",
            "description": "One 10-minute mock interview session today sharpens your answers significantly.",
            "cta_label": "Start Interview",
            "cta_path": "/app/mock-interview",
            "xp_reward": 75,
        }

    # Stage 6
    return {
        "type": "apply",
        "title": "Apply to a Target Role Today",
        "description": "Consistent applications are the only path to an offer. Submit one today.",
        "cta_label": "Browse Jobs",
        "cta_path": "/app/jobs",
        "xp_reward": 0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# COHORT SIGNALS
# ─────────────────────────────────────────────────────────────────────────────

def get_cohort_signals(user: User, db: Session) -> dict:
    """Return social proof signals for users in the same career track this week."""
    from datetime import timedelta
    roadmap = get_roadmap(None, user, db)
    if not roadmap:
        return {"signals": []}

    track_id = roadmap.career_track_id
    one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # Users in same track who advanced stages this week
    advanced_count = (
        db.query(StageGateEvaluation)
        .join(UserRoadmap, StageGateEvaluation.roadmap_id == UserRoadmap.id)
        .filter(
            UserRoadmap.career_track_id == track_id,
            UserRoadmap.user_id != user.id,
            StageGateEvaluation.status == "passed",
            StageGateEvaluation.evaluated_at >= one_week_ago,
        )
        .count()
    )

    # Users in same track who completed interviews this week
    from app.models.mvp2 import InterviewSession as IS
    interview_count = (
        db.query(IS)
        .join(User, IS.user_id == User.id)
        .join(UserRoadmap, UserRoadmap.user_id == User.id)
        .filter(
            UserRoadmap.career_track_id == track_id,
            IS.user_id != user.id,
            IS.status == "completed",
            IS.completed_at >= one_week_ago,
        )
        .count()
    )

    # Users who submitted tickets this week
    ticket_count = (
        db.query(TicketSubmission)
        .join(UserRoadmap, TicketSubmission.roadmap_id == UserRoadmap.id)
        .filter(
            UserRoadmap.career_track_id == track_id,
            TicketSubmission.user_id != user.id,
            TicketSubmission.submitted_at >= one_week_ago,
        )
        .count()
    )

    signals = []
    if advanced_count > 0:
        signals.append({
            "type": "stage_advance",
            "message": f"{advanced_count} {'person' if advanced_count == 1 else 'people'} in your career track advanced a stage this week.",
            "count": advanced_count,
        })
    if interview_count > 0:
        signals.append({
            "type": "interview",
            "message": f"{interview_count} {'person' if interview_count == 1 else 'people'} in your track completed mock interviews this week.",
            "count": interview_count,
        })
    if ticket_count > 0:
        signals.append({
            "type": "ticket",
            "message": f"{ticket_count} work tickets submitted by your cohort this week.",
            "count": ticket_count,
        })

    if not signals:
        signals.append({
            "type": "encouragement",
            "message": "Be the first in your cohort to complete an activity this week.",
            "count": 0,
        })

    return {"signals": signals, "period_days": 7}


# ─────────────────────────────────────────────────────────────────────────────
# PRIVATE HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _get_owned_roadmap(roadmap_id: str, user: User, db: Session) -> UserRoadmap:
    roadmap = db.query(UserRoadmap).filter(
        UserRoadmap.id == roadmap_id, UserRoadmap.user_id == user.id
    ).first()
    if not roadmap:
        raise ValueError("Roadmap not found.")
    return roadmap


def _build_stage_config(
    gap_skills: list[str],
    track: CareerTrack,
    target_jobs: list[JobPosting],
    db: Session,
) -> dict[str, Any]:
    """Build the stage_config JSONB for a new UserRoadmap."""
    # Find learning paths relevant to this track
    learning_paths = (
        db.query(LearningPath)
        .filter(LearningPath.career_track_id == track.id, LearningPath.is_active == True)
        .order_by(LearningPath.sort_order)
        .limit(6)
        .all()
    )
    path_refs = [{"id": str(p.id), "name": p.name} for p in learning_paths]

    return {
        "1": {**_STAGE_META[1], "status": "active", "gate": _GATE_CRITERIA[1]},
        "2": {**_STAGE_META[2], "status": "pending", "learning_paths": path_refs, "gap_skills_focus": gap_skills[:8], "gate": _GATE_CRITERIA[2]},
        "3": {**_STAGE_META[3], "status": "pending", "exercises_target": 5, "gate": _GATE_CRITERIA[3]},
        "4": {**_STAGE_META[4], "status": "pending", "tickets_target": 2, "gate": _GATE_CRITERIA[4]},
        "5": {**_STAGE_META[5], "status": "pending", "interview_rounds_target": 3, "gate": _GATE_CRITERIA[5]},
        "6": {**_STAGE_META[6], "status": "pending", "gate": None},
    }


def _build_stage_status(stage_num: int, roadmap: UserRoadmap, db: Session) -> StageStatus:
    """Build a StageStatus with live progress for the given stage."""
    meta = _STAGE_META[stage_num]
    cfg = (roadmap.stage_config or {}).get(str(stage_num), {})

    if stage_num < roadmap.current_stage:
        status = "passed"
    elif stage_num == roadmap.current_stage:
        status = "active"
    else:
        status = "pending"

    progress_pct = _stage_progress_pct(stage_num, roadmap, db)

    return StageStatus(
        stage_number=stage_num,
        title=meta["title"],
        description=meta["description"],
        status=status,
        estimated_days=meta["estimated_days"],
        progress_pct=progress_pct,
        gate=cfg.get("gate"),
    )


def _stage_progress_pct(stage_num: int, roadmap: UserRoadmap, db: Session) -> int:
    """Compute rough % progress within a stage based on completions."""
    if stage_num < roadmap.current_stage:
        return 100

    user_id = roadmap.user_id

    if stage_num == 1:
        if roadmap.narrative_score is not None:
            return 100
        if roadmap.narrative_text:
            return 50
        return 0

    if stage_num == 2:
        # Count lesson completions across enrolled paths for this track
        enrolled = (
            db.query(UserLearningEnrollment)
            .join(LearningPath, UserLearningEnrollment.learning_path_id == LearningPath.id)
            .filter(
                UserLearningEnrollment.user_id == user_id,
                LearningPath.career_track_id == roadmap.career_track_id,
            )
            .all()
        )
        if not enrolled:
            return 0
        completed_count = 0
        for enr in enrolled:
            path = db.query(LearningPath).options(
                joinedload(LearningPath.modules).joinedload(PathModule.lessons)
            ).filter(LearningPath.id == enr.learning_path_id).first()
            if path:
                all_ids = {str(l.id) for m in path.modules for l in m.lessons if l.is_active}
                done = db.query(LessonCompletion).filter(
                    LessonCompletion.user_id == user_id,
                    LessonCompletion.lesson_id.in_(all_ids),
                ).count()
                if all_ids:
                    completed_count += int((done / len(all_ids)) * 100)
        return min(100, completed_count // max(len(enrolled), 1))

    if stage_num == 4:
        done = db.query(TicketSubmission).filter(
            TicketSubmission.roadmap_id == roadmap.id,
            TicketSubmission.review_status == "done",
        ).count()
        cfg = (roadmap.stage_config or {}).get("4", {})
        target = cfg.get("tickets_target", 2)
        return min(100, int((done / target) * 100))

    if stage_num == 5:
        sessions_done = db.query(InterviewSession).filter(
            InterviewSession.user_id == user_id,
            InterviewSession.status == "completed",
        ).count()
        return min(100, int((sessions_done / 3) * 100))

    return 0


def _evaluate_gate_criteria(
    criteria: list[dict],
    stage_num: int,
    roadmap: UserRoadmap,
    user: User,
    db: Session,
) -> list[dict]:
    """Return criteria list with current_value and passed fields added."""
    results = []
    for c in criteria:
        ctype = c["type"]
        min_val = c.get("min_value", 1)
        current = _current_gate_value(ctype, roadmap, user, db)
        results.append({
            **c,
            "current_value": current,
            "passed": current >= min_val,
        })
    return results


def _current_gate_value(ctype: str, roadmap: UserRoadmap, user: User, db: Session) -> float:
    """Look up the current live value for a gate criterion type."""
    if ctype == "narrative_submitted":
        return 1.0 if roadmap.narrative_text else 0.0

    if ctype == "narrative_score":
        return float(roadmap.narrative_score or 0)

    if ctype == "lessons_completed_pct":
        return float(_stage_progress_pct(2, roadmap, db))

    if ctype == "exercises_completed":
        # Currently approximated from lesson completions with content_type='exercise'
        from app.models.mvp2 import Lesson
        count = (
            db.query(LessonCompletion)
            .join(Lesson, LessonCompletion.lesson_id == Lesson.id)
            .filter(
                LessonCompletion.user_id == user.id,
                Lesson.content_type == "exercise",
            )
            .count()
        )
        return float(count)

    if ctype == "tickets_completed":
        return float(db.query(TicketSubmission).filter(
            TicketSubmission.roadmap_id == roadmap.id,
            TicketSubmission.review_status == "done",
        ).count())

    if ctype == "ticket_avg_score":
        subs = db.query(TicketSubmission).filter(
            TicketSubmission.roadmap_id == roadmap.id,
            TicketSubmission.review_status == "done",
            TicketSubmission.ai_review_result != None,
        ).all()
        if not subs:
            return 0.0
        scores = [s.ai_review_result.get("overall_score", 0) for s in subs if s.ai_review_result]
        return float(sum(scores) / len(scores)) if scores else 0.0

    if ctype == "resume_ats_score":
        best = db.query(func.max(Resume.ats_score)).filter(
            Resume.user_id == user.id, Resume.deleted_at == None
        ).scalar()
        return float(best or 0)

    if ctype == "interview_sessions_completed":
        return float(db.query(InterviewSession).filter(
            InterviewSession.user_id == user.id,
            InterviewSession.status == "completed",
        ).count())

    return 0.0
