from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import case
from sqlalchemy.orm import Session

from app.core.rbac import get_current_aspirant
from app.database import get_db
from app.models.mvp2 import Conversation, CounsellorMemory, Message
from app.models.user import User
from app.modules.counsellor import orchestrator
from app.modules.counsellor.schemas import (
    ArchiveConversationResponse, ConversationDetail, ConversationSummary,
    CreateConversationRequest, MessageOut, SendMessageRequest,
)

router = APIRouter(prefix="/counsellor", tags=["AI Counsellor"])


@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    convs = (
        db.query(Conversation)
        .filter(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(20)
        .all()
    )
    return [
        ConversationSummary(
            id=str(c.id),
            title=c.title,
            context_type=c.context_type,
            status=c.status,
            message_count=c.message_count,
            skill_focus=c.skill_focus,
            job_context=c.job_context,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in convs
    ]


@router.post("/conversations", response_model=ConversationSummary, status_code=201)
def create_conversation(
    body: CreateConversationRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    job_ctx = None
    interview_cfg = None
    title = None

    if body.context_type == "skill_learning" and body.skill_focus:
        job_ctx = {
            "job_id":    body.job_id,
            "job_title": body.job_title,
            "company":   body.company,
            "sector":    body.sector,
        }
        title = f"{body.skill_focus} — {body.job_title or 'Job Prep'}"

    elif body.context_type == "mock_interview":
        itype_labels = {"hr": "HR Screening", "technical": "Technical Round", "stress": "Stress Interview"}
        itype = body.interview_type or "hr"
        interview_cfg = {
            "interview_type": itype,
            "job_id":         body.job_id,
            "job_title":      body.job_title or "Unknown Role",
            "company":        body.company or "the company",
            "sector":         body.sector or "general",
            "key_skills":     body.key_skills or [],
            "status":         "in_progress",
        }
        title = f"{itype_labels.get(itype, 'Interview')} — {body.job_title or 'Role'}"

    elif body.context_type == "career_coaching":
        title = "Career Coaching Session"

    conv = Conversation(
        user_id=user.id,
        title=title,
        context_type=body.context_type,
        status="active",
        skill_focus=body.skill_focus if body.context_type == "skill_learning" else None,
        job_context=job_ctx,
        interview_config=interview_cfg,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    return ConversationSummary(
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
    )


@router.post("/career-coaching", response_model=ConversationSummary, status_code=201)
def start_career_coaching(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """One-click start a career coaching conversation."""
    conv = Conversation(
        user_id=user.id,
        title="Career Coaching Session",
        context_type="career_coaching",
        status="active",
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ConversationSummary(
        id=str(conv.id),
        title=conv.title,
        context_type=conv.context_type,
        status=conv.status,
        message_count=0,
        skill_focus=None,
        job_context=None,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.get("/conversations/{conv_id}", response_model=ConversationDetail)
def get_conversation(
    conv_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

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


@router.post("/conversations/{conv_id}/messages")
async def send_message(
    conv_id: str,
    body: SendMessageRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Send a message and receive a streamed response via Server-Sent Events."""
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=422, detail="Message content cannot be empty.")

    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if conv.status == "archived":
        raise HTTPException(status_code=400, detail="Cannot send messages to an archived conversation.")

    async def event_stream():
        async for chunk in orchestrator.handle_message(conv, body.content.strip(), user, db):
            # SSE format: each chunk is a data event
            safe_chunk = chunk.replace("\n", "\\n")
            yield f"data: {safe_chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/conversations/{conv_id}", status_code=204)
def delete_conversation(
    conv_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Hard-delete a conversation and all its messages."""
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    db.query(Message).filter(Message.conversation_id == conv_id).delete()
    db.delete(conv)
    db.commit()


@router.put("/conversations/{conv_id}/archive", response_model=ArchiveConversationResponse)
def archive_conversation(
    conv_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    conv.status = "archived"
    db.commit()
    return ArchiveConversationResponse(conversation_id=conv_id, status="archived")


@router.get("/prep-checklist/{job_id}")
def get_prep_checklist(
    job_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """
    Return a prep checklist for a given job showing what the user has done
    and what's still outstanding.
    """
    from sqlalchemy import cast, String
    from app.models.mvp2 import LessonCompletion, Resume as ResumeModel
    from app.models.user import AspirantProfile, JobPosting

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()

    # Mock interview done for this job?
    interview_done = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user.id,
            Conversation.context_type == "mock_interview",
            cast(Conversation.interview_config["job_id"], String) == str(job_id),
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
                "cta": f"/app/mock-interview/{job_id}",
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


@router.get("/nudge")
def get_nudge(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """
    Return a proactive nudge message if the user has been inactive for 5+ days,
    or hasn't done a mock interview / skill session in a while.
    Returns null when no nudge is warranted.
    """
    from datetime import datetime, timezone, timedelta
    from app.models.mvp2 import UserStreak, LessonCompletion

    now = datetime.now(timezone.utc)
    five_days_ago = now - timedelta(days=5)

    # Check last mock interview conversation
    last_interview = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user.id,
            Conversation.context_type == "mock_interview",
        )
        .order_by(Conversation.updated_at.desc())
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

    nudge = None

    def _is_older(dt, threshold):
        if dt is None:
            return True
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt < threshold

    if not last_interview or _is_older(last_interview.updated_at, five_days_ago):
        nudge = {
            "type": "interview",
            "message": "You haven't practiced a mock interview in 5+ days. Even a quick 10-minute session keeps your confidence sharp.",
            "cta": "Start Mock Interview",
            "cta_path": "/app/mock-interview",
        }
    elif last_lesson and _is_older(last_lesson.completed_at, five_days_ago):
        nudge = {
            "type": "learning",
            "message": f"Your learning streak needs attention — your last lesson was over 5 days ago. Keep the momentum going!",
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


@router.get("/memories")
def list_memories(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Return all active memories DISHA has stored about this user."""
    importance_order = case(
        (CounsellorMemory.importance == "critical", 0),
        (CounsellorMemory.importance == "high", 1),
        (CounsellorMemory.importance == "medium", 2),
        else_=3,
    )
    memories = (
        db.query(CounsellorMemory)
        .filter(CounsellorMemory.user_id == user.id, CounsellorMemory.is_active == True)
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


@router.delete("/memories/{memory_id}", status_code=204)
def delete_memory(
    memory_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Soft-delete a memory (user forgets it)."""
    mem = (
        db.query(CounsellorMemory)
        .filter(CounsellorMemory.id == memory_id, CounsellorMemory.user_id == user.id)
        .first()
    )
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found.")
    mem.is_active = False
    db.commit()


@router.get("/conversations/{conv_id}/interview-report")
async def get_interview_report(
    conv_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Generate and return a scorecard for a completed mock interview."""
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if conv.context_type != "mock_interview":
        raise HTTPException(status_code=400, detail="Not a mock interview conversation.")

    from app.modules.counsellor.interview_report import generate_report
    report = await generate_report(conv_id, db)
    return report
