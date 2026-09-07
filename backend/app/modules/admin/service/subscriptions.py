"""Admin: subscription plan management."""

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.subscription import SubscriptionPlan
from app.modules.admin.schemas import (
    SubscriptionPlanAdminEntry,
    SubscriptionPlanUpdateRequest,
)
from app.modules.admin.service import core


def _plan_to_admin_entry(plan: SubscriptionPlan) -> SubscriptionPlanAdminEntry:
    return SubscriptionPlanAdminEntry(
        id=str(plan.id), name=plan.name, price_monthly=plan.price_monthly,
        max_active_jobs=plan.max_active_jobs, max_recruiter_seats=plan.max_recruiter_seats,
        resume_access=plan.resume_access, candidate_search_limit=plan.candidate_search_limit,
        is_active=plan.is_active,
    )


def list_subscription_plans(db: Session) -> list[SubscriptionPlanAdminEntry]:
    plans = db.query(SubscriptionPlan).order_by(SubscriptionPlan.price_monthly).all()
    return [_plan_to_admin_entry(p) for p in plans]


def update_subscription_plan(plan_id: str, data: SubscriptionPlanUpdateRequest, actor_id: str, db: Session, request: Request | None = None) -> SubscriptionPlanAdminEntry:
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise NotFoundException("Subscription plan not found.")

    before = _plan_to_admin_entry(plan).model_dump()
    for field in ("price_monthly", "max_active_jobs", "max_recruiter_seats", "resume_access", "candidate_search_limit", "is_active"):
        val = getattr(data, field)
        if val is not None:
            setattr(plan, field, val)

    core._write_audit(db, actor_id, "subscription_plan.updated", resource="subscription_plan",
                 resource_id=plan_id, previous_value=before, new_value=_plan_to_admin_entry(plan).model_dump(), request=request)
    db.commit()
    db.refresh(plan)
    return _plan_to_admin_entry(plan)

