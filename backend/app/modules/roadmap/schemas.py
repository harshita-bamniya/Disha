"""Pydantic schemas for the Roadmap API."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Stage config (per-stage summary returned to frontend) ─────────────────────

class StageStatus(BaseModel):
    stage_number: int
    title: str
    description: str
    status: str                          # pending | active | passed
    estimated_days: int | None
    progress_pct: int = 0                # 0-100 within the stage
    gate: dict[str, Any] | None = None  # gate criteria + current values


# ── Roadmap responses ──────────────────────────────────────────────────────────

class RoadmapOut(BaseModel):
    id: str
    career_track_id: str | None
    career_track_name: str | None
    current_stage: int
    gap_skills: list[str]
    job_readiness_score: int
    narrative_score: int | None
    narrative_feedback: dict[str, Any] | None
    stages: list[StageStatus]
    generated_at: datetime
    last_recalibrated: datetime
    # Active prep job (set when user pins a job to prep for)
    active_prep_job_id: str | None = None
    active_prep_job_title: str | None = None
    active_prep_job_company: str | None = None

    class Config:
        from_attributes = True


class JRSBreakdown(BaseModel):
    total: int                    # 0-100 composite
    profile_score: float          # out of 10
    skill_coverage_score: float   # out of 25
    competence_score: float       # out of 20
    narrative_score: float        # out of 15
    resume_score: float           # out of 15
    interview_score: float        # out of 15


# ── Narrative ─────────────────────────────────────────────────────────────────

class NarrativeSubmitRequest(BaseModel):
    narrative_text: str = Field(..., min_length=100, max_length=5000)


class NarrativeFeedbackOut(BaseModel):
    overall_score: int
    commercial_language_pct: int
    upsc_jargon_found: list[str]
    strengths: list[str]
    specific_improvements: list[dict[str, Any]]
    rewritten_version: str
    coaching_note: str
    error: str | None = None


# ── Gap skills ────────────────────────────────────────────────────────────────

class GapSkillOut(BaseModel):
    skill: str
    priority_rank: int
    competence_score: float | None    # None if never assessed


# ── Tickets ───────────────────────────────────────────────────────────────────

class TicketTemplateOut(BaseModel):
    id: str
    title: str
    context: str
    deliverable: str
    difficulty: str
    estimated_hours: int
    evaluation_rubric: dict[str, Any]
    career_track_name: str | None

    class Config:
        from_attributes = True


class TicketSubmitRequest(BaseModel):
    ticket_id: str
    submission_text: str = Field(..., min_length=50, max_length=10000)


class TicketSubmissionOut(BaseModel):
    id: str
    ticket_id: str | None
    ticket_title: str | None
    submission_text: str
    submitted_at: datetime
    review_status: str
    ai_review_result: dict[str, Any] | None
    ai_reviewed_at: datetime | None

    class Config:
        from_attributes = True


# ── Skill competence ─────────────────────────────────────────────────────────

class SkillCompetenceOut(BaseModel):
    skill_text: str
    competence_score: float
    quiz_score_avg: float
    exercise_score_avg: float
    attempts: int
    last_assessed: datetime

    class Config:
        from_attributes = True


# ── Gate check ────────────────────────────────────────────────────────────────

class GateCheckOut(BaseModel):
    stage_number: int
    can_advance: bool
    status: str         # passed | failed | pending
    criteria: list[dict[str, Any]]
    message: str
