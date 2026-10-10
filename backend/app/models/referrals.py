"""Employee referral program (employer portal).

A company switches on one ReferralProgram. Its people (Referrer rows: teammates with a seat, or
employees invited by email who never get a login) each have a personal code. A candidate who applies
through a referrer's link is attributed to them (Referral). When that application is hired, a
ReferralReward is created and walks pending -> eligible (retention period passed) -> approved -> paid.
ReferralEvent is the audit trail for every step.
"""
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
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

# Keep in sync with the check constraints below (a value accepted here but missing there 500s on write).
REFERRAL_STATUSES = ("invited", "applied", "in_process", "hired", "rejected", "withdrawn")
REWARD_STATUSES = ("pending", "eligible", "approved", "paid", "rejected", "cancelled")
REFERRER_STATUSES = ("active", "disabled")
REFERRAL_SOURCES = ("link", "nomination")


class ReferralProgram(Base):
    """One per company. Off until the owner/HR turns it on."""
    __tablename__ = "referral_programs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True)
    is_enabled = Column(Boolean, nullable=False, default=False, server_default="false")
    # Whole rupees. 0 = recognition only (referrals are tracked, no money owed).
    default_bonus_amount = Column(Integer, nullable=False, default=0, server_default="0")
    currency = Column(String(3), nullable=False, default="INR", server_default="INR")
    # The hire must still be there this many days after joining before the bonus becomes payable.
    hold_days = Column(Integer, nullable=False, default=90, server_default="90")
    terms = Column(Text, nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("default_bonus_amount >= 0", name="ck_referral_program_bonus_nonneg"),
        CheckConstraint("hold_days >= 0 AND hold_days <= 730", name="ck_referral_program_hold_range"),
    )


class ReferralJobConfig(Base):
    """Per-job override: close a job to referrals, or pay a different bonus for it (hard-to-fill roles)."""
    __tablename__ = "referral_job_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False, unique=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    is_open = Column(Boolean, nullable=False, default=True, server_default="true")
    bonus_amount = Column(Integer, nullable=True)   # NULL = use the program default
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (CheckConstraint("bonus_amount IS NULL OR bonus_amount >= 0", name="ck_referral_job_bonus_nonneg"),)


class Referrer(Base):
    """A person who can refer. A teammate (employer_profile_id set) signs in as usual; an invited
    employee has only a magic-link token and never gets an account."""
    __tablename__ = "referrers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    employer_profile_id = Column(UUID(as_uuid=True), ForeignKey("employer_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=False)          # stored lower-case
    code = Column(String(16), nullable=False, unique=True, index=True)   # public, goes in the share link
    # SHA-256 of the emailed portal token (raw token never stored). Replaced on resend.
    token_hash = Column(String(64), nullable=True, unique=True, index=True)
    status = Column(String(10), nullable=False, default="active", server_default="active")
    invited_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    last_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "email", name="uq_referrer_company_email"),
        CheckConstraint(f"status IN {REFERRER_STATUSES}", name="ck_referrer_status"),
    )


class Referral(Base):
    """One candidate referred to one job by one referrer."""
    __tablename__ = "referrals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False, index=True)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("referrers.id", ondelete="CASCADE"), nullable=False, index=True)
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="SET NULL"), nullable=True, unique=True)
    candidate_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    candidate_name = Column(String(150), nullable=True)
    candidate_email = Column(String(255), nullable=True, index=True)   # stored lower-case
    source = Column(String(12), nullable=False, default="link", server_default="link")
    status = Column(String(12), nullable=False, default="invited", server_default="invited", index=True)
    note = Column(Text, nullable=True)   # the referrer's "why I'm recommending them"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    referrer = relationship("Referrer")
    job = relationship("JobPosting")
    application = relationship("Application")
    reward = relationship("ReferralReward", back_populates="referral", uselist=False, cascade="all, delete-orphan")
    events = relationship("ReferralEvent", back_populates="referral", order_by="ReferralEvent.created_at",
                          cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(f"status IN {REFERRAL_STATUSES}", name="ck_referral_status"),
        CheckConstraint(f"source IN {REFERRAL_SOURCES}", name="ck_referral_source"),
    )


class ReferralReward(Base):
    """The bonus owed for a hired referral. Amount is a snapshot taken at hire time, so later changes
    to the program never rewrite what a referrer was promised."""
    __tablename__ = "referral_rewards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referral_id = Column(UUID(as_uuid=True), ForeignKey("referrals.id", ondelete="CASCADE"), nullable=False, unique=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("referrers.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    currency = Column(String(3), nullable=False, default="INR", server_default="INR")
    status = Column(String(10), nullable=False, default="pending", server_default="pending", index=True)
    hired_at = Column(DateTime(timezone=True), nullable=False)
    eligible_on = Column(Date, nullable=False)       # hired date + hold_days
    decided_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    payment_reference = Column(String(120), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    referral = relationship("Referral", back_populates="reward")
    referrer = relationship("Referrer")

    __table_args__ = (
        CheckConstraint(f"status IN {REWARD_STATUSES}", name="ck_referral_reward_status"),
        CheckConstraint("amount > 0", name="ck_referral_reward_amount_pos"),
    )


class ReferralEvent(Base):
    """Append-only audit trail: who did what to a referral and when."""
    __tablename__ = "referral_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referral_id = Column(UUID(as_uuid=True), ForeignKey("referrals.id", ondelete="CASCADE"), nullable=False, index=True)
    event = Column(String(40), nullable=False)   # created | status_changed | reward_created | reward_approved | reward_paid | ...
    from_value = Column(String(40), nullable=True)
    to_value = Column(String(40), nullable=True)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    referral = relationship("Referral", back_populates="events")
