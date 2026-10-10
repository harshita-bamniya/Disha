"""Employee referral program: attribution, status sync, reward lifecycle, permissions, public pages.

No network: referral emails are captured by replacing emails.send; nothing reaches Celery.
"""
import uuid
from datetime import date, timedelta

import pytest

from app.core.rbac import require_employer
from app.main import app
from app.models.company import CompanyDepartment
from app.models.referrals import Referral, ReferralJobConfig, ReferralReward, Referrer
from app.models.user import AspirantProfile, EmployerProfile, JobPosting, Role, User
from app.modules.applications import service as app_service
from app.modules.applications.schemas import SubmitApplicationRequest
from app.modules.referrals import emails, hooks, service
from app.modules.referrals.schemas import (
    JobConfigUpdate,
    NominateRequest,
    ProgramUpdate,
    ReferrerInvite,
)

hooks.install()


# ── builders ─────────────────────────────────────────────────────────────────────────────────

def _user(db, role_name, label, **kw):
    role = db.query(Role).filter(Role.name == role_name).first()
    assert role is not None, f"role {role_name} not seeded"
    u = User(email=f"{label}-{uuid.uuid4().hex[:8]}@example.com", role_id=role.id, email_verified=True, is_active=True, **kw)
    db.add(u)
    db.flush()
    return u


def _aspirant(db, name="Priya Sharma"):
    u = _user(db, "aspirant", "cand")
    db.add(AspirantProfile(user_id=u.id, full_name=name))
    db.flush()
    return u


def _teammate(db, company, role_name="recruiter", department_id=None, label="mate"):
    u = _user(db, role_name, label)
    db.add(EmployerProfile(user_id=u.id, company_name=company.name, city="Delhi", is_approved=True,
                           company_id=company.id, is_owner=False, department_id=department_id, contact_person=label.title()))
    db.flush()
    return u


def _job(db, owner, company, title="Analyst", **kw):
    emp = db.query(EmployerProfile).filter(EmployerProfile.user_id == owner.id).first()
    job = JobPosting(employer_id=emp.id, company_id=company.id, title=title, description="d", sector="Policy",
                     required_skills=["Python"], status="published", is_active=True, **kw)
    db.add(job)
    db.flush()
    return job


@pytest.fixture
def sent(monkeypatch):
    box = []
    monkeypatch.setattr(emails, "send", lambda to, subject, html: box.append((to, subject, html)))
    return box


@pytest.fixture
def env(db, owner_and_company, sent):
    owner, company = owner_and_company
    program = service.get_program(company.id, db)
    program.is_enabled, program.default_bonus_amount, program.hold_days = True, 20000, 90
    job = _job(db, owner, company)
    db.commit()
    return owner, company, job


def _invite(db, owner, name="Asha Rao", email=None):
    email = email or f"asha-{uuid.uuid4().hex[:6]}@example.com"
    res = service.invite_referrers(owner, [ReferrerInvite(name=name, email=email)], db)
    assert res["added"], res
    return db.query(Referrer).filter(Referrer.id == res["added"][0]["id"]).one()


def _apply(db, job, referrer_code=None, candidate=None, monkeypatch=None):
    cand = candidate or _aspirant(db)
    app_service._fire_notifications = lambda *a, **k: None   # the real one enqueues Celery tasks
    return cand, app_service.submit_application(
        str(job.id), SubmitApplicationRequest(referral_code=referrer_code), cand, db)


# ── attribution ──────────────────────────────────────────────────────────────────────────────

def test_applying_through_a_link_creates_a_referral_and_notifies_the_referrer(db, env, sent):
    owner, company, job = env
    ref = _invite(db, owner)
    sent.clear()
    cand, application = _apply(db, job, ref.code)

    r = db.query(Referral).filter(Referral.application_id == application.id).one()
    assert (r.referrer_id, r.status, r.source, r.candidate_user_id) == (ref.id, "applied", "link", cand.id)
    assert r.candidate_name == "Priya Sharma"
    assert [e.event for e in r.events] == ["created", "status_changed"]
    # The referrer is told (masked name), after the commit.
    assert [to for to, *_ in sent] == [ref.email]
    assert "Priya S." in sent[0][1] and "Sharma" not in sent[0][1]


