"""Counsellor business logic — Module 08.

Pulled out of router.py so route handlers stay thin (auth + delegate +
serialize) instead of holding the DB queries directly.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import String, case, cast
from sqlalchemy.orm import Session

from app.models.counsellor import Conversation, CounsellorMemory, Message
from app.models.interview import InterviewSession
from app.models.job_plan import JobLearningPlan
from app.models.learning import LessonCompletion, UserStreak
from app.models.resume import Resume as ResumeModel
from app.models.roadmap import UserSkillCompetence
from app.models.user import AspirantProfile, JobPosting, User
from app.modules.counsellor.schemas import (
    ArchiveConversationResponse,
    ConversationDetail,
    ConversationSummary,
    CreateConversationRequest,
    MessageOut,
)


def _to_summary(c: Conversation) -> ConversationSummary:
    return ConversationSummary(
        id=str(c.id),
        title=c.title,
        context_type=c.context_type,
        status=c.status,
        message_count=c.message_count,
        skill_focus=c.skill_focus,
        job_context=c.job_context,
        interview_config=c.interview_config,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


def get_owned_conversation(conv_id: str, user_id, db: Session) -> Conversation:
    """Fetch a conversation the given user owns, or raise ValueError."""
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user_id)
        .first()
    )
    if not conv:
        raise ValueError("Conversation not found.")
    return conv


def list_conversations(user_id, db: Session) -> list[ConversationSummary]:
    convs = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user_id,
            # "emotional" belongs to Your Companion, which has its own dedicated UI —
            # keep it out of the general AI Counsellor's conversation list. Roadmap
            # ("job_roadmap") chats stay visible here too, alongside the rest.
            Conversation.context_type != "emotional",
        )
        .order_by(Conversation.updated_at.desc())
        .limit(20)
        .all()
    )
    return [_to_summary(c) for c in convs]


def create_conversation(body: CreateConversationRequest, user_id, db: Session) -> ConversationSummary:
    job_ctx = None
    title = None

    if body.context_type == "skill_learning" and body.skill_focus:
        job_ctx = {
            "job_id":    body.job_id,
            "job_title": body.job_title,
            "company":   body.company,
            "sector":    body.sector,
        }
        title = f"{body.skill_focus} — {body.job_title or 'Job Prep'}"

    elif body.context_type == "career_coaching":
        title = "Career Coaching Session"

    elif body.context_type == "job_roadmap":
        job_ctx = {
            "job_id":    body.job_id,
            "job_title": body.job_title,
            "company":   body.company,
            "sector":    body.sector,
        }
        title = f"Roadmap Q&A — {body.job_title or 'Job Prep'}"

        # One continuous thread per job, not a new one on every page visit.
        existing = (
            db.query(Conversation)
            .filter(
                Conversation.user_id == user_id,
                Conversation.context_type == "job_roadmap",
                Conversation.status == "active",
                Conversation.job_context["job_id"].astext == str(body.job_id),
            )
            .order_by(Conversation.updated_at.desc())
            .first()
        )
        if existing:
            return _to_summary(existing)

    conv = Conversation(
        user_id=user_id,
        title=title,
        context_type=body.context_type,
        status="active",
        skill_focus=body.skill_focus if body.context_type == "skill_learning" else None,
        job_context=job_ctx,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    return _to_summary(conv)


def start_career_coaching(user_id, db: Session) -> ConversationSummary:
    """One-click start a career coaching conversation."""
    conv = Conversation(
        user_id=user_id,
        title="Career Coaching Session",
        context_type="career_coaching",
        status="active",
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return _to_summary(conv)


def get_conversation_detail(conv_id: str, user_id, db: Session) -> ConversationDetail:
    conv = get_owned_conversation(conv_id, user_id, db)

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
        .all()
    )

    return ConversationDetail(
        id=str(conv.id),
        title=conv.title,
        context_type=conv.context_type,
        status=conv.status,
        message_count=conv.message_count,
        skill_focus=conv.skill_focus,
        job_context=conv.job_context,
        interview_config=conv.interview_config,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[
            MessageOut(
                id=str(m.id),
                role=m.role,
                content=m.content,
                safety_flagged=m.safety_flagged,
                created_at=m.created_at,
            )
            for m in messages
        ],
    )


def get_conversation_for_message(conv_id: str, user_id, db: Session) -> Conversation:
    """Fetch a conversation to send a message into — raises ValueError if not
    found/not owned, PermissionError if archived."""
    conv = get_owned_conversation(conv_id, user_id, db)
    if conv.status == "archived":
        raise PermissionError("Cannot send messages to an archived conversation.")
    return conv


def delete_conversation(conv_id: str, user_id, db: Session) -> None:
    """Hard-delete a conversation and all its messages."""
    conv = get_owned_conversation(conv_id, user_id, db)
    db.query(Message).filter(Message.conversation_id == conv_id).delete()
    db.delete(conv)
    db.commit()


def archive_conversation(conv_id: str, user_id, db: Session) -> ArchiveConversationResponse:
    conv = get_owned_conversation(conv_id, user_id, db)
    conv.status = "archived"
    db.commit()
    return ArchiveConversationResponse(conversation_id=conv_id, status="archived")


def get_prep_checklist(job_id: str, user: User, db: Session) -> dict:
    """
    Return a prep checklist for a given job showing what the user has done
    and what's still outstanding.
    """
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()

    # Mock interview done — checked against the real interview module
    # (InterviewSession), not the retired counsellor mock_interview persona.
    # InterviewSession has no job_id FK (job_role is free text), so this is
    # "has the user completed any interview" rather than job-specific.
    interview_done = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.user_id == user.id,
            InterviewSession.status == "completed",
        )
        .first()
    ) is not None

    # Skill coaching sessions started for this job?
    skill_sessions = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user.id,
            Conversation.context_type == "skill_learning",
            cast(Conversation.job_context["job_id"], String) == str(job_id),
        )
        .count()
    )

    # Resume tailored to this job?
    job_title = job.title if job else ""
    resume_done = False
    if job_title:
        resume_done = db.query(ResumeModel).filter(
            ResumeModel.user_id == user.id,
            ResumeModel.title.ilike(f"%{job_title}%"),
            ResumeModel.deleted_at.is_(None),
        ).first() is not None

    # Skill gap coverage
    required = job.required_skills or [] if job else []
    user_skills = {s.lower().strip() for s in (profile.skills or [])} if profile else set()
    gap_skills = [s for s in required if s.lower().strip() not in user_skills]

    return {
        "checklist": [
            {
                "item": "Do a mock interview",
                "done": interview_done,
                "cta": "/app/interview/setup",
                "cta_label": "Start Mock Interview",
            },
            {
                "item": f"Start skill coaching sessions ({skill_sessions} done)",
                "done": skill_sessions > 0,
                "cta": "/app/learn",
                "cta_label": "Go to Learning Hub",
            },
            {
                "item": "Generate a tailored resume",
                "done": resume_done,
                "cta": f"/app/jobs/{job_id}",
                "cta_label": "Generate Resume",
            },
        ],
        "gap_skills": gap_skills,
        "is_active_prep": str(profile.active_prep_job_id) == str(job_id) if profile and profile.active_prep_job_id else False,
    }


def _is_older(dt, threshold):
    if dt is None:
        return True
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt < threshold


def get_nudge(user: User, db: Session) -> dict:
    """
    Return a proactive nudge message if the user has been inactive for 5+ days,
    or hasn't done a mock interview / skill session in a while. Also checks for
    a specific skill the user is stuck on (failed a job-plan quiz repeatedly)
    or a job-specific plan with no progress in a while — these are checked
    first since they reference something concrete, not just "come back".
    Returns {} when no nudge is warranted.
    """
    now = datetime.now(timezone.utc)
    five_days_ago = now - timedelta(days=5)

    nudge = None

    job_plans = (
        db.query(JobLearningPlan)
        .filter(JobLearningPlan.user_id == user.id, JobLearningPlan.status == "ready")
        .all()
    )

    # Most specific: a named skill the user has failed a job-plan quiz on more
    # than once (per UserSkillCompetence, the same tracker quiz submissions now
    # write to) — nudge toward that skill by name, not a generic "come back".
    for jp in job_plans:
        jp_progress = jp.progress or {}
        for module in (jp.plan or {}).get("modules", []):
            quiz_entry = jp_progress.get(f"quiz_{module.get('id')}")
            skill = (module.get("skill") or "").strip()
            if not quiz_entry or quiz_entry.get("passed") or not skill:
                continue
            comp = (
                db.query(UserSkillCompetence)
                .filter(UserSkillCompetence.user_id == user.id, UserSkillCompetence.skill_text == skill.lower().strip())
                .first()
            )
            if comp and comp.attempts >= 2 and comp.quiz_score_avg < 70:
                nudge = {
                    "type": "skill_struggle",
                    "message": f"You've missed the {skill} quiz a couple of times now — want to go over it together before trying again?",
                    "cta": f"Review {skill}",
                    "cta_path": f"/app/jobs/{jp.job_id}",
                }
                break
        if nudge:
            break

    # No progress on an in-progress job plan in 5+ days.
    if not nudge:
        for jp in job_plans:
            resources = [r for m in (jp.plan or {}).get("modules", []) for r in m.get("resources", [])]
            if not resources or not _is_older(jp.updated_at, five_days_ago):
                continue
            done_count = sum(1 for r in resources if (jp.progress or {}).get(r["id"], {}).get("done"))
            if done_count < len(resources):
                job_title = (jp.plan or {}).get("job_title", "your learning plan")
                nudge = {
                    "type": "stale_plan",
                    "message": f"Your plan for {job_title} hasn't moved in a while — {done_count}/{len(resources)} resources done. Pick up where you left off?",
                    "cta": "Resume Plan",
                    "cta_path": f"/app/jobs/{jp.job_id}",
                }
                break

    if nudge:
        return nudge

    # Check last mock interview — the real interview module (InterviewSession),
    # not the retired counsellor mock_interview persona.
    last_interview = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == user.id)
        .order_by(InterviewSession.created_at.desc())
        .first()
    )

    # Check last lesson completion
    last_lesson = (
        db.query(LessonCompletion)
        .filter(LessonCompletion.user_id == user.id)
        .order_by(LessonCompletion.completed_at.desc())
        .first()
    )

    # Check streak
    streak = db.query(UserStreak).filter(UserStreak.user_id == user.id).first()

    if not last_interview or _is_older(last_interview.created_at, five_days_ago):
        nudge = {
            "type": "interview",
            "message": "You haven't practiced a mock interview in 5+ days. Even a quick 10-minute session keeps your confidence sharp.",
            "cta": "Start Mock Interview",
            "cta_path": "/app/interview/setup",
        }
    elif last_lesson and _is_older(last_lesson.completed_at, five_days_ago):
        nudge = {
            "type": "learning",
            "message": "Your learning streak needs attention — your last lesson was over 5 days ago. Keep the momentum going!",
            "cta": "Continue Learning",
            "cta_path": "/app/learn",
        }
    elif streak and streak.current_streak == 0 and streak.longest_streak > 0:
        nudge = {
            "type": "streak",
            "message": f"Your streak broke — but your best was {streak.longest_streak} days. Today's a great day to restart.",
            "cta": "Resume Learning",
            "cta_path": "/app/learn",
        }

    return nudge or {}


def list_memories(user_id, db: Session) -> list[dict]:
    """Return all active memories BeginablAI has stored about this user."""
    importance_order = case(
        (CounsellorMemory.importance == "critical", 0),
        (CounsellorMemory.importance == "high", 1),
        (CounsellorMemory.importance == "medium", 2),
        else_=3,
    )
    memories = (
        db.query(CounsellorMemory)
        .filter(CounsellorMemory.user_id == user_id, CounsellorMemory.is_active == True)
        .order_by(importance_order, CounsellorMemory.created_at.desc())
        .all()
    )
    return [
        {
            "id": str(m.id),
            "memory_type": m.memory_type,
            "content": m.content,
            "importance": m.importance,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in memories
    ]


def delete_memory(memory_id: str, user_id, db: Session) -> None:
    """Soft-delete a memory (user forgets it)."""
    mem = (
        db.query(CounsellorMemory)
        .filter(CounsellorMemory.id == memory_id, CounsellorMemory.user_id == user_id)
        .first()
    )
    if not mem:
        raise ValueError("Memory not found.")
    mem.is_active = False
    db.commit()
