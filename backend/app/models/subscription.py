"""Module 05 Phase 6 — Subscription plans & usage tracking."""
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)   # free|standard|premium|enterprise
    price_monthly = Column(Integer, nullable=False, default=0)   # in paise (INR smallest unit)
    max_active_jobs = Column(Integer, nullable=True)             # null = unlimited
    max_recruiter_seats = Column(Integer, nullable=True)
    resume_access = Column(Boolean, nullable=False, default=False)
    candidate_search_limit = Column(Integer, nullable=True)      # per month, null = unlimited
    features = Column(JSONB, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)


class CompanySubscription(Base):
    __tablename__ = "company_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=False)
    status = Column(String(20), nullable=False, default="active")   # active|past_due|canceled
    current_period_start = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    current_period_end = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plan = relationship("SubscriptionPlan")
