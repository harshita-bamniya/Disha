"""Readiness report generation, session feedback, performance, and outcome tracking."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.interview import (
    InterviewFeedback,
    InterviewOutcome,
    InterviewSession,
    QuestionBank,
    SessionResponse,
)
from app.models.user import User
from app.modules.interview import feedback_ai
from app.ai.usage import tracked_complete
from app.modules.interview.schemas import (
    GRADING_DONE,
    GRADING_FAILED,
    GRADING_PENDING,
    GRADING_RUNNING,
    CompleteSessionResponse,
    FeedbackOut,
    JobReadinessReport,
    PerformanceResponse,
    SessionFeedbackResponse,
)
from app.modules.interview import scoring, transition
from app.modules.interview.service import core

logger = logging.getLogger(__name__)


class GradingUnavailable(Exception):
    """Scoring produced nothing usable (provider outage or quota), so grading
    is marked failed and can be retried instead of showing an empty report."""


_SYNTHETIC_PREFIX = "dyn:"  # prefix in question_text to mark dynamic bank entries


_WEAK_AREA_THRESHOLD = 6   # overall_score below this is a "weak" competency


async def _verified_second_pass(provider, system: str, user_msg: str, first: dict):
    """Verified interviews score every answer twice, independently, and
    reconcile. Returns (merged, note, passes): `note` is set when the two
    passes disagree (the answer then goes to a human), `passes` records both
    overall scores. If the second call fails the first pass stands."""
    try:
        result = await tracked_complete(
            provider, "answer_score_pass2", system, [{"role": "user", "content": user_msg}], temperature=0.4,
        )
        second = feedback_ai.parse_feedback_response(result.content)
    except Exception as exc:
        logger.warning("[INTERVIEW AI] Verification pass failed: %s", exc)
        return first, None, None
    merged, disagreed = scoring.reconcile_passes(first, second)
    note = None
    if disagreed:
        note = (
            f"Two independent scoring passes disagreed ({first.get('overall_score')}/10 vs "
            f"{second.get('overall_score')}/10), so this answer is flagged for human review."
        )
    return merged, note, {"pass_1": first.get("overall_score"), "pass_2": second.get("overall_score")}


def _transcript_entry(resp, fb, question_text, question_type, skill_assessed, difficulty) -> dict:
    """One answer, in the shape the report builder and scoring.py consume."""
    ok = not fb.is_fallback

    def score(value):
        # Never substitute a fake score, whether missing (None) or a
        # fabricated fallback placeholder.
        return value if (value is not None and ok) else 0

    return {
        "question": question_text,
        "question_type": question_type or "behavioral",
        "skill_assessed": skill_assessed or "General",
        "response": resp.response_text or "",
        "response_time_sec": resp.response_time_sec or 0,
        "is_followup": bool(resp.is_followup),
        "difficulty": difficulty,
        "is_fallback": bool(fb.is_fallback),
        "judge_disagreement": bool(fb.judge_disagreement_note),
        "clarity": score(fb.clarity_score),
        "conciseness": score(fb.conciseness_score),
        "relevance": score(fb.relevance_score),
        "impact": score(fb.impact_score),
        "overall": score(fb.overall_score),
    }


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
        from app.ai.dynamic_interview_engine import (
            generate_job_readiness_report,
            get_competencies,
        )
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
            language=session.language or "en",
        )
        # Code-level backstop for verbatim/near-verbatim repeats — catches
        # what the LLM might miss, independent of its own judgment.
        code_notes = core._detect_verbatim_repeats(transcript_for_report)
        if code_notes:
            raw_report["consistency_notes"] = [
                *raw_report.get("consistency_notes", []), *code_notes
            ]

        # Timing-based pacing and integrity signals — both computed purely
        # from response_time_sec (already captured, previously unused).
        raw_report["pacing_notes"] = core._pacing_notes(transcript_for_report)
        raw_report["integrity_notes"] = core._integrity_notes(transcript_for_report)

        # The model wrote the narrative; the numbers are computed here from the
        # per-answer scores and the competency weights (reproducible, and
        # explainable down to which answers produced which score). Skipped when
        # the model call itself failed, so an error report stays an error report.
        if not raw_report.get("error"):
            from app.ai.dynamic_interview_engine import _enforce_completeness_cap

            scoring.apply_code_scoring(raw_report, transcript_for_report, competencies)
            main_answered = sum(1 for e in transcript_for_report if not e.get("is_followup"))
            planned = session.total_questions or main_answered or 1
            _enforce_completeness_cap(raw_report, round(main_answered / planned * 100))
            scoring.apply_completeness(raw_report, main_answered, planned)

        session.job_readiness_report = raw_report
        db.commit()
        return JobReadinessReport(**raw_report)
    except Exception as exc:
        logger.warning("[INTERVIEW] Job readiness report failed: %s", exc)
        return None


# A grading run that has been "running"/"pending" longer than this is assumed
# dead (worker crash, lost task) so the candidate can retry instead of waiting
# forever.
GRADING_STALE_AFTER = timedelta(minutes=15)


def effective_grading_status(session: InterviewSession, now: datetime | None = None) -> str:
    """The grading status a client should see: NULL (completed before async
    grading existed) means done, and a run stuck past GRADING_STALE_AFTER
    counts as failed."""
    status = session.grading_status
    if status is None or status in (GRADING_DONE, GRADING_FAILED):
        return status or GRADING_DONE
    now = now or datetime.now(timezone.utc)
    since = session.grading_started_at or session.completed_at
    if since is not None and now - since > GRADING_STALE_AFTER:
        return GRADING_FAILED
    return status


def complete_session(session_id: str, user: User, db: Session) -> tuple[CompleteSessionResponse, bool]:
    """Mark the interview finished and queue grading — returns immediately.

    Returns (response, needs_dispatch). needs_dispatch is True when grading was
    newly queued (the caller starts it); calling /complete again on an already
    completed session just reports its current state.
    """
    session = (
        db.query(InterviewSession)
        .options(selectinload(InterviewSession.responses))
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .with_for_update()
        .first()
    )
    if not session:
        raise ValueError("Session not found.")
    if session.status == "completed":
        db.commit()
        return CompleteSessionResponse(
            session_id=session_id, status=session.status, grading_status=effective_grading_status(session)
        ), False
    if session.status == "abandoned":
        # A safety halt (or any abandoned session) is never graded or scored.
        raise ValueError("This interview was stopped and can't be scored.")
    if not session.responses:
        raise ValueError("No responses submitted.")

    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)
    session.grading_status = GRADING_PENDING
    db.commit()
    return CompleteSessionResponse(session_id=session_id, status="completed", grading_status=GRADING_PENDING), True


def regrade_session(session_id: str, user: User, db: Session) -> tuple[CompleteSessionResponse, bool]:
    """Retry grading for a completed session whose background grading failed
    (or went stale). Refuses to re-grade a session that already has feedback."""
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .with_for_update()
        .first()
    )
    if not session:
        raise ValueError("Session not found.")
    if session.status != "completed":
        raise ValueError("Session is not completed yet.")
    current = effective_grading_status(session)
    if current != GRADING_FAILED:
        db.commit()
        return CompleteSessionResponse(session_id=session_id, status=session.status, grading_status=current), False
    session.grading_status = GRADING_PENDING
    # Restart the staleness clock now. Left empty it would fall back to
    # completed_at (long ago), so the retry would read as "failed" straight away.
    session.grading_started_at = datetime.now(timezone.utc)
    db.commit()
    return CompleteSessionResponse(session_id=session_id, status=session.status, grading_status=GRADING_PENDING), True


def _claim_grading(session_id: str, db: Session) -> bool:
    """Atomically move pending/failed/stale -> running so only one worker
    grades a session even if the task is delivered twice."""
    now = datetime.now(timezone.utc)
    stale_before = now - GRADING_STALE_AFTER
    claimed = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == session_id,
            InterviewSession.status == "completed",
            or_(
                InterviewSession.grading_status.in_([GRADING_PENDING, GRADING_FAILED]),
                and_(
                    InterviewSession.grading_status == GRADING_RUNNING,
                    InterviewSession.grading_started_at < stale_before,
                ),
            ),
        )
        .update(
            {"grading_status": GRADING_RUNNING, "grading_started_at": now},
            synchronize_session=False,
        )
    )
    db.commit()
    return bool(claimed)


async def run_grading(session_id: str) -> None:
    """Grade a completed interview in the background (called from the Celery
    task, or from a FastAPI background task if the broker is down). Opens its
    own DB session; never raises."""
    from app.ai.usage import interview_context
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        if not _claim_grading(session_id, db):
            logger.info("[INTERVIEW] grading for %s not claimable (already done/running) — skipping", session_id)
            return
        session = (
            db.query(InterviewSession)
            .options(
                joinedload(InterviewSession.career_track),
                joinedload(InterviewSession.responses).joinedload(SessionResponse.question),
            )
            .filter(InterviewSession.id == session_id)
            .first()
        )
        user = db.query(User).filter(User.id == session.user_id).first() if session else None
        if not session or not user:
            return
        try:
            with interview_context(session_id):
                await _grade_session(session, user, db, light=session.session_type == "drill")
            session.grading_status = GRADING_DONE
            db.commit()
            try:
                from app.modules.interview.service import verified
                verified.on_graded(session_id, db)
            except Exception:
                logger.exception("[INTERVIEW] verified hand-off failed for session=%s", session_id)
                db.rollback()
        except Exception:
            logger.exception("[INTERVIEW] grading failed for session=%s", session_id)
            db.rollback()
            db.query(InterviewSession).filter(InterviewSession.id == session_id).update(
                {"grading_status": GRADING_FAILED}, synchronize_session=False
            )
            db.commit()
    finally:
        db.close()


async def _grade_session(
    session: InterviewSession, user: User, db: Session, *, light: bool = False,
) -> SessionFeedbackResponse:
    """Score every answer, build the readiness report, award XP. Safe to run
    again after a partial failure: previous feedback rows are cleared first.

    light=True (drills): one scoring call per answer and nothing else. No
    second-opinion judges, no readiness report, no XP, so a drill costs a
    fraction of an interview and can't be farmed for points."""
    session_id = str(session.id)
    db.query(InterviewFeedback).filter(InterviewFeedback.session_id == session.id).delete(
        synchronize_session=False
    )
    db.flush()

    feedback_items: list[FeedbackOut] = []
    track_name = session.career_track.title if session.career_track else (session.job_role or "General")

    try:
        from app.ai.providers import create_provider
        provider = create_provider()
    except Exception:
        provider = None

    transcript_for_report: list[dict] = []
    distress_ids = set((session.blueprint or {}).get("_distress_response_ids") or [])
    # A follow-up probes the question before it, so it inherits that topic and
    # difficulty instead of showing up as "General".
    last_main_skill = None
    last_main_difficulty = None

    for resp in session.responses:
        question_text = ""
        question_type = None
        skill_assessed = None

        if resp.question:
            question_text = resp.question.question_text
            question_type = resp.question.question_type
            skill_assessed = core._extract_skill(resp.question.expected_answer_guide)
        elif resp.dynamic_question_text:
            question_text = resp.dynamic_question_text
            question_type = resp.dynamic_question_type

        is_transition = transition.is_transition_answer(session.blueprint, resp)
        if is_transition:
            skill_assessed = transition.TRANSITION_SKILL

        difficulty = resp.question.difficulty if resp.question else None
        if resp.is_followup:
            skill_assessed = skill_assessed or last_main_skill
            difficulty = difficulty or last_main_difficulty
        else:
            last_main_skill, last_main_difficulty = skill_assessed, difficulty

        is_fallback = False
        pass_note = None
        pass_scores = None
        if str(resp.id) in distress_ids:
            # The candidate was showing signs of distress on this answer; it is
            # never scored.
            parsed = core._default_feedback()
            is_fallback = True
        elif provider:
            try:
                feedback_ai.validate_response_text(resp.response_text or "")
                if is_transition:
                    sys_p, user_p = feedback_ai.build_transition_prompt(
                        question_text, resp.response_text, session.job_role, session.language or "en",
                    )
                else:
                    sys_p, user_p = feedback_ai.build_feedback_prompt(
                        question_text, resp.response_text, track_name, session.session_type,
                        session.language or "en",
                    )
                try:
                    ai_resp = await tracked_complete(provider, "answer_score", sys_p, [{"role": "user", "content": user_p}], temperature=0.1)
                    parsed = feedback_ai.parse_feedback_response(ai_resp.content)
                except Exception as first_exc:
                    logger.warning("[INTERVIEW AI] Feedback attempt 1 failed for response=%s: %s — retrying once", resp.id, first_exc)
                    ai_resp = await tracked_complete(provider, "answer_score_retry", sys_p, [{"role": "user", "content": user_p}], temperature=0.1)
                    parsed = feedback_ai.parse_feedback_response(ai_resp.content)
                if session.mode == "verified":
                    parsed, pass_note, pass_scores = await _verified_second_pass(provider, sys_p, user_p, parsed)
            except Exception as exc:
                from app.core.exceptions import BadRequestException
                if not isinstance(exc, BadRequestException):
                    logger.warning("[INTERVIEW AI] Feedback failed for response=%s after retry: %s", resp.id, exc)
                parsed = core._default_feedback()
                is_fallback = True
        else:
            parsed = core._default_feedback()
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
        if not light and session.mode != "verified" and not is_fallback and provider and answer_word_count >= _LOW_STAKES_WORD_COUNT:
            try:
                import asyncio

                from app.ai.providers import create_provider
                from app.ai.providers.groq import LIGHT_MODEL
                judge_provider = create_provider(model=LIGHT_MODEL, reasoning_effort="low")

                async def _run_judge(persona: str):
                    sys_p, user_p = feedback_ai.build_judge_prompt(persona, question_text, resp.response_text, track_name)
                    result = await tracked_complete(judge_provider, f"judge_{persona}", sys_p, [{"role": "user", "content": user_p}], max_tokens=200, temperature=0.3)
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

        if pass_scores:
            # Verified: the two scoring passes replace the persona judges.
            judge_scores, judge_disagreement_note = pass_scores, pass_note

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
            # Judge verdicts are raw model text; they get the same wording rules as the report.
            judge_disagreement_note=scoring.sanitize_text(judge_disagreement_note) if judge_disagreement_note else None,
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

        transcript_for_report.append(
            _transcript_entry(resp, fb, question_text, question_type, skill_assessed, difficulty)
        )

    db.commit()

    scores = [f.overall_score for f in feedback_items if f.overall_score is not None and not f.is_fallback]
    avg = round(sum(scores) / len(scores), 1) if scores else 0.0

    # ── Job Readiness Report (only for role-specific sessions) ────────────────
    readiness_report = None
    if session.job_role and transcript_for_report and not light:
        readiness_report = await _generate_and_store_readiness_report(session, transcript_for_report, db)

    # Nothing could be scored (provider outage / quota) or the report itself
    # failed: this is a failed grading to retry, not a finished interview. No XP.
    scorable = [f for f in feedback_items if str(f.response_id) not in distress_ids]
    if scorable and (not scores or (readiness_report is not None and readiness_report.error) or (
        session.job_role and not light and readiness_report is None
    )):
        raise GradingUnavailable("The AI scoring service could not produce a real score.")

    # XP award (never for drills)
    try:
        if not light:
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

    weak_skills = core._weakest_skills(str(user.id), db)
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


