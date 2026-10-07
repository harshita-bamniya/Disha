"""Resume–job match scoring storage.

`job_requirements` holds the structured requirement list parsed once per job
posting and reused for every applicant's scan. It is re-parsed only when the
employer changes what the parse depends on (tracked by `source_hash`).
"""
from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.database import Base


class JobRequirementsRecord(Base):
    __tablename__ = "job_requirements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"),
                    nullable=False, unique=True, index=True)
    # sha256 of everything the parse depends on (title, description, required skills, parser version)
    source_hash = Column(String(64), nullable=False)
    parser_version = Column(String(16), nullable=False)
    model = Column(String(80), nullable=True)
    # JobRequirements (resume_match.schemas) as JSON
    data = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ResumeMatchScan(Base):
    """One resume-vs-job analysis. Immutable: a re-scan writes a new row.

    `profile` is the parsed candidate profile (name/contact were redacted before
    parsing), kept so an unchanged resume never pays for parsing again.
    `report` is the full MatchReport JSON. `previous_scan_id`/`score_delta` link a
    re-scan to the user's prior scan of the same job.
    """
    __tablename__ = "resume_match_scans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False)
    resume_source = Column(String(10), nullable=False)          # builder | file | upload
    resume_ref_id = Column(UUID(as_uuid=True), nullable=True)   # Resume.id or CandidateResumeFile.id
    resume_label = Column(String(300), nullable=True)
    resume_hash = Column(String(64), nullable=False)
    job_source_hash = Column(String(64), nullable=False)
    scoring_version = Column(String(16), nullable=False)
    score = Column(Integer, nullable=False)
    band = Column(String(10), nullable=False)
    must_haves_met = Column(Integer, nullable=False, default=0)
    must_haves_total = Column(Integer, nullable=False, default=0)
    profile = Column(JSONB, nullable=False, default=dict)
    report = Column(JSONB, nullable=False, default=dict)
    previous_scan_id = Column(UUID(as_uuid=True), nullable=True)
    score_delta = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_resume_match_scans_user_job_created", "user_id", "job_id", "created_at"),
        Index("ix_resume_match_scans_user_hash", "user_id", "resume_hash"),
    )
