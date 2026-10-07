"""Interview session creation (dynamic question generation, context building)."""
from __future__ import annotations

import logging
import random

from sqlalchemy.orm import Session

from app.ai.usage import interview_context
from app.models.interview import InterviewSession, QuestionBank
from app.models.user import CareerTrack, User
from app.modules.interview.schemas import (
    CreateSessionRequest,
    QuestionOut,
    SessionDetail,
)
from app.modules.interview import transition
from app.modules.interview.service import core

logger = logging.getLogger(__name__)


_SYNTHETIC_PREFIX = "dyn:"  # prefix in question_text to mark dynamic bank entries


_WEAK_AREA_THRESHOLD = 6   # overall_score below this is a "weak" competency


# Skill name (and relative weight) the employer's own questions are scored under.
EMPLOYER_SKILL = "Employer-specific questions"
EMPLOYER_WEIGHT = 15


async def create_session(
    body: CreateSessionRequest, user: User, db: Session, plan: dict | None = None,
) -> SessionDetail:
    """plan (verified interviews only): {"competencies": [...], "custom_questions": [...]} from the
    employer's template. It replaces the generated competency matrix and adds the employer's questions."""
    session = InterviewSession(
        user_id=user.id,
        career_track_id=body.career_track_id,
        session_type=body.session_type,
        total_questions=min(body.total_questions, 15),
        status="scheduled",
        job_role=body.job_role,
        experience_level=body.experience_level,
        job_description=body.job_description,
        language=body.language,
    )
    db.add(session)
    # Committed (not just flushed) so model_runs rows logged from a separate
    # DB connection during generation can reference this session.
    db.commit()

    questions: list[QuestionOut] = []

    try:
        with interview_context(str(session.id)):
            if body.job_role:
                # ── Dynamic AI-generated questions ──────────────────────────
                questions = await _generate_dynamic_questions(
                    session, body, db, user, plan
                )
            else:
                # ── Legacy: static question bank sampling ───────────────────
                questions = _sample_from_bank(session, body, db)
        db.commit()
    except Exception:
        db.rollback()
        # Don't leave a question-less session behind.
        from app.modules.interview.service.sessions import discard_session
        discard_session(str(session.id), user, db)
        raise

    track_name = None
    if body.career_track_id:
        track = db.query(CareerTrack).filter(CareerTrack.id == body.career_track_id).first()
        track_name = track.title if track else None

    return SessionDetail(
        id=str(session.id),
        career_track_name=track_name,
        session_type=session.session_type,
        status=session.status,
        total_questions=session.total_questions,
        responses_count=0,
        avg_score=None,
        started_at=None,
        completed_at=None,
        created_at=session.created_at,
        job_role=session.job_role,
        experience_level=session.experience_level,
        blueprint=session.blueprint,
        language=session.language,
        questions=questions,
        responses=[],
    )


def _build_resume_context(user: User, db: Session) -> str | None:
    """Pull named specifics (projects, employers, tools) out of the candidate's
    primary resume, if one exists, so the interviewer can reference real things
    instead of only generic UPSC-prep background.
    """
    from app.models.resume import Resume, ResumeSection

    resume = (
        db.query(Resume)
        .filter(Resume.user_id == user.id, Resume.deleted_at == None)
        .order_by(Resume.is_primary.desc(), Resume.updated_at.desc())
        .first()
    )
    if not resume:
        return None

    sections = {
        s.section_type: (s.content or {})
        for s in db.query(ResumeSection).filter(ResumeSection.resume_id == resume.id).all()
    }

    lines = []

    experience_items = (sections.get("experience") or {}).get("items", [])[:3]
    for item in experience_items:
        title = item.get("title")
        company = item.get("company")
        if title or company:
            bullet = (item.get("bullets") or [""])[0]
            lines.append(f"Worked as {title or 'a professional'} at {company or 'an unnamed employer'}. {bullet}".strip())

    project_items = (sections.get("projects") or {}).get("items", [])[:3]
    for item in project_items:
        name = item.get("name")
        if not name:
            continue
        tech = ", ".join(item.get("tech") or [])
        bullet = (item.get("bullets") or [""])[0]
        tech_note = f" (using {tech})" if tech else ""
        lines.append(f"Built a project called \"{name}\"{tech_note}. {bullet}".strip())

    skills_block = sections.get("skills") or {}
    all_skills = [
        *(skills_block.get("technical") or []),
        *(skills_block.get("tools") or []),
        *(skills_block.get("domain") or []),
    ]
    if all_skills:
        lines.append(f"Resume skills: {', '.join(all_skills[:15])}")

    if not lines:
        return None
    return "Resume highlights:\n" + "\n".join(f"- {line}" for line in lines)


