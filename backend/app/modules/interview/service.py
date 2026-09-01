"""Mock Interview Engine service — Module 07 (Production AI Interview Platform)."""
from __future__ import annotations

import logging
import random
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.interview import InterviewFeedback, InterviewOutcome, InterviewSession, QuestionBank, SessionResponse
from app.models.user import CareerTrack, User
from app.modules.interview import feedback_ai
from app.modules.interview.schemas import (
    CreateSessionRequest, FeedbackOut, JobReadinessReport,
    PerformanceResponse, QuestionOut, SessionDetail, SessionFeedbackResponse,
    SessionSummary, SubmitResponseRequest, SubmittedResponseOut,
)

logger = logging.getLogger(__name__)

_SYNTHETIC_PREFIX = "dyn:"  # prefix in question_text to mark dynamic bank entries

_WEAK_AREA_THRESHOLD = 6   # overall_score below this is a "weak" competency


def _extract_skill(guide: str | None) -> str | None:
    """Pulls the skill tag out of a "[SKILL:name] ..." expected_answer_guide."""
    guide = guide or ""
    if guide.startswith("[SKILL:"):
        end = guide.index("]")
        return guide[7:end].strip() or None
    return None


def _recent_history(session: InterviewSession, exclude_response_id: str, limit: int = 3) -> str:
    """Format the last few prior Q&A turns in this session as plain text, for
    feeding into the follow-up decision as rolling conversation context.
    Excludes the response currently being decided on. Returns "" if there's
    nothing prior (e.g. this is the first question).
    """
    prior = [r for r in session.responses if str(r.id) != exclude_response_id]
    prior = sorted(prior, key=lambda r: r.sequence_num)[-limit:]

    blocks = []
    for r in prior:
        q_text = r.question.question_text if r.question else (r.dynamic_question_text or "")
        a_text = (r.response_text or "")[:150]
        if q_text:
            blocks.append(f"Q: {q_text}\nA: {a_text}")
    return "\n\n".join(blocks)


def _detect_verbatim_repeats(transcript: list[dict]) -> list[str]:
    """Cheap, deterministic backstop alongside the LLM's own contradiction
    detection: flags near-verbatim repeated answers via plain string
    similarity, independent of whether the model notices.
    """
    import difflib

    notes: list[str] = []
    for i in range(len(transcript)):
        text_i = (transcript[i].get("response") or "").strip()
        if len(text_i) < 20:
            continue
        for j in range(i + 1, len(transcript)):
            text_j = (transcript[j].get("response") or "").strip()
            if len(text_j) < 20:
                continue
            ratio = difflib.SequenceMatcher(None, text_i.lower(), text_j.lower()).ratio()
            if ratio > 0.85:
                notes.append(
                    f"Your answers to Q{i + 1} and Q{j + 1} are nearly identical — "
                    f"did you mean to give different answers?"
                )
    return notes


def _pacing_notes(transcript: list[dict]) -> list[str]:
    """Deterministic, code-level pacing signal from response_time_sec — a real,
    already-captured signal that was previously collected and never used.
    Coaching-oriented (long hesitation before a thin answer), not an
    accusation — see _integrity_notes for the implausible-speed flag."""
    notes = []
    for i, t in enumerate(transcript):
        secs = t.get("response_time_sec") or 0
        words = len((t.get("response") or "").split())
        if secs > 90 and words < 20:
            notes.append(
                f"Q{i + 1}: you paused for {secs}s before a short ({words}-word) answer — "
                f"try thinking out loud even briefly instead of going silent, it reads better live."
            )
    return notes


def _integrity_notes(transcript: list[dict]) -> list[str]:
    """Flags answers whose length is physically implausible for the time
    taken to submit them (faster than ~2.5 words/sec sustained — beyond even
    fast conversational speech, let alone typing) — a strong hint the answer
    was pasted rather than composed live. Deliberately conservative: only
    fires on long answers with a wide safety margin, to avoid false-flagging
    a candidate who is just a fast typist on a short answer."""
    notes = []
    for i, t in enumerate(transcript):
        secs = t.get("response_time_sec") or 0
        words = len((t.get("response") or "").split())
        # Bug fix (2026-08-24): this previously required secs > 0, which
        # excluded the single most implausible case — a genuine 0-second
        # submission — since `or 0` already coalesces missing/None timing to
        # the same value. A real 0 on a 40+ word answer is exactly what this
        # check exists to catch, not a case to whitelist.
        if words >= 40 and secs < (words / 2.5):
            notes.append(
                f"Q{i + 1}: a {words}-word answer submitted in {secs}s is faster than typical typing "
                f"or speech for that length — flagged for review, not penalized in the score."
            )
    return notes


def _skill_score_history(user_id: str, db: Session) -> dict[str, list[int]]:
    """Every non-fallback overall_score the user has ever received, grouped by
    the skill its question was tagged with. Computed on demand from durable
    Postgres rows — backs both the weak-skill bias fed into future interview
    blueprints and the skill breakdown shown on the history page.
    """
    rows = (
        db.query(InterviewFeedback, QuestionBank)
        .join(SessionResponse, InterviewFeedback.response_id == SessionResponse.id)
        .join(InterviewSession, InterviewFeedback.session_id == InterviewSession.id)
        .outerjoin(QuestionBank, SessionResponse.question_id == QuestionBank.id)
        .filter(
            InterviewSession.user_id == user_id,
            InterviewFeedback.is_fallback == False,
            InterviewFeedback.overall_score != None,
        )
        .all()
    )
    history: dict[str, list[int]] = {}
    for fb, qb in rows:
        skill = _extract_skill(qb.expected_answer_guide) if qb else None
        if skill:
            history.setdefault(skill, []).append(fb.overall_score)
    return history


