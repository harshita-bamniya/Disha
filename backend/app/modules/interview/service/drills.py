"""Drills: one question, one answer, immediate feedback, instant retry.

The cheap way to practise. A drill makes one question-generation call and one
scoring call (no blueprint, no second-opinion judges, no readiness report, no
XP), costs a fraction of a full interview, and does not use up the free
interviews, though it is capped per day to bound spend.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.ai.usage import interview_context
from app.models.interview import InterviewSession, QuestionBank
from app.models.user import User
from app.modules.interview.schemas import (
    DrillRequest,
    SessionDetail,
    SessionFeedbackResponse,
    SubmitResponseRequest,
)
from app.modules.interview.service import core
from app.modules.interview.service.eligibility import drill_quota
from app.modules.interview.service.feedback import complete_session, get_session_feedback, run_grading
from app.modules.interview.service.interaction import submit_response
from app.modules.interview.service.sessions import discard_session, get_session

logger = logging.getLogger(__name__)

_QUESTION_TYPES = ("behavioral", "situational", "technical", "hr", "case", "system_design")


class DrillLimitReached(Exception):
    """The daily drill allowance is used up (mapped to HTTP 429)."""


def _pick_competency(requested: str | None, competencies: list[dict], weakest: list[str]) -> str:
    """The competency to drill: the one asked for, else the candidate's weakest
    from past interviews, else the role's most heavily weighted one."""
    names = [c["skill"] for c in competencies]
    folded = {n.casefold(): n for n in names}
    if requested and requested.casefold() in folded:
        return folded[requested.casefold()]
    for skill in weakest:
        if skill and skill.casefold() in folded:
            return folded[skill.casefold()]
    return max(competencies, key=lambda c: float(c.get("weight") or 0))["skill"]


def _store_question(raw: dict, competency: str, language: str, is_technical: bool, db: Session) -> QuestionBank:
    from app.ai.dynamic_interview_engine import panelist_for_question_type

    q_type = raw.get("question_type", "behavioral")
    if q_type not in _QUESTION_TYPES:
        q_type = "behavioral"
    difficulty = raw.get("difficulty", "medium")
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"
    hints = raw.get("expected_answer_hints") or ""
    panelist = panelist_for_question_type(q_type, is_technical)
    row = QuestionBank(
        question_text=raw.get("question_text") or "Tell me about a time you had to make a difficult decision.",
        question_type=q_type,
        difficulty=difficulty,
        expected_answer_guide=f"[SKILL:{competency}] {hints}".strip(),
        language=language,
        is_active=True,
        career_track_id=None,
        panelist_name=panelist["name"] if panelist else None,
        panelist_role=panelist["role"] if panelist else None,
    )
    db.add(row)
    db.flush()
    return row


async def create_drill(body: DrillRequest, user: User, db: Session) -> SessionDetail:
    from app.ai.dynamic_interview_engine import (
        generate_questions,
        is_technical_breakdown,
        resolve_competencies,
    )
    from app.modules.counsellor.interview_tone import interview_tone

    quota = drill_quota(user, db)
    if quota["remaining"] <= 0:
        raise DrillLimitReached(f"You've used today's {quota['limit']} drills. Come back tomorrow, or start a full interview.")

    prior_question_id: str | None = None
    competencies: list[dict]
    if body.repeat_of:
        prior = (
            db.query(InterviewSession)
            .filter(
                InterviewSession.id == body.repeat_of,
                InterviewSession.user_id == user.id,
                InterviewSession.session_type == "drill",
            )
            .first()
        )
        ids = ((prior.blueprint or {}).get("_question_ids") if prior else None) or []
        if not prior or not ids:
            raise ValueError("That drill can't be repeated.")
        prior_question_id = ids[0]
        competencies = (prior.blueprint or {}).get("_competencies") or []
        body = body.model_copy(update={
            "job_role": prior.job_role or body.job_role,
            "experience_level": prior.experience_level or body.experience_level,
        })

    now = datetime.now(timezone.utc)
    session = InterviewSession(
        user_id=user.id, session_type="drill", total_questions=1, status="in_progress", started_at=now,
        job_role=body.job_role, experience_level=body.experience_level, language=body.language,
    )
    db.add(session)
    # Committed (not just flushed) so model_runs rows logged from another DB
    # connection while generating can reference this session.
    db.commit()

    try:
        with interview_context(str(session.id)):
            if prior_question_id:
                question = db.query(QuestionBank).filter(QuestionBank.id == prior_question_id).first()
                if question is None:
                    raise ValueError("That drill's question is no longer available.")
                skill = core._extract_skill(question.expected_answer_guide) or ""
            else:
                competencies = await resolve_competencies(body.job_role)
                weakest = core._weakest_skills(str(user.id), db)
                skill = _pick_competency(body.competency, competencies, weakest)
                blueprint = {
                    "skills_to_assess": [skill], "question_breakdown": {"behavioral": 1}, "focus_areas": [skill],
                }
                raw = await generate_questions(
                    job_role=body.job_role,
                    experience_level=body.experience_level or "Mid-Level",
                    blueprint=blueprint,
                    count=1,
                    competencies=competencies,
                    language=body.language,
                )
                question = _store_question(
                    raw[0] if raw else {}, skill, body.language,
                    is_technical_breakdown(blueprint["question_breakdown"]), db,
                )

        session.blueprint = {
            "_question_ids": [str(question.id)],
            "_competencies": competencies,
            "_tone": interview_tone(user.id, db),
            "_drill_skill": skill,
        }
        db.commit()
    except Exception:
        db.rollback()
        discard_session(str(session.id), user, db)
        raise

    return get_session(str(session.id), user, db)


async def answer_drill(session_id: str, body: SubmitResponseRequest, user: User, db: Session) -> dict:
    """Record the answer, score it, and return the feedback in one call.
    A crisis signal halts the drill exactly as it does in a full interview."""
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise ValueError("Drill not found.")
    if session.session_type != "drill":
        raise ValueError("This isn't a drill.")

    question_id = ((session.blueprint or {}).get("_question_ids") or [None])[0]
    body = body.model_copy(update={"question_id": question_id, "is_followup": False})
    result = submit_response(session_id, body, user, db)
    if result.get("safety_hold"):
        return result

    complete_session(session_id, user, db)
    await run_grading(session_id)
    feedback: SessionFeedbackResponse = get_session_feedback(session_id, user, db)
    return {"feedback": feedback.model_dump(), "session_id": str(uuid.UUID(str(session_id))), **{
        k: v for k, v in result.items() if k in ("distress", "message")
    }}
