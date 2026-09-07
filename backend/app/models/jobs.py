"""SQLAlchemy ORM models for reusable job-posting boilerplate."""
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


class JobTemplate(Base):
    """Reusable job-posting boilerplate — distinct from a draft JobPosting,
    which is a specific dated requisition. A template has no expires_at or
    salary; an employer picks one to pre-fill a new posting, then fills in
    the req-specific details (dates, comp) before publishing."""
    __tablename__ = "job_templates"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    employer_id     = Column(UUID(as_uuid=True), ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    name            = Column(String(150), nullable=False)   # employer's own label, e.g. "Standard Analyst Req"
    title           = Column(String(200), nullable=False)
    description     = Column(Text, nullable=False)
    sector          = Column(String(100), nullable=False)
    required_skills = Column(JSONB, nullable=False)
    job_type        = Column(String(20), nullable=True)
    employment_type = Column(String(30), nullable=True)
    min_k_score     = Column(Integer, nullable=False, default=0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    employer        = relationship("EmployerProfile")