def _build_candidate_context(user: User, db: Session) -> str | None:
    """Build a concise candidate background string for interview calibration."""
    # Deliberately no PsychologicalAssessment here: counselling data never
    # reaches the interview prompts. Only the one-way tone flag does (see
    # counsellor.interview_tone).
    from app.models.user import AspirantProfile, KrsScore

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    resume_context = _build_resume_context(user, db)

    if not profile and not krs and not resume_context:
        return None

    lines = []
    if resume_context:
        lines.append(resume_context)
    if profile:
        years = profile.years_preparing or 0
        attempts = profile.upsc_attempts or 0
        stage = profile.highest_stage_cleared or "not specified"
        exam = profile.upsc_exam or "UPSC"
        lines.append(f"UPSC journey: {exam.upper()}, {years} year(s) preparation, {attempts} attempt(s), highest stage: {stage}")
        if profile.optional_subject:
            lines.append(f"Optional subject: {profile.optional_subject}")
        if profile.preferred_sectors:
            lines.append(f"Target sectors: {', '.join(profile.preferred_sectors[:3])}")
        if profile.has_work_experience and profile.work_experience_years:
            lines.append(f"Prior work: {profile.work_experience_years} year(s) in {profile.work_experience_domain or 'unspecified field'}")
        else:
            lines.append("Prior work: No work experience (direct UPSC candidate)")
        if profile.skills:
            lines.append(f"Key skills: {', '.join(profile.skills[:6])}")

    if krs:
        def _label(s):
            if s is None: return "not assessed"
            return "Strong" if s >= 75 else "Moderate" if s >= 50 else "Developing"
        lines.append(
            f"Career readiness — Knowledge: {_label(krs.k_score)} ({krs.k_score}/100), "
            f"Readiness: {_label(krs.r_score)} ({krs.r_score}/100), "
            f"Skills match: {_label(krs.s_score)} ({krs.s_score}/100)"
        )

    return "\n".join(lines) if lines else None


