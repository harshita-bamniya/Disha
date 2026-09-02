"""Readiness report generation, session feedback, performance, and outcome tracking."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from app.models.interview import (
    InterviewFeedback,
    InterviewOutcome,
    InterviewSession,
    QuestionBank,
    SessionResponse,
)
from app.models.user import User
from app.modules.interview import feedback_ai
from app.modules.interview.schemas import (
    FeedbackOut,
    JobReadinessReport,
    PerformanceResponse,
    SessionFeedbackResponse,
)
from app.modules.interview.service import core

logger = logging.getLogger(__name__)


_SYNTHETIC_PREFIX = "dyn:"  # prefix in question_text to mark dynamic bank entries


_WEAK_AREA_THRESHOLD = 6   # overall_score below this is a "weak" competency


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
        code_notes = core._detect_verbatim_repeats(transcript_for_report)
        if code_notes:
            raw_report["consistency_notes"] = [
                *raw_report.get("consistency_notes", []), *code_notes
            ]

        # Timing-based pacing and integrity signals — both computed purely
        # from response_time_sec (already captured, previously unused).
        raw_report["pacing_notes"] = core._pacing_notes(transcript_for_report)
        raw_report["integrity_notes"] = core._integrity_notes(transcript_for_report)

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
            skill_assessed = core._extract_skill(resp.question.expected_answer_guide)
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
            skill_assessed = core._extract_skill(resp.question.expected_answer_guide)
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
    for fb, resp in sorted(feedback_rows, key=lambda pair: pair[1].sequence_num):
        if resp.question:
            question_text = resp.question.question_text
            question_type = resp.question.question_type
            skill_assessed = core._extract_skill(resp.question.expected_answer_guide)
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

