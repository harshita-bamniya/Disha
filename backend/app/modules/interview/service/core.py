"""Shared text-analysis and skill-scoring helpers used by every sub-module."""
from __future__ import annotations

import logging
import re

from sqlalchemy.orm import Session

from app.models.interview import (
    InterviewFeedback,
    InterviewSession,
    QuestionBank,
    SessionResponse,
)

logger = logging.getLogger(__name__)

_SYNTHETIC_PREFIX = "dyn:"  # prefix in question_text to mark dynamic bank entries

_WEAK_AREA_THRESHOLD = 6   # overall_score below this is a "weak" competency


_JD_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "have", "will",
    "your", "you", "are", "our", "who", "what", "how", "not", "but", "can",
    "all", "any", "use", "using", "team", "work", "role", "years", "experience",
    "ability", "strong", "excellent", "including", "such", "into", "than",
    "their", "them", "they", "about", "also", "able", "must", "should",
    "would", "while", "where", "when", "other", "these", "those", "each",
}


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


def _skill_breakdown(user_id: str, db: Session) -> list[dict]:
    """Every assessed skill with its running average, weakest first."""
    history = _skill_score_history(user_id, db)
    breakdown = [
        {"skill": skill, "avg_score": round(sum(scores) / len(scores), 1), "attempts": len(scores)}
        for skill, scores in history.items()
    ]
    breakdown.sort(key=lambda d: d["avg_score"])
    return breakdown


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

