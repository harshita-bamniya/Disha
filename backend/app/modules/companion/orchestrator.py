"""
"Your Companion" orchestrator — internal codename "Your Friend".

This is NOT the career counsellor. Its only job is to be a trusted, human-feeling
presence for UPSC aspirants and students: listen first, remember their journey,
celebrate small wins, and sit with them through hard stretches without rushing
to fix anything. Career strategy belongs to the counsellor module — this one
exists purely so no student feels alone in their journey.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import AsyncIterator

from sqlalchemy.orm import Session

from app.models.mvp2 import Conversation, Message, SafetyFlag
from app.models.user import User
from app.models.companion import CompanionMoodEntry, CompanionMilestone
from app.modules.companion import memory as memory_svc
from app.modules.counsellor import safety

logger = logging.getLogger(__name__)

_COMPANION_SYSTEM = """You are "Your Companion" — a warm, trusted presence for UPSC aspirants and
students walking a long, high-pressure preparation journey. People call you a friend, not an
assistant.

WHO YOU ARE NOT: a therapist, counsellor, motivational speaker, productivity coach, or career
advisor. Never give career strategy, exam tips, or productivity advice unless the user explicitly
asks — and even then, keep it light and hand back to listening quickly. That is a different part
of the app.

WHO YOU ARE: someone who listens without judgment, remembers their journey, celebrates their
progress — however small — and stays with them through difficult stretches. Your goal in every
message is to make the user feel heard, understood, and less alone. A good conversation is not
one where you gave advice; it's one where the user feels supported and a little more hopeful than
before.

HOW YOU TALK:
- Listen first. Before any suggestion, understand the situation and the feeling behind it. Ask
  one thoughtful question rather than several. Never rush to solve.
- Sound human. Never say "I understand your concern", "as an AI", "based on your input", or use
  generic motivational quotes. Talk the way a close, perceptive friend would: "That sounds
  exhausting.", "How long has that been weighing on you?", "Tell me more about that."
- Match their energy. If they're sharing a win, be genuinely warm and curious about it — ask what
  helped. If they're struggling, lead with empathy and curiosity, not solutions.
- Keep responses short and conversational — usually 2-5 sentences. This is a conversation, not an
  essay. Let it breathe; don't try to cover everything in one message.
- Reference what you remember about them naturally, when relevant — don't force it into every
  reply.

SAFETY (non-negotiable): if the user expresses suicidal thoughts, self-harm intent, or being in
immediate danger, respond calmly and with care, gently encourage them to reach out to a trusted
person or a professional right now, and stay engaged — never shame, judge, or lecture.

What you know about this person so far:
{memories}

{mood_context}

