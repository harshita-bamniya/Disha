from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class QuestionOut(BaseModel):
    id: str
    question_text: str
    question_type: Optional[str]
    difficulty: Optional[str]
    language: str
    career_track_id: Optional[str]
    skill_assessed: Optional[str] = None
    is_dynamic: bool = False
    panelist_name: Optional[str] = None
    panelist_role: Optional[str] = None

    class Config:
        from_attributes = True


class SessionSummary(BaseModel):
    id: str
    career_track_name: Optional[str]
    session_type: str
    status: str
    total_questions: int
    responses_count: int
    avg_score: Optional[float]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    job_role: Optional[str] = None
    experience_level: Optional[str] = None
    blueprint: Optional[dict] = None
    language: str = "en"
    # practice | verified (an employer-invited interview)
    mode: str = "practice"

    @field_validator("blueprint")
    @classmethod
    def _public_blueprint(cls, value: Optional[dict]) -> Optional[dict]:
        """Underscore keys are server-internal (question ids, scoring weights, the
        counsellor-side tone flag). They never leave the API; only the drill label does."""
        if value is None:
            return None
        return {k: v for k, v in value.items() if not k.startswith("_") or k == "_drill_skill"}

    class Config:
        from_attributes = True


class SubmittedResponseOut(BaseModel):
    id: str
    question_text: str
    question_type: Optional[str] = None
    response_text: str
    sequence_num: int
    is_followup: bool = False

    class Config:
        from_attributes = True


class SessionDetail(SessionSummary):
    questions: list[QuestionOut]
    responses: list[SubmittedResponseOut] = []
    # True only if the candidate opted in to keeping their answer audio.
    saving_audio: bool = False


MAX_QUESTIONS = 15
MAX_ANSWER_CHARS = 5000
MAX_RESPONSE_SECONDS = 3600


