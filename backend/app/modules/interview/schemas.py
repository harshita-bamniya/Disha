from __future__ import annotations
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


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

    class Config:
        from_attributes = True


class SubmittedResponseOut(BaseModel):
    id: str
    question_text: str
    question_type: Optional[str] = None
    response_text: str
    sequence_num: int

    class Config:
        from_attributes = True


class SessionDetail(SessionSummary):
    questions: list[QuestionOut]
    responses: list[SubmittedResponseOut] = []


class CreateSessionRequest(BaseModel):
    career_track_id: Optional[str] = None
    session_type: str = "practice"
    total_questions: int = 5
    difficulty: Optional[str] = None
    job_context: Optional[str] = None
    # New dynamic interview fields
    job_role: Optional[str] = None
    experience_level: Optional[str] = None
    job_description: Optional[str] = None


class SubmitResponseRequest(BaseModel):
    question_id: Optional[str] = None
    question_text: Optional[str] = None
    question_type: Optional[str] = None
    response_text: str
    response_time_sec: int = 0
    is_followup: bool = False


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
    confidence_score: float
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


class SessionFeedbackResponse(BaseModel):
    session_id: str
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
