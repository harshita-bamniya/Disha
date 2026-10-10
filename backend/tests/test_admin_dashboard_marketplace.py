"""Admin dashboard zone B (marketplace health).

The test database also holds real development rows, so assertions compare against a baseline taken first.
"""
from datetime import date, timedelta

import pytest

from app.core.rbac import get_current_user
from app.main import app
from app.models.applications import (
    APPLICATION_STATUSES,
    REACHED_INTERVIEW_STATUSES,
    Application,
    ApplicationStatusHistory,
)
from app.models.user import JobPosting
from app.modules.admin.dashboard import marketplace
from tests.test_admin_dashboard import NOW, _as, _employer_profile, _user


def _tile(result, key):
    return next(t for t in result["tiles"] if t["key"] == key)


def _job(db, prof, title, sector="Banking & Finance", status="published", age_days=0, expires=None, active=True):
    j = JobPosting(employer_id=prof.id, title=title, description="d", sector=sector, required_skills=["x"],
                   status=status, is_active=active, expires_at=expires, created_at=NOW - timedelta(days=age_days))
    db.add(j)
    db.flush()
    return j


def _application(db, job, status="applied", days_ago=1, history=()):
    cand = _user(db, "aspirant", "cand")
    a = Application(aspirant_id=cand.id, job_id=job.id, status=status, created_at=NOW - timedelta(days=days_ago))
    db.add(a)
    db.flush()
    for to_status, d in history:
        db.add(ApplicationStatusHistory(application_id=a.id, to_status=to_status, created_at=NOW - timedelta(days=d)))
    db.flush()
    return a


@pytest.fixture
def employer(db):
    return _employer_profile(db)[1]


@pytest.fixture
def admin(db):
    return _user(db, "super_admin", "super")


def test_live_jobs_exclude_drafts_expired_and_inactive(db, employer):
    before = _tile(marketplace.overview(db, 30, False), "live_jobs")["value"]
    _job(db, employer, "live")
    _job(db, employer, "draft", status="draft")
    _job(db, employer, "expired", expires=date.today() - timedelta(days=1))
    _job(db, employer, "inactive", active=False)
    _job(db, employer, "closes today", expires=date.today())          # still open on its last day
    assert _tile(marketplace.overview(db, 30, False), "live_jobs")["value"] - before == 2


def test_applications_count_and_daily_series_cover_only_the_range(db, employer):
    before = marketplace.overview(db, 30, False)
    busy, quiet = _job(db, employer, "busy"), _job(db, employer, "quiet")
    for _ in range(3):
        _application(db, busy, days_ago=2)
    _application(db, quiet, days_ago=2)
    _application(db, busy, days_ago=60)                                  # outside the 30-day range
    after = marketplace.overview(db, 30, False)
    tile = _tile(after, "applications")
    assert tile["value"] - _tile(before, "applications")["value"] == 4
    assert len(tile["series"]) == 30 and sum(tile["series"]) == tile["value"]


def test_interview_rate_counts_every_interview_stage_and_looks_at_history_too(db, employer):
    job = _job(db, employer, "j")
    before = _tile(marketplace.overview(db, 30, False), "interview_rate")
    _application(db, job, "hr_interview")                                              # missed by the old funnel
    _application(db, job, "technical_interview")
    _application(db, job, "offer_sent")
    _application(db, job, "rejected", history=[("hr_interview", 3), ("rejected", 2)])  # interviewed, then rejected
    _application(db, job, "shortlisted")                                               # not an interview yet
    _application(db, job, "applied")
    after = _tile(marketplace.overview(db, 30, False), "interview_rate")
    assert after["denominator"] - before["denominator"] == 6
    assert after["numerator"] - before["numerator"] == 4


def test_the_funnel_and_the_tiles_share_one_interview_definition():
    from app.modules.admin.command_center import funnel
    assert set(funnel.INTERVIEW_STATUSES) == set(REACHED_INTERVIEW_STATUSES)
    # the old funnel looked for 'interviewed' and 'offered', which are not statuses at all
    assert set(REACHED_INTERVIEW_STATUSES) <= set(APPLICATION_STATUSES)


def test_hires_are_counted_by_the_date_of_the_status_change(db, employer):
    job = _job(db, employer, "j")
    before = marketplace.overview(db, 30, True)
    _application(db, job, "hired", days_ago=50, history=[("hired", 2)])      # applied long ago, hired inside the range
    _application(db, job, "hired", days_ago=5, history=[("hired", 40)])      # hired in the previous period
    after = marketplace.overview(db, 30, True)
    assert _tile(after, "hires")["value"] - _tile(before, "hires")["value"] == 1
    # one more hire now and one more in the previous period: the change between the periods is unchanged
    assert _tile(after, "hires")["delta"]["abs"] == _tile(before, "hires")["delta"]["abs"]


def test_small_samples_get_no_change_and_no_misleading_percentage(db, employer):
    job = _job(db, employer, "j")
    _application(db, job, "hr_interview", days_ago=2)
    _application(db, job, "applied", days_ago=40)
    rate = _tile(marketplace.overview(db, 30, True), "interview_rate")
    if rate["low_sample"]:
        assert rate["delta"] is None                                          # no arrow on a handful of people
    assert marketplace._count_delta(3, 1) == {"abs": 2, "pct": None}          # 1 -> 3 is not "+200%"
    assert marketplace._count_delta(30, 20) == {"abs": 10, "pct": 0.5}
    assert marketplace._count_delta(5, None) is None                           # compare off: no delta at all


def test_compare_off_returns_no_deltas(db):
    result = marketplace.overview(db, 30, False)
    assert all(t["delta"] is None for t in result["tiles"]) and result["range"]["compare"] is False


def test_sector_balance_and_jobs_that_never_got_an_application(db, employer):
    stale = _job(db, employer, "stale", sector="Test Sector Zero", age_days=10)          # a week up, no applications ever
    fresh = _job(db, employer, "fresh", sector="Test Sector Zero", age_days=1)           # too new to judge
    busy = _job(db, employer, "busy", sector="Test Sector Busy", age_days=10)
    for _ in range(4):
        _application(db, busy, days_ago=2)
    result = marketplace.overview(db, 30, False)
    by = {s["sector"]: s for s in result["sectors"]}
    assert by["Test Sector Zero"] == {"sector": "Test Sector Zero", "jobs": 2, "applications": 0, "per_job": 0.0}
    assert by["Test Sector Busy"]["applications"] == 4 and by["Test Sector Busy"]["per_job"] == 4.0
    flagged = {i["id"] for i in result["zero_application_jobs"]["items"]}
    assert str(stale.id) in flagged and str(fresh.id) not in flagged and str(busy.id) not in flagged


def test_overview_endpoint_is_for_super_admin_and_admin_and_validates_the_range(client, db, admin):
    try:
        for role in ("moderator", "finance_manager", "support_executive", "verification_officer"):
            app.dependency_overrides[get_current_user] = _as(_user(db, role, role))
            assert client.get("/api/admin/dashboard/overview").status_code == 403
        app.dependency_overrides[get_current_user] = _as(admin)
        ok = client.get("/api/admin/dashboard/overview?days=7&compare=true")
        assert ok.status_code == 200 and ok.json()["range"]["days"] == 7 and len(ok.json()["tiles"]) == 4
        assert client.get("/api/admin/dashboard/overview?days=3").status_code == 422
        assert client.get("/api/admin/dashboard/overview?days=999").status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)
