"""Razorpay recurring billing: checkout, webhook-driven activation, and the
gating helpers (aspirant free-tier credits, employer paid-plan dashboard lock)
that the rest of the app enforces access with."""
import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timedelta, timezone

import razorpay
from fastapi import Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    PaymentRequiredException,
    ServiceUnavailableException,
)
from app.core.rbac import get_current_user, require_employer
from app.database import get_db
from app.models.payment import FeatureUsage, Payment, RazorpayWebhookEvent
from app.models.subscription import AspirantSubscription, CompanySubscription, SubscriptionPlan
from app.models.user import EmployerProfile, User
from app.modules.payments.schemas import FREE_TIER_LIMIT, GATED_FEATURES

logger = logging.getLogger(__name__)


def _client() -> razorpay.Client:
    settings = get_settings()
    if not (settings.razorpay_key_id and settings.razorpay_key_secret):
        raise ServiceUnavailableException("Payments are not configured on this server yet.")
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


def _plan_to_entry(plan: SubscriptionPlan):
    from app.modules.payments.schemas import PlanEntry
    return PlanEntry(
        id=str(plan.id), name=plan.name, plan_type=plan.plan_type, billing_interval=plan.billing_interval,
        price_monthly=plan.price_monthly, max_active_jobs=plan.max_active_jobs,
        max_recruiter_seats=plan.max_recruiter_seats, resume_access=plan.resume_access,
        candidate_search_limit=plan.candidate_search_limit, is_active=plan.is_active,
    )


def list_plans(plan_type: str, db: Session) -> list:
    plans = (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.plan_type == plan_type, SubscriptionPlan.is_active == True)
        .order_by(SubscriptionPlan.price_monthly)
        .all()
    )
    return [_plan_to_entry(p) for p in plans]


# ── Employer/company helpers ─────────────────────────────────────────────────

def _get_employer_profile(user: User, db: Session) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile or not profile.company_id:
        raise NotFoundException("No company associated with this account.")
    return profile


def _get_or_create_company_subscription(company_id, db: Session) -> CompanySubscription:
    sub = db.query(CompanySubscription).filter(CompanySubscription.company_id == company_id).first()
    if not sub:
        free_plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.name == "free", SubscriptionPlan.plan_type == "employer",
        ).first()
        if not free_plan:
            raise NotFoundException("No subscription plan available for this company.")
        now = datetime.now(timezone.utc)
        sub = CompanySubscription(
            company_id=company_id, plan_id=free_plan.id, status="active",
            current_period_start=now, current_period_end=now + timedelta(days=365 * 100),
        )
        db.add(sub)
        try:
            db.commit()
        except IntegrityError:
            # Lost the race against another lazy-provisioner (e.g. companies
            # service's own _get_company_subscription) firing for the same
            # company at the same time — the other request's row already
            # exists, so just read it back instead of crashing the request.
            db.rollback()
            sub = db.query(CompanySubscription).filter(CompanySubscription.company_id == company_id).first()
            if not sub:
                raise
        else:
            db.refresh(sub)
    return sub


def require_active_employer_subscription(
    current_user: User = Depends(require_employer), db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: blocks dashboard/job-management access until the
    company has an active subscription — free or paid. The free plan's own
    limits (max_active_jobs, max_recruiter_seats, etc., enforced separately
    where each is used) cap what a free-tier company can actually do; this
    dependency only blocks a company with no profile yet, or a lapsed/
    canceled subscription that hasn't been renewed."""
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == current_user.id).first()
    if not profile or not profile.company_id:
        raise PaymentRequiredException("Set up your company profile to unlock the dashboard.")

    sub = _get_or_create_company_subscription(profile.company_id, db)
    if sub.status != "active":
        raise PaymentRequiredException("Your subscription is inactive. Renew your plan to continue.")
    return current_user


# ── Aspirant helpers ──────────────────────────────────────────────────────────

