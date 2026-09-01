"""Embedding cache for skill strings — shared across all users and jobs."""
from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, DateTime, String
from sqlalchemy.sql import func

from app.database import Base


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
