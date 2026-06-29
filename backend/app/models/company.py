"""Module 05 Phase 4 — Company profile + recruiter team management.

EmployerProfile stays the FK target for JobPosting (unchanged, zero blast radius
on existing job/application code). Company is the new shared entity: every
EmployerProfile gets a company_id, and the first (registering) profile is
flagged is_owner=True. Team members are additional EmployerProfile rows
sharing the same company_id with a non-owner role (hr_manager/recruiter/interviewer).
"""
import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.user import COMPANY_SIZE_ENUM


class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    industry = Column(String(100), nullable=True)
    company_size = Column(COMPANY_SIZE_ENUM, nullable=True)
    website = Column(String(500), nullable=True)
    logo_url = Column(Text, nullable=True)
    cover_banner_url = Column(Text, nullable=True)
    headquarters = Column(String(200), nullable=True)
    founded_year = Column(Integer, nullable=True)
    social_links = Column(JSONB, nullable=True)   # {"linkedin": "...", "twitter": "..."}
    description = Column(Text, nullable=True)
    verification_status = Column(String(20), nullable=False, default="unverified", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    members = relationship("EmployerProfile", back_populates="company")


class CompanyInvite(Base):
    """Pending invite record — kept for audit/history even though member
    creation in this MVP is immediate (no email-token acceptance flow yet)."""
    __tablename__ = "company_invites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    invited_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company")
    role = relationship("Role")
    inviter = relationship("User", foreign_keys=[invited_by])