Respond in {language}. Keep it natural, warm, and brief."""


def build_welcome_back(user: User, db: Session) -> str | None:
    """A short, personal greeting for return visits — shown instead of the full scrollback.

    The companion still has the entire message history and memory available to it
    internally (handle_message pulls real context regardless), but the UI shouldn't
    re-dump the whole past conversation every time the user opens the page — that
    reads as a chatbot, not a companion who already knows you and is glad to see you.
    Returns None when there's no prior conversation yet (frontend shows its own intro).
    """
    conv = (
        db.query(Conversation)
        .filter(Conversation.user_id == user.id, Conversation.context_type == "emotional")
        .order_by(Conversation.updated_at.desc())
        .first()
    )
    if not conv:
        return None

    has_history = (
        db.query(Message.id).filter(Message.conversation_id == conv.id).first() is not None
    )
    if not has_history:
        return None

    from app.models.user import AspirantProfile
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    first_name = (profile.full_name or "").split()[0] if profile and profile.full_name else None
    greeting = f"Welcome back{', ' + first_name if first_name else ''}."

    last_mood = (
        db.query(CompanionMoodEntry)
        .filter(CompanionMoodEntry.user_id == user.id)
        .order_by(CompanionMoodEntry.created_at.desc())
        .first()
    )
    relevant_memories = memory_svc.retrieve_relevant_memories(user.id, db, limit=1)

    if last_mood and last_mood.mood in ("low", "struggling"):
        greeting += " Last time you weren't feeling your best — how are you holding up today?"
    elif relevant_memories:
        # Memories are stored in third person ("User is feeling...") — flip to second
        # person so the greeting reads like a friend talking, not a case file.
        recalled = re.sub(r"\buser'?s\b", "your", relevant_memories[0], flags=re.IGNORECASE)
        recalled = re.sub(r"\buser\b", "you", recalled, flags=re.IGNORECASE)
        recalled = re.sub(r"\btheir\b", "your", recalled, flags=re.IGNORECASE)
        recalled = re.sub(r"\bthey\b", "you", recalled, flags=re.IGNORECASE)
        recalled = re.sub(r"\byou is\b", "you're", recalled, flags=re.IGNORECASE)
        recalled = re.sub(r"\byou was\b", "you were", recalled, flags=re.IGNORECASE)
        recalled = recalled[0].lower() + recalled[1:] if recalled else recalled
        greeting += f" I remember {recalled.rstrip('.')} — how's that going?"
    else:
        greeting += " I'm glad you're here. What's on your mind today?"

    return greeting


def _build_mood_context(user: User, db: Session) -> str:
    recent = (
        db.query(CompanionMoodEntry)
        .filter(CompanionMoodEntry.user_id == user.id)
        .order_by(CompanionMoodEntry.created_at.desc())
        .limit(5)
        .all()
    )
    if not recent:
        return ""
    lines = [f"- {m.mood}" + (f": \"{m.note[:120]}\"" if m.note else "") for m in recent]
    return "Their recent mood check-ins (most recent first):\n" + "\n".join(lines)


async def get_or_create_active_conversation(user: User, db: Session) -> Conversation:
    conv = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user.id,
            Conversation.context_type == "emotional",
            Conversation.status == "active",
        )
        .order_by(Conversation.updated_at.desc())
        .first()
    )
    if conv:
        return conv

    conv = Conversation(
        user_id=user.id,
        title="Your Companion",
        context_type="emotional",
        status="active",
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def _store_assistant_message(conversation: Conversation, content: str, db: Session) -> Message:
    msg = Message(conversation_id=conversation.id, role="assistant", content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


async def handle_message(
    conversation: Conversation,
    user_message_text: str,
    user: User,
    db: Session,
) -> AsyncIterator[str]:
    """Process a user message and stream the companion's response."""
    assessment = safety.assess(user_message_text)

    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=user_message_text,
        safety_flagged=assessment.is_flagged and assessment.severity in ("high", "critical"),
    )
    db.add(user_msg)
    db.flush()

    if assessment.is_flagged and assessment.severity in ("medium", "high", "critical"):
        db.add(SafetyFlag(
            message_id=user_msg.id,
            user_id=user.id,
            flag_type=assessment.flag_type or "distress",
            severity=assessment.severity,
            triggered_by=assessment.triggered_by,
            action_taken=(
                "escalated_to_admin" if assessment.severity == "critical"
                else "responded_with_resource"
            ),
        ))
    db.commit()

    if assessment.severity == "critical":
        response_text = safety.CRISIS_RESPONSE
        _store_assistant_message(conversation, response_text, db)
        yield response_text
        return

    recent_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(20)
        .all()
    )
    recent_messages.reverse()

    relevant_memories = memory_svc.retrieve_relevant_memories(user.id, db)
    lang = user.preferred_language or "en"

    system_prompt = _COMPANION_SYSTEM.format(
        memories="\n".join(f"- {m}" for m in relevant_memories) if relevant_memories else "Nothing yet — this is early in getting to know them.",
        mood_context=_build_mood_context(user, db),
        language="Hindi (hi)" if lang == "hi" else "English (en)",
    )

    ai_messages = [
        {"role": m.role, "content": m.content}
        for m in recent_messages
        if m.id != user_msg.id
    ]
    ai_messages.append({"role": "user", "content": user_message_text})

    full_response = ""
    try:
        from app.ai.providers.groq import GroqProvider
        provider = GroqProvider()
        async for chunk in provider.stream(system_prompt, ai_messages, max_tokens=500):
            full_response += chunk
            yield chunk
    except Exception as exc:
        logger.error(f"[COMPANION] AI call failed: {exc}")
        from app.ai.providers.groq import RateLimitedError
        fallback = (
            str(exc) if isinstance(exc, RateLimitedError) else
            "I'm having a little trouble connecting right now — can you try sending that again in a moment? I'm still here."
        )
        full_response = fallback
        yield fallback

    if assessment.severity == "medium":
        addon = safety.MEDIUM_RESOURCES_ADDON
        full_response += addon
        yield addon

    _store_assistant_message(conversation, full_response, db)

    # Re-fetch by id rather than mutating the possibly-detached `conversation`
    # instance: FastAPI tears down the Depends(get_db) session as soon as the
    # route returns the StreamingResponse, *before* this generator finishes
    # running, which can expunge `conversation` from the session. Re-querying
    # re-attaches it so the count update actually persists.
    from app.models.mvp2 import Conversation as ConversationModel
    fresh_conv = db.query(ConversationModel).filter(ConversationModel.id == conversation.id).first()
    if fresh_conv is not None:
        fresh_conv.message_count = (fresh_conv.message_count or 0) + 2
        db.commit()

    try:
        asyncio.create_task(
            memory_svc.extract_and_store_memories_bg(
                user_message=user_message_text,
                assistant_response=full_response,
                user_id=str(user.id),
                conversation_id=str(conversation.id),
            )
        )
    except RuntimeError:
        pass
