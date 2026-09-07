"""SQLAlchemy ORM models for the resume builder (Module 06)."""
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
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