def _weakest_skills(user_id: str, db: Session, limit: int = 5) -> list[str]:
    """Skills with a below-threshold average score, weakest first."""
    history = _skill_score_history(user_id, db)
    weak = [
        (skill, sum(scores) / len(scores))
        for skill, scores in history.items()
        if (sum(scores) / len(scores)) < _WEAK_AREA_THRESHOLD
    ]
    weak.sort(key=lambda pair: pair[1])
    return [skill for skill, _ in weak[:limit]]


_JD_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "have", "will",
    "your", "you", "are", "our", "who", "what", "how", "not", "but", "can",
    "all", "any", "use", "using", "team", "work", "role", "years", "experience",
    "ability", "strong", "excellent", "including", "such", "into", "than",
    "their", "them", "they", "about", "also", "able", "must", "should",
    "would", "while", "where", "when", "other", "these", "those", "each",
}


def _jd_specificity(job_description: str, questions: list[dict]) -> dict:
    """Measures whether "adding a JD makes the interview more targeted" is
    actually true for a given session, instead of just asserting it in the
    setup wizard's copy — counts generated questions that reference a
    JD-specific term vs. a plain word cloud.
    """
    words = re.findall(r"[A-Za-z][A-Za-z+.#/-]{3,}", job_description)
    jd_terms = {w.lower() for w in words if w.lower() not in _JD_STOPWORDS}

    referencing = 0
    for q in questions:
        text = (q.get("question_text") or "").lower()
        if any(term in text for term in jd_terms):
            referencing += 1

    total = len(questions)
    return {
        "jd_terms_found": len(jd_terms),
        "questions_referencing_jd": referencing,
        "total_questions": total,
        "specificity_pct": round(100 * referencing / total) if total else 0,
    }


def _skill_breakdown(user_id: str, db: Session) -> list[dict]:
    """Every assessed skill with its running average, weakest first."""
    history = _skill_score_history(user_id, db)
    breakdown = [
        {"skill": skill, "avg_score": round(sum(scores) / len(scores), 1), "attempts": len(scores)}
        for skill, scores in history.items()
    ]
    breakdown.sort(key=lambda d: d["avg_score"])
    return breakdown


def list_questions(
    career_track_id: str | None,
    question_type: str | None,
    difficulty: str | None,
    db: Session,
) -> list[QuestionOut]:
    q = db.query(QuestionBank).filter(QuestionBank.is_active == True)
    if career_track_id:
        q = q.filter(
            (QuestionBank.career_track_id == career_track_id) |
            (QuestionBank.career_track_id == None)
        )
    if question_type:
        q = q.filter(QuestionBank.question_type == question_type)
    if difficulty:
        q = q.filter(QuestionBank.difficulty == difficulty)

    return [
        QuestionOut(
            id=str(qb.id),
            question_text=qb.question_text,
            question_type=qb.question_type,
            difficulty=qb.difficulty,
            language=qb.language or "en",
            career_track_id=str(qb.career_track_id) if qb.career_track_id else None,
        )
        for qb in q.all()
    ]


def _build_summary(session: InterviewSession, db: Session) -> SessionSummary:
    track_name = session.career_track.title if session.career_track else None
    resp_count = db.query(func.count(SessionResponse.id)).filter(SessionResponse.session_id == session.id).scalar() or 0

    avg_score = None
    if session.status == "completed":
        scores = (
            db.query(InterviewFeedback.overall_score)
            .filter(
                InterviewFeedback.session_id == session.id,
                InterviewFeedback.response_id != None,
                InterviewFeedback.is_fallback == False,
            )
            .all()
        )
        valid = [s.overall_score for s in scores if s.overall_score is not None]
        avg_score = round(sum(valid) / len(valid), 1) if valid else None

    return SessionSummary(
        id=str(session.id),
        career_track_name=track_name,
        session_type=session.session_type,
        status=session.status,
        total_questions=session.total_questions,
        responses_count=resp_count,
        avg_score=avg_score,
        started_at=session.started_at,
        completed_at=session.completed_at,
        created_at=session.created_at,
        job_role=session.job_role,
        experience_level=session.experience_level,
        blueprint=session.blueprint,
    )


def list_sessions(user: User, db: Session) -> list[SessionSummary]:
    sessions = (
        db.query(InterviewSession)
        .options(joinedload(InterviewSession.career_track))
        .filter(InterviewSession.user_id == user.id)
        .order_by(InterviewSession.created_at.desc())
        .all()
    )
    return [_build_summary(s, db) for s in sessions]


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
        generate_blueprint, generate_questions, resolve_competencies, panelist_for_question_type,
    )

    candidate_context = _build_candidate_context(user, db) if user else None

    # Inject weak competency areas from prior sessions so the AI allocates
    # more questions there (improving weaker areas first).
    prior_weak = _weakest_skills(str(user.id), db) if user else []

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
        jd_metric = _jd_specificity(body.job_description, raw_questions)
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


