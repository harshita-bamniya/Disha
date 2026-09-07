"""SQLAlchemy ORM models for employer-customisable application pipeline stages."""
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


# Canonical stage keys available for customisation — subset of APPLICATION_STATUSES
# (models/applications.py) that an employer can rename/recolor. 'withdrawn' is
# aspirant-only and excluded.
CUSTOMISABLE_STAGE_KEYS = (
    "applied", "screening", "shortlisted",
    "interview_scheduled", "interview_completed",
    "offer_sent", "hired", "rejected",
)


class CompanyPipelineTemplate(Base):
    """A named reusable template of pipeline stages for a company.
    Stores stage configuration as JSONB so templates can be applied to new jobs
    without N rows per template."""
    __tablename__ = "company_pipeline_templates"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name       = Column(String(100), nullable=False)
    # [{stage_key, display_name, color, position, is_visible}]
    stages     = Column(JSONB, nullable=False, default=list)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    company    = relationship("Company", foreign_keys=[company_id])
    creator    = relationship("User", foreign_keys=[created_by])


class JobPipelineStage(Base):
    """Per-job pipeline stage customisation.
    One row per (job_id, stage_key). If no rows exist for a job, the UI falls
    back to the system defaults defined in CUSTOMISABLE_STAGE_KEYS."""
    __tablename__ = "job_pipeline_stages"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    job_id       = Column(UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_key    = Column(String(30), nullable=False)   # must be in CUSTOMISABLE_STAGE_KEYS
    display_name = Column(String(100), nullable=False)
    color        = Column(String(7), nullable=False, default="#6B7280")  # hex
    position     = Column(Integer, nullable=False, default=0)
    is_visible   = Column(Boolean, nullable=False, default=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("job_id", "stage_key", name="uq_job_pipeline_stage_key"),
        CheckConstraint(f"stage_key IN {CUSTOMISABLE_STAGE_KEYS}", name="ck_pipeline_stage_key"),
    )
