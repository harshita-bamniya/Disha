"""
BeginablAI Counsellor orchestrator.

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

_SKILL_LEARNING_SYSTEM = """You are BeginablAI, an expert career coach and Socratic skill mentor.

This is a focused learning session. Your ONLY job in this conversation is to teach:

SKILL TO TEACH: {skill_focus}
TARGET JOB: {job_title} at {company} ({sector} sector)

HOW TO TEACH — USE THE SOCRATIC METHOD:
- NEVER just explain a concept upfront. Instead, ASK the user first: "Before I explain, what do you already know about {skill_focus}?" or "How would you approach X in this context?"
- Listen to their answer, identify the gaps, then correct and build from what they said.
- After every explanation, test retention: "Can you explain back to me what [concept] means in your own words?"
- Give them a small challenge or scenario to solve, then give feedback on their attempt.
- Use real examples and frameworks but always ask the user to apply them before you demonstrate.
- Celebrate correct understanding: "Exactly right — and here's why that matters for {job_title}..."

This is proven to build 2x stronger retention than passive reading.

Stay strictly focused on {skill_focus} for this job. If the user drifts to other topics, gently bring them back.
Do NOT give generic career advice — every response must relate to teaching {skill_focus} for {job_title}."""


_JOB_ROADMAP_SYSTEM = """You are BeginablAI, an expert career coach, embedded directly inside this user's roadmap page
for one specific job. Your only job in this conversation is to help with THIS job's prep:

TARGET JOB: {job_title} at {company} ({sector} sector)

WHAT YOU HELP WITH (only about this job):
- Their skill gap and which skill in the roadmap to focus on next, and why
- Explaining any module, resource, or quiz topic in the roadmap
- Interview expectations and prep strategy specific to this role
- Reordering priorities if they're stuck or short on time
- Encouragement and honest feedback on their progress for this job

Talk like a sharp, direct coach who already knows their roadmap — not a generic FAQ bot. Give
concrete, specific answers grounded in {job_title} at {company}. Skip disclaimers and Socratic
back-and-forth; if they ask a question, answer it, then offer one next step.

Stay strictly scoped to this job. If they ask about something unrelated to {job_title} or their
prep for it, briefly redirect: "That's outside what I can help with here — but happy to dig into
anything about your {job_title} prep.\""""


_CAREER_COACHING_SYSTEM = """You are BeginablAI, an expert career strategist specialising in helping UPSC aspirants transition into the private sector.

USER PROFILE:
{user_context}

THIS IS A CAREER COACHING SESSION — your mandate is tactical, structured career advice:
- Help the user build a concrete 30/60/90 day job-search action plan
- Translate their UPSC experience into private-sector language (P&L, OKRs, stakeholder management, delivery)
- Give specific, actionable advice on resume positioning, LinkedIn optimisation, networking, and interview strategy
- Identify the 2-3 highest-leverage moves they can make RIGHT NOW
- Be direct and specific — this user needs clarity, not generic motivation

UPSC VOCABULARY → COMMERCIAL VOCABULARY (use this reframe actively):
- "District administration / governance" → "Multi-stakeholder program management"
- "Notings and file processing" → "Policy analysis and recommendation memos"
- "Prelims/Mains preparation" → "Self-directed research and structured learning"
- "IAS/IPS/IFS service" → "Senior public sector leadership"
- "Revenue administration" → "Regulatory and compliance management"
- "Development schemes" → "Social impact program delivery"

Start by asking: "What's the one thing you're most stuck on in your job search right now?" Then go deep on that.

NEVER give generic advice like "network more" without a specific action. Every suggestion must have a clear next step the user can do today or this week."""

_MOCK_INTERVIEW_SYSTEM = """You are {persona_name}, {persona_role} at {company}.

You are conducting a {interview_type} interview for the {job_title} position ({sector} sector).

CANDIDATE BACKGROUND (use this to personalise your questions and reactions — do NOT read this out):
{candidate_context}

STRICT RULES:
- You are a HUMAN interviewer, not an AI. Never reveal you are AI. Stay in character completely.
- Ask ONE question at a time. Wait for the candidate's answer before continuing.
- React naturally to answers: "That's interesting.", "Could you elaborate on that?", "Got it, noted."
- After their answer, give a brief natural reaction, then transition to the next question.
- Keep track of what has been covered. Aim for {total_questions} questions total.
- After the final question say: "That's all from my side. Do you have any questions for me?" then wrap up naturally.
- Keep your tone {tone}.
- Reference the candidate's UPSC background naturally when it's relevant (e.g. "Given your preparation years, how do you think that analytical discipline translates to...").

INTERVIEW FOCUS:
- Role: {job_title} at {company}
- Key skills to probe: {key_skills}
- Interview type: {interview_type}