def _valid_uuid(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return None
    try:
        return str(UUID(str(value)))
    except ValueError:
        raise ValueError("must be a valid UUID")


class CreateSessionRequest(BaseModel):
    career_track_id: Optional[str] = None
    # "drill" is created through /drills, not here. "stress" is checked for eligibility.
    session_type: Literal["practice", "timed", "full_mock", "stress"] = "practice"
    total_questions: int = Field(default=5, ge=1, le=MAX_QUESTIONS)
    difficulty: Optional[str] = Field(default=None, max_length=10)
    job_context: Optional[str] = Field(default=None, max_length=2000)
    # New dynamic interview fields
    job_role: Optional[str] = Field(default=None, max_length=150)
    experience_level: Optional[str] = Field(default=None, max_length=50)
    job_description: Optional[str] = Field(default=None, max_length=6000)
    # What the candidate agreed to on the instructions page. "ai_processing"
    # is required: answers are sent to an AI provider to be scored.
    consents: list[Literal["ai_processing", "own_effort", "improve_product", "media", "employer_share"]] = []
    # Language the interview is conducted in; answers may mix languages freely.
    language: Literal["en", "hi", "hinglish"] = "en"

    _check_track = field_validator("career_track_id")(_valid_uuid)


class DrillRequest(BaseModel):
    """One question, one answer, instant feedback."""
    job_role: str = Field(min_length=2, max_length=150)
    experience_level: Optional[str] = Field(default=None, max_length=50)
    language: Literal["en", "hi", "hinglish"] = "en"
    # Which competency to drill; default is the candidate's weakest so far.
    competency: Optional[str] = Field(default=None, max_length=120)
    # Retry the exact question of an earlier drill.
    repeat_of: Optional[str] = None
    consents: list[Literal["ai_processing", "own_effort", "improve_product", "media"]] = []

    _check_repeat = field_validator("repeat_of")(_valid_uuid)


class SubmitResponseRequest(BaseModel):
    question_id: Optional[str] = None
    # Verified interviews: the id of the follow-up the SERVER issued. The server
    # looks the question text up itself and ignores question_text/question_type.
    followup_id: Optional[str] = None
    question_text: Optional[str] = Field(default=None, max_length=2000)
    question_type: Optional[str] = Field(default=None, max_length=50)
    response_text: str = Field(max_length=MAX_ANSWER_CHARS)
    response_time_sec: int = Field(default=0, ge=0, le=MAX_RESPONSE_SECONDS)
    # Kept so older clients still validate; the server derives this itself and
    # ignores whatever the client sends (see service.interaction.submit_response).
    is_followup: bool = False

    _check_question = field_validator("question_id", "followup_id")(_valid_uuid)

    @field_validator("response_text")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("response_text must not be empty")
        return v


class RoadmapStep(BaseModel):
    week_range: str
    focus: str
    action: str
    resource_type: str


class JobReadinessReport(BaseModel):
    job_role: str
    experience_level: Optional[str]
    overall_readiness_score: float
    technical_readiness_score: float
    communication_score: float
    # No longer reported (confidence can't be validly inferred); kept at 0 so
    # older stored reports and clients still parse.
    confidence_score: float = 0
    hiring_recommendation: str
    hiring_recommendation_reason: str
    strengths: list[str]
    critical_gaps: list[str]
    skill_scores: dict[str, float]
    competencies: list[dict]
    candidate_summary: str
    roadmap: list[dict]
    readiness_message: str
    consistency_notes: list[str] = []
    confidence_note: Optional[str] = None
    pacing_notes: list[str] = []
    integrity_notes: list[str] = []
    # Objective, coaching-only signals from the answer text (never scored).
    delivery: Optional[dict] = None
    # The model's own estimate, kept for audit; the headline score is computed
    # in code from the per-answer scores.
    llm_overall_readiness_score: Optional[float] = None
    needs_human_review: bool = False
    review_reasons: list[str] = []
    # Employer-facing band for verified interviews (Strong fit / Good fit / Developing / Not yet a fit / Needs human review)
    fit_band: Optional[str] = None
    # Audit finding (2026-08-24): a degraded/fallback report (LLM call failed
    # twice, or was rate-limited past the fallback provider too) was
    # indistinguishable from a real one once it crossed the API boundary —
    # _default_readiness_report() tags it internally with "error": True, but
    # this schema dropped the field, so the frontend rendered "0% / No Hire /
    # report generation failed" as if it were the candidate's real,
    # final assessment, with no error state at all.
    error: bool = False


class FeedbackOut(BaseModel):
    id: str
    response_id: Optional[str]
    question_text: Optional[str]
    question_type: Optional[str] = None
    skill_assessed: Optional[str] = None
    original_response: Optional[str]
    clarity_score: Optional[int]
    conciseness_score: Optional[int]
    impact_score: Optional[int]
    relevance_score: Optional[int]
    star_adherence: Optional[int]
    overall_score: Optional[int]
    strengths: list[str]
    improvements: list[str]
    rewritten_answer: Optional[str]
    is_fallback: bool = False
    evidence_quote: Optional[str] = None
    judge_scores: Optional[dict[str, int]] = None
    judge_disagreement_note: Optional[str] = None

    class Config:
        from_attributes = True


GRADING_PENDING = "pending"
GRADING_RUNNING = "running"
GRADING_DONE = "done"
GRADING_FAILED = "failed"


class CompleteSessionResponse(BaseModel):
    """Returned immediately by /complete: grading runs in the background and
    the client polls /feedback until grading_status is 'done' or 'failed'."""
    session_id: str
    status: str
    grading_status: str


class SessionFeedbackResponse(BaseModel):
    session_id: str
    mode: str = "practice"
    # 'pending'/'running' while background grading is in progress, 'failed' if
    # it errored (retry via POST /regrade), 'done' once feedback exists. Older
    # sessions graded inline are always 'done'.
    grading_status: str = GRADING_DONE
    overall_avg: float
    feedback_items: list[FeedbackOut]
    job_readiness_report: Optional[JobReadinessReport] = None
    weak_skills: list[str] = []
    outcome_reported: bool = False
    reported_outcome: Optional[str] = None


# ─── Predictive-validity flywheel ───────────────────────────────────────────

OUTCOME_VALUES = ("interview_scheduled", "offer_received", "rejected", "no_response", "did_not_apply")


class SubmitOutcomeRequest(BaseModel):
    outcome: str
    notes: Optional[str] = None


class OutcomeOut(BaseModel):
    outcome: str
    notes: Optional[str] = None
    reported_at: datetime

    class Config:
        from_attributes = True


class SkillPerformanceOut(BaseModel):
    skill: str
    avg_score: float
    attempts: int


class PerformanceResponse(BaseModel):
    total_sessions: int
    completed_sessions: int
    avg_overall_score: float
    avg_clarity: float
    avg_conciseness: float
    avg_impact: float
    best_session_score: float
    sessions_by_type: dict[str, int]
    by_skill: list[SkillPerformanceOut] = []


# ─── Human-calibration dashboard (internal/admin only) ──────────────────────

HUMAN_RECOMMENDATION_VALUES = ("Strong Hire", "Hire", "Maybe", "No Hire")


class ReviewableSessionOut(BaseModel):
    """A completed, AI-scored session awaiting a blind human review — the AI's
    own verdict is deliberately withheld from this model so the admin UI can't
    accidentally show it before the reviewer forms an independent opinion."""
    session_id: str
    job_role: Optional[str] = None
    experience_level: Optional[str] = None
    completed_at: Optional[datetime] = None
    transcript: list[dict]


class SubmitHumanReviewRequest(BaseModel):
    human_readiness_score: int
    human_recommendation: str
    notes: Optional[str] = None


class HumanReviewOut(BaseModel):
    session_id: str
    ai_readiness_score: Optional[float] = None
    ai_recommendation: Optional[str] = None
    human_readiness_score: int
    human_recommendation: str
    agree: bool
    reviewed_at: datetime


class CalibrationStatsOut(BaseModel):
    total_reviews: int
    agreement_rate: Optional[float] = None
    reviews: list[HumanReviewOut] = []


# ─── Predictive-validity flywheel — admin correlation view ──────────────────

class OutcomeCorrelationRow(BaseModel):
    hiring_recommendation: str
    total: int
    outcomes: dict[str, int]


class OutcomeCorrelationOut(BaseModel):
    total_outcomes_reported: int
    by_recommendation: list[OutcomeCorrelationRow] = []
