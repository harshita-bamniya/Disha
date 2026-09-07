"""Interview session listing and retrieval."""
from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.interview import (
    InterviewFeedback,
    InterviewSession,
    QuestionBank,
    SessionResponse,
)
from app.models.user import User
from app.modules.interview.schemas import (
    JobReadinessReport,
    QuestionOut,
    SessionDetail,
    SessionSummary,
    SubmittedResponseOut,
)

logger = logging.getLogger(__name__)

_SYNTHETIC_PREFIX = "dyn:"  # prefix in question_text to mark dynamic bank entries

_WEAK_AREA_THRESHOLD = 6   # overall_score below this is a "weak" competency


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

