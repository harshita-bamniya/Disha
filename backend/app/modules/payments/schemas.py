from datetime import datetime
from typing import Optional

from pydantic import BaseModel

FREE_TIER_LIMIT = 3
GATED_FEATURES = ("counsellor_chat", "roadmap", "resume_builder", "mock_interview")


class PlanEntry(BaseModel):
    id: str
    name: str
    plan_type: str
    billing_interval: str
    price_monthly: int
    max_active_jobs: Optional[int] = None
    max_recruiter_seats: Optional[int] = None
    resume_access: bool
    candidate_search_limit: Optional[int] = None
    is_active: bool


class CheckoutRequest(BaseModel):
    plan_id: str


class CheckoutResponse(BaseModel):
    razorpay_key_id: str
    razorpay_subscription_id: str
    plan: PlanEntry


class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str


class VerifyPaymentResponse(BaseModel):
    status: str


class PaymentHistoryEntry(BaseModel):
    id: str
    plan_name: Optional[str] = None
    amount: int
    currency: str
    status: str
    method: Optional[str] = None
    invoice_number: Optional[str] = None
    created_at: datetime
    captured_at: Optional[datetime] = None


class AspirantSubscriptionResponse(BaseModel):
    plan: PlanEntry
    status: str
    current_period_start: datetime
    current_period_end: datetime


class FeatureUsageEntry(BaseModel):
    feature_key: str
    used_count: int
    limit: Optional[int] = None   # null = unlimited (active paid subscription)


class AspirantUsageResponse(BaseModel):
    is_premium: bool
    features: list[FeatureUsageEntry]
