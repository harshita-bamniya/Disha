"""Employer dashboard: attention queues, tiles, pipeline, open jobs, and who sees which jobs.

Each test works in a brand-new company (the owner_and_company fixture), so counts are exact.
"""
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from app.core.rbac import require_employer
from app.main import app
from app.models.applications import (
    Application,
    ApplicationStatusHistory,
    CandidateInterviewFeedback,
)
from app.models.company import Company, CompanyDepartment
from app.models.platform import PlatformSetting
from app.models.user import EmployerProfile, JobPosting, Role, User
from app.modules.employer_home import service

NOW = datetime.now(timezone.utc)


def _user(db, role_name, label="u"):
    role = db.query(Role).filter(Role.name == role_name).first()
    assert role is not None, role_name
    u = User(email=f"{label}-{uuid.uuid4().hex[:8]}@example.com", role_id=role.id, email_verified=True, is_active=True)
    db.add(u)
    db.flush()
    return u


@pytest.fixture
def env(db, owner_and_company):
    owner, company = owner_and_company
    prof = db.query(EmployerProfile).filter(EmployerProfile.user_id == owner.id).one()
    return owner, company, prof


def _job(db, prof, company, title="Analyst", status="published", age_days=10, department=None, expires=None, active=True):
    j = JobPosting(employer_id=prof.id, company_id=company.id, department_id=department.id if department else None,
                   title=title, description="d", sector="Banking", required_skills=["x"], status=status, is_active=active,
                   expires_at=expires, created_at=NOW - timedelta(days=age_days))
    db.add(j)
    db.flush()
    return j


def _app(db, job, status="applied", days_ago=1, history=()):
    cand = _user(db, "aspirant", "cand")
    a = Application(aspirant_id=cand.id, job_id=job.id, status=status, created_at=NOW - timedelta(days=days_ago))
    db.add(a)
    db.flush()
    for to_status, d in history:
        db.add(ApplicationStatusHistory(application_id=a.id, to_status=to_status, created_at=NOW - timedelta(days=d)))
    db.flush()
    return a


def _interview(db, application, scheduled_in_hours, status="scheduled", reschedule=False):
    row = CandidateInterviewFeedback(application_id=application.id, status=status,
                                     scheduled_at=NOW + timedelta(hours=scheduled_in_hours),
                                     reschedule_requested_at=NOW if reschedule else None)
    db.add(row)
    db.flush()
    return row


def _rows(db, user):
    return {r["key"]: r for r in service.attention(db, user)["rows"]}


def _tile(result, key):
    return next(t for t in result["tiles"] if t["key"] == key)


# ── scoping ──────────────────────────────────────────────────────────────────────────────────

def test_a_department_member_only_sees_their_own_departments_jobs_and_applications(db, env):
    owner, company, prof = env
    eng = CompanyDepartment(company_id=company.id, name="Eng")
    ops = CompanyDepartment(company_id=company.id, name="Ops")
    db.add_all([eng, ops])
    db.flush()
    _app(db, _job(db, prof, company, "eng role", department=eng))
    _app(db, _job(db, prof, company, "eng role 2", department=eng))
    _app(db, _job(db, prof, company, "ops role", department=ops))
    recruiter = _user(db, "recruiter", "rec")
    db.add(EmployerProfile(user_id=recruiter.id, company_name=company.name, city="X", is_approved=True,
                           company_id=company.id, is_owner=False, department_id=eng.id))
    db.flush()

    assert _rows(db, owner)["new_applications"]["count"] == 3                     # company-wide owner
    assert _rows(db, recruiter)["new_applications"]["count"] == 2                 # only Eng
    titles = {j["title"] for j in service.overview(db, recruiter, 30, False)["jobs"]["items"]}
    assert titles == {"eng role", "eng role 2"}


def test_another_company_sees_nothing_of_this_one(db, env):
    owner, company, prof = env
    _app(db, _job(db, prof, company))
    rival = _user(db, "employer", "rival")
    other = Company(name="Rival Co", verification_status="verified")
    db.add(other)
    db.flush()
    db.add(EmployerProfile(user_id=rival.id, company_name="Rival Co", city="X", is_approved=True, company_id=other.id, is_owner=True))
    db.flush()
    assert _rows(db, rival) == {}
    ov = service.overview(db, rival, 30, False)
    assert _tile(ov, "applications")["value"] == 0 and ov["jobs"]["items"] == []