def _get_or_create_aspirant_subscription(user_id, db: Session) -> AspirantSubscription:
    sub = db.query(AspirantSubscription).filter(AspirantSubscription.user_id == user_id).first()
    if not sub:
        free_plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.name == "aspirant_free", SubscriptionPlan.plan_type == "aspirant",
        ).first()
        if not free_plan:
            raise NotFoundException("No aspirant plan available.")
        now = datetime.now(timezone.utc)
        sub = AspirantSubscription(
            user_id=user_id, plan_id=free_plan.id, status="active",
            current_period_start=now, current_period_end=now + timedelta(days=365 * 100),
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
    return sub


def _aspirant_is_premium(user_id, db: Session) -> bool:
    sub = (
        db.query(AspirantSubscription)
        .join(SubscriptionPlan, AspirantSubscription.plan_id == SubscriptionPlan.id)
        .filter(AspirantSubscription.user_id == user_id)
        .filter(AspirantSubscription.status == "active")
        .filter(SubscriptionPlan.price_monthly > 0)
        .first()
    )
    return sub is not None


def check_feature_credit(user: User, feature_key: str, db: Session) -> None:
    """Raise HTTP 402 if the free allowance is already exhausted, WITHOUT
    spending a credit. Use before expensive work (so an out-of-credits user
    doesn't trigger an LLM call), then call consume_feature_credit() once the
    work has actually succeeded."""
    if feature_key not in GATED_FEATURES:
        raise ValueError(f"Unknown gated feature: {feature_key}")
    if _aspirant_is_premium(user.id, db):
        return
    usage = db.query(FeatureUsage).filter(
        FeatureUsage.user_id == user.id, FeatureUsage.feature_key == feature_key,
    ).first()
    if usage and usage.used_count >= FREE_TIER_LIMIT:
        raise PaymentRequiredException(
            f"You've used all {FREE_TIER_LIMIT} free uses of this feature. Upgrade to DISHA Premium for unlimited access."
        )


def consume_feature_credit(user: User, feature_key: str, db: Session) -> None:
    """Spend one use of a gated aspirant feature. No-ops for a premium
    aspirant; otherwise raises HTTP 402 once the free lifetime allowance
    (3 uses) is exhausted. For features with costly setup, call
    check_feature_credit() first and this only after the work succeeded."""
    if feature_key not in GATED_FEATURES:
        raise ValueError(f"Unknown gated feature: {feature_key}")

    if _aspirant_is_premium(user.id, db):
        return

    usage = db.query(FeatureUsage).filter(
        FeatureUsage.user_id == user.id, FeatureUsage.feature_key == feature_key,
    ).first()
    if not usage:
        usage = FeatureUsage(user_id=user.id, feature_key=feature_key, used_count=0)
        db.add(usage)
        db.flush()

    if usage.used_count >= FREE_TIER_LIMIT:
        raise PaymentRequiredException(
            f"You've used all {FREE_TIER_LIMIT} free uses of this feature. Upgrade to DISHA Premium for unlimited access."
        )

    usage.used_count += 1
    db.commit()


def get_aspirant_usage(user: User, db: Session):
    from app.modules.payments.schemas import AspirantUsageResponse, FeatureUsageEntry

    is_premium = _aspirant_is_premium(user.id, db)
    rows = {r.feature_key: r.used_count for r in db.query(FeatureUsage).filter(FeatureUsage.user_id == user.id).all()}
    return AspirantUsageResponse(
        is_premium=is_premium,
        features=[
            FeatureUsageEntry(feature_key=key, used_count=rows.get(key, 0), limit=None if is_premium else FREE_TIER_LIMIT)
            for key in GATED_FEATURES
        ],
    )


def get_aspirant_subscription(user: User, db: Session):
    from app.modules.payments.schemas import AspirantSubscriptionResponse

    sub = _get_or_create_aspirant_subscription(user.id, db)
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
    return AspirantSubscriptionResponse(
        plan=_plan_to_entry(plan), status=sub.status,
        current_period_start=sub.current_period_start, current_period_end=sub.current_period_end,
    )


# ── Checkout ──────────────────────────────────────────────────────────────────

def create_checkout(user: User, plan_id: str, db: Session):
    from app.modules.payments.schemas import CheckoutResponse

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id, SubscriptionPlan.is_active == True).first()
    if not plan:
        raise NotFoundException("Subscription plan not found.")
    if plan.price_monthly <= 0:
        raise BadRequestException("The free plan doesn't require checkout.")
    if not plan.razorpay_plan_id:
        raise ServiceUnavailableException("This plan isn't wired up for checkout yet — contact support.")

    client = _client()

    if plan.plan_type == "aspirant":
        if user.role_name != "aspirant":
            raise ForbiddenException("Only aspirants can subscribe to this plan.")
        sub_row = _get_or_create_aspirant_subscription(user.id, db)
        customer_email, customer_name = user.email, user.full_name
    else:
        if user.role_name not in ("employer", "employer_owner", "hr_manager", "recruiter", "interviewer"):
            raise ForbiddenException("Only employers can subscribe to this plan.")
        profile = _get_employer_profile(user, db)
        sub_row = _get_or_create_company_subscription(profile.company_id, db)
        customer_email, customer_name = user.email, profile.company_name

    try:
        if not sub_row.razorpay_customer_id:
            customer = client.customer.create({
                "name": customer_name or "DISHA user", "email": customer_email or "",
                "fail_existing": 0,
            })
            sub_row.razorpay_customer_id = customer["id"]
            db.commit()

        razorpay_subscription = client.subscription.create({
            "plan_id": plan.razorpay_plan_id,
            "customer_notify": 1,
            "total_count": 120 if plan.billing_interval == "monthly" else 10,   # ~10 years of billing cycles, cancellable anytime
            "notes": {"local_plan_id": str(plan.id), "local_user_id": str(user.id)},
        })
    except (razorpay.errors.BadRequestError, razorpay.errors.ServerError, razorpay.errors.GatewayError) as exc:
        logger.error("Razorpay checkout failed for plan %s: %s", plan.id, exc)
        raise ServiceUnavailableException("Payment provider rejected the request. Please try again shortly or contact support.")

    db.add(Payment(
        user_id=user.id if plan.plan_type == "aspirant" else None,
        company_id=None if plan.plan_type == "aspirant" else sub_row.company_id,
        plan_id=plan.id, amount=plan.price_monthly, currency="INR", status="created",
        razorpay_subscription_id=razorpay_subscription["id"],
    ))
    db.commit()

    return CheckoutResponse(
        razorpay_key_id=get_settings_key_id(),
        razorpay_subscription_id=razorpay_subscription["id"],
        plan=_plan_to_entry(plan),
    )


