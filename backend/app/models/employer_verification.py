"""Employer (company) verification workflow.

State machine:
  draft -> requested -> under_review -> approved | rejected
                      `-> needs_info -> (employer resubmits) -> requested
'draft'  = the employer is still filling in details/documents; invisible to admins.
'requested' = submitted and waiting in the review queue.
'needs_info' = a reviewer asked for something specific; the employer edits the same case and resubmits.
Approval is a company-level fact (mirrored on Company.verification_status).
"""
import uuid

from sqlalchemy import (
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

VERIFICATION_STATUSES = ("draft", "requested", "under_review", "needs_info", "approved", "rejected")
DOCUMENT_TYPES = (
    "gst_certificate", "pan_card", "company_registration", "business_email",
    "udyam_certificate", "shops_establishment", "partnership_deed", "ngo_registration",
    "tax_exemption_12a", "signatory_authorisation", "address_proof", "other",
)
DOCUMENT_STATUSES = ("pending", "verified", "rejected")


class EmployerVerification(Base):
    __tablename__ = "employer_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employer_id = Column(UUID(as_uuid=True), ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="requested", index=True)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    entity_type = Column(String(40), nullable=True)
    details = Column(JSONB, nullable=True)        # registry IDs, business email, signatory, declarations
    auto_checks = Column(JSONB, nullable=True)    # [{code, level, message}] from the automatic checks
    reason_code = Column(String(40), nullable=True)
    info_request = Column(Text, nullable=True)    # what a reviewer needs when status == needs_info
    attempt_no = Column(Integer, nullable=False, default=1)
    # The business email address the employer proved they can read (OTP). Only counts while it still
    # equals details["business_email"], so editing the address withdraws the proof.
    business_email_verified = Column(String(150), nullable=True)

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
    # What the AI reader saw in the file: {status, detected_type, legible, fields{...}}. Advisory only.
    ai_check = Column(JSONB, nullable=True)
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