def test_a_company_awaiting_approval_gets_empty_results_not_an_error(db):
    user = _user(db, "employer", "pending")
    db.add(EmployerProfile(user_id=user.id, company_name="Pending Co", city="X", is_approved=False))
    db.flush()
    assert service.attention(db, user)["approved"] is False and service.attention(db, user)["rows"] == []
    assert service.overview(db, user, 30, True)["tiles"] == []


# ── attention ────────────────────────────────────────────────────────────────────────────────

def test_new_applications_count_only_open_jobs_and_flag_the_ones_past_the_target(db, env):
    owner, company, prof = env
    job = _job(db, prof, company)
    _app(db, job, "applied", days_ago=5)         # past the 3-day target
    _app(db, job, "applied", days_ago=1)
    _app(db, job, "screening", days_ago=9)       # someone already looked: not waiting
    _app(db, _job(db, prof, company, "closed", status="closed"), "applied", days_ago=9)         # job is not open
    _app(db, _job(db, prof, company, "expired", expires=date.today() - timedelta(days=1)), "applied", days_ago=9)
    row = _rows(db, owner)["new_applications"]
    assert (row["count"], row["overdue"], row["level"]) == (2, 1, "urgent")
    assert 4.5 * 24 < row["oldest_age_hours"] < 5.5 * 24


def test_the_first_look_target_is_an_editable_setting(db, env):
    owner, company, prof = env
    _app(db, _job(db, prof, company), "applied", days_ago=2)
    assert _rows(db, owner)["new_applications"]["overdue"] == 0
    row = db.query(PlatformSetting).filter(PlatformSetting.key == "application_first_look_days").one()
    row.value = 1
    db.flush()
    assert _rows(db, owner)["new_applications"]["overdue"] == 1


def test_interview_queues_feedback_reschedules_today_and_completed_ones_ignored(db, env):
    owner, company, prof = env
    job = _job(db, prof, company)
    _interview(db, _app(db, job, "interview_scheduled"), -3)                         # passed 3h ago, nothing logged
    _interview(db, _app(db, job, "interview_scheduled"), -0.2)                       # started 12 min ago: not stale yet
    _interview(db, _app(db, job, "interview_scheduled"), 48, reschedule=True)        # candidate asked for another time
    _interview(db, _app(db, job, "interview_completed"), -5, status="completed")     # done: never listed
    _interview(db, _app(db, job, "interview_completed"), -5, status="no_show")
    rows = _rows(db, owner)
    assert rows["needs_feedback"]["count"] == 1 and rows["needs_feedback"]["level"] == "urgent"
    assert rows["reschedule_requests"]["count"] == 1 and rows["reschedule_requests"]["level"] == "normal"


def test_interviews_today_are_counted_in_india_time_with_the_next_one_named(db, env, monkeypatch):
    """The clock is pinned (11:30 am India time) so the test means the same at any hour, including near midnight."""
    owner, company, prof = env
    fixed = datetime(2026, 10, 10, 6, 0, tzinfo=timezone.utc)                  # 11:30 am IST on 10 Oct

    class FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed.astimezone(tz) if tz else fixed

    monkeypatch.setattr(service, "datetime", FixedDatetime)
    monkeypatch.setattr(service, "_now", lambda: fixed)

    ist = service.IST
    def at(day, hour, minute=0):
        return datetime(2026, 10, day, hour, minute, tzinfo=ist).astimezone(timezone.utc)

    job = _job(db, prof, company)
    for when in (at(10, 9), at(10, 15), at(11, 10), at(9, 23, 30)):        # 9 am and 3 pm today; tomorrow; late last night
        db.add(CandidateInterviewFeedback(application_id=_app(db, job, "interview_scheduled").id, status="scheduled", scheduled_at=when))
    db.flush()
    row = _rows(db, owner)["interviews_today"]
    assert row["count"] == 2 and row["note"] == "next at 3:00 pm"


def test_offers_waiting_use_the_date_the_offer_was_sent(db, env):
    owner, company, prof = env
    job = _job(db, prof, company)
    _app(db, job, "offer_sent", history=[("offer_sent", 6)])
    _app(db, job, "offer_sent", history=[("offer_sent", 2)])
    _app(db, job, "hired", history=[("offer_sent", 9), ("hired", 7)])        # answered: not waiting
    row = _rows(db, owner)["offers_waiting"]
    assert row["count"] == 2 and 5.5 * 24 < row["oldest_age_hours"] < 6.5 * 24


