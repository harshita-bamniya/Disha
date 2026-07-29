"""Mock Interview Engine service — Module 07 (Production AI Interview Platform)."""
from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.mvp2 import (
    InterviewFeedback, InterviewSession, QuestionBank, SessionResponse,
)
from app.models.user import CareerTrack, User
from app.modules.interview import feedback_ai
from app.modules.interview.schemas import (
    CreateSessionRequest, FeedbackOut, JobReadinessReport,
    PerformanceResponse, QuestionOut, SessionDetail, SessionFeedbackResponse,
    SessionSummary, SubmitResponseRequest,
)

logger = logging.getLogger(__name__)

_SYNTHETIC_PREFIX = "dyn:"  # prefix in question_text to mark dynamic bank entries

_WEAK_AREA_THRESHOLD = 6   # overall_score below this is a "weak" competency
_WEAK_AREA_TTL = 60 * 60 * 24 * 30  # 30 days


def _weak_area_redis_key(user_id: str) -> str:
    return f"interview:weak_areas:{user_id}"


def _redis_client():
    import redis as redis_lib
    from app.config import get_settings
    return redis_lib.from_url(get_settings().redis_url, decode_responses=True)


def _store_weak_competencies(user_id: str, transcript: list[dict]) -> None:
    """After a session ends, compute skills with avg overall_score < threshold and cache in Redis."""
    import json

    skill_scores: dict[str, list[float]] = {}
    for item in transcript:
        skill = (item.get("skill_assessed") or "").strip()
        score = item.get("overall")
        if skill and score is not None:
            skill_scores.setdefault(skill, []).append(float(score))

    weak = [
        skill for skill, scores in skill_scores.items()
        if (sum(scores) / len(scores)) < _WEAK_AREA_THRESHOLD
    ]

    if not weak:
        return

    r = _redis_client()
    r.setex(_weak_area_redis_key(user_id), _WEAK_AREA_TTL, json.dumps(weak))
    logger.info("[INTERVIEW] Stored %d weak competencies for user %s: %s", len(weak), user_id, weak)


def _get_weak_competencies(user_id: str) -> list[str]:
    """Load previously stored weak competencies from Redis."""
    import json
    try:
        r = _redis_client()
        raw = r.get(_weak_area_redis_key(user_id))
        return json.loads(raw) if raw else []
    except Exception:
        return []


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
    )


