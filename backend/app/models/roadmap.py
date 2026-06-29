"""ORM models for the BeginablAI Roadmap Intelligence System.

6-stage job-readiness engine:
  Stage 1: Identity Reframe        (narrative transformation)
  Stage 2: Skill Foundation        (KRS-gap-driven learning paths)
  Stage 3: Applied Practice        (exercises)
  Stage 4: Real-World Simulation   (work tickets)
  Stage 5: Job Market Activation   (resume + 3-round interviews)
  Stage 6: Offer Pipeline          (always-on after stage 5)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, CheckConstraint, Column, DateTime, Float,
    ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────────────────────────────────────
# WORK TICKET TEMPLATES  (seeded by admin, drives Stage 4)
# ─────────────────────────────────────────────────────────────────────────────

class TicketTemplate(Base):
    """Admin-curated work simulation tickets for Stage 4.

    Each ticket represents a realistic private-sector task (Jira-style).
    Evaluation rubric is JSONB: {criterion: {weight: int, description: str}}.
    """
    __tablename__ = "ticket_templates"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    career_track_id  = Column(UUID(as_uuid=True), ForeignKey("career_tracks.id", ondelete="SET NULL"), nullable=True, index=True)
    title            = Column(String(300), nullable=False)
    context          = Column(Text, nullable=False)     # background/scenario
    deliverable      = Column(Text, nullable=False)     # what user must produce
    evaluation_rubric = Column(JSONB, nullable=False, server_default="{}")
    difficulty       = Column(String(20), nullable=False, default="mid")
    estimated_hours  = Column(Integer, default=3)
    is_active        = Column(Boolean, default=True, nullable=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    career_track     = relationship("CareerTrack", foreign_keys=[career_track_id])
    submissions      = relationship("TicketSubmission", back_populates="ticket")

    __table_args__ = (
        CheckConstraint("difficulty IN ('junior','mid','senior')", name="ck_ticket_difficulty"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# USER ROADMAP  (one active roadmap per user per career track)
# ─────────────────────────────────────────────────────────────────────────────

class UserRoadmap(Base):
    """Generated roadmap — the user's personalised 6-stage transformation plan.

    stage_config JSONB structure (see service.py _build_stage_config for schema):
    {
      "1": { "title": ..., "estimated_days": ..., "gate": {...}, "status": "pending|active|passed" },
      "2": { "learning_path_ids": [...], "gate": {...}, ... },
      ...
    }

    gap_skills is ordered by priority_score descending (frequency × weight).
    """
    __tablename__ = "user_roadmaps"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id              = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    career_track_id      = Column(UUID(as_uuid=True), ForeignKey("career_tracks.id", ondelete="SET NULL"), nullable=True, index=True)
    target_job_ids       = Column(JSONB, nullable=False, server_default="[]")   # top-5 job UUIDs at generation time
    current_stage        = Column(Integer, nullable=False, default=1)
    stage_config         = Column(JSONB, nullable=False, server_default="{}")
    gap_skills           = Column(JSONB, nullable=False, server_default="[]")   # list[str] ordered by priority
    narrative_score      = Column(Integer, nullable=True)                        # 0-100; set after Stage 1 AI eval
    narrative_text       = Column(Text, nullable=True)                           # latest draft submitted
    narrative_feedback   = Column(JSONB, nullable=True)                         # AI feedback dict
    job_readiness_score  = Column(Integer, nullable=False, default=0)            # 0-100 composite JRS
    is_active            = Column(Boolean, default=True, nullable=False)
    generated_at         = Column(DateTime(timezone=True), server_default=func.now())
    last_recalibrated    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user                 = relationship("User", foreign_keys=[user_id])
    career_track         = relationship("CareerTrack", foreign_keys=[career_track_id])
    gate_evaluations     = relationship("StageGateEvaluation", back_populates="roadmap", cascade="all, delete-orphan")
    ticket_submissions   = relationship("TicketSubmission", back_populates="roadmap")

    __table_args__ = (
        UniqueConstraint("user_id", "career_track_id", name="uq_roadmap_user_track"),
        CheckConstraint("current_stage BETWEEN 1 AND 6", name="ck_roadmap_stage"),
        CheckConstraint("job_readiness_score BETWEEN 0 AND 100", name="ck_roadmap_jrs"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# USER SKILL COMPETENCE  (per-skill mastery tracking across exercises + quizzes)
# ─────────────────────────────────────────────────────────────────────────────

class UserSkillCompetence(Base):
    """Tracks demonstrated mastery per skill per user.

    Updated after every quiz completion and exercise submission.
    competence_score = quiz_score_avg * 0.40 + exercise_score_avg * 0.40 + consistency * 0.20
    """
    __tablename__ = "user_skill_competence"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id              = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_text           = Column(String(200), nullable=False)          # normalised (lower + strip)
    quiz_score_avg       = Column(Float, nullable=False, default=0.0)   # 0-100
    exercise_score_avg   = Column(Float, nullable=False, default=0.0)   # 0-100
    attempts             = Column(Integer, nullable=False, default=0)
    competence_score     = Column(Float, nullable=False, default=0.0)   # 0-100 composite
    last_assessed        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user                 = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        UniqueConstraint("user_id", "skill_text", name="uq_skill_competence_user_skill"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# STAGE GATE EVALUATIONS  (audit trail of gate checks)
# ─────────────────────────────────────────────────────────────────────────────

class StageGateEvaluation(Base):
    """Records every gate check — auto (Celery) or manual (admin).

    gate_criteria: snapshot of what was required at evaluation time.
    gate_results:  what was actually achieved (scores, counts, etc.).
    """
    __tablename__ = "stage_gate_evaluations"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    roadmap_id       = Column(UUID(as_uuid=True), ForeignKey("user_roadmaps.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_number     = Column(Integer, nullable=False)
    status           = Column(String(20), nullable=False, default="pending")
    gate_criteria    = Column(JSONB, nullable=False, server_default="{}")
    gate_results     = Column(JSONB, nullable=False, server_default="{}")
    evaluated_at     = Column(DateTime(timezone=True), server_default=func.now())
    evaluated_by     = Column(String(20), nullable=False, default="auto")   # "auto" | "admin"

    roadmap          = relationship("UserRoadmap", back_populates="gate_evaluations")

    __table_args__ = (
        CheckConstraint("stage_number BETWEEN 1 AND 6", name="ck_gate_stage"),
        CheckConstraint("status IN ('pending','passed','failed','waived')", name="ck_gate_status"),
        CheckConstraint("evaluated_by IN ('auto','admin')", name="ck_gate_by"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# TICKET SUBMISSIONS  (Stage 4 user work)
# ─────────────────────────────────────────────────────────────────────────────

class TicketSubmission(Base):
    """A user's submission for a Stage 4 work ticket.

    ai_review_result JSONB structure:
    {
      "overall_score": 0-100,
      "strengths": ["...", "..."],
      "improvements": ["...", "..."],
      "specific_edits": [{"location": "...", "issue": "...", "suggestion": "..."}]
    }
    """
    __tablename__ = "ticket_submissions"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    roadmap_id       = Column(UUID(as_uuid=True), ForeignKey("user_roadmaps.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ticket_id        = Column(UUID(as_uuid=True), ForeignKey("ticket_templates.id", ondelete="SET NULL"), nullable=True, index=True)
    submission_text  = Column(Text, nullable=False)
    submitted_at     = Column(DateTime(timezone=True), server_default=func.now())
    review_status    = Column(String(20), nullable=False, default="pending")
    ai_review_result = Column(JSONB, nullable=True)
    ai_reviewed_at   = Column(DateTime(timezone=True), nullable=True)
    human_reviewed   = Column(Boolean, default=False, nullable=False)

    roadmap          = relationship("UserRoadmap", back_populates="ticket_submissions")
    user             = relationship("User", foreign_keys=[user_id])
    ticket           = relationship("TicketTemplate", back_populates="submissions")

    __table_args__ = (
        CheckConstraint("review_status IN ('pending','reviewing','done','failed')", name="ck_ticket_review_status"),
    )