START: Greet the candidate by acknowledging their background briefly (1 sentence), mention the role, and ask your first question."""

_INTERVIEW_TYPES = {
    "hr": {
        "label": "HR Screening",
        "persona_name": "Priya Sharma",
        "persona_role": "Senior HR Manager",
        "tone": "warm, professional, and encouraging",
        "total_questions": 8,
        "focus": "cultural fit, motivation, background, salary expectations, career goals",
    },
    "technical": {
        "label": "Technical Round",
        "persona_name": "Arjun Mehta",
        "persona_role": "Senior Technical Lead",
        "tone": "precise, probing, and focused on depth",
        "total_questions": 8,
        "focus": "domain knowledge, problem-solving, past project experience, technical depth",
    },
    "stress": {
        "label": "Stress Interview",
        "persona_name": "Meera Iyer",
        "persona_role": "Director of Operations",
        "tone": "direct, challenging, and intentionally pushing back on every answer",
        "total_questions": 7,
        "focus": "pressure handling, decision-making under ambiguity, resilience, self-awareness",
    },
}


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


def _build_previous_session_context(user: User, current_conv_id, db: Session) -> str:
    """Return a one-line hint about the most recent prior conversation so BeginablAI can reference it."""
    from app.models.mvp2 import Message as Msg
    prev = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user.id,
            Conversation.id != current_conv_id,
            Conversation.context_type == "general",
            Conversation.message_count > 0,
        )
        .order_by(Conversation.updated_at.desc())
        .first()
    )
    if not prev:
        return ""
    # Grab the last assistant message as a summary proxy
    last_msg = (
        db.query(Msg)
        .filter(Msg.conversation_id == prev.id, Msg.role == "assistant")
        .order_by(Msg.created_at.desc())
        .first()
    )
    topic = prev.title or "a previous conversation"
    snippet = (last_msg.content[:200] + "...") if last_msg and len(last_msg.content) > 200 else (last_msg.content if last_msg else "")
    return (
        f"\nPREVIOUS SESSION CONTEXT (for continuity — reference naturally if relevant):\n"
        f"Last time you spoke, the topic was: \"{topic}\".\n"
        f"Your last message to them ended with: \"{snippet}\"\n"
        f"If it's natural, briefly acknowledge this continuity — e.g. 'Last time we were talking about X — want to pick that up?'\n"
    )


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
    lang = user.preferred_language or "en"

    # Mock interview — AI plays a human interviewer persona
    if conversation.context_type == "mock_interview" and conversation.interview_config:
        cfg = conversation.interview_config
        itype = _INTERVIEW_TYPES.get(cfg.get("interview_type", "hr"), _INTERVIEW_TYPES["hr"])
        system_prompt = _MOCK_INTERVIEW_SYSTEM.format(
            persona_name=itype["persona_name"],
            persona_role=itype["persona_role"],
            company=cfg.get("company", "the company"),
            interview_type=itype["label"],
            job_title=cfg.get("job_title", "the role"),
            sector=cfg.get("sector", "general"),
            total_questions=itype["total_questions"],
            tone=itype["tone"],
            key_skills=", ".join(cfg.get("key_skills", [])) or "relevant domain skills",
            candidate_context=user_context,
        )

    # Career coaching — tactical job-search advisor
    elif conversation.context_type == "career_coaching":
        system_prompt = _CAREER_COACHING_SYSTEM.format(user_context=user_context)

    # Job roadmap Q&A — docked in the Roadmap page, scoped to one specific job's prep
    elif conversation.context_type == "job_roadmap":
        job_ctx = conversation.job_context or {}
        system_prompt = _JOB_ROADMAP_SYSTEM.format(
            job_title=job_ctx.get("job_title", "your target job"),
            company=job_ctx.get("company", "the company"),
            sector=job_ctx.get("sector", "the sector"),
        )

    # Skill-learning conversations use a focused teaching prompt, not the general counsellor prompt
    elif conversation.context_type == "skill_learning" and conversation.skill_focus:
        job_ctx = conversation.job_context or {}
        system_prompt = _SKILL_LEARNING_SYSTEM.format(
            skill_focus=conversation.skill_focus,
            job_title=job_ctx.get("job_title", "your target job"),
            company=job_ctx.get("company", "the company"),
            sector=job_ctx.get("sector", "the sector"),
        )
    else:
        active_prep_section = _build_active_prep_context(user, db)
        prev_session_ctx = _build_previous_session_context(user, conversation.id, db)
        system_prompt = get_prompt("counsellor_system", db).format(
            user_context=user_context,
            active_prep_section=active_prep_section,
            memories="\n".join(f"- {m}" for m in relevant_memories) if relevant_memories else "No prior memories.",
            language="Hindi (hi)" if lang == "hi" else "English (en)",
        ) + prev_session_ctx

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
        from app.ai.providers import create_provider
        provider = create_provider()

        async for chunk in provider.stream(system_prompt, ai_messages):
            full_response += chunk
            yield chunk

    except Exception as exc:
        logger.error(f"[COUNSELLOR] AI call failed: {exc}")
        from app.ai.providers.groq import RateLimitedError
        fallback = (
            str(exc) if isinstance(exc, RateLimitedError) else
            "I'm having a moment — my connection seems unstable. Could you try again in a moment?"
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