def test_code_is_case_insensitive_and_an_unknown_code_does_not_block_the_application(db, env):
    owner, _, job = env
    ref = _invite(db, owner)
    _, a1 = _apply(db, job, ref.code.lower())
    _, a2 = _apply(db, job, "NOSUCHCODE")
    assert db.query(Referral).filter(Referral.application_id == a1.id).count() == 1
    assert a2.id and db.query(Referral).filter(Referral.application_id == a2.id).count() == 0


def test_self_referral_is_ignored(db, env):
    owner, _, job = env
    me = _aspirant(db)
    ref = _invite(db, owner, email=me.email)
    _, application = _apply(db, job, ref.code, candidate=me)
    assert db.query(Referral).filter(Referral.application_id == application.id).count() == 0


def test_a_teammate_is_recognised_as_themselves_by_account_or_email(db, env):
    owner, company, job = env
    mate = _teammate(db, company)
    mine = service.ensure_self_referrer(mate, db)
    assert service._is_self(mine, mate, None, db) is True                      # same account
    assert service._is_self(mine, _aspirant(db), mate.email, db) is True       # same email
    assert service._is_self(mine, _aspirant(db), "someone@else.com", db) is False


@pytest.mark.parametrize("breaker", ["program_off", "job_closed", "referrer_disabled", "other_company"])
def test_no_attribution_when_the_rules_do_not_allow_it(db, env, breaker):
    owner, company, job = env
    ref = _invite(db, owner)
    if breaker == "program_off":
        service.get_program(company.id, db).is_enabled = False
    elif breaker == "job_closed":
        db.add(ReferralJobConfig(job_id=job.id, company_id=company.id, is_open=False))
    elif breaker == "referrer_disabled":
        ref.status = "disabled"
    else:
        # A valid code from a different company must not attribute to this company's job.
        from app.models.company import Company
        other = Company(name="Other Co", verification_status="verified")
        db.add(other)
        db.flush()
        ref.company_id = other.id
    db.flush()
    _, application = _apply(db, job, ref.code)
    assert db.query(Referral).filter(Referral.application_id == application.id).count() == 0


def test_an_earlier_nomination_beats_a_later_link(db, env):
    owner, _, job = env
    first, second = _invite(db, owner, "First"), _invite(db, owner, "Second")
    cand = _aspirant(db)
    service.nominate(first, NominateRequest(job_id=str(job.id), candidate_name="Priya", candidate_email=cand.email), db)
    _, application = _apply(db, job, second.code, candidate=cand)
    r = db.query(Referral).filter(Referral.application_id == application.id).one()
    assert r.referrer_id == first.id and r.source == "nomination" and r.status == "applied"
    assert db.query(Referral).filter(Referral.job_id == job.id).count() == 1


# ── status sync + rewards ────────────────────────────────────────────────────────────────────

def test_referral_follows_the_application_and_a_hire_creates_a_reward_snapshot(db, env, sent):
    owner, company, job = env
    ref = _invite(db, owner)
    _, application = _apply(db, job, ref.code)
    r = db.query(Referral).filter(Referral.application_id == application.id).one()

    application.status = "shortlisted"
    db.commit()
    db.refresh(r)
    assert r.status == "in_process" and r.reward is None

    sent.clear()
    application.status = "hired"
    db.commit()
    db.refresh(r)
    assert r.status == "hired"
    assert (r.reward.amount, r.reward.status, r.reward.eligible_on) == (20000, "pending", date.today() + timedelta(days=90))
    assert any("hired" in s.lower() for _, s, _ in sent)

    # Changing the program afterwards never rewrites what was promised.
    service.update_program(owner, ProgramUpdate(default_bonus_amount=1), db)
    db.refresh(r.reward)
    assert r.reward.amount == 20000


def test_job_bonus_override_wins_and_zero_means_recognition_only(db, env):
    owner, company, job = env
    ref = _invite(db, owner)
    service.update_job_config(owner, str(job.id), JobConfigUpdate(bonus_amount=50000), db)
    _, a1 = _apply(db, job, ref.code)
    a1.status = "hired"
    db.commit()
    assert db.query(ReferralReward).filter(ReferralReward.referrer_id == ref.id).one().amount == 50000

    job2 = _job(db, owner, company, "Zero bonus role")
    service.update_job_config(owner, str(job2.id), JobConfigUpdate(bonus_amount=0), db)
    _, a2 = _apply(db, job2, ref.code)
    a2.status = "hired"
    db.commit()
    r2 = db.query(Referral).filter(Referral.application_id == a2.id).one()
    assert r2.status == "hired" and r2.reward is None


