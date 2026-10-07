"""SQLAlchemy ORM models for the mock/AI interview engine (Module 07)."""
import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


class QuestionBank(Base):
    __tablename__ = "question_banks"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    career_track_id      = Column(UUID(as_uuid=True), ForeignKey("career_tracks.id", ondelete="SET NULL"), nullable=True, index=True)
    question_text        = Column(Text, nullable=False)
    question_type        = Column(String(30), nullable=True)
    difficulty           = Column(String(10), nullable=True)
    expected_answer_guide = Column(Text, nullable=True)
    language             = Column(String(10), default="en")
    is_active            = Column(Boolean, default=True, nullable=False)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    # Panel simulation — which interviewer persona asks this question, if any
    # (legacy static bank rows and non-panel sessions leave both null)
    panelist_name        = Column(String(60), nullable=True)
    panelist_role        = Column(String(60), nullable=True)

    career_track         = relationship("CareerTrack", foreign_keys=[career_track_id])
    responses            = relationship("SessionResponse", back_populates="question")

    __table_args__ = (
        CheckConstraint(
            "question_type IN ('behavioral','situational','technical','hr','case','system_design')",
            name="ck_question_type"
        ),
        CheckConstraint("difficulty IN ('easy','medium','hard')", name="ck_question_difficulty"),
    )


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id              = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    career_track_id      = Column(UUID(as_uuid=True), ForeignKey("career_tracks.id", ondelete="SET NULL"), nullable=True)
    session_type         = Column(String(20), default="practice", nullable=False)
    status               = Column(String(20), default="scheduled", nullable=False)
    total_questions      = Column(Integer, default=5)
    started_at           = Column(DateTime(timezone=True), nullable=True)
    completed_at         = Column(DateTime(timezone=True), nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    # Dynamic interview fields
    job_role             = Column(String(150), nullable=True)
    experience_level     = Column(String(50), nullable=True)
    job_description      = Column(Text, nullable=True)
    blueprint            = Column(JSONB, nullable=True)
    job_readiness_report = Column(JSONB, nullable=True)
    # Predictive-validity flywheel — set once the "how did it go" follow-up
    # notification has been sent, so the daily scanner task doesn't re-send it
    outcome_requested_at = Column(DateTime(timezone=True), nullable=True)
    # Background grading state. `status` says whether the candidate finished;
    # `grading_status` says whether feedback + report exist yet:
    # pending -> running -> done | failed. NULL means a session completed
    # before async grading existed (its feedback was already produced inline).
    grading_status       = Column(String(12), nullable=True)
    grading_started_at   = Column(DateTime(timezone=True), nullable=True)
    # en / hi / hinglish: the language the interview is conducted in
    language             = Column(String(10), nullable=False, default="en", server_default="en")
    # practice: private to the candidate. verified: an employer-invited
    # interview, scored with two independent passes and shared (with consent).
    mode                 = Column(String(12), nullable=False, default="practice", server_default="practice")

    user            = relationship("User")
    career_track    = relationship("CareerTrack", foreign_keys=[career_track_id])
    responses       = relationship("SessionResponse", back_populates="session", order_by="SessionResponse.sequence_num", cascade="all, delete-orphan")
    feedback        = relationship("InterviewFeedback", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("session_type IN ('practice','timed','full_mock','stress','drill')", name="ck_session_type"),
        CheckConstraint("status IN ('scheduled','in_progress','completed','abandoned')", name="ck_session_status"),
        CheckConstraint("mode IN ('practice','verified')", name="ck_session_mode"),
    )


class SessionResponse(Base):
    __tablename__ = "session_responses"

    id                    = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id            = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id           = Column(UUID(as_uuid=True), ForeignKey("question_banks.id"), nullable=True)
    response_text         = Column(Text, nullable=False)
    response_time_sec     = Column(Integer, default=0)
    sequence_num          = Column(Integer, nullable=False)
    submitted_at          = Column(DateTime(timezone=True), server_default=func.now())
    # True when this response answers a follow-up/challenge question rather
    # than an original question_banks question — a follow-up has no
    # question_id (it isn't a bank row), so "already probed this topic" can't
    # be derived from question_id like it can for original questions.
    is_followup           = Column(Boolean, default=False, nullable=False, server_default="false")
    # For AI-generated dynamic questions (no FK needed)
    dynamic_question_text = Column(Text, nullable=True)
    dynamic_question_type = Column(String(50), nullable=True)

    session           = relationship("InterviewSession", back_populates="responses")
    question          = relationship("QuestionBank", back_populates="responses")
    feedback          = relationship("InterviewFeedback", back_populates="response", uselist=False)


class InterviewFeedback(Base):
    __tablename__ = "mock_interview_feedback"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id        = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    response_id       = Column(UUID(as_uuid=True), ForeignKey("session_responses.id", ondelete="CASCADE"), nullable=True)
    clarity_score     = Column(Integer, nullable=True)
    conciseness_score = Column(Integer, nullable=True)
    impact_score      = Column(Integer, nullable=True)
    relevance_score   = Column(Integer, nullable=True)
    star_adherence    = Column(Integer, nullable=True)
    overall_score     = Column(Integer, nullable=True)
    strengths         = Column(JSONB, server_default="'[]'")
    improvements      = Column(JSONB, server_default="'[]'")
    rewritten_answer  = Column(Text, nullable=True)
    is_fallback       = Column(Boolean, default=False, nullable=False, server_default="false")
    evidence_quote    = Column(Text, nullable=True)
    # Multi-judge adversarial scoring — independent skeptic/domain-specialist
    # passes alongside the primary generalist score, e.g.
    # {"generalist": 7, "skeptic": 4, "domain_specialist": 6}
    judge_scores            = Column(JSONB, nullable=True)
    judge_disagreement_note = Column(Text, nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    session           = relationship("InterviewSession", back_populates="feedback")
    response          = relationship("SessionResponse", back_populates="feedback")


class InterviewOutcome(Base):
    """Predictive-validity flywheel: what actually happened after the interview
    the candidate practiced for, self-reported (opt-in, asked ~2 weeks later)."""
    __tablename__ = "interview_outcomes"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id    = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, unique=True)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    outcome       = Column(String(30), nullable=False)
    notes         = Column(Text, nullable=True)
    reported_at   = Column(DateTime(timezone=True), server_default=func.now())

    session       = relationship("InterviewSession")

    __table_args__ = (
        CheckConstraint(
            "outcome IN ('interview_scheduled','offer_received','rejected','no_response','did_not_apply')",
            name="ck_interview_outcome",
        ),
    )


class ModelRun(Base):
    """One row per LLM call made for an interview (question generation, live
    follow-up decisions, per-answer scoring, judges, report). Stores tokens and
    latency so per-interview cost can be measured before a paid-plan cap is
    set. Rupee cost is deliberately NOT stored: vendor prices change, so cost
    is computed from tokens at reporting time."""
    __tablename__ = "model_runs"

    id            = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    interview_id  = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    purpose       = Column(String(40), nullable=False, index=True)
    model         = Column(String(80), nullable=True)
    tokens_in     = Column(Integer, nullable=False, default=0)
    tokens_out    = Column(Integer, nullable=False, default=0)
    latency_ms    = Column(Integer, nullable=True)
    ok            = Column(Boolean, nullable=False, default=True)
    error         = Column(String(200), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class InterviewConsent(Base):
    """What a candidate agreed to when starting an interview, with the version
    of the wording they saw. Kept even if the session is later deleted (the
    session link is nulled) so there is a record the consent was given."""
    __tablename__ = "interview_consents"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id    = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    kind          = Column(String(30), nullable=False)
    text_version  = Column(String(20), nullable=False)
    granted_at    = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at    = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("kind IN ('ai_processing','own_effort','improve_product','media','employer_share')", name="ck_interview_consent_kind"),
    )


class InterviewSafetyEvent(Base):
    """A crisis signal detected in a candidate's interview answer. The session
    is halted and never scored. Holds only the matched phrase, not the answer."""
    __tablename__ = "interview_safety_events"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id    = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    severity      = Column(String(20), nullable=False)
    triggered_by  = Column(String(200), nullable=True)
    action_taken  = Column(String(50), nullable=False, default="session_halted")
    reviewed_by   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class InterviewHumanReview(Base):
    """Human-calibration dashboard: a staff member's blind score on a sampled
    session, tracked against the AI's own readiness score/recommendation to
    measure agreement rate over time."""
    __tablename__ = "interview_human_reviews"

    id                     = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id             = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    human_readiness_score  = Column(Integer, nullable=False)
    human_recommendation   = Column(String(20), nullable=False)
    notes                  = Column(Text, nullable=True)
    created_at             = Column(DateTime(timezone=True), server_default=func.now())

    session       = relationship("InterviewSession")
    reviewer      = relationship("User", foreign_keys=[reviewer_user_id])

    __table_args__ = (
        CheckConstraint(
            "human_recommendation IN ('Strong Hire','Hire','Maybe','No Hire')",
            name="ck_human_review_recommendation",
        ),
        CheckConstraint(
            "human_readiness_score >= 0 AND human_readiness_score <= 100",
            name="ck_human_review_score_range",
        ),
    )
