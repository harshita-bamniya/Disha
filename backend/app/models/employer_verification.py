"""Module 05 Phase 2 — Employer KYC verification workflow.

State machine: draft -> pending -> under_review -> approved | rejected -> draft -> pending
'draft' = documents being uploaded, not yet submitted (employer can still edit).
'pending' = actually submitted, awaiting admin review — employer can no longer resubmit
until rejected. Keeping these distinct is what stops the "submit" button from being
clickable indefinitely once already in the review queue.
"""
import uuid
from sqlalchemy import Boolean, Column, CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

VERIFICATION_STATUSES = ("requested", "under_review", "approved", "rejected")
DOCUMENT_TYPES = ("gst_certificate", "pan_card", "company_registration", "business_email")
DOCUMENT_STATUSES = ("pending", "verified", "rejected")


class EmployerVerification(Base):
    __tablename__ = "employer_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employer_id = Column(UUID(as_uuid=True), ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    employer = relationship("EmployerProfile")
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    documents = relationship("EmployerVerificationDocument", back_populates="verification", cascade="all, delete-orphan")
    events = relationship("EmployerVerificationEvent", back_populates="verification",
                           cascade="all, delete-orphan", order_by="EmployerVerificationEvent.created_at")

    __table_args__ = (
        CheckConstraint(f"status IN {VERIFICATION_STATUSES}", name="ck_emp_verif_status"),
    )


class EmployerVerificationDocument(Base):
    __tablename__ = "employer_verification_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    verification_id = Column(UUID(as_uuid=True), ForeignKey("employer_verifications.id", ondelete="CASCADE"), nullable=False, index=True)
    doc_type = Column(String(40), nullable=False)
    file_url = Column(Text, nullable=False)
    original_filename = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    notes = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    verification = relationship("EmployerVerification", back_populates="documents")

    __table_args__ = (
        CheckConstraint(f"doc_type IN {DOCUMENT_TYPES}", name="ck_emp_verif_doc_type"),
        CheckConstraint(f"status IN {DOCUMENT_STATUSES}", name="ck_emp_verif_doc_status"),
    )


class EmployerVerificationEvent(Base):
    """Timeline entries for the verification detail page."""
    __tablename__ = "employer_verification_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    verification_id = Column(UUID(as_uuid=True), ForeignKey("employer_verifications.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    from_status = Column(String(20), nullable=True)
    to_status = Column(String(20), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    verification = relationship("EmployerVerification", back_populates="events")
    actor = relationship("User", foreign_keys=[actor_id])