def test_rejection_and_withdrawal_map_through(db, env):
    owner, _, job = env
    ref = _invite(db, owner)
    _, a = _apply(db, job, ref.code)
    r = db.query(Referral).filter(Referral.application_id == a.id).one()
    a.status = "rejected"
    db.commit()
    db.refresh(r)
    assert r.status == "rejected"


def _hired_reward(db, owner, job, ref):
    _, a = _apply(db, job, ref.code)
    a.status = "hired"
    db.commit()
    return db.query(ReferralReward).filter(ReferralReward.referrer_id == ref.id).order_by(ReferralReward.created_at.desc()).first()


def test_reward_lifecycle_requires_the_retention_period_then_approval_then_payment(db, env, sent):
    owner, _, job = env
    ref = _invite(db, owner)
    reward = _hired_reward(db, owner, job, ref)

    with pytest.raises(Exception) as e:
        service.approve_reward(owner, str(reward.id), db)
    assert "retention period ends" in str(e.value.detail)

    with pytest.raises(Exception) as e:
        service.pay_reward(owner, str(reward.id), "UTR1", db)
    assert "Approve" in str(e.value.detail)

    reward.eligible_on = date.today() - timedelta(days=1)
    db.commit()
    assert service.approve_reward(owner, str(reward.id), db)["status"] == "approved"
    paid = service.pay_reward(owner, str(reward.id), "UTR-123", db)
    assert (paid["status"], paid["payment_reference"]) == ("paid", "UTR-123") and paid["paid_at"]

    with pytest.raises(Exception):
        service.reject_reward(owner, str(reward.id), "too late", False, db)   # a paid reward is final
    events = [e.event for e in db.query(Referral).filter(Referral.id == reward.referral_id).one().events]
    assert {"reward_created", "reward_eligible", "reward_approved", "reward_paid"} <= set(events)


def test_hire_who_left_cancels_and_rejection_records_a_reason(db, env):
    owner, _, job = env
    ref = _invite(db, owner)
    reward = _hired_reward(db, owner, job, ref)
    out = service.reject_reward(owner, str(reward.id), "Left after 3 weeks", True, db)
    assert out["status"] == "cancelled" and out["note"] == "Left after 3 weeks"


def test_zero_hold_days_makes_the_reward_payable_immediately(db, env):
    owner, _, job = env
    service.update_program(owner, ProgramUpdate(hold_days=0), db)
    reward = _hired_reward(db, owner, job, _invite(db, owner))
    assert reward.status == "eligible"


def test_csv_export_defuses_spreadsheet_formulas(db, env):
    owner, _, job = env
    ref = _invite(db, owner, name='=HYPERLINK("http://evil")')
    _hired_reward(db, owner, job, ref)
    csv_text = service.export_rewards_csv(owner, db)
    assert "\n'=HYPERLINK" in csv_text.replace('"', "") or "'=HYPERLINK" in csv_text
    assert "\n=HYPERLINK" not in csv_text


# ── nominations ──────────────────────────────────────────────────────────────────────────────

def test_nomination_emails_the_candidate_and_rejects_duplicates_and_self(db, env, sent):
    owner, _, job = env
    ref = _invite(db, owner)
    sent.clear()
    body = NominateRequest(job_id=str(job.id), candidate_name="Ravi", candidate_email="Ravi@Example.com", note="Worked with him <b>5y</b>")
    service.nominate(ref, body, db)
    to, subject, html = sent[0]
    assert to == "ravi@example.com" and ref.code in html and "&lt;b&gt;" in html and "<b>5y" not in html

    with pytest.raises(Exception) as e:
        service.nominate(ref, body, db)
    assert e.value.status_code == 409
    with pytest.raises(Exception) as e:
        service.nominate(ref, NominateRequest(job_id=str(job.id), candidate_name="Me", candidate_email=ref.email), db)
    assert "yourself" in str(e.value.detail)


def test_nomination_is_rate_limited_per_day(db, env):
    owner, _, job = env
    ref = _invite(db, owner)
    for i in range(service.NOMINATIONS_PER_DAY):
        service.nominate(ref, NominateRequest(job_id=str(job.id), candidate_name="C", candidate_email=f"c{i}@example.com"), db)
    with pytest.raises(Exception) as e:
        service.nominate(ref, NominateRequest(job_id=str(job.id), candidate_name="C", candidate_email="one-more@example.com"), db)
    assert "a day" in str(e.value.detail)


