"""SQLAlchemy ORM models for the learning path system (Module 05)."""
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


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
