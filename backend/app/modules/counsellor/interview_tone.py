"""The ONLY thing the AI interview is allowed to know from the counselling side.

The interview engine must never read a candidate's psychological assessment or
counselling conversations. This module is the one-way gate: it looks at the
assessment on the counsellor side and returns a single flag, "gentle" or
"standard", which only changes the interviewer's tone (warmer opening, easier
first question). Rigour, rubric and scoring are identical for both.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

GENTLE = "gentle"
STANDARD = "standard"

BURNOUT_GENTLE_FROM = 60
CONFIDENCE_GENTLE_BELOW = 40


def interview_tone(user_id, db: Session) -> str:
    """Return "gentle" or "standard". Never raises: any problem means standard."""
    try:
        from app.models.user import PsychologicalAssessment

        psych = db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user_id).first()
        if psych is None:
            return STANDARD
        burnout = psych.burnout_score
        confidence = psych.confidence_index
        if burnout is not None and burnout >= BURNOUT_GENTLE_FROM:
            return GENTLE
        if confidence is not None and confidence < CONFIDENCE_GENTLE_BELOW:
            return GENTLE
    except Exception:
        pass
    return STANDARD
