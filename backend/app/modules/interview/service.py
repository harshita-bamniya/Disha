"""Mock Interview Engine service — Module 07."""
from __future__ import annotations

import logging
import random
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.mvp2 import (
    InterviewFeedback, InterviewSession, QuestionBank, SessionResponse,
)
from app.models.user import CareerTrack, User
from app.modules.interview import feedback_ai
from app.modules.interview.schemas import (
    CreateSessionRequest, FeedbackOut, PerformanceResponse,
    QuestionOut, SessionDetail, SessionFeedbackResponse, SessionSummary,
    SubmitResponseRequest,
)

logger = logging.getLogger(__name__)


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


def create_session(body: CreateSessionRequest, user: User, db: Session) -> SessionDetail:
    session = InterviewSession(
        user_id=user.id,
        career_track_id=body.career_track_id,
        session_type=body.session_type,
        total_questions=min(body.total_questions, 10),
        status="scheduled",
    )
    db.add(session)
    db.flush()

    # Select questions for this session
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
        questions=[
            QuestionOut(
                id=str(q.id),
                question_text=q.question_text,
                question_type=q.question_type,
                difficulty=q.difficulty,
                language=q.language or "en",
                career_track_id=str(q.career_track_id) if q.career_track_id else None,
            )
            for q in selected
        ],
    )


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

    # Build question list from already-responded questions
    responded_qids = {str(r.question_id) for r in session.responses}

    # Also try to get additional questions for the session
    q_bank = db.query(QuestionBank).filter(QuestionBank.is_active == True)
    if session.career_track_id:
        q_bank = q_bank.filter(
            (QuestionBank.career_track_id == session.career_track_id) |
            (QuestionBank.career_track_id == None)
        )
    all_q = q_bank.all()

    # Start with responded questions, add remaining up to total_questions
    responded_questions = [r.question for r in session.responses]
    remaining_pool = [q for q in all_q if str(q.id) not in responded_qids]
    remaining_needed = max(0, session.total_questions - len(responded_questions))
    additional = random.sample(remaining_pool, min(remaining_needed, len(remaining_pool)))

    all_questions = responded_questions + additional

    return SessionDetail(
        **_build_summary(session, db).model_dump(),
        questions=[
            QuestionOut(
                id=str(q.id),
                question_text=q.question_text,
                question_type=q.question_type,
                difficulty=q.difficulty,
                language=q.language or "en",
                career_track_id=str(q.career_track_id) if q.career_track_id else None,
            )
            for q in all_questions
        ],
    )


def start_session(session_id: str, user: User, db: Session) -> dict:
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise ValueError("Session not found.")
    if session.status != "scheduled":
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
        question_id=body.question_id,
        response_text=body.response_text,
        response_time_sec=body.response_time_sec,
        sequence_num=seq,
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
    """Mark session complete and generate AI feedback for all responses."""
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
    track_name = session.career_track.title if session.career_track else "General"

    try:
        from app.ai.providers.groq import GroqProvider
        provider = GroqProvider()
    except Exception:
        provider = None

    for resp in session.responses:
        question_text = resp.question.question_text if resp.question else "N/A"

        if provider:
            try:
                # Validate before calling AI — skip AI for trivially short responses
                feedback_ai.validate_response_text(resp.response_text or "")
                sys_p, user_p = feedback_ai.build_feedback_prompt(
                    question_text, resp.response_text, track_name, session.session_type
                )
                ai_resp = await provider.complete(sys_p, [{"role": "user", "content": user_p}])
                parsed = feedback_ai.parse_feedback_response(ai_resp.content)
            except Exception as exc:
                from app.core.exceptions import BadRequestException
                if isinstance(exc, BadRequestException):
                    logger.info("[INTERVIEW AI] Skipping AI for short response=%s", resp.id)
                else:
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

        feedback_items.append(FeedbackOut(
            id=str(fb.id),
            response_id=str(resp.id),
            question_text=question_text,
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

    db.commit()

    scores = [f.overall_score for f in feedback_items if f.overall_score is not None]
    avg = round(sum(scores) / len(scores), 1) if scores else 0.0

    return SessionFeedbackResponse(
        session_id=session_id,
        overall_avg=avg,
        feedback_items=feedback_items,
    )


def _default_feedback() -> dict:
    """Fallback feedback when AI is unavailable."""
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
        db.query(InterviewFeedback, SessionResponse, QuestionBank)
        .join(SessionResponse, InterviewFeedback.response_id == SessionResponse.id)
        .join(QuestionBank, SessionResponse.question_id == QuestionBank.id)
        .filter(InterviewFeedback.session_id == session_id)
        .all()
    )

    items = [
        FeedbackOut(
            id=str(fb.id),
            response_id=str(resp.id),
            question_text=q.question_text,
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
        for fb, resp, q in feedback_rows
    ]

    scores = [i.overall_score for i in items if i.overall_score is not None]
    avg = round(sum(scores) / len(scores), 1) if scores else 0.0

    return SessionFeedbackResponse(session_id=session_id, overall_avg=avg, feedback_items=items)


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

    # Best session
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