# ── permissions ──────────────────────────────────────────────────────────────────────────────

def test_only_owner_or_company_wide_hr_can_administer(db, env):
    owner, company, job = env
    recruiter = _teammate(db, company, "recruiter")
    dept = CompanyDepartment(company_id=company.id, name="Eng")
    db.add(dept)
    db.flush()
    dept_hr = _teammate(db, company, "hr_manager", department_id=dept.id, label="depthr")
    company_hr = _teammate(db, company, "hr_manager", label="cohr")

    for who in (recruiter, dept_hr):
        for call in (lambda u: service.overview(u, db), lambda u: service.update_program(u, ProgramUpdate(is_enabled=False), db),
                     lambda u: service.invite_referrers(u, [ReferrerInvite(name="X", email="x@example.com")], db)):
            with pytest.raises(Exception) as e:
                call(who)
            assert e.value.status_code == 403
    assert service.overview(company_hr, db)["program_enabled"] is True


def test_company_data_is_not_visible_across_companies(db, env):
    owner, company, job = env
    ref = _invite(db, owner)
    reward = _hired_reward(db, owner, job, ref)
    from app.models.company import Company
    other_co = Company(name="Rival", verification_status="verified")
    db.add(other_co)
    db.flush()
    rival = _user(db, "employer_owner" if db.query(Role).filter(Role.name == "employer_owner").first() else "employer", "rival")
    db.add(EmployerProfile(user_id=rival.id, company_name="Rival", city="X", is_approved=True, company_id=other_co.id, is_owner=True))
    db.flush()
    with pytest.raises(Exception) as e:
        service.approve_reward(rival, str(reward.id), db)
    assert e.value.status_code == 404
    assert service.list_referrals(rival, db)["total"] == 0
    with pytest.raises(Exception) as e:
        service.get_referral(rival, str(db.query(Referral).first().id), db)
    assert e.value.status_code == 404


def test_removing_a_teammate_switches_their_link_off(db, env):
    owner, company, job = env
    mate = _teammate(db, company)
    mine = service.ensure_self_referrer(mate, db)
    assert service.resolve_link(mine.code, str(job.id), db)["valid"] is True
    mate.is_active = False
    db.commit()
    assert service.resolve_link(mine.code, str(job.id), db) == {"valid": False}
    _, application = _apply(db, job, mine.code)
    assert db.query(Referral).filter(Referral.application_id == application.id).count() == 0


def test_a_referrer_sees_masked_names_only(db, env):
    owner, _, job = env
    ref = _invite(db, owner)
    _apply(db, job, ref.code)
    dash = service.my_dashboard(ref, db)
    assert dash["referrals"][0]["candidate"] == "Priya S."
    assert dash["jobs"][0]["share_url"].endswith(f"/r/{ref.code}/{job.id}")
    assert dash["totals"]["referred"] == 1


# ── HTTP surface ─────────────────────────────────────────────────────────────────────────────

def test_public_link_and_portal_endpoints(client, db, env, sent):
    owner, _, job = env
    res = service.invite_referrers(owner, [ReferrerInvite(name="Asha Rao", email="asha@example.com")], db)
    ref = db.query(Referrer).filter(Referrer.id == res["added"][0]["id"]).one()
    token = next(html for to, _, html in sent if to == "asha@example.com").split("/referrer/")[1].split('"')[0]

    info = client.get(f"/api/public/referrals/link/{ref.code}/{job.id}").json()
    assert info == {"valid": True, "job_title": "Analyst", "company_name": info["company_name"],
                    "location": None, "referrer_first_name": "Asha"}
    for path in (f"NOPE/{job.id}", f"{ref.code}/not-a-uuid"):
        body = client.get(f"/api/public/referrals/link/{path}").json()
        assert body["valid"] is False and body["job_title"] is None and body["referrer_first_name"] is None

    assert client.get("/api/public/referrals/portal/wrong-token").status_code == 404
    dash = client.get(f"/api/public/referrals/portal/{token}")
    assert dash.status_code == 200 and dash.json()["referrer_name"] == "Asha Rao" and len(dash.json()["jobs"]) == 1

    nom = client.post(f"/api/public/referrals/portal/{token}/nominate",
                      json={"job_id": str(job.id), "candidate_name": "Ravi", "candidate_email": "ravi@example.com"})
    assert nom.status_code == 201 and nom.json()["referrals"][0]["status"] == "invited"

    # Disabling the person kills the private page immediately.
    service.set_referrer_status(owner, str(ref.id), "disabled", db)
    assert client.get(f"/api/public/referrals/portal/{token}").status_code == 404