async def _generate_dynamic_questions(
    session: InterviewSession,
    body: CreateSessionRequest,
    db: Session,
    user: User | None = None,
    plan: dict | None = None,
) -> list[QuestionOut]:
    """Generate role-specific questions via AI and persist them to question_banks."""
    from app.ai.dynamic_interview_engine import (
        generate_blueprint,
        generate_questions,
        is_technical_breakdown,
        panelist_for_question_type,
        resolve_competencies,
    )

    candidate_context = _build_candidate_context(user, db) if user else None

    # Inject weak competency areas from prior sessions so the AI allocates
    # more questions there (improving weaker areas first).
    prior_weak = core._weakest_skills(str(user.id), db) if user else []

    # Resolved once and reused for blueprint + questions + (later) the readiness
    # report, so a free-typed role not in the fixed taxonomy gets one consistent
    # LLM-generated competency matrix instead of drifting between calls.
    custom_questions = list((plan or {}).get("custom_questions") or [])
    competencies = list(plan["competencies"]) if plan else await resolve_competencies(body.job_role)

    from app.modules.counsellor.interview_tone import interview_tone
    tone = interview_tone(user.id, db) if user else "standard"

    blueprint = await generate_blueprint(
        job_role=body.job_role,
        experience_level=body.experience_level or "Mid-Level",
        job_description=body.job_description,
        total_questions=session.total_questions,
        candidate_context=candidate_context,
        prior_weak_areas=prior_weak,
        competencies=competencies,
        tone=tone,
        language=body.language,
        session_type=body.session_type,
    )

    raw_questions = await generate_questions(
        job_role=body.job_role,
        experience_level=body.experience_level or "Mid-Level",
        blueprint=blueprint,
        # The first slot is the career-transition question and the employer's own questions take theirs.
        count=max(1, session.total_questions - 1 - len(custom_questions)) if plan else session.total_questions,
        competencies=competencies,
        candidate_context=candidate_context,
        language=body.language,
    )
    for text in custom_questions:
        raw_questions.append({
            "question_text": text, "question_type": "situational", "difficulty": "medium",
            "skill_assessed": EMPLOYER_SKILL, "expected_answer_hints": "",
        })

    # Persist generated questions into question_banks so FK stays valid
    is_technical_role = is_technical_breakdown(blueprint.get("question_breakdown"))
    question_outs: list[QuestionOut] = []
    for q in raw_questions:
        q_type = q.get("question_type", "behavioral")
        # Normalize to allowed values — must match ck_question_type exactly.
        # "system_design" was missing here despite _QUESTIONS_SYSTEM explicitly
        # asking the LLM for it: every system-design question was silently
        # relabeled "behavioral" and misrouted to the wrong panelist persona.
        if q_type not in ("behavioral", "situational", "technical", "hr", "case", "system_design"):
            q_type = "behavioral"
        difficulty = q.get("difficulty", "medium")
        if difficulty not in ("easy", "medium", "hard"):
            difficulty = "medium"

        skill_name = q.get("skill_assessed", "")
        # Embed skill_assessed in expected_answer_guide with a parseable prefix
        guide = f"[SKILL:{skill_name}] " + (q.get("expected_answer_hints") or "") if skill_name else q.get("expected_answer_hints")

        panelist = panelist_for_question_type(q_type, is_technical_role)

        bank_entry = QuestionBank(
            question_text=q.get("question_text", "Tell me about yourself."),
            question_type=q_type,
            difficulty=difficulty,
            expected_answer_guide=guide,
            language=body.language,
            is_active=True,
            career_track_id=None,
            panelist_name=panelist["name"] if panelist else None,
            panelist_role=panelist["role"] if panelist else None,
        )
        db.add(bank_entry)
        db.flush()

        question_outs.append(QuestionOut(
            id=str(bank_entry.id),
            question_text=bank_entry.question_text,
            question_type=q_type,
            difficulty=difficulty,
            language=body.language,
            career_track_id=None,
            skill_assessed=skill_name or None,
            is_dynamic=True,
            panelist_name=bank_entry.panelist_name,
            panelist_role=bank_entry.panelist_role,
        ))

    # Store blueprint + generated question IDs + resolved competencies on the
    # session so process_response can scope to them and the readiness report
    # later uses the exact same competency matrix these questions were built from.
    generated_ids = [str(q.id) for q in question_outs]
    # The first question is always the career-transition story, in the
    # interview's language. It replaces the generic ice-breaker and is scored
    # on its own rubric as one more competency.
    transition_q = transition.question(body.language, body.job_role)
    session.blueprint = {
        **(blueprint or {}),
        "ice_breaker_question": transition_q,
        "_transition_question": transition_q,
        "_question_ids": generated_ids,
        "_competencies": transition.with_competency(
            [*competencies, {"skill": EMPLOYER_SKILL, "weight": EMPLOYER_WEIGHT}] if custom_questions else competencies
        ),
        "_tone": tone,
    }

    # Measures the setup wizard's "adding a JD makes this 3x more targeted"
    # claim per-session instead of just asserting it in the copy.
    if body.job_description:
        jd_metric = core._jd_specificity(body.job_description, raw_questions)
        session.blueprint["_jd_specificity"] = jd_metric
        logger.info("[INTERVIEW] JD specificity for session=%s: %s", session.id, jd_metric)

    return question_outs


def _sample_from_bank(
    session: InterviewSession,
    body: CreateSessionRequest,
    db: Session,
) -> list[QuestionOut]:
    q = db.query(QuestionBank).filter(QuestionBank.is_active == True)
    if body.career_track_id:
        q = q.filter(
            (QuestionBank.career_track_id == body.career_track_id) |
            (QuestionBank.career_track_id == None)
        )
    if body.difficulty:
        q = q.filter(QuestionBank.difficulty == body.difficulty)

    all_questions = q.all()
    selected = random.sample(all_questions, min(session.total_questions, len(all_questions)))

    return [
        QuestionOut(
            id=str(q.id),
            question_text=q.question_text,
            question_type=q.question_type,
            difficulty=q.difficulty,
            language=q.language or "en",
            career_track_id=str(q.career_track_id) if q.career_track_id else None,
        )
        for q in selected
    ]