def test_urgent_rows_sort_first(db, env):
    owner, company, prof = env
    job = _job(db, prof, company)
    _app(db, job, "applied", days_ago=1)                                      # normal
    _interview(db, _app(db, job, "interview_scheduled"), -4)                  # urgent
    keys = [r["key"] for r in service.attention(db, owner)["rows"]]
    assert keys.index("needs_feedback") < keys.index("new_applications")


# ── overview ─────────────────────────────────────────────────────────────────────────────────

def test_applications_series_and_period_boundaries(db, env):
    owner, company, prof = env
    job = _job(db, prof, company)
    for _ in range(3):
        _app(db, job, days_ago=2)
    _app(db, job, days_ago=60)                                              # outside a 30-day period
    tile = _tile(service.overview(db, owner, 30, False), "applications")
    assert tile["value"] == 3 and len(tile["series"]) == 30 and sum(tile["series"]) == 3


def test_interview_rate_uses_the_shared_definition(db, env):
    owner, company, prof = env
    job = _job(db, prof, company)
    for status in ("hr_interview", "technical_interview", "offer_sent", "hired"):
        _app(db, job, status)
    _app(db, job, "rejected", history=[("hr_interview", 3), ("rejected", 2)])
    _app(db, job, "shortlisted")
    _app(db, job, "applied")
    t = _tile(service.overview(db, owner, 30, False), "interview_rate")
    assert (t["numerator"], t["denominator"]) == (5, 7) and t["low_sample"] is True


def test_hires_time_to_hire_median_and_small_sample_flag(db, env):
    owner, company, prof = env
    job = _job(db, prof, company)
    for applied, hired in ((25, 20), (16, 10), (45, 5)):           # took 5, 6 and 40 days: the median is 6, the mean would be 17
        _app(db, job, "hired", days_ago=applied, history=[("hired", hired)])
    _app(db, job, "hired", days_ago=90, history=[("hired", 70)])    # hired outside the period: excluded
    ov = service.overview(db, owner, 30, True)
    hires, ttl = _tile(ov, "hires"), _tile(ov, "time_to_hire")
    assert hires["value"] == 3 and sum(hires["series"]) == 3
    assert ttl["value"] == 6.0 and ttl["low_sample"] is True              # 3 hires is under the minimum
    assert ttl["delta"] is None                                              # never compared on so few hires


def test_offer_acceptance_counts_resolved_offers_only(db, env):
    owner, company, prof = env
    job = _job(db, prof, company)
    _app(db, job, "hired", history=[("offer_sent", 5), ("hired", 3)])
    _app(db, job, "hired", history=[("offer_sent", 6), ("hired", 4)])
    _app(db, job, "offer_declined", history=[("offer_sent", 6), ("offer_declined", 4)])
    _app(db, job, "offer_sent", history=[("offer_sent", 1)])                  # still waiting: not counted
    t = _tile(service.overview(db, owner, 30, False), "offer_acceptance")
    assert (t["numerator"], t["denominator"]) == (2, 3) and t["low_sample"] is True


def test_pipeline_counts_open_jobs_by_stage(db, env):
    owner, company, prof = env
    job = _job(db, prof, company)
    for status in ("applied", "under_review", "screening", "shortlisted", "hr_interview", "interview_completed", "offer_sent", "hired", "rejected"):
        _app(db, job, status)
    _app(db, _job(db, prof, company, "closed", status="closed"), "applied")      # closed job: not in the pipeline
    got = {s["key"]: s["count"] for s in service.overview(db, owner, 30, False)["pipeline"]}
    assert got == {"new": 2, "screening": 2, "interview": 2, "offer": 1}


def test_open_jobs_table_sorted_by_who_is_waiting_and_flags_jobs_nobody_applied_to(db, env):
    owner, company, prof = env
    busy, quiet = _job(db, prof, company, "busy"), _job(db, prof, company, "quiet")
    _job(db, prof, company, "stale", age_days=12)
    _job(db, prof, company, "new", age_days=1)
    for _ in range(3):
        _app(db, busy, "applied")
    _app(db, busy, "hr_interview")
    _app(db, quiet, "applied")
    items = service.overview(db, owner, 30, False)["jobs"]["items"]
    by = {i["title"]: i for i in items}
    assert [i["title"] for i in items][:2] == ["busy", "quiet"]
    assert (by["busy"]["applicants"], by["busy"]["awaiting"], by["busy"]["in_interview"]) == (4, 3, 1)
    assert by["stale"]["no_applications"] is True and by["new"]["no_applications"] is False