def feedback_items(session_id, db: Session) -> list[FeedbackOut]:
    """Per-answer feedback for a session, in the order the questions were
    asked. The career-transition answer carries its own skill label, and a
    follow-up carries the topic of the question it probed."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    blueprint = session.blueprint if session else None
    feedback_rows = (
        db.query(InterviewFeedback, SessionResponse)
        .join(SessionResponse, InterviewFeedback.response_id == SessionResponse.id)
        .outerjoin(QuestionBank, SessionResponse.question_id == QuestionBank.id)
        .filter(InterviewFeedback.session_id == session_id)
        .order_by(SessionResponse.sequence_num)
        .all()
    )

    items: list[FeedbackOut] = []
    last_main_skill = None
    for fb, resp in feedback_rows:
        q_text = ""
        q_type = None
        skill_assessed = None
        if resp.question:
            q_text = resp.question.question_text
            q_type = resp.question.question_type
            skill_assessed = core._extract_skill(resp.question.expected_answer_guide)
        elif resp.dynamic_question_text:
            q_text = resp.dynamic_question_text
            q_type = resp.dynamic_question_type
        if transition.is_transition_answer(blueprint, resp):
            skill_assessed = transition.TRANSITION_SKILL
        if resp.is_followup:
            skill_assessed = skill_assessed or last_main_skill
        else:
            last_main_skill = skill_assessed

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
    return items


def get_session_feedback(session_id: str, user: User, db: Session) -> SessionFeedbackResponse:
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise ValueError("Session not found.")

    items = feedback_items(session_id, db)

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
        mode=session.mode or "practice",
        grading_status=effective_grading_status(session),
        overall_avg=avg,
        feedback_items=items,
        job_readiness_report=readiness_report,
        weak_skills=core._weakest_skills(str(user.id), db),
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
    last_main_skill = None
    last_main_difficulty = None
    for fb, resp in sorted(feedback_rows, key=lambda pair: pair[1].sequence_num):
        if resp.question:
            question_text = resp.question.question_text
            question_type = resp.question.question_type
            skill_assessed = core._extract_skill(resp.question.expected_answer_guide)
        else:
            question_text = resp.dynamic_question_text or ""
            question_type = resp.dynamic_question_type
            skill_assessed = None

        difficulty = resp.question.difficulty if resp.question else None
        if resp.is_followup:
            skill_assessed = skill_assessed or last_main_skill
            difficulty = difficulty or last_main_difficulty
        else:
            last_main_skill, last_main_difficulty = skill_assessed, difficulty

        transcript_for_report.append(
            _transcript_entry(resp, fb, question_text, question_type, skill_assessed, difficulty)
        )

    from app.ai.usage import interview_context
    with interview_context(session_id):
        await _generate_and_store_readiness_report(session, transcript_for_report, db)
    return get_session_feedback(session_id, user, db)


def is_completed_practice(session) -> bool:
    """A finished full practice interview. Drills and employer-invited
    (verified) interviews are not "practice interviews" and don't count."""
    return (
        session.status == "completed"
        and session.session_type != "drill"
        and (getattr(session, "mode", None) or "practice") != "verified"
    )


def get_performance(user: User, db: Session) -> PerformanceResponse:
    sessions = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == user.id)
        .all()
    )
    total = len(sessions)
    completed = sum(1 for s in sessions if is_completed_practice(s))

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
        by_skill=core._skill_breakdown(str(user.id), db),
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

