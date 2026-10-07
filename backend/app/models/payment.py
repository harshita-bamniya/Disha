"""Razorpay payment ledger, webhook idempotency log, and aspirant free-tier
usage counters — introduced alongside recurring billing (Razorpay Subscriptions,
UPI Autopay/e-mandate) for both employer and aspirant plans."""
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=True)
    amount = Column(Integer, nullable=False)      # paise (INR smallest unit)
    currency = Column(String(3), nullable=False, default="INR")
    status = Column(String(20), nullable=False, default="created")   # created|authorized|captured|failed|refunded
    razorpay_payment_id = Column(String(64), nullable=True, index=True)
    razorpay_subscription_id = Column(String(64), nullable=True, index=True)
    razorpay_signature = Column(String(256), nullable=True)
    method = Column(String(30), nullable=True)    # card|upi|netbanking|...
    invoice_number = Column(String(40), nullable=True, unique=True)
    raw_payload = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    captured_at = Column(DateTime(timezone=True), nullable=True)


class RazorpayWebhookEvent(Base):
    __tablename__ = "razorpay_webhook_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    razorpay_event_id = Column(String(64), nullable=False, unique=True, index=True)
    event_type = Column(String(60), nullable=False)
    payload = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)


class FeatureUsage(Base):
    """Free-tier lifetime usage counters for gated aspirant features
    (counsellor_chat|roadmap|resume_builder|mock_interview). Only consulted
    while the aspirant has no active paid subscription."""
    __tablename__ = "feature_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    feature_key = Column(String(30), nullable=False)
    used_count = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
