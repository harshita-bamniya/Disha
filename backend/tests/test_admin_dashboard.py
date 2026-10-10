"""Admin dashboard: the 'needs attention' queues, role visibility, targets, and daily-activity recording.

The test database also holds real development rows, so every assertion compares against a baseline taken before
the test adds its own rows (a delta), never an absolute count.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.core.rbac import get_current_user
from app.main import app
from app.models.analytics import UserActivityDaily
from app.models.counsellor import Conversation, Message, SafetyFlag
from app.models.employer_verification import EmployerVerification
from app.models.interview import InterviewSafetyEvent, InterviewSession
from app.models.interview_verified import InterviewAppeal
from app.models.payment import Payment
from app.models.platform import PlatformSetting
from app.models.subscription import CompanySubscription, SubscriptionPlan
from app.models.support import SupportTicket, TicketMessage
from app.models.user import EmployerProfile, Role, User
from app.modules.admin.dashboard import service

NOW = datetime.now(timezone.utc)


def _user(db, role_name, label="u"):
    role = db.query(Role).filter(Role.name == role_name).first()
    assert role is not None, f"role {role_name} not seeded"
    u = User(email=f"{label}-{uuid.uuid4().hex[:8]}@example.com", role_id=role.id, email_verified=True, is_active=True)
    db.add(u)
    db.flush()
    return u


def _rows(db, user):
    return {r["key"]: r for r in service.attention(db, user)["rows"]}


def _delta(after, before, key, field="count"):
    return (after.get(key) or {}).get(field, 0) - (before.get(key) or {}).get(field, 0)


@pytest.fixture
def admin(db):
    return _user(db, "super_admin", "super")


def _employer_profile(db):
    owner = _user(db, "employer", "emp")
    prof = EmployerProfile(user_id=owner.id, company_name="Dash Test Co", city="Delhi", is_approved=False)
    db.add(prof)
    db.flush()
    return owner, prof


def _verification(db, status, days_ago):
    _, prof = _employer_profile(db)
    v = EmployerVerification(employer_id=prof.id, status=status, submitted_at=NOW - timedelta(days=days_ago))
    db.add(v)
    db.flush()
    return v


# ── verifications ────────────────────────────────────────────────────────────────────────────

def test_verification_queue_counts_staff_backlog_and_overdue_against_the_target(db, admin):
    before = _rows(db, admin)
    _verification(db, "requested", 5)       # overdue (target is 3 days)
    _verification(db, "under_review", 1)    # waiting, not overdue
    _verification(db, "approved", 30)       # finished: ignored
    _verification(db, "needs_info", 10)     # waiting on the employer: never staff backlog
    after = _rows(db, admin)
    assert _delta(after, before, "verifications") == 2
    assert _delta(after, before, "verifications", "overdue") == 1
    assert after["verifications"]["level"] == "urgent"
    assert after["verifications"]["note"] and "waiting on the employer" in after["verifications"]["note"]


def test_target_comes_from_platform_settings_and_can_be_changed(db, admin):
    before = _rows(db, admin)
    _verification(db, "requested", 2)
    assert _delta(_rows(db, admin), before, "verifications", "overdue") == 0      # 2 days is within a 3-day target
    row = db.query(PlatformSetting).filter(PlatformSetting.key == "verification_target_days").one()
    row.value = 1
    db.flush()
    assert _delta(_rows(db, admin), before, "verifications", "overdue") == 1      # now overdue


# ── tickets ──────────────────────────────────────────────────────────────────────────────────

def _ticket(db, reporter, hours_old, priority="normal", assigned=None, status="open"):
    t = SupportTicket(subject="Help", status=status, priority=priority, reporter_id=reporter.id,
                      assigned_to=assigned.id if assigned else None, created_at=NOW - timedelta(hours=hours_old))
    db.add(t)
    db.flush()
    return t


def test_ticket_row_counts_unassigned_urgent_and_first_response_overdue(db, admin):
    reporter, staff = _user(db, "aspirant", "rep"), _user(db, "support_executive", "sup")
    before = _rows(db, admin)
    _ticket(db, reporter, 30)                                           # no staff reply after 30h: overdue
    answered = _ticket(db, reporter, 30, assigned=staff)                # staff replied: not overdue
    db.add(TicketMessage(ticket_id=answered.id, sender_id=staff.id, body="On it", is_internal=False))
    internal_only = _ticket(db, reporter, 30, priority="urgent", assigned=staff)
    db.add(TicketMessage(ticket_id=internal_only.id, sender_id=staff.id, body="note to self", is_internal=True))
    _ticket(db, reporter, 2)                                            # fresh
    _ticket(db, reporter, 90, status="resolved")                        # not open: ignored
    db.flush()
    after = _rows(db, admin)
    assert _delta(after, before, "tickets") == 4
    # an internal note is not a reply to the customer, so that ticket is overdue too
    assert _delta(after, before, "tickets", "overdue") == 2
    parts_after = {p["label"]: p["count"] for p in after["tickets"]["parts"]}
    parts_before = {p["label"]: p["count"] for p in (before.get("tickets") or {"parts": []})["parts"]}
    assert parts_after.get("unassigned", 0) - parts_before.get("unassigned", 0) == 2
    assert parts_after.get("high or urgent", 0) - parts_before.get("high or urgent", 0) == 1


def test_reporter_replying_to_their_own_ticket_is_not_a_staff_response(db, admin):
    reporter = _user(db, "aspirant", "rep")
    before = _rows(db, admin)
    t = _ticket(db, reporter, 30)
    db.add(TicketMessage(ticket_id=t.id, sender_id=reporter.id, body="Any update?", is_internal=False))
    db.flush()
    assert _delta(_rows(db, admin), before, "tickets", "overdue") == 1


# ── safety + appeals ─────────────────────────────────────────────────────────────────────────

def test_safety_row_combines_interview_events_and_counsellor_flags_and_flags_high_severity(db, admin):
    cand = _user(db, "aspirant", "cand")
    before = _rows(db, admin)
    db.add(InterviewSafetyEvent(user_id=cand.id, severity="critical", triggered_by="x"))
    db.add(InterviewSafetyEvent(user_id=cand.id, severity="low", triggered_by="x"))
    db.add(InterviewSafetyEvent(user_id=cand.id, severity="critical", triggered_by="x", reviewed_by=admin.id))   # handled
    conv = Conversation(user_id=cand.id)
    db.add(conv)
    db.flush()
    msg = Message(conversation_id=conv.id, role="user", content="hi")
    db.add(msg)
    db.flush()
    db.add(SafetyFlag(message_id=msg.id, user_id=cand.id, flag_type="self_harm", severity="high"))
    db.flush()
    after = _rows(db, admin)
    assert _delta(after, before, "safety") == 3
    assert after["safety"]["level"] == "urgent"
    high = {p["label"]: p["count"] for p in after["safety"]["parts"]}["high or critical"]
    high_before = {p["label"]: p["count"] for p in (before.get("safety") or {"parts": []})["parts"]}.get("high or critical", 0)
    assert high - high_before == 2


def test_open_appeals_are_counted_and_resolved_ones_are_not(db, admin):
    cand = _user(db, "aspirant", "cand")
    sess = InterviewSession(user_id=cand.id)
    db.add(sess)
    db.flush()
    before = _rows(db, admin)
    db.add(InterviewAppeal(session_id=sess.id, user_id=cand.id, reason="unfair", status="open"))
    db.add(InterviewAppeal(session_id=sess.id, user_id=cand.id, reason="old", status="resolved"))
    db.flush()
    assert _delta(_rows(db, admin), before, "appeals") == 1


# ── payments ─────────────────────────────────────────────────────────────────────────────────

def test_payments_row_counts_past_due_subscriptions_and_recent_failed_payments(db, admin):
    from app.models.company import Company
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_type == "employer", SubscriptionPlan.price_monthly > 0).first()
    assert plan is not None
    co = Company(name="Past Due Co", verification_status="verified")
    db.add(co)
    db.flush()
    before = _rows(db, admin)
    db.add(CompanySubscription(company_id=co.id, plan_id=plan.id, status="past_due",
                               current_period_end=NOW + timedelta(days=5)))
    db.add(Payment(company_id=co.id, amount=100, status="failed"))
    db.add(Payment(company_id=co.id, amount=100, status="failed", created_at=NOW - timedelta(days=30)))   # too old
    db.flush()
    after = _rows(db, admin)
    parts = {p["label"]: p["count"] for p in after["payments"]["parts"]}
    parts_before = {p["label"]: p["count"] for p in (before.get("payments") or {"parts": []})["parts"]}
    assert parts["past due"] - parts_before.get("past due", 0) == 1
    assert parts["failed payments in the last 7 days"] - parts_before.get("failed payments in the last 7 days", 0) == 1
    assert after["payments"]["level"] == "urgent" and "a month at risk" in (after["payments"]["note"] or "")


# ── who sees what ────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("role,expected", [
    ("super_admin", {"verifications", "tickets", "safety", "appeals", "payments"}),
    ("admin", {"verifications", "tickets", "safety", "appeals"}),                  # no revenue for plain admin
    ("verification_officer", {"verifications"}),
    ("support_executive", {"tickets"}),
    ("moderator", {"safety", "appeals"}),
    ("finance_manager", {"payments"}),
])
def test_each_role_is_only_ever_shown_its_own_queues(db, role, expected):
    user = _user(db, role, role)
    result = service.attention(db, user)
    seen = {r["key"] for r in result["rows"]} | {
        k for k, label in service.ROW_LABELS.items() if label in result["clear"]
    }
    assert seen == expected


def test_a_role_with_no_permission_never_has_the_hidden_queues_computed(db, monkeypatch):
    called = []
    monkeypatch.setitem(service._BUILDERS, "payments", lambda *a, **k: called.append("payments"))
    service.attention(db, _user(db, "admin", "adm"))
    assert called == []            # computing is skipped, not just hidden


def test_rows_are_sorted_urgent_first_then_oldest_first(db):
    user = _user(db, "super_admin", "super")
    rows = service.attention(db, user)["rows"]
    keys = [(r["level"] != "urgent", -(r["oldest_age_hours"] or 0)) for r in rows]
    assert keys == sorted(keys)


# ── HTTP ─────────────────────────────────────────────────────────────────────────────────────

def _as(user):
    # A closure, not `lambda u=user: u`: FastAPI would treat a defaulted argument as a query parameter and copy it.
    return lambda: user


def test_endpoints_require_a_staff_role(client, db):
    assert client.get("/api/admin/dashboard/attention").status_code in (401, 403)
    cand = _user(db, "aspirant", "cand")
    emp = _user(db, "employer", "emp")
    try:
        for who in (cand, emp):
            app.dependency_overrides[get_current_user] = _as(who)
            assert client.get("/api/admin/dashboard/attention").status_code == 403
        mod = _user(db, "moderator", "mod")
        app.dependency_overrides[get_current_user] = _as(mod)
        ok = client.get("/api/admin/dashboard/attention")
        assert ok.status_code == 200 and set(ok.json()) == {"generated_at", "targets", "rows", "clear"}
        assert ok.json()["targets"] == {"verification_days": 3, "ticket_first_response_hours": 24}
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ── daily activity ───────────────────────────────────────────────────────────────────────────

def test_activity_is_recorded_once_per_user_per_day_and_never_raises(db):
    from app.core.activity import IST, record_activity
    u = _user(db, "aspirant", "act")
    for _ in range(3):
        record_activity(db, u.id)
    today = datetime.now(IST).date()
    assert db.query(UserActivityDaily).filter(UserActivityDaily.user_id == u.id, UserActivityDaily.activity_date == today).count() == 1
    record_activity(db, uuid.uuid4())            # unknown user: foreign key violation is swallowed, caller carries on
    record_activity(db, u.id)                    # and the session is still usable afterwards
    assert db.query(UserActivityDaily).filter(UserActivityDaily.user_id == u.id).count() == 1


def test_every_session_start_counts_as_activity(client, db):
    """Login and token refresh both create today's row (a 30-day session means refresh is what keeps a user 'active')."""
    from app.core.activity import IST
    from app.core.security import hash_password
    u = _user(db, "aspirant", "login")
    u.password_hash = hash_password("Test@1234")
    db.commit()
    today = datetime.now(IST).date()
    res = client.post("/api/auth/login", json={"identifier": u.email, "password": "Test@1234"})
    assert res.status_code == 200, res.text
    q = db.query(UserActivityDaily).filter(UserActivityDaily.user_id == u.id)
    assert q.filter(UserActivityDaily.activity_date == today).count() == 1
    db.query(UserActivityDaily).filter(UserActivityDaily.user_id == u.id).delete()
    db.commit()
    refreshed = client.post("/api/auth/refresh", json={"refresh_token": res.json()["refresh_token"]})
    assert refreshed.status_code == 200, refreshed.text
    assert q.filter(UserActivityDaily.activity_date == today).count() == 1
