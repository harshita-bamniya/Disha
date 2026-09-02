"""Interview session creation (dynamic question generation, context building)."""
from __future__ import annotations

import logging
import random

from sqlalchemy.orm import Session

from app.models.interview import InterviewSession, QuestionBank
from app.models.user import CareerTrack, User
from app.modules.interview.schemas import (
    CreateSessionRequest,
    QuestionOut,
    SessionDetail,
)
from app.modules.interview.service import core

logger = logging.getLogger(__name__)


_SYNTHETIC_PREFIX = "dyn:"  # prefix in question_text to mark dynamic bank entries


_WEAK_AREA_THRESHOLD = 6   # overall_score below this is a "weak" competency


async def create_session(body: CreateSessionRequest, user: User, db: Session) -> SessionDetail:
    session = InterviewSession(
        user_id=user.id,
        career_track_id=body.career_track_id,
        session_type=body.session_type,
        total_questions=min(body.total_questions, 15),
        status="scheduled",
        job_role=body.job_role,
        experience_level=body.experience_level,
        job_description=body.job_description,
    )
    db.add(session)
    db.flush()

    questions: list[QuestionOut] = []

    if body.job_role:
        # ── Dynamic AI-generated questions ──────────────────────────────────
        questions = await _generate_dynamic_questions(
            session, body, db, user
        )
    else:
        # ── Legacy: static question bank sampling ────────────────────────────
        questions = _sample_from_bank(session, body, db)

    db.commit()

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
    from app.models.user import AspirantProfile, KrsScore, PsychologicalAssessment

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    psych = db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user.id).first()
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

    if psych:
        burnout = "High" if (psych.burnout_score or 0) >= 70 else "Moderate" if (psych.burnout_score or 0) >= 40 else "Low"
        confidence = "High" if (psych.confidence_index or 0) >= 65 else "Low"
        lines.append(f"Psychological state: Burnout={burnout}, Confidence={confidence}")

    return "\n".join(lines) if lines else None


async def _generate_dynamic_questions(
    session: InterviewSession,
    body: CreateSessionRequest,
    db: Session,
    user: User | None = None,
) -> list[QuestionOut]:
    """Generate role-specific questions via AI and persist them to question_banks."""
    from app.ai.dynamic_interview_engine import (
        generate_blueprint,
        generate_questions,
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
    competencies = await resolve_competencies(body.job_role)

    blueprint = await generate_blueprint(
        job_role=body.job_role,
        experience_level=body.experience_level or "Mid-Level",
        job_description=body.job_description,
        total_questions=session.total_questions,
        candidate_context=candidate_context,
        prior_weak_areas=prior_weak,
        competencies=competencies,
    )

    raw_questions = await generate_questions(
        job_role=body.job_role,
        experience_level=body.experience_level or "Mid-Level",
        blueprint=blueprint,
        count=session.total_questions,
        competencies=competencies,
        candidate_context=candidate_context,
    )

    # Persist generated questions into question_banks so FK stays valid
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

        panelist = panelist_for_question_type(q_type)

        bank_entry = QuestionBank(
            question_text=q.get("question_text", "Tell me about yourself."),
            question_type=q_type,
            difficulty=difficulty,
            expected_answer_guide=guide,
            language="en",
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
            language="en",
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
    session.blueprint = {**(blueprint or {}), "_question_ids": generated_ids, "_competencies": competencies}

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