def test_compare_off_means_no_deltas_and_small_counts_get_no_percentage(db, env):
    owner, company, prof = env
    _app(db, _job(db, prof, company))
    assert all(t["delta"] is None for t in service.overview(db, owner, 30, False)["tiles"])
    assert service._count_delta(3, 1) == {"abs": 2, "pct": None}
    assert service._count_delta(30, 20) == {"abs": 10, "pct": 0.5}


def test_open_jobs_carry_the_stage_mix_and_how_soon_the_posting_closes(db, env):
    owner, company, prof = env
    job = _job(db, prof, company, "mixed", expires=datetime.now(service.IST).date() + timedelta(days=3))   # India date, as the service uses
    for status in ("applied", "applied", "screening", "shortlisted", "hr_interview", "offer_sent", "rejected"):
        _app(db, job, status)
    _job(db, prof, company, "open-ended")                                     # no closing date
    by = {j["title"]: j for j in service.overview(db, owner, 30, False)["jobs"]["items"]}
    mixed = by["mixed"]
    assert (mixed["awaiting"], mixed["screening"], mixed["in_interview"], mixed["offer"], mixed["applicants"]) == (2, 2, 1, 1, 7)
    assert mixed["closes_in_days"] == 3 and by["open-ended"]["closes_in_days"] is None


def test_upcoming_interviews_are_future_scheduled_only_in_order_with_the_candidates_name(db, env):
    owner, company, prof = env
    job = _job(db, prof, company)
    later, sooner = _app(db, job, "interview_scheduled"), _app(db, job, "interview_scheduled")
    _interview(db, later, 30)
    _interview(db, sooner, 2, reschedule=True)
    _interview(db, _app(db, job, "interview_scheduled"), -3)                      # already passed
    _interview(db, _app(db, job, "interview_completed"), 5, status="completed")   # not scheduled
    got = service.overview(db, owner, 30, False)["upcoming_interviews"]
    assert [g["application_id"] for g in got] == [str(sooner.id), str(later.id)]
    assert got[0]["reschedule_requested"] is True and got[1]["reschedule_requested"] is False
    assert got[0]["job_title"] == "Analyst" and got[0]["candidate"]


def test_recent_applicants_are_newest_first_capped_and_only_from_your_own_jobs(db, env):
    owner, company, prof = env
    job = _job(db, prof, company)
    made = [_app(db, job, "applied", days_ago=d) for d in (9, 1, 5, 3, 7, 2, 4, 6)]
    rival_owner = _user(db, "employer", "rival")
    other = Company(name="Rival Co", verification_status="verified")
    db.add(other)
    db.flush()
    rival_prof = EmployerProfile(user_id=rival_owner.id, company_name="Rival Co", city="X", is_approved=True, company_id=other.id, is_owner=True)
    db.add(rival_prof)
    db.flush()
    _app(db, _job(db, rival_prof, other, "rival job"), "applied", days_ago=0)           # newest of all, but not ours
    got = service.overview(db, owner, 30, False)["recent_applicants"]
    assert len(got) == 6 and all(g["job_title"] == "Analyst" for g in got)
    newest_first = [str(a.id) for a in sorted(made, key=lambda a: a.created_at, reverse=True)][:6]
    assert [g["application_id"] for g in got] == newest_first
    assert service.overview(db, rival_owner, 30, False)["recent_applicants"][0]["job_title"] == "rival job"


# ── HTTP ─────────────────────────────────────────────────────────────────────────────────────

def test_endpoints_are_for_employer_roles_and_validate_the_range(client, db, env):
    owner, _, _ = env
    assert client.get("/api/employer/home/attention").status_code in (401, 403)
    cand = _user(db, "aspirant", "cand")
    try:
        app.dependency_overrides[require_employer] = lambda: owner
        ok = client.get("/api/employer/home/overview?days=7&compare=true")
        assert ok.status_code == 200 and len(ok.json()["tiles"]) == 6 and ok.json()["range"]["days"] == 7
        assert client.get("/api/employer/home/attention").status_code == 200
        assert client.get("/api/employer/home/overview?days=3").status_code == 422
    finally:
        app.dependency_overrides.pop(require_employer, None)
    # the real guard (not overridden) refuses an aspirant
    from app.core.rbac import get_current_user
    try:
        app.dependency_overrides[get_current_user] = lambda: cand
        assert client.get("/api/employer/home/attention").status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