def get_settings_key_id() -> str:
    return get_settings().razorpay_key_id


def verify_checkout_signature(payment_id: str, subscription_id: str, signature: str, db: Session) -> None:
    settings = get_settings()
    if not settings.razorpay_key_secret:
        raise ServiceUnavailableException("Payments are not configured on this server yet.")

    expected = hmac.new(
        settings.razorpay_key_secret.encode(), f"{payment_id}|{subscription_id}".encode(), hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise BadRequestException("Payment signature verification failed.")

    payment = db.query(Payment).filter(Payment.razorpay_subscription_id == subscription_id).first()
    if payment:
        payment.razorpay_payment_id = payment_id
        payment.razorpay_signature = signature
        payment.status = "authorized"
        db.commit()


def cancel_subscription(user: User, db: Session) -> None:
    client = _client()
    if user.role_name == "aspirant":
        sub = db.query(AspirantSubscription).filter(AspirantSubscription.user_id == user.id).first()
    else:
        profile = _get_employer_profile(user, db)
        sub = db.query(CompanySubscription).filter(CompanySubscription.company_id == profile.company_id).first()

    if not sub or not sub.razorpay_subscription_id:
        raise NotFoundException("No active paid subscription to cancel.")

    try:
        client.subscription.cancel(sub.razorpay_subscription_id, {"cancel_at_cycle_end": 1})
    except (razorpay.errors.BadRequestError, razorpay.errors.ServerError, razorpay.errors.GatewayError) as exc:
        logger.error("Razorpay cancellation failed for subscription %s: %s", sub.razorpay_subscription_id, exc)
        raise ServiceUnavailableException("Payment provider rejected the cancellation. Please try again shortly or contact support.")

    sub.status = "canceled"
    db.commit()


def list_payment_history(user: User, db: Session) -> list:
    from app.modules.payments.schemas import PaymentHistoryEntry

    query = db.query(Payment)
    if user.role_name == "aspirant":
        query = query.filter(Payment.user_id == user.id)
    else:
        profile = _get_employer_profile(user, db)
        query = query.filter(Payment.company_id == profile.company_id)

    rows = query.order_by(Payment.created_at.desc()).all()
    plan_names = {p.id: p.name for p in db.query(SubscriptionPlan).all()}
    return [
        PaymentHistoryEntry(
            id=str(r.id), plan_name=plan_names.get(r.plan_id), amount=r.amount, currency=r.currency,
            status=r.status, method=r.method, invoice_number=r.invoice_number,
            created_at=r.created_at, captured_at=r.captured_at,
        )
        for r in rows
    ]


# ── Webhook ───────────────────────────────────────────────────────────────────

def _verify_webhook_signature(raw_body: bytes, signature: str) -> None:
    settings = get_settings()
    if not settings.razorpay_webhook_secret:
        raise ServiceUnavailableException("Webhook is not configured on this server yet.")
    expected = hmac.new(settings.razorpay_webhook_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature or ""):
        raise BadRequestException("Invalid webhook signature.")


def handle_webhook(raw_body: bytes, signature: str, db: Session) -> None:
    import json

    _verify_webhook_signature(raw_body, signature)
    event = json.loads(raw_body)
    event_id = event.get("id") or str(uuid.uuid4())
    event_type = event.get("event", "")

    if db.query(RazorpayWebhookEvent).filter(RazorpayWebhookEvent.razorpay_event_id == event_id).first():
        return   # already processed — Razorpay retries webhooks, so this must be idempotent

    log_row = RazorpayWebhookEvent(razorpay_event_id=event_id, event_type=event_type, payload=event)
    db.add(log_row)
    db.commit()

    entity = event.get("payload", {}).get("subscription", {}).get("entity", {})
    razorpay_subscription_id = entity.get("id")
    if not razorpay_subscription_id:
        log_row.processed_at = datetime.now(timezone.utc)
        db.commit()
        return

    company_sub = db.query(CompanySubscription).filter(
        CompanySubscription.razorpay_subscription_id == razorpay_subscription_id,
    ).first()
    aspirant_sub = None
    if not company_sub:
        aspirant_sub = db.query(AspirantSubscription).filter(
            AspirantSubscription.razorpay_subscription_id == razorpay_subscription_id,
        ).first()
    sub = company_sub or aspirant_sub

    if not sub:
        # First activation — the row was keyed by subscription id only in `payments`,
        # not yet linked to the actual subscription record. Resolve it from there.
        payment = db.query(Payment).filter(Payment.razorpay_subscription_id == razorpay_subscription_id).first()
        if payment and payment.plan_id:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == payment.plan_id).first()
            if plan and plan.plan_type == "aspirant" and payment.user_id:
                sub = _get_or_create_aspirant_subscription(payment.user_id, db)
                sub.plan_id = plan.id
            elif plan and payment.company_id:
                sub = _get_or_create_company_subscription(payment.company_id, db)
                sub.plan_id = plan.id
            if sub:
                sub.razorpay_subscription_id = razorpay_subscription_id

    if sub:
        if event_type in ("subscription.activated", "subscription.charged"):
            sub.status = "active"
            sub.current_period_start = datetime.now(timezone.utc)
            interval = timedelta(days=365) if _plan_billing_interval(sub, db) == "annual" else timedelta(days=30)
            sub.current_period_end = datetime.now(timezone.utc) + interval
            if event_type == "subscription.charged":
                payment_entity = event.get("payload", {}).get("payment", {}).get("entity", {})
                db.add(Payment(
                    user_id=sub.user_id if isinstance(sub, AspirantSubscription) else None,
                    company_id=None if isinstance(sub, AspirantSubscription) else sub.company_id,
                    plan_id=sub.plan_id, amount=payment_entity.get("amount", 0), currency="INR",
                    status="captured", razorpay_payment_id=payment_entity.get("id"),
                    razorpay_subscription_id=razorpay_subscription_id, method=payment_entity.get("method"),
                    raw_payload=payment_entity, captured_at=datetime.now(timezone.utc),
                ))
        elif event_type in ("subscription.cancelled", "subscription.completed"):
            sub.status = "canceled"
        elif event_type in ("subscription.halted", "payment.failed"):
            sub.status = "past_due"
        db.commit()

    log_row.processed_at = datetime.now(timezone.utc)
    db.commit()


def _plan_billing_interval(sub, db: Session) -> str:
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
    return plan.billing_interval if plan else "monthly"
