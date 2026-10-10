"""Request/response models for the referral module. IDs are plain strings in responses."""
from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Optional

from pydantic import BaseModel, Field, StringConstraints

# email-validator isn't a dependency here; a shape check + lower-casing is what the rest of the app does.
Email = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=255,
                                         pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]


class ProgramOut(BaseModel):
    is_enabled: bool
    default_bonus_amount: int
    currency: str
    hold_days: int
    terms: Optional[str] = None
    updated_at: Optional[datetime] = None


class ProgramUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    default_bonus_amount: Optional[int] = Field(None, ge=0, le=10_000_000)
    hold_days: Optional[int] = Field(None, ge=0, le=730)
    terms: Optional[str] = Field(None, max_length=5000)


class JobConfigUpdate(BaseModel):
    is_open: Optional[bool] = None
    bonus_amount: Optional[int] = Field(None, ge=0, le=10_000_000)
    # Send clear_bonus=true to go back to the program default (null can't tell "unset" from "absent").
    clear_bonus: bool = False


class ReferralJobOut(BaseModel):
    job_id: str
    title: str
    location: Optional[str] = None
    department: Optional[str] = None
    is_open: bool
    bonus_amount: int                  # effective bonus (override or default)
    has_override: bool
    referral_count: int
    hired_count: int


class ReferrerInvite(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    email: Email


class ReferrerBulkInvite(BaseModel):
    people: list[ReferrerInvite] = Field(..., min_length=1, max_length=200)


class ReferrerStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|disabled)$")


class ReferrerOut(BaseModel):
    id: str
    name: str
    email: str
    status: str
    is_teammate: bool
    referral_count: int
    hired_count: int
    earned_amount: int
    last_sent_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class BulkInviteResult(BaseModel):
    added: list[ReferrerOut]
    skipped: list[dict]                # [{"email":..., "reason":...}]


class NominateRequest(BaseModel):
    job_id: str
    candidate_name: str = Field(..., min_length=1, max_length=150)
    candidate_email: Email
    note: Optional[str] = Field(None, max_length=1000)


class RewardOut(BaseModel):
    id: str
    referral_id: str
    referrer_name: str
    candidate_name: Optional[str] = None
    job_title: str
    amount: int
    currency: str
    status: str
    hired_at: datetime
    eligible_on: date
    paid_at: Optional[datetime] = None
    payment_reference: Optional[str] = None
    note: Optional[str] = None


class RewardPay(BaseModel):
    payment_reference: Optional[str] = Field(None, max_length=120)


class RewardReject(BaseModel):
    reason: str = Field(..., min_length=3, max_length=1000)
    hire_left: bool = False            # true -> "cancelled" (hire left before the hold ended)


class ReferralEventOut(BaseModel):
    event: str
    from_value: Optional[str] = None
    to_value: Optional[str] = None
    note: Optional[str] = None
    actor: Optional[str] = None
    created_at: datetime


class ReferralOut(BaseModel):
    id: str
    job_id: str
    job_title: str
    referrer_id: str
    referrer_name: str
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    source: str
    status: str
    application_id: Optional[str] = None
    note: Optional[str] = None
    reward_status: Optional[str] = None
    reward_amount: Optional[int] = None
    created_at: datetime
    events: list[ReferralEventOut] = []


class ReferralPage(BaseModel):
    items: list[ReferralOut]
    total: int
    page: int
    page_size: int


class MyReferralOut(BaseModel):
    """What a referrer sees about someone they referred: first name + initial, and the stage."""
    id: str
    candidate: str
    job_title: str
    status: str
    source: str
    reward_status: Optional[str] = None
    reward_amount: Optional[int] = None
    created_at: datetime


class MyJobOut(BaseModel):
    job_id: str
    title: str
    location: Optional[str] = None
    bonus_amount: int
    share_url: str


class MyReferralsOut(BaseModel):
    company_name: str
    referrer_name: str
    program_enabled: bool
    currency: str
    hold_days: int
    terms: Optional[str] = None
    jobs: list[MyJobOut]
    referrals: list[MyReferralOut]
    totals: dict                        # {referred, hired, pending_amount, payable_amount, paid_amount}


class LeaderOut(BaseModel):
    referrer_id: str
    name: str
    referrals: int
    hires: int
    earned_amount: int


class OverviewOut(BaseModel):
    program_enabled: bool
    referrers: int
    referrals: int
    by_status: dict
    hires: int
    conversion_rate: float             # hires / referrals that actually applied
    rewards_by_status: dict            # {"pending": {"count":n,"amount":x}, ...}
    top_referrers: list[LeaderOut]
    top_jobs: list[dict]


class LinkInfo(BaseModel):
    valid: bool
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    location: Optional[str] = None
    referrer_first_name: Optional[str] = None
