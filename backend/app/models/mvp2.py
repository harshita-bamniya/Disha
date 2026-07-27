"""SQLAlchemy ORM models for MVP2: Learning, Resume, Interview, Counsellor, Analytics."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey,
    Integer, String, Text, UniqueConstraint, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector

from app.database import Base


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.now(timezone.utc)


# ═══════════════════════════════════════════════════════════════════════════════
# SKILL VECTOR CACHE — shared across all users and jobs
# ═══════════════════════════════════════════════════════════════════════════════

class SkillVector(Base):
    """Embedding cache for individual skill strings.

    Keyed by the normalised skill text (lowercased + stripped).
    Shared across all users and job postings — each unique skill phrase is
    embedded exactly once, then looked up for all future gap computations.
    """
    __tablename__ = "skill_vectors"

    skill_text  = Column(String(200), primary_key=True)   # normalised: lower + strip
    embedding   = Column(Vector(384), nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE 05 — LEARNING SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

class LearningPath(Base):
    __tablename__ = "learning_paths"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    career_track_id  = Column(UUID(as_uuid=True), ForeignKey("career_tracks.id", ondelete="SET NULL"), nullable=True)
    name             = Column(String(200), nullable=False)
    description      = Column(Text, nullable=True)
    estimated_hours  = Column(Integer, default=0)
    difficulty       = Column(String(20), nullable=True)
    target_skills    = Column(JSONB, nullable=True)   # master-list skills this path develops
    is_active        = Column(Boolean, default=True, nullable=False)
    sort_order       = Column(Integer, default=0)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    modules          = relationship("PathModule", back_populates="path", order_by="PathModule.sort_order", cascade="all, delete-orphan")
    enrollments      = relationship("UserLearningEnrollment", back_populates="path")
    career_track     = relationship("CareerTrack", foreign_keys=[career_track_id])

    __table_args__ = (
        CheckConstraint("difficulty IN ('beginner','intermediate','advanced')", name="ck_path_difficulty"),
    )


class PathModule(Base):
    __tablename__ = "path_modules"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    learning_path_id = Column(UUID(as_uuid=True), ForeignKey("learning_paths.id", ondelete="CASCADE"), nullable=False)
    title            = Column(String(200), nullable=False)
    description      = Column(Text, nullable=True)
    sort_order       = Column(Integer, nullable=False, default=0)
    skill_focus      = Column(String(150), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    path             = relationship("LearningPath", back_populates="modules")
    lessons          = relationship("Lesson", back_populates="module", order_by="Lesson.sort_order", cascade="all, delete-orphan")


class Lesson(Base):
    __tablename__ = "lessons"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    module_id        = Column(UUID(as_uuid=True), ForeignKey("path_modules.id", ondelete="CASCADE"), nullable=False)
    title            = Column(String(200), nullable=False)
    content_type     = Column(String(30), nullable=True)
    content_url      = Column(Text, nullable=True)
    content_body     = Column(Text, nullable=True)
    duration_minutes = Column(Integer, default=5)
    sort_order       = Column(Integer, nullable=False, default=0)
    language         = Column(String(10), default="en")
    is_active        = Column(Boolean, default=True, nullable=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    module           = relationship("PathModule", back_populates="lessons")
    completions      = relationship("LessonCompletion", back_populates="lesson")

    __table_args__ = (
        CheckConstraint(
            "content_type IN ('article','video','exercise','case_study','quiz')",
            name="ck_lesson_content_type"
        ),
    )


class UserLearningEnrollment(Base):
    __tablename__ = "user_learning_enrollments"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    learning_path_id = Column(UUID(as_uuid=True), ForeignKey("learning_paths.id", ondelete="CASCADE"), nullable=False)
    status           = Column(String(20), default="enrolled", nullable=False)
    enrolled_at      = Column(DateTime(timezone=True), server_default=func.now())
    completed_at     = Column(DateTime(timezone=True), nullable=True)
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user             = relationship("User")
    path             = relationship("LearningPath", back_populates="enrollments")

    __table_args__ = (
        UniqueConstraint("user_id", "learning_path_id", name="uq_enrollment_user_path"),
        CheckConstraint("status IN ('enrolled','in_progress','completed','paused')", name="ck_enrollment_status"),
    )


class LessonCompletion(Base):
    __tablename__ = "lesson_completions"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lesson_id      = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    completed_at   = Column(DateTime(timezone=True), server_default=func.now())
    time_spent_sec = Column(Integer, default=0)
    score          = Column(Integer, nullable=True)

    user           = relationship("User")
    lesson         = relationship("Lesson", back_populates="completions")

    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_completion_user_lesson"),
    )


class UserStreak(Base):
    __tablename__ = "user_streaks"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    current_streak = Column(Integer, default=0, nullable=False)
    longest_streak = Column(Integer, default=0, nullable=False)
    last_activity  = Column(Date, nullable=True)
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user           = relationship("User")


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE 06 — RESUME BUILDER
# ═══════════════════════════════════════════════════════════════════════════════

class ResumeTemplate(Base):
    __tablename__ = "resume_templates"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name          = Column(String(100), nullable=False)
    description   = Column(Text, nullable=True)
    template_type = Column(String(30), nullable=True)
    thumbnail_url = Column(Text, nullable=True)
    html_template = Column(Text, nullable=True)
    is_active     = Column(Boolean, default=True, nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    resumes       = relationship("Resume", back_populates="template")

    __table_args__ = (
        CheckConstraint(
            "template_type IN ('ats_clean','modern','hybrid','executive')",
            name="ck_template_type"
        ),
    )


class Resume(Base):
    __tablename__ = "resumes"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id     = Column(UUID(as_uuid=True), ForeignKey("resume_templates.id", ondelete="SET NULL"), nullable=True)
    title           = Column(String(200), nullable=False, default="My Resume")
    career_track_id = Column(UUID(as_uuid=True), ForeignKey("career_tracks.id", ondelete="SET NULL"), nullable=True)
    is_primary          = Column(Boolean, default=False, nullable=False)
    ats_score           = Column(Integer, nullable=True)
    score_breakdown     = Column(JSONB, nullable=True)
    target_job_description = Column(Text, nullable=True)
    deleted_at          = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user            = relationship("User")
    template        = relationship("ResumeTemplate", back_populates="resumes")
    sections        = relationship("ResumeSection", back_populates="resume", order_by="ResumeSection.sort_order", cascade="all, delete-orphan")
    versions        = relationship("ResumeVersion", back_populates="resume", order_by="ResumeVersion.version_num.desc()", cascade="all, delete-orphan")
    career_track    = relationship("CareerTrack", foreign_keys=[career_track_id])

    __table_args__ = (
        CheckConstraint("ats_score IS NULL OR (ats_score BETWEEN 0 AND 100)", name="ck_ats_score_range"),
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class ResumeSection(Base):
    __tablename__ = "resume_sections"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    resume_id    = Column(UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True)
    section_type = Column(String(50), nullable=False)
    title        = Column(String(100), nullable=True)
    content      = Column(JSONB, nullable=False, server_default="{}")
    sort_order   = Column(Integer, default=0)
    ai_improved  = Column(Boolean, default=False, nullable=False)
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    resume       = relationship("Resume", back_populates="sections")

    __table_args__ = (
        CheckConstraint(
            "section_type IN ('summary','experience','education','skills','achievements','projects','certifications','languages')",
            name="ck_section_type"
        ),
    )


class ResumeVersion(Base):
    __tablename__ = "resume_versions"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    resume_id    = Column(UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True)
    version_num  = Column(Integer, nullable=False)
    content      = Column(JSONB, nullable=False)
    ai_generated = Column(Boolean, default=False, nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    resume       = relationship("Resume", back_populates="versions")

    __table_args__ = (
        UniqueConstraint("resume_id", "version_num", name="uq_resume_version"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE 07 — MOCK INTERVIEW ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

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

    career_track         = relationship("CareerTrack", foreign_keys=[career_track_id])
    responses            = relationship("SessionResponse", back_populates="question")

    __table_args__ = (
        CheckConstraint(
            "question_type IN ('behavioral','situational','technical','hr','case')",
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

    user            = relationship("User")
    career_track    = relationship("CareerTrack", foreign_keys=[career_track_id])
    responses       = relationship("SessionResponse", back_populates="session", order_by="SessionResponse.sequence_num", cascade="all, delete-orphan")
    feedback        = relationship("InterviewFeedback", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("session_type IN ('practice','timed','full_mock')", name="ck_session_type"),
        CheckConstraint("status IN ('scheduled','in_progress','completed','abandoned')", name="ck_session_status"),
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
    # For AI-generated dynamic questions (no FK needed)
    dynamic_question_text = Column(Text, nullable=True)
    dynamic_question_type = Column(String(50), nullable=True)

    session           = relationship("InterviewSession", back_populates="responses")
    question          = relationship("QuestionBank", back_populates="responses")
    feedback          = relationship("InterviewFeedback", back_populates="response", uselist=False)


class InterviewFeedback(Base):
    __tablename__ = "interview_feedback"

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
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    session           = relationship("InterviewSession", back_populates="feedback")
    response          = relationship("SessionResponse", back_populates="feedback")


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE 08 — AI COUNSELLOR (BeginablAI BOT)
# ═══════════════════════════════════════════════════════════════════════════════

class Conversation(Base):
    __tablename__ = "conversations"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title         = Column(String(200), nullable=True)
    context_type  = Column(String(30), default="general", nullable=False)
    status        = Column(String(20), default="active", nullable=False)
    message_count = Column(Integer, default=0, nullable=False)
    # skill_learning context fields
    skill_focus      = Column(String(200), nullable=True)   # e.g. "Policy Research"
    job_context      = Column(JSONB, nullable=True)          # {job_id, job_title, company, sector}
    # mock_interview context fields
    interview_config = Column(JSONB, nullable=True)
    # {persona_name, persona_role, interview_type, job_id, job_title, company, sector,
    #  total_questions, status: "in_progress"|"completed"}
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user          = relationship("User")
    messages      = relationship("Message", back_populates="conversation", order_by="Message.created_at", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "context_type IN ('career','emotional','learning','resume','general','skill_learning','mock_interview','job_roadmap')",
            name="ck_conv_context_type"
        ),
        CheckConstraint("status IN ('active','archived')", name="ck_conv_status"),
    )


class Message(Base):
    __tablename__ = "messages"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role            = Column(String(20), nullable=False)
    content         = Column(Text, nullable=False)
    content_hi      = Column(Text, nullable=True)
    token_count     = Column(Integer, nullable=True)
    model_used      = Column(String(100), nullable=True)
    safety_flagged  = Column(Boolean, default=False, nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    conversation    = relationship("Conversation", back_populates="messages")
    safety_flags    = relationship("SafetyFlag", back_populates="message")

    __table_args__ = (
        CheckConstraint("role IN ('user','assistant','system')", name="ck_message_role"),
    )


class CounsellorMemory(Base):
    __tablename__ = "counsellor_memory"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    memory_type    = Column(String(30), nullable=False)
    content        = Column(Text, nullable=False)
    importance     = Column(String(20), default="medium", nullable=False)
    source_conv_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True)
    is_active      = Column(Boolean, default=True, nullable=False)
    expires_at     = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user           = relationship("User")
    embedding      = relationship("CounsellorMemoryEmbedding", back_populates="memory", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "memory_type IN ('fact','preference','concern','milestone','goal')",
            name="ck_memory_type"
        ),
        CheckConstraint("importance IN ('low','medium','high','critical')", name="ck_memory_importance"),
    )


class CounsellorMemoryEmbedding(Base):
    __tablename__ = "counsellor_memory_embeddings"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    memory_id  = Column(UUID(as_uuid=True), ForeignKey("counsellor_memory.id", ondelete="CASCADE"), nullable=False, unique=True)
    embedding  = Column(Vector(384), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    memory     = relationship("CounsellorMemory", back_populates="embedding")


class SafetyFlag(Base):
    __tablename__ = "safety_flags"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    message_id   = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    flag_type    = Column(String(30), nullable=False)
    severity     = Column(String(20), nullable=False)
    triggered_by = Column(String(200), nullable=True)
    action_taken = Column(String(50), default="logged", nullable=False)
    reviewed_by  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    message      = relationship("Message", back_populates="safety_flags")
    user         = relationship("User", foreign_keys=[user_id])
