"""
DISHA AI Counsellor orchestrator.

Assembles full context (user profile + active prep job + memories),
calls the AI provider with streaming, and coordinates the memory and
safety systems.
"""
from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator

from sqlalchemy.orm import Session

from app.models.mvp2 import Conversation, Message, SafetyFlag
from app.models.user import AspirantProfile, JobPosting, KrsScore, User, UserCareerSelection
from app.modules.counsellor import memory as memory_svc
from app.modules.counsellor import safety
from app.ai.prompts.loader import get_prompt

logger = logging.getLogger(__name__)

_ACTIVE_PREP_SECTION = """The user is actively preparing for a specific role — focus advice on this:
Target Role: {job_title} in the {sector} sector
Key skills they have: {skills_have}
Skills they are building: {skills_gap}
When the user asks about interviews, resume, or strategy — relate it to this target role."""


def _score_label(score: int | None) -> str:
    """Convert numeric score to qualitative label — avoids leaking raw numbers to AI."""
    if score is None:
        return "not assessed"
    if score >= 75:
        return "strong"
    if score >= 50:
        return "moderate"
    if score >= 30:
        return "developing"
    return "early stage"


def _build_user_context(user: User, db: Session) -> str:
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    selections = db.query(UserCareerSelection).filter(UserCareerSelection.user_id == user.id).all()

    lines = []
    if profile:
        # Use first name only — not full name/phone/DOB
        first_name = (profile.full_name or "").split()[0] if profile.full_name else "the user"
        lines.append(f"First name: {first_name}")
        years = profile.years_preparing or "?"
        attempts = profile.upsc_attempts or 0
        stage = profile.highest_stage_cleared or "not specified"
        lines.append(f"UPSC journey: {years} years of preparation, {attempts} attempt(s), highest stage: {stage}")
        if profile.optional_subject:
            lines.append(f"Optional subject: {profile.optional_subject}")
        if profile.has_work_experience and profile.work_experience_years:
            lines.append(
                f"Prior work: {profile.work_experience_years} years in "
                f"{profile.work_experience_domain or 'an unspecified field'}"
            )
        if profile.skills:
            lines.append(f"Key skills: {', '.join(profile.skills[:8])}")

    if krs:
        lines.append(
            f"Career readiness assessment — "
            f"Knowledge: {_score_label(krs.k_score)}, "
            f"Readiness: {_score_label(krs.r_score)}, "
            f"Skills match: {_score_label(krs.s_score)}"
        )

    if selections:
        track_names = [sel.track.title for sel in selections if sel.track]
        if track_names:
            lines.append(f"Selected career paths: {', '.join(track_names)}")

    return "\n".join(lines) if lines else "No profile data available yet."


def _build_active_prep_context(user: User, db: Session) -> str:
    """Build the active prep job section for the system prompt, or empty string."""
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    if not profile or not profile.active_prep_job_id:
        return ""

    job = db.query(JobPosting).filter(
        JobPosting.id == profile.active_prep_job_id,
        JobPosting.is_active == True,
    ).first()
    if not job:
        return ""

    required = job.required_skills or []
    user_skills = {s.lower().strip() for s in (profile.skills or [])}
    have = [s for s in required if s.lower().strip() in user_skills]
    gap  = [s for s in required if s.lower().strip() not in user_skills]

    # Get company name
    from app.models.user import EmployerProfile
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()
    company = employer.company_name if employer else "Company"

    return _ACTIVE_PREP_SECTION.format(
        job_title=job.title,
        sector=job.sector or "general",
        skills_have=", ".join(have) if have else "none identified yet",
        skills_gap=", ".join(gap) if gap else "none — great match!",
    )


async def handle_message(
    conversation: Conversation,
    user_message_text: str,
    user: User,
    db: Session,
) -> AsyncIterator[str]:
    """
    Process a user message and stream the assistant response.

    Order of operations:
    1. Safety pre-check (keyword classification)
    2. Store user message + safety flag in DB
    3. Critical severity → yield crisis response, return immediately
    4. Assemble full context (profile + active prep job + memories)
    5. Call AI with streaming
    6. Append mental-health resources addon for medium severity
    7. Store assistant message
    8. Fire memory extraction in background (own DB session — avoids closed-session bug)
    """
    # ── 1. Safety pre-check ──────────────────────────────────────────────────
    assessment = safety.assess(user_message_text)

    # ── 2. Store user message ────────────────────────────────────────────────
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

    # ── 3. Crisis override ───────────────────────────────────────────────────
    if assessment.severity == "critical":
        response_text = safety.CRISIS_RESPONSE
        _store_assistant_message(conversation, response_text, db)
        yield response_text
        return

    # ── 4. Assemble context ──────────────────────────────────────────────────
    recent_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(20)
        .all()
    )
    recent_messages.reverse()

    # Embed the current message for memory retrieval
    query_embedding = None
    try:
        from app.modules.recommendations.embedder import embed
        query_embedding = embed(user_message_text[:512])
    except Exception:
        pass

    relevant_memories = memory_svc.retrieve_relevant_memories(user.id, query_embedding, db)
    user_context = _build_user_context(user, db)
    active_prep_section = _build_active_prep_context(user, db)
    lang = user.preferred_language or "en"

    system_prompt = get_prompt("counsellor_system", db).format(
        user_context=user_context,
        active_prep_section=active_prep_section,
        memories="\n".join(f"- {m}" for m in relevant_memories) if relevant_memories else "No prior memories.",
        language="Hindi (hi)" if lang == "hi" else "English (en)",
    )

    # Build message history (exclude the message we just stored to avoid duplication)
    ai_messages = [
        {"role": m.role, "content": m.content}
        for m in recent_messages
        if m.id != user_msg.id
    ]
    ai_messages.append({"role": "user", "content": user_message_text})

    # ── 5. AI streaming call ─────────────────────────────────────────────────
    full_response = ""
    try:
        from app.ai.providers.groq import GroqProvider
        provider = GroqProvider()

        async for chunk in provider.stream(system_prompt, ai_messages):
            full_response += chunk
            yield chunk

    except Exception as exc:
        logger.error(f"[COUNSELLOR] AI call failed: {exc}")
        fallback = (
            "I'm having a moment — my connection seems unstable. "
            "Could you try again in a moment?"
        )
        full_response = fallback
        yield fallback

    # ── 6. Mental health resources addon ─────────────────────────────────────
    if assessment.severity == "medium":
        addon = safety.MEDIUM_RESOURCES_ADDON
        full_response += addon
        yield addon

    # ── 7. Store assistant response ──────────────────────────────────────────
    _store_assistant_message(conversation, full_response, db)

    # ── 8. Update conversation metadata ─────────────────────────────────────
    conversation.message_count = (conversation.message_count or 0) + 2
    if not conversation.title and user_message_text:
        conversation.title = user_message_text[:60] + ("..." if len(user_message_text) > 60 else "")
    db.commit()

    # ── 9. Memory extraction — background task with its OWN DB session ───────
    # CRITICAL: Do NOT pass the request-scoped `db` session here.
    # By the time the background task runs, that session is closed.
    # We pass only primitive IDs and open a fresh session inside the coroutine.
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
        # No running event loop in some test contexts — skip silently
        pass


def _store_assistant_message(conversation: Conversation, content: str, db: Session) -> Message:
    msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=content,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
