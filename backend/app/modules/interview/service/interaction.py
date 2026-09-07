"""The live Q&A loop: submitting a response, getting the next question."""
from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.interview import InterviewSession, QuestionBank, SessionResponse
from app.models.user import User
from app.modules.interview.schemas import (
    SubmitResponseRequest,
)
from app.modules.interview.service import core

logger = logging.getLogger(__name__)


_SYNTHETIC_PREFIX = "dyn:"  # prefix in question_text to mark dynamic bank entries


_WEAK_AREA_THRESHOLD = 6   # overall_score below this is a "weak" competency


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
        recent_history=core._recent_history(session, response_id),
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

