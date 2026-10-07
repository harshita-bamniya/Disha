"""The live Q&A loop: submitting a response, getting the next question."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.interview import InterviewSafetyEvent, InterviewSession, QuestionBank, SessionResponse
from app.models.user import User
from app.modules.interview import policy
from app.modules.interview.safety import CRISIS_MESSAGE, DISTRESS_MESSAGE, HELPLINES, assess_answer
from app.modules.interview.schemas import (
    SubmitResponseRequest,
)
from app.modules.interview.service import core

logger = logging.getLogger(__name__)


_SYNTHETIC_PREFIX = "dyn:"  # prefix in question_text to mark dynamic bank entries


_WEAK_AREA_THRESHOLD = 6   # overall_score below this is a "weak" competency


# A repeat of the same answer to the same question within this window is
# treated as a double-click / network retry, not a second answer.
DUPLICATE_WINDOW_SEC = 15


def _question_belongs_to_session(session: InterviewSession, question_id: str, db: Session) -> bool:
    """A submitted question_id must be a real, active question that this
    session could actually have asked."""
    session_qids = (session.blueprint or {}).get("_question_ids") or []
    if session_qids:
        return question_id in session_qids
    return (
        db.query(QuestionBank.id)
        .filter(QuestionBank.id == question_id, QuestionBank.is_active == True)
        .first()
        is not None
    )


def clamp_response_time(claimed_sec: int, elapsed_since_last_event_sec: float | None) -> int:
    """The client reports how long the answer took, and the pacing/integrity
    notes are computed from it. A candidate can't have taken longer than the
    server-observed gap since the previous event, so cap the claim there
    (+1s of slack) — this stops a candidate from inflating their time to dodge
    the implausible-typing-speed note."""
    claimed = max(0, int(claimed_sec))
    if elapsed_since_last_event_sec is None:
        return claimed
    return min(claimed, max(0, int(elapsed_since_last_event_sec) + 1))


def submit_response(
    session_id: str,
    body: SubmitResponseRequest,
    user: User,
    db: Session,
) -> dict:
    # Row lock: two near-simultaneous submits for one session must queue up so
    # they can't both compute the same sequence number.
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .with_for_update()
        .first()
    )
    if not session:
        raise ValueError("Session not found.")
    if session.status not in ("in_progress", "scheduled"):
        raise ValueError("Session is not active.")

    now = datetime.now(timezone.utc)
    if session.status == "scheduled":
        session.status = "in_progress"
        session.started_at = now

    question_id = body.question_id or None
    if question_id and not _question_belongs_to_session(session, question_id, db):
        raise ValueError("That question does not belong to this interview.")

    last = (
        db.query(SessionResponse)
        .filter(SessionResponse.session_id == session_id)
        .order_by(SessionResponse.sequence_num.desc())
        .first()
    )

    if last is not None:
        same_question = (str(last.question_id) if last.question_id else None) == question_id
        recent = last.submitted_at is not None and (now - last.submitted_at).total_seconds() < DUPLICATE_WINDOW_SEC
        if same_question and recent and last.response_text == body.response_text:
            db.commit()
            return {"response_id": str(last.id), "sequence_num": last.sequence_num, "duplicate": True}

    answered = (
        db.query(func.count(SessionResponse.id))
        .filter(SessionResponse.session_id == session_id)
        .scalar()
        or 0
    )
    # Follow-ups don't use up the planned-question budget, but the total is
    # still bounded so a session can't be fed answers forever.
    if answered >= policy.max_responses(session.total_questions):
        raise ValueError("All questions for this interview have been answered.")

    # Safety net first: a crisis signal halts the interview before anything is
    # stored or scored, and records an event for the human team (matched phrase
    # only, never the answer).
    safety = assess_answer(body.response_text)
    if safety.level == "crisis":
        db.add(InterviewSafetyEvent(
            session_id=session.id, user_id=user.id, severity="critical",
            triggered_by=safety.trigger, action_taken="session_halted",
        ))
        session.status = "abandoned"
        session.grading_status = None
        db.commit()
        logger.critical("[INTERVIEW_SAFETY] crisis signal; session=%s user=%s halted", session_id, user.id)
        return {"safety_hold": True, "message": CRISIS_MESSAGE, "helplines": HELPLINES}

    seq = (last.sequence_num if last else 0) + 1

    # Server-derived: bank questions always carry an id; a follow-up/challenge
    # is generated text with no id. The first answer can be the host's
    # ice-breaker (also id-less) and is never a follow-up.
    is_followup = question_id is None and seq > 1

    prev_event = last.submitted_at if last is not None else session.started_at
    elapsed = (now - prev_event).total_seconds() if prev_event is not None else None

    resp = SessionResponse(
        session_id=session_id,
        question_id=question_id,
        response_text=body.response_text,
        response_time_sec=clamp_response_time(body.response_time_sec, elapsed),
        sequence_num=seq,
        dynamic_question_text=body.question_text if not question_id else None,
        dynamic_question_type=body.question_type if not question_id else None,
        is_followup=is_followup,
    )
    db.add(resp)
    db.flush()

    result: dict = {"response_id": str(resp.id), "sequence_num": seq}
    if safety.level == "distress":
        # Keep the interview going, but never score this answer, and offer a
        # break. Stored on the blueprint to avoid a schema change.
        blueprint = dict(session.blueprint or {})
        blueprint["_distress_response_ids"] = [*(blueprint.get("_distress_response_ids") or []), str(resp.id)]
        session.blueprint = blueprint
        result.update({"distress": True, "message": DISTRESS_MESSAGE})

    db.commit()
    return result


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

    responses = list(session.responses)
    main_remaining = session.total_questions - policy.main_answered(responses)
    followups_so_far = policy.followups_used(responses)
    followup_cap = policy.followup_cap_total(session.total_questions)
    hard_limit = policy.hard_limit_seconds(session.session_type)
    elapsed = (
        (datetime.now(timezone.utc) - session.started_at).total_seconds()
        if session.started_at is not None else None
    )

    question_text = ""
    if resp.question:
        question_text = resp.question.question_text
    elif resp.dynamic_question_text:
        question_text = resp.dynamic_question_text
    skill_topic = resp.question.question_type if resp.question else resp.dynamic_question_type

    # Only ask the model whether to probe when a probe is actually allowed.
    # Otherwise the answer is already decided by the rules below, so skip the
    # LLM call entirely (this was a paid call on every answer before).
    probe_possible = (
        not already_probed
        and followups_so_far < followup_cap
        and (elapsed is None or hard_limit - elapsed >= policy.MIN_SECONDS_FOR_FOLLOWUP)
    )
    if probe_possible:
        from app.ai.adaptive_interviewer import decide_next_action
        from app.ai.usage import interview_context
        with interview_context(session_id):
            decision = await decide_next_action(
                question_text=question_text,
                response_text=resp.response_text or "",
                interview_type=session.session_type or "practice",
                questions_remaining=main_remaining,
                skill_topic=skill_topic,
                already_probed=already_probed,
                recent_history=core._recent_history(session, response_id),
                job_role=session.job_role,
            )
    else:
        decision = {"action": "next_question", "provisional_score": 5, "coaching_note": ""}

    follow_up_q = decision.get("follow_up_question")

    # Code wins over the model: it only suggests, the rules in policy decide.
    verdict = policy.choose_action(
        decision.get("action"),
        bool(follow_up_q),
        main_remaining=main_remaining,
        followups_used_total=followups_so_far,
        followup_cap=followup_cap,
        already_probed=already_probed,
        elapsed_sec=elapsed,
        hard_limit_sec=hard_limit,
    )
    logger.info("[INTERVIEW] session=%s action=%s reason=%s main_remaining=%s followups=%s/%s",
                session_id, verdict.action, verdict.reason, main_remaining, followups_so_far, followup_cap)

    if verdict.action == "close":
        return {
            "action": "next_question",
            "question": None,
            "provisional_score": decision.get("provisional_score", 5),
            "coaching_note": "",
            "session_complete": True,
        }

    # A follow-up is the same interviewer probing deeper on their own question,
    # not a new panelist stepping in — carry the original question's persona
    # through rather than re-deriving or dropping it.
    if resp.question:
        followup_panelist = {"name": resp.question.panelist_name, "role": resp.question.panelist_role}
    else:
        from app.ai.dynamic_interview_engine import is_technical_breakdown, panelist_for_question_type
        is_technical_role = is_technical_breakdown((session.blueprint or {}).get("question_breakdown"))
        followup_panelist = panelist_for_question_type(resp.dynamic_question_type, is_technical_role) or {"name": None, "role": None}

    if verdict.action in ("follow_up", "challenge"):
        return {
            "action": verdict.action,
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

    next_q = policy.pick_next_question(
        remaining,
        (session.blueprint or {}).get("difficulty_ramp"),
        (session.blueprint or {}).get("_question_ids"),
    )
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

