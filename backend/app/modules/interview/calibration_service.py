"""Phase 7 moonshots that are internal/admin-facing rather than candidate-facing:
the human-calibration dashboard (AI-vs-human agreement tracking) and the
predictive-validity correlation view (readiness tier vs. reported outcome).

Kept separate from interview/service.py, which is entirely candidate-facing
interview flow — these two read the same tables but serve a different
audience (staff reviewing quality, not candidates taking interviews).
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.interview import InterviewHumanReview, InterviewOutcome, InterviewSession
from app.models.user import User
from app.modules.interview.schemas import (
    CalibrationStatsOut, HUMAN_RECOMMENDATION_VALUES, HumanReviewOut,
    OutcomeCorrelationOut, OutcomeCorrelationRow, ReviewableSessionOut,
)


def sample_sessions_for_review(limit: int, db: Session) -> list[ReviewableSessionOut]:
    """Completed, AI-scored sessions that don't have a human review yet."""
    already_reviewed = {r.session_id for r in db.query(InterviewHumanReview.session_id).all()}

    sessions = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.status == "completed",
            InterviewSession.job_readiness_report != None,
        )
        .order_by(InterviewSession.completed_at.desc())
        .limit(limit + len(already_reviewed))
        .all()
    )

    out = []
    for s in sessions:
        if s.id in already_reviewed:
            continue
        out.append(ReviewableSessionOut(
            session_id=str(s.id),
            job_role=s.job_role,
            experience_level=s.experience_level,
            completed_at=s.completed_at,
            transcript=_rebuild_transcript(s, db),
        ))
        if len(out) >= limit:
            break
    return out


def _rebuild_transcript(session: InterviewSession, db: Session) -> list[dict]:
    """The readiness report doesn't persist the raw Q&A transcript, so
    reconstruct it from responses for the reviewer to actually read — a
    calibration reviewer scoring blind needs the same material the AI saw."""
    from app.models.interview import SessionResponse
    responses = (
        db.query(SessionResponse)
        .filter(SessionResponse.session_id == session.id)
        .order_by(SessionResponse.sequence_num)
        .all()
    )
    transcript = []
    for r in responses:
        q_text = r.question.question_text if r.question else (r.dynamic_question_text or "")
        transcript.append({"question": q_text, "response": r.response_text})
    return transcript


def submit_human_review(
    session_id: str,
    reviewer: User,
    human_readiness_score: int,
    human_recommendation: str,
    notes: str | None,
    db: Session,
) -> dict:
    if human_recommendation not in HUMAN_RECOMMENDATION_VALUES:
        raise ValueError(f"Invalid recommendation. Must be one of: {', '.join(HUMAN_RECOMMENDATION_VALUES)}")
    if not (0 <= human_readiness_score <= 100):
        raise ValueError("human_readiness_score must be between 0 and 100.")

    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise ValueError("Session not found.")
    if not session.job_readiness_report:
        raise ValueError("Session has no AI-generated readiness report to calibrate against.")

    db.add(InterviewHumanReview(
        session_id=session_id,
        reviewer_user_id=reviewer.id,
        human_readiness_score=human_readiness_score,
        human_recommendation=human_recommendation,
        notes=notes,
    ))
    db.commit()
    return {"message": "Review recorded."}


def get_calibration_stats(db: Session) -> CalibrationStatsOut:
    """AI-vs-human agreement rate — the 11/10 bar the roadmap names directly:
    'AI-assigned readiness tier agrees with a blinded human reviewer's tier
    on >=85% of a sampled set of sessions.'"""
    rows = (
        db.query(InterviewHumanReview, InterviewSession)
        .join(InterviewSession, InterviewHumanReview.session_id == InterviewSession.id)
        .order_by(InterviewHumanReview.created_at.desc())
        .all()
    )

    reviews: list[HumanReviewOut] = []
    agreements = 0
    for review, session in rows:
        report = session.job_readiness_report or {}
        ai_rec = report.get("hiring_recommendation")
        ai_score = report.get("overall_readiness_score")
        agree = ai_rec == review.human_recommendation
        if agree:
            agreements += 1
        reviews.append(HumanReviewOut(
            session_id=str(session.id),
            ai_readiness_score=ai_score,
            ai_recommendation=ai_rec,
            human_readiness_score=review.human_readiness_score,
            human_recommendation=review.human_recommendation,
            agree=agree,
            reviewed_at=review.created_at,
        ))

    total = len(reviews)
    return CalibrationStatsOut(
        total_reviews=total,
        agreement_rate=round(100 * agreements / total, 1) if total else None,
        reviews=reviews,
    )


def get_outcome_correlation(db: Session) -> OutcomeCorrelationOut:
    """Predictive-validity flywheel's actual correlation view: does a higher
    AI readiness tier actually track with better reported outcomes? Answers
    the roadmap's own test directly rather than assuming the scoring is
    calibrated just because it's confident."""
    rows = (
        db.query(InterviewOutcome, InterviewSession)
        .join(InterviewSession, InterviewOutcome.session_id == InterviewSession.id)
        .all()
    )

    by_rec: dict[str, dict[str, int]] = {}
    for outcome, session in rows:
        report = session.job_readiness_report or {}
        rec = report.get("hiring_recommendation") or "Unknown"
        by_rec.setdefault(rec, {})
        by_rec[rec][outcome.outcome] = by_rec[rec].get(outcome.outcome, 0) + 1

    return OutcomeCorrelationOut(
        total_outcomes_reported=len(rows),
        by_recommendation=[
            OutcomeCorrelationRow(hiring_recommendation=rec, total=sum(counts.values()), outcomes=counts)
            for rec, counts in by_rec.items()
        ],
    )
