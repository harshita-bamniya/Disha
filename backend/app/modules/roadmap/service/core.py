"""Shared helpers for the roadmap service split (stage config/status, gate evaluation, JRS computation, roadmap lookup)."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.roadmap import (
    TicketSubmission, UserRoadmap, UserSkillCompetence,
)
from app.models.user import (
    AspirantProfile, CareerTrack, JobPosting, User,
)
from app.models.interview import InterviewFeedback, InterviewSession
from app.models.learning import LearningPath, LessonCompletion, PathModule, UserLearningEnrollment
from app.models.resume import Resume
from app.modules.roadmap.schemas import (
    JRSBreakdown, StageStatus, SubtopicOut,
)

logger = logging.getLogger(__name__)

# Stage metadata — titles and descriptions are fixed per stage


# ─────────────────────────────────────────────────────────────────────────────
# GENERATE / GET ROADMAP
# ─────────────────────────────────────────────────────────────────────────────


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
        subtopics=_build_subtopics(stage_num, roadmap, cfg, db),
    )


def _build_subtopics(stage_num: int, roadmap: UserRoadmap, cfg: dict, db: Session) -> list[SubtopicOut]:
    """Reshape a stage's content into curriculum-style subtopic rows."""
    user_id = roadmap.user_id

    if stage_num == 1:
        return [
            SubtopicOut(
                id=f"{roadmap.id}-1-1", title="Draft your narrative",
                description="Write a 150-200 word story reframing your background for private-sector hiring managers.",
                is_completed=bool(roadmap.narrative_text),
                resource_label="View Resources", resource_kind="narrative",
            ),
            SubtopicOut(
                id=f"{roadmap.id}-1-2", title="Get AI feedback & refine",
                description="Submit your draft for AI coaching and revise based on the feedback.",
                is_completed=roadmap.narrative_score is not None,
                resource_label="View Resources", resource_kind="narrative",
            ),
        ]

    if stage_num == 2:
        gap_skills = cfg.get("gap_skills_focus", [])[:8]
        if not gap_skills:
            return []
        recs = (
            db.query(UserSkillCompetence)
            .filter(
                UserSkillCompetence.user_id == user_id,
                UserSkillCompetence.skill_text.in_([s.lower().strip() for s in gap_skills]),
            )
            .all()
        )
        competence_map = {r.skill_text: r.competence_score for r in recs}
        return [
            SubtopicOut(
                id=f"{roadmap.id}-2-{i}", title=skill,
                description=f"Build proficiency in {skill} through curated lessons and exercises.",
                is_completed=competence_map.get(skill.lower().strip(), 0) >= 60,
                resource_label="View Resources", resource_kind="learning",
            )
            for i, skill in enumerate(gap_skills)
        ]

    if stage_num == 3:
        target = cfg.get("exercises_target", 5)
        from app.models.learning import Lesson, LessonCompletion
        done = (
            db.query(LessonCompletion)
            .join(Lesson, LessonCompletion.lesson_id == Lesson.id)
            .filter(LessonCompletion.user_id == user_id, Lesson.content_type == "exercise")
            .count()
        )
        return [
            SubtopicOut(
                id=f"{roadmap.id}-3-1", title=f"Practice Exercises ({min(done, target)}/{target})",
                description="Apply your new skills through hands-on case studies and exercises.",
                is_completed=done >= target,
                resource_label="View Resources", resource_kind="exercise",
            ),
        ]

    if stage_num == 4:
        target = cfg.get("tickets_target", 2)
        done = db.query(TicketSubmission).filter(
            TicketSubmission.roadmap_id == roadmap.id,
            TicketSubmission.review_status == "done",
        ).count()
        return [
            SubtopicOut(
                id=f"{roadmap.id}-4-{i}", title=f"Work Ticket {i + 1}",
                description="Complete a real-world work simulation ticket and get AI review.",
                is_completed=done > i,
                resource_label="View Resources", resource_kind="ticket",
            )
            for i in range(target)
        ]

    if stage_num == 5:
        best_ats = db.query(func.max(Resume.ats_score)).filter(
            Resume.user_id == user_id, Resume.deleted_at == None
        ).scalar()
        interview_target = cfg.get("interview_rounds_target", 3)
        sessions_done = db.query(InterviewSession).filter(
            InterviewSession.user_id == user_id, InterviewSession.status == "completed",
        ).count()
        return [
            SubtopicOut(
                id=f"{roadmap.id}-5-1", title="Optimise Resume",
                description="Polish your resume until it scores at least 70 on the ATS checker.",
                is_completed=(best_ats or 0) >= 70,
                resource_label="View Resources", resource_kind="resume",
            ),
            SubtopicOut(
                id=f"{roadmap.id}-5-2", title=f"Mock Interviews ({min(sessions_done, interview_target)}/{interview_target})",
                description="Complete mock interview rounds to sharpen your answers.",
                is_completed=sessions_done >= interview_target,
                resource_label="View Resources", resource_kind="interview",
            ),
        ]

    if stage_num == 6:
        return [
            SubtopicOut(
                id=f"{roadmap.id}-6-1", title="Apply to Target Roles",
                description="Apply, track, and iterate on target job listings until you land an offer.",
                is_completed=False,
                resource_label="View Resources", resource_kind="jobs",
            ),
        ]

    return []


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
        from app.models.learning import Lesson
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


def _compute_jrs_internal(user: User, roadmap: UserRoadmap | None, db: Session) -> int:
    breakdown = _jrs_breakdown(user, roadmap, db)
    return breakdown.total


def compute_jrs(user: User, db: Session) -> JRSBreakdown:
    """Compute JRS breakdown for display on the dashboard."""
    roadmap = get_roadmap(None, user, db)
    total = _compute_jrs_internal(user, roadmap, db)
    breakdown = _jrs_breakdown(user, roadmap, db)
    return breakdown


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

