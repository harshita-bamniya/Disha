"""Admin dashboard, zone A: the work that is waiting on a person.

Every row is a queue that a staff member can actually clear. A row appears only when it has something in it;
rows a role may not act on are not computed at all (so nothing leaks to the wrong role). "Overdue" is measured
against targets kept in platform_settings (verification_target_days, ticket_first_response_hours).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import exists, func
from sqlalchemy.orm import Session

from app.models.counsellor import SafetyFlag
from app.models.employer_verification import EmployerVerification
from app.models.interview import InterviewSafetyEvent
from app.models.interview_verified import InterviewAppeal
from app.models.payment import Payment
from app.models.platform import PlatformSetting
from app.models.subscription import (
    AspirantSubscription,
    CompanySubscription,
    SubscriptionPlan,
)
from app.models.support import SupportTicket, TicketMessage
from app.models.user import User

DEFAULT_VERIFICATION_TARGET_DAYS = 3
DEFAULT_TICKET_FIRST_RESPONSE_HOURS = 24

# Which roles act on which queue. Revenue-related rows are super admin (and the billing role) only.
ROW_ROLES: dict[str, set[str]] = {
    "verifications": {"super_admin", "admin", "verification_officer"},
    "tickets": {"super_admin", "admin", "support_executive"},
    "appeals": {"super_admin", "admin", "moderator"},
    "safety": {"super_admin", "admin", "moderator"},
    "payments": {"super_admin", "finance_manager"},
}
ROW_ORDER = ["verifications", "tickets", "safety", "appeals", "payments"]
ROW_LABELS = {
    "verifications": "Employer verifications",
    "tickets": "Support tickets",
    "safety": "Safety events",
    "appeals": "Interview appeals",
    "payments": "Payments",
}
ROW_LINKS = {
    "verifications": "/admin/kyc",
    "tickets": "/admin/support",
    "safety": "/admin/interview-calibration",
    "appeals": "/admin/interview-calibration",
    "payments": "/admin/billing",
}
DASHBOARD_ROLES = ("super_admin", "admin", "moderator", "verification_officer", "finance_manager", "support_executive")

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _setting(db: Session, key: str, default: int) -> int:
    row = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    try:
        value = int(row.value) if row and row.value is not None else default
    except (TypeError, ValueError):
        value = default
    return value if value > 0 else default


def targets(db: Session) -> dict:
    return {
        "verification_days": _setting(db, "verification_target_days", DEFAULT_VERIFICATION_TARGET_DAYS),
        "ticket_first_response_hours": _setting(db, "ticket_first_response_hours", DEFAULT_TICKET_FIRST_RESPONSE_HOURS),
    }


def _age_hours(oldest: Optional[datetime], now: datetime) -> Optional[float]:
    if oldest is None:
        return None
    return round(max(0.0, (now - oldest).total_seconds() / 3600), 1)


def _row(key: str, count: int, oldest: Optional[datetime], now: datetime, overdue: int = 0, urgent: bool = False,
         parts: Optional[list[tuple[str, int]]] = None, note: Optional[str] = None) -> dict:
    return {
        "key": key,
        "label": ROW_LABELS[key],
        "count": count,
        "overdue": overdue,
        "level": "urgent" if (overdue > 0 or urgent) else "normal",
        "oldest_age_hours": _age_hours(oldest, now),
        "parts": [{"label": label, "count": n} for label, n in (parts or []) if n > 0],
        "note": note,
        "link": ROW_LINKS[key],
    }


# ── one function per queue ───────────────────────────────────────────────────────────────────

def _verifications(db: Session, now: datetime, tg: dict) -> Optional[dict]:
    waiting = db.query(EmployerVerification).filter(EmployerVerification.status.in_(("requested", "under_review")))
    count = waiting.count()
    if count == 0:
        return None
    oldest = waiting.with_entities(func.min(EmployerVerification.submitted_at)).scalar()
    cutoff = now - timedelta(days=tg["verification_days"])
    overdue = waiting.filter(EmployerVerification.submitted_at < cutoff).count()
    # needs_info is waiting on the employer, not on staff: shown as a note, never counted as backlog.
    needs_info = db.query(EmployerVerification).filter(EmployerVerification.status == "needs_info").count()
    note = f"{needs_info} waiting on the employer for more information" if needs_info else None
    return _row("verifications", count, oldest, now, overdue=overdue, note=note)


def _tickets(db: Session, now: datetime, tg: dict) -> Optional[dict]:
    open_q = db.query(SupportTicket).filter(SupportTicket.status == "open")
    count = open_q.count()
    if count == 0:
        return None
    oldest = open_q.with_entities(func.min(SupportTicket.created_at)).scalar()
    unassigned = open_q.filter(SupportTicket.assigned_to.is_(None)).count()
    urgent_high = open_q.filter(SupportTicket.priority.in_(("high", "urgent"))).count()
    staff_replied = exists().where(
        TicketMessage.ticket_id == SupportTicket.id,
        TicketMessage.is_internal.is_(False),
        TicketMessage.sender_id.isnot(None),
        TicketMessage.sender_id != SupportTicket.reporter_id,
    )
    cutoff = now - timedelta(hours=tg["ticket_first_response_hours"])
    overdue = open_q.filter(SupportTicket.created_at < cutoff, ~staff_replied).count()
    return _row("tickets", count, oldest, now, overdue=overdue,
                parts=[("unassigned", unassigned), ("high or urgent", urgent_high)])


def _safety(db: Session, now: datetime, tg: dict) -> Optional[dict]:
    interview = db.query(InterviewSafetyEvent).filter(InterviewSafetyEvent.reviewed_by.is_(None))
    counsel = db.query(SafetyFlag).filter(SafetyFlag.reviewed_by.is_(None))
    count = interview.count() + counsel.count()
    if count == 0:
        return None
    high = (
        interview.filter(InterviewSafetyEvent.severity.in_(("high", "critical"))).count()
        + counsel.filter(SafetyFlag.severity.in_(("high", "critical"))).count()
    )
    oldest_candidates = [
        interview.with_entities(func.min(InterviewSafetyEvent.created_at)).scalar(),
        counsel.with_entities(func.min(SafetyFlag.created_at)).scalar(),
    ]
    oldest = min((d for d in oldest_candidates if d is not None), default=None)
    return _row("safety", count, oldest, now, urgent=high > 0, parts=[("high or critical", high)])


def _appeals(db: Session, now: datetime, tg: dict) -> Optional[dict]:
    q = db.query(InterviewAppeal).filter(InterviewAppeal.status == "open")
    count = q.count()
    if count == 0:
        return None
    return _row("appeals", count, q.with_entities(func.min(InterviewAppeal.created_at)).scalar(), now)


def _payments(db: Session, now: datetime, tg: dict) -> Optional[dict]:
    company_past_due = (
        db.query(func.count(CompanySubscription.id), func.coalesce(func.sum(SubscriptionPlan.price_monthly), 0))
        .join(SubscriptionPlan, SubscriptionPlan.id == CompanySubscription.plan_id)
        .filter(CompanySubscription.status == "past_due").one()
    )
    aspirant_past_due = (
        db.query(func.count(AspirantSubscription.id), func.coalesce(func.sum(SubscriptionPlan.price_monthly), 0))
        .join(SubscriptionPlan, SubscriptionPlan.id == AspirantSubscription.plan_id)
        .filter(AspirantSubscription.status == "past_due").one()
    )
    count = company_past_due[0] + aspirant_past_due[0]
    failed_week = db.query(Payment).filter(Payment.status == "failed", Payment.created_at >= now - timedelta(days=7)).count()
    if count == 0 and failed_week == 0:
        return None
    at_risk_paise = int(company_past_due[1]) + int(aspirant_past_due[1])
    note = f"₹{at_risk_paise // 100:,} a month at risk" if at_risk_paise else None
    return _row("payments", count, None, now, urgent=count > 0,
                parts=[("past due", count), ("failed payments in the last 7 days", failed_week)], note=note)


_BUILDERS = {
    "verifications": _verifications, "tickets": _tickets, "safety": _safety, "appeals": _appeals, "payments": _payments,
}


def attention(db: Session, user: User) -> dict:
    """Rows that need a person, most urgent first, plus the queues this role watches that are clear."""
    now = _now()
    tg = targets(db)
    role = user.role_name
    rows, clear = [], []
    for key in ROW_ORDER:
        if role not in ROW_ROLES[key]:
            continue
        row = _BUILDERS[key](db, now, tg)
        if row is None:
            clear.append(ROW_LABELS[key])
        else:
            rows.append(row)
    # Urgent first, then by how long the oldest item has waited.
    rows.sort(key=lambda r: (r["level"] != "urgent", -(r["oldest_age_hours"] or 0)))
    return {"generated_at": now.isoformat(), "targets": tg, "rows": rows, "clear": clear}