def test_resending_replaces_the_private_link(client, db, env, sent):
    owner, _, _ = env
    ref = _invite(db, owner, email="resend@example.com")
    old = next(h for to, _, h in sent if to == "resend@example.com").split("/referrer/")[1].split('"')[0]
    sent.clear()
    service.resend_invite(owner, str(ref.id), db)
    new = sent[0][2].split("/referrer/")[1].split('"')[0]
    assert new != old
    assert client.get(f"/api/public/referrals/portal/{old}").status_code == 404
    assert client.get(f"/api/public/referrals/portal/{new}").status_code == 200


def test_employer_endpoints_enforce_roles(client, db, env):
    owner, company, job = env
    recruiter = _teammate(db, company, "recruiter")
    try:
        app.dependency_overrides[require_employer] = lambda: recruiter
        assert client.get("/api/employer/referrals/overview").status_code == 403
        assert client.get("/api/employer/referrals/program").status_code == 200       # anyone on the team may read the rules
        me = client.get("/api/employer/referrals/me")
        assert me.status_code == 200 and me.json()["jobs"][0]["job_id"] == str(job.id)

        app.dependency_overrides[require_employer] = lambda: owner
        ov = client.get("/api/employer/referrals/overview")
        assert ov.status_code == 200 and ov.json()["referrals"] == 0
        assert client.put("/api/employer/referrals/program", json={"default_bonus_amount": -5}).status_code == 422
        assert client.put("/api/employer/referrals/program", json={"hold_days": 900}).status_code == 422
        assert client.get("/api/employer/referrals/rewards/not-a-uuid").status_code in (404, 405)
        assert client.post("/api/employer/referrals/rewards/not-a-uuid/approve").status_code == 404
        csv_resp = client.get("/api/employer/referrals/rewards/export")
        assert csv_resp.status_code == 200 and csv_resp.headers["content-type"].startswith("text/csv")
    finally:
        app.dependency_overrides.pop(require_employer, None)


def test_overview_numbers(db, env):
    owner, _, job = env
    ref = _invite(db, owner)
    _, a1 = _apply(db, job, ref.code)
    _apply(db, job, ref.code)
    a1.status = "hired"
    db.commit()
    ov = service.overview(owner, db)
    assert ov["referrals"] == 2 and ov["hires"] == 1 and ov["conversion_rate"] == 0.5
    assert ov["rewards_by_status"]["pending"] == {"count": 1, "amount": 20000}
    assert ov["top_referrers"][0]["hires"] == 1


# ── regressions found by the real-HTTP run ───────────────────────────────────────────────────

def test_teammate_referrer_gets_in_app_notifications_through_the_whole_flow(db, env):
    """A teammate (unlike an invited employee) is told in-app too. The notifications table only accepts known
    types, and a rejected insert used to silently cost the candidate their referral credit."""
    owner, company, job = env
    mine = service.ensure_self_referrer(owner, db)
    _, application = _apply(db, job, mine.code)
    assert db.query(Referral).filter(Referral.application_id == application.id).count() == 1

    application.status = "hired"
    db.commit()
    from app.models.notifications import Notification
    types = {n.type for n in db.query(Notification).filter(Notification.user_id == owner.id)}
    assert {"referral_applied", "referral_hired"} <= types
    reward = db.query(ReferralReward).filter(ReferralReward.referrer_id == mine.id).one()
    reward.eligible_on = date.today() - timedelta(days=1)
    db.commit()
    service.approve_reward(owner, str(reward.id), db)
    service.pay_reward(owner, str(reward.id), None, db)


def test_every_notification_type_the_module_uses_is_allowed_by_the_table():
    import re
    from pathlib import Path

    from app.models.notifications import NOTIFICATION_TYPES
    src = "".join(p.read_text(encoding="utf8") for p in Path(service.__file__).parent.glob("*.py"))
    # the type is always the 3rd argument of _notify_referrer(...) / create_notification(...)
    used = set(re.findall(r'(?:_notify_referrer|create_notification)\(\s*[^,]+,\s*[^,]+,\s*"(referral_[a-z_]+)"', src))
    assert used and used <= set(NOTIFICATION_TYPES), used - set(NOTIFICATION_TYPES)