def get_session(session_id: str, user: User, db: Session) -> SessionDetail:
    session = (
        db.query(InterviewSession)
        .options(
            joinedload(InterviewSession.career_track),
            joinedload(InterviewSession.responses).joinedload(SessionResponse.question),
        )
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise ValueError("Session not found.")

    responded_qids = {str(r.question_id) for r in session.responses if r.question_id}

    # Build question list
    if session.job_role:
        # Dynamic session: questions come from responses + we need to return stored questions
        all_questions: list[QuestionOut] = []
        for r in session.responses:
            if r.question:
                all_questions.append(QuestionOut(
                    id=str(r.question.id),
                    question_text=r.question.question_text,
                    question_type=r.question.question_type,
                    difficulty=r.question.difficulty,
                    language=r.question.language or "en",
                    career_track_id=None,
                    is_dynamic=True,
                    panelist_name=r.question.panelist_name,
                    panelist_role=r.question.panelist_role,
                ))
            elif r.dynamic_question_text:
                all_questions.append(QuestionOut(
                    id=str(r.id),
                    question_text=r.dynamic_question_text,
                    question_type=r.dynamic_question_type,
                    difficulty="medium",
                    language="en",
                    career_track_id=None,
                    is_dynamic=True,
                ))

        # If we have a blueprint, questions were already generated — but for active sessions
        # we need to fetch the generated questions from question_banks that aren't answered yet
        remaining_needed = max(0, session.total_questions - len(all_questions))
        if remaining_needed > 0:
            # Bug fix (2026-08-24): this used to pad from ANY QuestionBank row
            # with no career track, scoped only by "not yet answered in this
            # session" — with no check that the row was actually generated
            # for this session at all. That could surface a different
            # candidate's AI-generated (and, since Phase 4, possibly
            # resume-personalized) questions into this session's view. Scope
            # to this session's own generated IDs, same as get_next_question
            # already correctly does, falling back to the old heuristic only
            # for sessions created before _question_ids was ever stored.
            session_qids: list[str] = (session.blueprint or {}).get("_question_ids", [])
            q_filter = [QuestionBank.is_active == True, ~QuestionBank.id.in_([uuid.UUID(qid) for qid in responded_qids if qid])]
            if session_qids:
                q_filter.append(QuestionBank.id.in_([uuid.UUID(qid) for qid in session_qids if qid not in responded_qids]))
            else:
                q_filter.append(QuestionBank.career_track_id == None)
            recent_q = (
                db.query(QuestionBank)
                .filter(*q_filter)
                .order_by(QuestionBank.created_at.desc())
                .limit(remaining_needed * 3)
                .all()
            )
            extra = random.sample(recent_q, min(remaining_needed, len(recent_q)))
            for q in extra:
                all_questions.append(QuestionOut(
                    id=str(q.id),
                    question_text=q.question_text,
                    question_type=q.question_type,
                    difficulty=q.difficulty,
                    language=q.language or "en",
                    career_track_id=None,
                    is_dynamic=True,
                    panelist_name=q.panelist_name,
                    panelist_role=q.panelist_role,
                ))
    else:
        q_bank = db.query(QuestionBank).filter(QuestionBank.is_active == True)
        if session.career_track_id:
            q_bank = q_bank.filter(
                (QuestionBank.career_track_id == session.career_track_id) |
                (QuestionBank.career_track_id == None)
            )
        all_q = q_bank.all()
        responded_questions = [r.question for r in session.responses if r.question]
        remaining_pool = [q for q in all_q if str(q.id) not in responded_qids]
        remaining_needed = max(0, session.total_questions - len(responded_questions))
        additional = random.sample(remaining_pool, min(remaining_needed, len(remaining_pool)))
        all_questions = [
            QuestionOut(
                id=str(q.id),
                question_text=q.question_text,
                question_type=q.question_type,
                difficulty=q.difficulty,
                language=q.language or "en",
                career_track_id=str(q.career_track_id) if q.career_track_id else None,
            )
            for q in (responded_questions + additional)
        ]

    # Attach job_readiness_report if exists
    readiness = None
    if session.job_readiness_report:
        try:
            readiness = JobReadinessReport(**session.job_readiness_report)
        except Exception:
            logger.exception("Failed to deserialize job_readiness_report for session %s", session.id)

    # Already-submitted responses, ordered — used by the frontend to resume
    # a session after a refresh instead of restarting at question 1.
    submitted: list[SubmittedResponseOut] = []
    for r in sorted(session.responses, key=lambda r: r.sequence_num):
        if r.question:
            q_text = r.question.question_text
            q_type = r.question.question_type
        else:
            q_text = r.dynamic_question_text or ""
            q_type = r.dynamic_question_type
        submitted.append(SubmittedResponseOut(
            id=str(r.id),
            question_text=q_text,
            question_type=q_type,
            response_text=r.response_text,
            sequence_num=r.sequence_num,
        ))

    return SessionDetail(
        **_build_summary(session, db).model_dump(),
        questions=all_questions,
        responses=submitted,
    )


def start_session(session_id: str, user: User, db: Session) -> dict:
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise ValueError("Session not found.")
    if session.status not in ("scheduled", "pending"):
        if session.status == "in_progress":
            return {"session_id": session_id, "status": "in_progress"}
        raise ValueError(f"Cannot start a session with status '{session.status}'.")

    session.status = "in_progress"
    session.started_at = datetime.now(timezone.utc)
    db.commit()
    return {"session_id": session_id, "status": "in_progress"}


def submit_response(
    session_id: str,
    body: SubmitResponseRequest,
    user: User,
    db: Session,
) -> dict:
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise ValueError("Session not found.")
    if session.status not in ("in_progress", "scheduled"):
        raise ValueError("Session is not active.")

    if session.status == "scheduled":
        session.status = "in_progress"
        session.started_at = datetime.now(timezone.utc)

    seq = (
        db.query(func.count(SessionResponse.id))
        .filter(SessionResponse.session_id == session_id)
        .scalar()
        or 0
    ) + 1

    resp = SessionResponse(
        session_id=session_id,
        question_id=body.question_id if body.question_id else None,
        response_text=body.response_text,
        response_time_sec=body.response_time_sec,
        sequence_num=seq,
        dynamic_question_text=body.question_text if not body.question_id else None,
        dynamic_question_type=body.question_type if not body.question_id else None,
        is_followup=body.is_followup,
    )
    db.add(resp)
    db.commit()
    db.refresh(resp)

    return {"response_id": str(resp.id), "sequence_num": seq}


async def _generate_and_store_readiness_report(
    session: InterviewSession,
    transcript_for_report: list[dict],
    db: Session,
) -> JobReadinessReport | None:
    """Generate the job readiness report (primary pass + adversarial
    consistency check + deterministic notes), persist it on the session, and
    return the parsed schema — or None if generation failed entirely.

    Extracted (2026-08-25) so a completed session's report can be regenerated
    on demand via regenerate_readiness_report(), not just at completion time —
    a report that failed from a transient Groq quota exhaustion shouldn't be
    stuck that way forever with no way to retry once the quota clears.
    """
    try:
        from app.ai.dynamic_interview_engine import generate_job_readiness_report, get_competencies
        # Reuse the exact matrix the blueprint/questions were generated from
        # (important for free-typed roles, where it's LLM-generated and not
        # reproducible on demand) — fall back to the static lookup only for
        # sessions created before this was stored.
        competencies = (session.blueprint or {}).get("_competencies") or get_competencies(session.job_role)
        raw_report = await generate_job_readiness_report(
            job_role=session.job_role,
            experience_level=session.experience_level or "Mid-Level",
            competencies=competencies,
            transcript=transcript_for_report,
            total_questions_planned=session.total_questions,
            temperature=0.3,
        )
        # Adversarial consistency check: a second, independently-sampled
        # pass at a higher temperature. One LLM opinion presented as a
        # precise number is a claim; two that agree are corroboration.
        #
        # Cost fix (2026-08-25): this used to run unconditionally, even
        # when the primary pass above already failed and fell back to
        # _default_readiness_report — comparing a real score against a
        # fallback stub's 0 is meaningless, so that was a second full
        # LLM call (with its own internal retry-once) spent on nothing,
        # right when quota pressure is already the reason the primary
        # call failed in the first place. Only worth running when there's
        # an actual first opinion to corroborate.
        if raw_report.get("error"):
            logger.info(
                "[INTERVIEW] Skipping consistency second-pass for session=%s — "
                "primary readiness report already failed, nothing to corroborate.",
                session.id,
            )
        else:
            try:
                second_pass = await generate_job_readiness_report(
                    job_role=session.job_role,
                    experience_level=session.experience_level or "Mid-Level",
                    competencies=competencies,
                    transcript=transcript_for_report,
                    total_questions_planned=session.total_questions,
                    temperature=0.75,
                )
                score_diff = abs(
                    raw_report.get("overall_readiness_score", 0)
                    - second_pass.get("overall_readiness_score", 0)
                )
                if score_diff > 15:
                    raw_report["confidence_note"] = (
                        f"Two independent evaluations of this interview differed by "
                        f"{score_diff} points ({raw_report.get('overall_readiness_score')} vs "
                        f"{second_pass.get('overall_readiness_score')}) — treat this score as a "
                        f"rough estimate, not a precise measurement."
                    )
            except Exception as exc:
                logger.warning("[INTERVIEW] Consistency second-pass failed: %s", exc)

        # Code-level backstop for verbatim/near-verbatim repeats — catches
        # what the LLM might miss, independent of its own judgment.
        code_notes = _detect_verbatim_repeats(transcript_for_report)
        if code_notes:
            raw_report["consistency_notes"] = [
                *raw_report.get("consistency_notes", []), *code_notes
            ]

        # Timing-based pacing and integrity signals — both computed purely
        # from response_time_sec (already captured, previously unused).
        raw_report["pacing_notes"] = _pacing_notes(transcript_for_report)
        raw_report["integrity_notes"] = _integrity_notes(transcript_for_report)

        session.job_readiness_report = raw_report
        db.commit()
        return JobReadinessReport(**raw_report)
    except Exception as exc:
        logger.warning("[INTERVIEW] Job readiness report failed: %s", exc)
        return None


async def complete_session_and_generate_feedback(
    session_id: str,
    user: User,
    db: Session,
) -> SessionFeedbackResponse:
    """Mark session complete, generate AI feedback and job readiness report."""
    session = (
        db.query(InterviewSession)
        .options(
            joinedload(InterviewSession.career_track),
            joinedload(InterviewSession.responses).joinedload(SessionResponse.question),
        )
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise ValueError("Session not found.")
    if session.status == "completed":
        return get_session_feedback(session_id, user, db)
    if not session.responses:
        raise ValueError("No responses submitted.")

    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)
    db.flush()

    feedback_items: list[FeedbackOut] = []
    track_name = session.career_track.title if session.career_track else (session.job_role or "General")

    try:
        from app.ai.providers import create_provider
        provider = create_provider()
    except Exception:
        provider = None

    transcript_for_report: list[dict] = []

    for resp in session.responses:
        question_text = ""
        question_type = None
        skill_assessed = None

        if resp.question:
            question_text = resp.question.question_text
            question_type = resp.question.question_type
            skill_assessed = _extract_skill(resp.question.expected_answer_guide)
        elif resp.dynamic_question_text:
            question_text = resp.dynamic_question_text
            question_type = resp.dynamic_question_type

        is_fallback = False
        if provider:
            try:
                feedback_ai.validate_response_text(resp.response_text or "")
                sys_p, user_p = feedback_ai.build_feedback_prompt(
                    question_text, resp.response_text, track_name, session.session_type
                )
                try:
                    ai_resp = await provider.complete(sys_p, [{"role": "user", "content": user_p}], temperature=0.1)
                    parsed = feedback_ai.parse_feedback_response(ai_resp.content)
                except Exception as first_exc:
                    logger.warning("[INTERVIEW AI] Feedback attempt 1 failed for response=%s: %s — retrying once", resp.id, first_exc)
                    ai_resp = await provider.complete(sys_p, [{"role": "user", "content": user_p}], temperature=0.1)
                    parsed = feedback_ai.parse_feedback_response(ai_resp.content)
            except Exception as exc:
                from app.core.exceptions import BadRequestException
                if not isinstance(exc, BadRequestException):
                    logger.warning("[INTERVIEW AI] Feedback failed for response=%s after retry: %s", resp.id, exc)
                parsed = _default_feedback()
                is_fallback = True
        else:
            parsed = _default_feedback()
            is_fallback = True

        # A well-typed quote is not the same as a real citation — only trust
        # it if it's an actual substring of what the candidate wrote.
        verified_quote = feedback_ai.verify_evidence_quote(
            parsed.get("evidence_quote"), resp.response_text or ""
        )

        # Multi-judge adversarial scoring: two independent, narrowly-framed
        # second opinions alongside the primary generalist score above. Only
        # worth running when the primary call actually succeeded — piling
        # judge calls on top of an already-degraded fallback score just wastes
        # quota without producing a meaningful disagreement signal.
        #
        # Cost fix (2026-08-25): this used to run unconditionally on every
        # successfully-scored answer, tripling per-answer LLM call volume
        # (1 generalist + 2 judges) and materially worsening this session's
        # Groq rate-limit pressure. A near-floor-length answer (just over the
        # 30-char validate_response_text minimum, but not substantive) rarely
        # produces a meaningful disagreement signal — the generalist score is
        # already unambiguous — so skip judges below a real substance
        # threshold and spend that quota on answers where a second opinion
        # can actually change something.
        _LOW_STAKES_WORD_COUNT = 15
        answer_word_count = len((resp.response_text or "").split())
        judge_scores = None
        judge_disagreement_note = None
        if not is_fallback and provider and answer_word_count >= _LOW_STAKES_WORD_COUNT:
            try:
                import asyncio
                from app.ai.providers import create_provider
                from app.ai.providers.groq import LIGHT_MODEL
                judge_provider = create_provider(model=LIGHT_MODEL, reasoning_effort="low")

                async def _run_judge(persona: str):
                    sys_p, user_p = feedback_ai.build_judge_prompt(persona, question_text, resp.response_text, track_name)
                    result = await judge_provider.complete(sys_p, [{"role": "user", "content": user_p}], max_tokens=200, temperature=0.3)
                    return feedback_ai.parse_judge_response(result.content)

                skeptic, domain_specialist = await asyncio.gather(
                    _run_judge("skeptic"), _run_judge("domain_specialist"),
                )
                judge_scores = {
                    "generalist": parsed.get("overall_score"),
                    "skeptic": skeptic["overall_score"],
                    "domain_specialist": domain_specialist["overall_score"],
                }
                spread = max(judge_scores.values()) - min(judge_scores.values())
                if spread >= 4:
                    judge_disagreement_note = (
                        f"Judges disagreed on this answer (generalist {judge_scores['generalist']}/10, "
                        f"skeptic {judge_scores['skeptic']}/10, domain specialist {judge_scores['domain_specialist']}/10) — "
                        f"treat the score as approximate. Skeptic: \"{skeptic['verdict']}\" Domain specialist: \"{domain_specialist['verdict']}\""
                    )
            except Exception as exc:
                logger.warning("[INTERVIEW AI] Multi-judge scoring failed for response=%s: %s", resp.id, exc)

        fb = InterviewFeedback(
            session_id=session_id,
            response_id=resp.id,
            clarity_score=parsed.get("clarity_score"),
            conciseness_score=parsed.get("conciseness_score"),
            impact_score=parsed.get("impact_score"),
            relevance_score=parsed.get("relevance_score"),
            star_adherence=parsed.get("star_adherence"),
            overall_score=parsed.get("overall_score"),
            strengths=parsed.get("strengths", []),
            improvements=parsed.get("improvements", []),
            rewritten_answer=parsed.get("rewritten_answer"),
            is_fallback=is_fallback,
            evidence_quote=verified_quote,
            judge_scores=judge_scores,
            judge_disagreement_note=judge_disagreement_note,
        )
        db.add(fb)
        db.flush()

        fi = FeedbackOut(
            id=str(fb.id),
            response_id=str(resp.id),
            question_text=question_text,
            question_type=question_type,
            skill_assessed=skill_assessed,
            original_response=resp.response_text,
            clarity_score=fb.clarity_score,
            conciseness_score=fb.conciseness_score,
            impact_score=fb.impact_score,
            relevance_score=fb.relevance_score,
            star_adherence=fb.star_adherence,
            overall_score=fb.overall_score,
            strengths=fb.strengths or [],
            improvements=fb.improvements or [],
            rewritten_answer=fb.rewritten_answer,
            is_fallback=fb.is_fallback,
            evidence_quote=fb.evidence_quote,
            judge_scores=fb.judge_scores,
            judge_disagreement_note=fb.judge_disagreement_note,
        )
        feedback_items.append(fi)

        transcript_for_report.append({
            "question": question_text,
            "question_type": question_type or "behavioral",
            "skill_assessed": skill_assessed or "General",
            "response": resp.response_text or "",
            "response_time_sec": resp.response_time_sec or 0,
            # Use actual scores including 0 — never substitute a fake score,
            # whether missing (None) or a fabricated fallback placeholder.
            "clarity": fb.clarity_score if (fb.clarity_score is not None and not is_fallback) else 0,
            "impact": fb.impact_score if (fb.impact_score is not None and not is_fallback) else 0,
            "overall": fb.overall_score if (fb.overall_score is not None and not is_fallback) else 0,
        })

    db.commit()

    scores = [f.overall_score for f in feedback_items if f.overall_score is not None and not f.is_fallback]
    avg = round(sum(scores) / len(scores), 1) if scores else 0.0

    # ── Job Readiness Report (only for role-specific sessions) ────────────────
    readiness_report = None
    if session.job_role and transcript_for_report:
        readiness_report = await _generate_and_store_readiness_report(session, transcript_for_report, db)

    # XP award
    try:
        from app.modules.xp.service import award_xp
        award_xp(user.id, "interview_complete", ref_id=session_id,
                 note=f"Mock interview session avg={avg}", db=db)
        db.commit()
    except Exception as exc:
        logger.warning("[INTERVIEW] XP award failed: %s", exc)

    # Skill competence update
    try:
        from app.modules.roadmap.service import update_skill_competence
        for resp, fi in zip(session.responses, feedback_items):
            topic = fi.skill_assessed or (resp.question.question_type if resp.question else None) or "general"
            if fi.overall_score is not None:
                update_skill_competence(
                    user_id=str(user.id),
                    skill_text=topic,
                    quiz_score=0,  # use 0 not None to avoid arithmetic failure in competence service
                    exercise_score=float(fi.overall_score) * 10,
                    db=db,
                )
        db.commit()
    except Exception as exc:
        logger.warning("[INTERVIEW] Skill competence update failed: %s", exc)

    weak_skills = _weakest_skills(str(user.id), db)
    existing_outcome = db.query(InterviewOutcome).filter(InterviewOutcome.session_id == session_id).first()

    return SessionFeedbackResponse(
        session_id=session_id,
        overall_avg=avg,
        feedback_items=feedback_items,
        job_readiness_report=readiness_report,
        weak_skills=weak_skills,
        outcome_reported=existing_outcome is not None,
        reported_outcome=existing_outcome.outcome if existing_outcome else None,
    )


async def get_next_question(
    session_id: str,
    response_id: str,
    user: User,
    db: Session,
) -> dict:
    """After a response is submitted, decide whether to ask a follow-up or move on."""
    session = (
        db.query(InterviewSession)
        .options(
            joinedload(InterviewSession.career_track),
            joinedload(InterviewSession.responses).joinedload(SessionResponse.question),
        )
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise ValueError("Session not found.")
    if session.status not in ("in_progress", "scheduled"):
        raise ValueError("Session is not active.")

    resp = db.query(SessionResponse).filter(
        SessionResponse.id == response_id,
        SessionResponse.session_id == session_id,
    ).first()
    if not resp:
        raise ValueError("Response not found.")

    question_id = str(resp.question_id) if resp.question_id else None
    # Bug fix (2026-08-24): this used to count responses sharing question_id —
    # but a follow-up's own response always has question_id=None (it isn't a
    # question_banks row), so that count could never exceed 1 once the chain
    # left the original question, and the interviewer could keep follow-up-ing
    # indefinitely. already_probed now means exactly what it needs to: "the
    # answer I'm evaluating was itself an answer to a follow-up" — which
    # correctly caps any topic at one follow-up regardless of question_id.
    already_probed = bool(resp.is_followup)

    responses_done = len(session.responses)
    questions_remaining = session.total_questions - responses_done
    session_complete = questions_remaining <= 0

    if session_complete:
        return {
            "action": "next_question",
            "question": None,
            "provisional_score": 5,
            "coaching_note": "Session complete. Complete the session to get full AI feedback.",
            "session_complete": True,
        }

    question_text = ""
    if resp.question:
        question_text = resp.question.question_text
    elif resp.dynamic_question_text:
        question_text = resp.dynamic_question_text
    skill_topic = resp.question.question_type if resp.question else resp.dynamic_question_type

    from app.ai.adaptive_interviewer import decide_next_action
    decision = await decide_next_action(
        question_text=question_text,
        response_text=resp.response_text or "",
        interview_type=session.session_type or "practice",
        questions_remaining=questions_remaining,
        skill_topic=skill_topic,
        already_probed=already_probed,
        recent_history=_recent_history(session, response_id),
    )

    action = decision.get("action", "next_question")
    follow_up_q = decision.get("follow_up_question")

    # A follow-up is the same interviewer probing deeper on their own question,
    # not a new panelist stepping in — carry the original question's persona
    # through rather than re-deriving or dropping it.
    if resp.question:
        followup_panelist = {"name": resp.question.panelist_name, "role": resp.question.panelist_role}
    else:
        from app.ai.dynamic_interview_engine import panelist_for_question_type
        followup_panelist = panelist_for_question_type(resp.dynamic_question_type) or {"name": None, "role": None}

    if action in ("follow_up", "challenge") and follow_up_q:
        return {
            "action": action,
            "question": {
                "text": follow_up_q,
                "is_followup": True,
                "original_question_id": question_id,
                "panelist_name": followup_panelist["name"],
                "panelist_role": followup_panelist["role"],
            },
            "provisional_score": decision.get("provisional_score", 5),
            "coaching_note": decision.get("coaching_note", ""),
            "session_complete": False,
        }

    # Move to next question
    responded_qids = {str(r.question_id) for r in session.responses if r.question_id}

    if session.job_role and session.blueprint:
        # Dynamic session: scope strictly to the question IDs generated for this session.
        session_qids: list[str] = (session.blueprint or {}).get("_question_ids", [])
        if session_qids:
            allowed_uuids = [uuid.UUID(qid) for qid in session_qids if qid not in responded_qids]
            candidate_q = (
                db.query(QuestionBank)
                .filter(
                    QuestionBank.id.in_(allowed_uuids),
                    QuestionBank.is_active == True,
                )
                .all()
            )
        else:
            # Fallback for sessions created before this fix: use created_at heuristic
            candidate_q = (
                db.query(QuestionBank)
                .filter(
                    QuestionBank.career_track_id == None,
                    QuestionBank.is_active == True,
                    ~QuestionBank.id.in_([uuid.UUID(qid) for qid in responded_qids if qid]),
                )
                .order_by(QuestionBank.created_at.desc())
                .limit(session.total_questions * 2)
                .all()
            )
        remaining = candidate_q
    else:
        q_bank = db.query(QuestionBank).filter(QuestionBank.is_active == True)
        if session.career_track_id:
            q_bank = q_bank.filter(
                (QuestionBank.career_track_id == session.career_track_id) |
                (QuestionBank.career_track_id == None)
            )
        remaining = [q for q in q_bank.all() if str(q.id) not in responded_qids]

    if not remaining:
        return {
            "action": "next_question",
            "question": None,
            "provisional_score": decision.get("provisional_score", 5),
            "coaching_note": decision.get("coaching_note", ""),
            "session_complete": True,
        }

    next_q = random.choice(remaining)
    return {
        "action": "next_question",
        "question": {
            "id": str(next_q.id),
            "text": next_q.question_text,
            "question_type": next_q.question_type,
            "difficulty": next_q.difficulty,
            "is_followup": False,
            "panelist_name": next_q.panelist_name,
            "panelist_role": next_q.panelist_role,
        },
        "provisional_score": decision.get("provisional_score", 5),
        "coaching_note": decision.get("coaching_note", ""),
        "session_complete": False,
    }


def _default_feedback() -> dict:
    return {
        "clarity_score": 5,
        "conciseness_score": 5,
        "impact_score": 5,
        "relevance_score": 5,
        "star_adherence": 5,
        "overall_score": 5,
        "strengths": ["Response submitted successfully."],
        "improvements": ["AI feedback unavailable — please try again."],
        "rewritten_answer": None,
        "evidence_quote": None,
    }


def get_session_feedback(session_id: str, user: User, db: Session) -> SessionFeedbackResponse:
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise ValueError("Session not found.")

    feedback_rows = (
        db.query(InterviewFeedback, SessionResponse)
        .join(SessionResponse, InterviewFeedback.response_id == SessionResponse.id)
        .outerjoin(QuestionBank, SessionResponse.question_id == QuestionBank.id)
        .filter(InterviewFeedback.session_id == session_id)
        .all()
    )

    items = []
    for fb, resp in feedback_rows:
        q_text = ""
        q_type = None
        skill_assessed = None
        if resp.question:
            q_text = resp.question.question_text
            q_type = resp.question.question_type
            skill_assessed = _extract_skill(resp.question.expected_answer_guide)
        elif resp.dynamic_question_text:
            q_text = resp.dynamic_question_text
            q_type = resp.dynamic_question_type

        items.append(FeedbackOut(
            id=str(fb.id),
            response_id=str(resp.id),
            question_text=q_text,
            question_type=q_type,
            skill_assessed=skill_assessed,
            original_response=resp.response_text,
            clarity_score=fb.clarity_score,
            conciseness_score=fb.conciseness_score,
            impact_score=fb.impact_score,
            relevance_score=fb.relevance_score,
            star_adherence=fb.star_adherence,
            overall_score=fb.overall_score,
            strengths=fb.strengths or [],
            improvements=fb.improvements or [],
            rewritten_answer=fb.rewritten_answer,
            is_fallback=fb.is_fallback,
            evidence_quote=fb.evidence_quote,
            judge_scores=fb.judge_scores,
            judge_disagreement_note=fb.judge_disagreement_note,
        ))

    scores = [i.overall_score for i in items if i.overall_score is not None and not i.is_fallback]
    avg = round(sum(scores) / len(scores), 1) if scores else 0.0

    readiness_report = None
    if session.job_readiness_report:
        try:
            readiness_report = JobReadinessReport(**session.job_readiness_report)
        except Exception:
            logger.exception("Failed to deserialize job_readiness_report for session %s", session.id)

    existing_outcome = db.query(InterviewOutcome).filter(InterviewOutcome.session_id == session_id).first()

    return SessionFeedbackResponse(
        session_id=session_id,
        overall_avg=avg,
        feedback_items=items,
        job_readiness_report=readiness_report,
        weak_skills=_weakest_skills(str(user.id), db),
        outcome_reported=existing_outcome is not None,
        reported_outcome=existing_outcome.outcome if existing_outcome else None,
    )


async def regenerate_readiness_report(session_id: str, user: User, db: Session) -> SessionFeedbackResponse:
    """Retry report generation for a completed session whose report
    previously failed — e.g. from a transient Groq quota exhaustion that has
    since cleared. Added 2026-08-25: before this, a failed report was stuck
    that way forever, since calling /complete again on an already-completed
    session just replays the cached (failed) result rather than regenerating.

    Refuses to run on a session that already has a real (non-error) report —
    this exists to recover from a known failure, not to let a candidate
    reroll a score they don't like.
    """
    session = (
        db.query(InterviewSession)
        .options(joinedload(InterviewSession.responses).joinedload(SessionResponse.question))
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise ValueError("Session not found.")
    if session.status != "completed":
        raise ValueError("Session is not completed yet.")
    if not session.job_role:
        raise ValueError("This session type doesn't generate a job readiness report.")
    existing = session.job_readiness_report
    if existing and not existing.get("error"):
        raise ValueError("This session already has a real readiness report — nothing to regenerate.")

    feedback_rows = (
        db.query(InterviewFeedback, SessionResponse)
        .join(SessionResponse, InterviewFeedback.response_id == SessionResponse.id)
        .filter(InterviewFeedback.session_id == session_id)
        .all()
    )
    if not feedback_rows:
        raise ValueError("No scored answers to build a report from.")

    transcript_for_report: list[dict] = []
    for fb, resp in sorted(feedback_rows, key=lambda pair: pair[1].sequence_num):
        if resp.question:
            question_text = resp.question.question_text
            question_type = resp.question.question_type
            skill_assessed = _extract_skill(resp.question.expected_answer_guide)
        else:
            question_text = resp.dynamic_question_text or ""
            question_type = resp.dynamic_question_type
            skill_assessed = None

        transcript_for_report.append({
            "question": question_text,
            "question_type": question_type or "behavioral",
            "skill_assessed": skill_assessed or "General",
            "response": resp.response_text or "",
            # Same rule as at original completion time — never substitute a
            # fake score, whether missing (None) or a fabricated fallback.
            "clarity": fb.clarity_score if (fb.clarity_score is not None and not fb.is_fallback) else 0,
            "impact": fb.impact_score if (fb.impact_score is not None and not fb.is_fallback) else 0,
            "overall": fb.overall_score if (fb.overall_score is not None and not fb.is_fallback) else 0,
        })

    await _generate_and_store_readiness_report(session, transcript_for_report, db)
    return get_session_feedback(session_id, user, db)


def get_performance(user: User, db: Session) -> PerformanceResponse:
    sessions = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == user.id)
        .all()
    )
    total = len(sessions)
    completed = sum(1 for s in sessions if s.status == "completed")

    feedback_scores = (
        db.query(InterviewFeedback)
        .join(InterviewSession, InterviewFeedback.session_id == InterviewSession.id)
        .filter(
            InterviewSession.user_id == user.id,
            InterviewFeedback.response_id != None,
            InterviewFeedback.is_fallback == False,
        )
        .all()
    )

    def _avg(vals):
        valid = [v for v in vals if v is not None]
        return round(sum(valid) / len(valid), 1) if valid else 0.0

    sessions_by_type: dict[str, int] = {}
    for s in sessions:
        sessions_by_type[s.session_type] = sessions_by_type.get(s.session_type, 0) + 1

    session_avgs = {}
    for fb in feedback_scores:
        sid = str(fb.session_id)
        if fb.overall_score is not None:
            if sid not in session_avgs:
                session_avgs[sid] = []
            session_avgs[sid].append(fb.overall_score)

    best = max(
        (sum(v) / len(v) for v in session_avgs.values() if v),
        default=0.0
    )

    return PerformanceResponse(
        total_sessions=total,
        completed_sessions=completed,
        avg_overall_score=_avg([f.overall_score for f in feedback_scores]),
        avg_clarity=_avg([f.clarity_score for f in feedback_scores]),
        avg_conciseness=_avg([f.conciseness_score for f in feedback_scores]),
        avg_impact=_avg([f.impact_score for f in feedback_scores]),
        best_session_score=round(best, 1),
        sessions_by_type=sessions_by_type,
        by_skill=_skill_breakdown(str(user.id), db),
    )


def submit_outcome(session_id: str, outcome: str, notes: str | None, user: User, db: Session) -> dict:
    """Predictive-validity flywheel: the candidate self-reports what actually
    happened after the interview they practiced for. Opt-in, called either
    from the follow-up notification's deep link or spontaneously from the
    report page. Upserts — a candidate updating their answer overwrites the
    prior one rather than creating a duplicate."""
    from app.modules.interview.schemas import OUTCOME_VALUES

    if outcome not in OUTCOME_VALUES:
        raise ValueError(f"Invalid outcome. Must be one of: {', '.join(OUTCOME_VALUES)}")

    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise ValueError("Session not found.")
    if session.status != "completed":
        raise ValueError("Can only report an outcome for a completed interview.")

    existing = db.query(InterviewOutcome).filter(InterviewOutcome.session_id == session_id).first()
    if existing:
        existing.outcome = outcome
        existing.notes = notes
    else:
        db.add(InterviewOutcome(session_id=session_id, user_id=user.id, outcome=outcome, notes=notes))
    db.commit()
    return {"message": "Outcome recorded. Thanks for closing the loop."}