def _build_candidate_context(user: User, db: Session) -> str | None:
    """Build a concise candidate background string for interview calibration."""
    from app.models.user import AspirantProfile, KrsScore, PsychologicalAssessment

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    psych = db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user.id).first()

    if not profile and not krs:
        return None

    lines = []
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
    from app.ai.dynamic_interview_engine import generate_blueprint, generate_questions

    candidate_context = _build_candidate_context(user, db) if user else None

    # Inject weak competency areas from the user's last session so the AI
    # allocates more questions there (improving weaker areas first).
    prior_weak = _get_weak_competencies(str(user.id)) if user else []

    blueprint = await generate_blueprint(
        job_role=body.job_role,
        experience_level=body.experience_level or "Mid-Level",
        job_description=body.job_description,
        total_questions=session.total_questions,
        candidate_context=candidate_context,
        prior_weak_areas=prior_weak,
    )

    raw_questions = await generate_questions(
        job_role=body.job_role,
        experience_level=body.experience_level or "Mid-Level",
        blueprint=blueprint,
        count=session.total_questions,
    )

    # Persist generated questions into question_banks so FK stays valid
    question_outs: list[QuestionOut] = []
    for q in raw_questions:
        q_type = q.get("question_type", "behavioral")
        # Normalize to allowed values
        if q_type not in ("behavioral", "situational", "technical", "hr", "case"):
            q_type = "behavioral"
        difficulty = q.get("difficulty", "medium")
        if difficulty not in ("easy", "medium", "hard"):
            difficulty = "medium"

        skill_name = q.get("skill_assessed", "")
        # Embed skill_assessed in expected_answer_guide with a parseable prefix
        guide = f"[SKILL:{skill_name}] " + (q.get("expected_answer_hints") or "") if skill_name else q.get("expected_answer_hints")

        bank_entry = QuestionBank(
            question_text=q.get("question_text", "Tell me about yourself."),
            question_type=q_type,
            difficulty=difficulty,
            expected_answer_guide=guide,
            language="en",
            is_active=True,
            career_track_id=None,
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
        ))

    # Store blueprint + generated question IDs on session so process_response can scope to them
    generated_ids = [str(q.id) for q in question_outs]
    session.blueprint = {**(blueprint or {}), "_question_ids": generated_ids}
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
            recent_q = (
                db.query(QuestionBank)
                .filter(
                    QuestionBank.career_track_id == None,
                    QuestionBank.is_active == True,
                    ~QuestionBank.id.in_([uuid.UUID(qid) for qid in responded_qids if qid]),
                )
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
            pass

    return SessionDetail(
        **_build_summary(session, db).model_dump(),
        questions=all_questions,
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
    )
    db.add(resp)
    db.commit()
    db.refresh(resp)

    return {"response_id": str(resp.id), "sequence_num": seq}


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
            # Extract skill tag stored as "[SKILL:name] ..." in expected_answer_guide
            guide = resp.question.expected_answer_guide or ""
            if guide.startswith("[SKILL:"):
                end = guide.index("]")
                skill_assessed = guide[7:end].strip() or None
        elif resp.dynamic_question_text:
            question_text = resp.dynamic_question_text
            question_type = resp.dynamic_question_type

        if provider:
            try:
                feedback_ai.validate_response_text(resp.response_text or "")
                sys_p, user_p = feedback_ai.build_feedback_prompt(
                    question_text, resp.response_text, track_name, session.session_type
                )
                ai_resp = await provider.complete(sys_p, [{"role": "user", "content": user_p}], temperature=0.1)
                parsed = feedback_ai.parse_feedback_response(ai_resp.content)
            except Exception as exc:
                from app.core.exceptions import BadRequestException
                if not isinstance(exc, BadRequestException):
                    logger.warning("[INTERVIEW AI] Feedback failed for response=%s: %s", resp.id, exc)
                parsed = _default_feedback()
        else:
            parsed = _default_feedback()

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
        )
        feedback_items.append(fi)

        transcript_for_report.append({
            "question": question_text,
            "question_type": question_type or "behavioral",
            "skill_assessed": skill_assessed or "General",
            "response": resp.response_text or "",
            # Use actual scores including 0 — never substitute a fake 5
            "clarity": fb.clarity_score if fb.clarity_score is not None else 0,
            "impact": fb.impact_score if fb.impact_score is not None else 0,
            "overall": fb.overall_score if fb.overall_score is not None else 0,
        })

    db.commit()

    scores = [f.overall_score for f in feedback_items if f.overall_score is not None]
    avg = round(sum(scores) / len(scores), 1) if scores else 0.0

    # ── Job Readiness Report (only for role-specific sessions) ────────────────
    readiness_report = None
    if session.job_role and transcript_for_report:
        try:
            from app.ai.dynamic_interview_engine import generate_job_readiness_report, get_competencies
            competencies = get_competencies(session.job_role)
            raw_report = await generate_job_readiness_report(
                job_role=session.job_role,
                experience_level=session.experience_level or "Mid-Level",
                competencies=competencies,
                transcript=transcript_for_report,
                total_questions_planned=session.total_questions,
            )
            session.job_readiness_report = raw_report
            db.commit()
            readiness_report = JobReadinessReport(**raw_report)
        except Exception as exc:
            logger.warning("[INTERVIEW] Job readiness report failed: %s", exc)

    # XP award
    try:
        from app.modules.xp.service import award_xp
        award_xp(user.id, "interview_complete", ref_id=session_id,
                 note=f"Mock interview session avg={avg}", db=db)
        db.commit()
    except Exception as exc:
        logger.warning("[INTERVIEW] XP award failed: %s", exc)

    # Persist weak competency areas to Redis for next-session injection
    try:
        _store_weak_competencies(str(user.id), transcript_for_report)
    except Exception as exc:
        logger.warning("[INTERVIEW] Weak competency storage failed: %s", exc)

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

    return SessionFeedbackResponse(
        session_id=session_id,
        overall_avg=avg,
        feedback_items=feedback_items,
        job_readiness_report=readiness_report,
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
    responses_for_question = [
        r for r in session.responses
        if (str(r.question_id) == question_id if question_id else False)
    ]
    already_probed = len(responses_for_question) > 1

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
    )

    action = decision.get("action", "next_question")
    follow_up_q = decision.get("follow_up_question")

    if action in ("follow_up", "challenge") and follow_up_q:
        return {
            "action": action,
            "question": {
                "text": follow_up_q,
                "is_followup": True,
                "original_question_id": question_id,
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
        if resp.question:
            q_text = resp.question.question_text
            q_type = resp.question.question_type
        elif resp.dynamic_question_text:
            q_text = resp.dynamic_question_text
            q_type = resp.dynamic_question_type

        items.append(FeedbackOut(
            id=str(fb.id),
            response_id=str(resp.id),
            question_text=q_text,
            question_type=q_type,
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
        ))

    scores = [i.overall_score for i in items if i.overall_score is not None]
    avg = round(sum(scores) / len(scores), 1) if scores else 0.0

    readiness_report = None
    if session.job_readiness_report:
        try:
            readiness_report = JobReadinessReport(**session.job_readiness_report)
        except Exception:
            pass

    return SessionFeedbackResponse(
        session_id=session_id,
        overall_avg=avg,
        feedback_items=items,
        job_readiness_report=readiness_report,
    )


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
        .filter(InterviewSession.user_id == user.id, InterviewFeedback.response_id != None)
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
    )
