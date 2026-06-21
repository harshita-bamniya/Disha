from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import case
from sqlalchemy.orm import Session

from app.core.rbac import get_current_aspirant
from app.database import get_db
from app.models.mvp2 import Conversation, Message, CounsellorMemory
from app.models.companion import CompanionMoodEntry, CompanionMilestone
from app.models.user import User
from app.modules.companion import orchestrator
from app.modules.companion.schemas import (
    ConversationDetail, ConversationOut, MessageOut, SendMessageRequest,
    MoodEntryOut, CreateMoodEntryRequest,
    MilestoneOut, CreateMilestoneRequest,
    MemoryOut, WeeklyInsight, TimelineEntry,
)

router = APIRouter(prefix="/companion", tags=["Your Companion"])


# ── Welcome back (return-visit greeting, not the full scrollback) ────────────

@router.get("/welcome")
def get_welcome(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """A short personal greeting for returning users — None on a first-ever visit."""
    return {"greeting": orchestrator.build_welcome_back(user, db)}


# ── Conversation (one continuous thread per user) ─────────────────────────────

@router.get("/conversation", response_model=ConversationDetail)
async def get_conversation(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Get or create the user's ongoing companion conversation, with recent history."""
    conv = await orchestrator.get_or_create_active_conversation(user, db)
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at)
        .limit(200)
        .all()
    )
    return ConversationDetail(
        id=str(conv.id),
        title=conv.title,
        message_count=conv.message_count,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[
            MessageOut(
                id=str(m.id), role=m.role, content=m.content,
                safety_flagged=m.safety_flagged, created_at=m.created_at,
            )
            for m in messages
        ],
    )


@router.post("/conversation/messages")
async def send_message(
    body: SendMessageRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Send a message to Your Companion and receive a streamed response (SSE)."""
    if not body.content.strip():
        raise HTTPException(status_code=422, detail="Message content cannot be empty.")

    conv = await orchestrator.get_or_create_active_conversation(user, db)

    async def event_stream():
        async for chunk in orchestrator.handle_message(conv, body.content.strip(), user, db):
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


# ── Mood check-ins / reflection journal ───────────────────────────────────────

@router.post("/mood", response_model=MoodEntryOut, status_code=201)
def create_mood_entry(
    body: CreateMoodEntryRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    entry = CompanionMoodEntry(user_id=user.id, mood=body.mood, note=body.note)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return MoodEntryOut.model_validate(entry)


@router.get("/mood", response_model=list[MoodEntryOut])
def list_mood_entries(
    days: int = 30,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    entries = (
        db.query(CompanionMoodEntry)
        .filter(CompanionMoodEntry.user_id == user.id, CompanionMoodEntry.created_at >= since)
        .order_by(CompanionMoodEntry.created_at.desc())
        .all()
    )
    return [MoodEntryOut.model_validate(e) for e in entries]


# ── Milestones ─────────────────────────────────────────────────────────────────

@router.post("/milestones", response_model=MilestoneOut, status_code=201)
def create_milestone(
    body: CreateMilestoneRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    milestone = CompanionMilestone(
        user_id=user.id, title=body.title, description=body.description, source="user",
    )
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return MilestoneOut.model_validate(milestone)


@router.get("/milestones", response_model=list[MilestoneOut])
def list_milestones(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    milestones = (
        db.query(CompanionMilestone)
        .filter(CompanionMilestone.user_id == user.id)
        .order_by(CompanionMilestone.created_at.desc())
        .all()
    )
    return [MilestoneOut.model_validate(m) for m in milestones]


@router.delete("/milestones/{milestone_id}", status_code=204)
def delete_milestone(
    milestone_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    m = (
        db.query(CompanionMilestone)
        .filter(CompanionMilestone.id == milestone_id, CompanionMilestone.user_id == user.id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found.")
    db.delete(m)
    db.commit()


# ── Memory highlights ──────────────────────────────────────────────────────────

@router.get("/memories", response_model=list[MemoryOut])
def list_memories(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Everything Your Companion remembers about this user (shared with the counsellor)."""
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
        .limit(50)
        .all()
    )
    return [
        MemoryOut(
            id=str(m.id),
            memory_type=m.memory_type,
            content=m.content,
            importance=m.importance,
            created_at=m.created_at.isoformat() if m.created_at else None,
        )
        for m in memories
    ]


@router.delete("/memories/{memory_id}", status_code=204)
def delete_memory(
    memory_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    mem = (
        db.query(CounsellorMemory)
        .filter(CounsellorMemory.id == memory_id, CounsellorMemory.user_id == user.id)
        .first()
    )
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found.")
    mem.is_active = False
    db.commit()


# ── Journey timeline (mood entries + milestones, merged chronologically) ──────

@router.get("/timeline", response_model=list[TimelineEntry])
def get_timeline(
    days: int = 60,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    moods = (
        db.query(CompanionMoodEntry)
        .filter(CompanionMoodEntry.user_id == user.id, CompanionMoodEntry.created_at >= since)
        .all()
    )
    milestones = (
        db.query(CompanionMilestone)
        .filter(CompanionMilestone.user_id == user.id, CompanionMilestone.created_at >= since)
        .all()
    )
    entries = [
        TimelineEntry(type="mood", date=m.created_at, mood=m.mood, note=m.note)
        for m in moods
    ] + [
        TimelineEntry(type="milestone", date=m.created_at, title=m.title, description=m.description)
        for m in milestones
    ]
    entries.sort(key=lambda e: e.date, reverse=True)
    return entries


# ── Weekly emotional insights ──────────────────────────────────────────────────

@router.get("/insights", response_model=WeeklyInsight)
def get_weekly_insights(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=7)
    entries = (
        db.query(CompanionMoodEntry)
        .filter(CompanionMoodEntry.user_id == user.id, CompanionMoodEntry.created_at >= since)
        .order_by(CompanionMoodEntry.created_at.desc())
        .all()
    )

    mood_counts: dict[str, int] = {}
    for e in entries:
        mood_counts[e.mood] = mood_counts.get(e.mood, 0) + 1
    dominant_mood = max(mood_counts, key=mood_counts.get) if mood_counts else None

    # Streak: consecutive days (from today backwards) with at least one check-in
    streak = 0
    day_cursor = datetime.now(timezone.utc).date()
    all_entries = (
        db.query(CompanionMoodEntry)
        .filter(CompanionMoodEntry.user_id == user.id)
        .order_by(CompanionMoodEntry.created_at.desc())
        .all()
    )
    check_in_days = {e.created_at.date() for e in all_entries}
    while day_cursor in check_in_days:
        streak += 1
        day_cursor -= timedelta(days=1)

    latest_milestone_row = (
        db.query(CompanionMilestone)
        .filter(CompanionMilestone.user_id == user.id)
        .order_by(CompanionMilestone.created_at.desc())
        .first()
    )

    return WeeklyInsight(
        mood_counts=mood_counts,
        dominant_mood=dominant_mood,
        check_in_count=len(entries),
        check_in_streak=streak,
        latest_milestone=MilestoneOut.model_validate(latest_milestone_row) if latest_milestone_row else None,
    )
