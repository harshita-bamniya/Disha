"""Resume-match routes: ownership, daily quota, cache, rewrite cap, error mapping (the AI parts are stubbed)."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.ai.providers.groq import RateLimitedError
from app.core.rbac import get_current_aspirant
from app.main import app
from app.models.resume_match import ResumeMatchScan
from app.models.user import AspirantProfile, EmployerProfile, JobPosting, Role, User
from app.modules.resume_match import service
from tests.test_resume_fit_applications import _report

RESUME = "Analyst with five years of Python and policy research experience. " * 3


def _user(db, label):
    role = db.query(Role).filter(Role.name == "aspirant").first()
    u = User(email=f"{label}-{uuid.uuid4().hex[:8]}@example.com", role_id=role.id, email_verified=True, is_active=True)
    db.add(u)
    db.flush()
    return u


@pytest.fixture
def env(db, owner_and_company, monkeypatch):
    owner, company = owner_and_company
    emp = db.query(EmployerProfile).filter(EmployerProfile.user_id == owner.id).first()
    job = JobPosting(employer_id=emp.id, company_id=company.id, title="Analyst", description="d", sector="Policy",
                     required_skills=["Python"], status="published", is_active=True)
    db.add(job)
    me, other = _user(db, "me"), _user(db, "other")
    for u in (me, other):
        db.add(AspirantProfile(user_id=u.id, resume_scan_consent_at=datetime.now(timezone.utc)))
    db.flush()
    app.dependency_overrides[get_current_aspirant] = lambda: me
    calls = {"analyze": 0}

    async def fake_requirements(_db, _job):
        from app.modules.resume_match.schemas import JobRequirements, Requirement
        return JobRequirements(requirements=[Requirement(name="Python", type="hard_skill")])

    async def fake_parse(text):
        from app.modules.resume_match.schemas import CandidateProfile
        return CandidateProfile()

    async def fake_analyze(requirements, profile, signals):
        calls["analyze"] += 1
        return _report()

    monkeypatch.setattr(service, "get_or_parse_requirements", fake_requirements)
    monkeypatch.setattr(service, "parse_resume", fake_parse)
    monkeypatch.setattr(service.engine, "analyze", fake_analyze)
    from app.modules.resume_match.schemas import AtsSignals
    monkeypatch.setattr(service, "text_from_upload", lambda data, name: (data.decode(), AtsSignals(char_count=900), name))
    yield job, me, other, calls
    app.dependency_overrides.pop(get_current_aspirant, None)


def scan(client, job, text=RESUME):
    return client.post("/api/resume-match/scan-upload", data={"job_id": str(job.id)}, files={"file": ("cv.pdf", text.encode(), "application/pdf")})


def test_scan_then_identical_rescan_is_cached_and_uses_no_quota(client, env):
    job, _, _, calls = env
    first, second = scan(client, job), scan(client, job)
    assert first.status_code == 200 and first.json()["cached"] is False
    assert second.status_code == 200 and second.json()["cached"] is True and second.json()["id"] == first.json()["id"]
    assert calls["analyze"] == 1
    assert client.get("/api/resume-match/quota").json() == {"limit": 10, "used": 1, "remaining": 9}


def test_changed_resume_text_is_a_new_scan_linked_to_the_previous(client, env):
    job, *_ = env
    a = scan(client, job).json()
    b = scan(client, job, RESUME + " Added a new project on budget tracking.").json()
    assert b["cached"] is False and b["id"] != a["id"]


def _fill_quota(db, user, job, n):
    for i in range(n):
        db.add(ResumeMatchScan(user_id=user.id, job_id=job.id, resume_source="upload", resume_label="x", resume_hash=f"h{i}",
                               job_source_hash="j", scoring_version="old", score=50, band="Fair", profile={}, report={},
                               created_at=datetime.now(timezone.utc) - timedelta(hours=1)))
    db.flush()


def test_eleventh_new_scan_in_a_day_gets_429_but_a_cached_one_still_works(client, db, env):
    job, me, _, calls = env
    assert scan(client, job).status_code == 200
    _fill_quota(db, me, job, 9)                                   # 1 real + 9 = 10 used
    r = scan(client, job, RESUME + " different text so it is not cached")
    assert r.status_code == 429 and "Daily limit" in r.json()["detail"]
    assert scan(client, job).status_code == 200 and calls["analyze"] == 1      # same text: cache hit, no quota needed


def test_other_users_scan_is_invisible_and_cannot_be_deleted(client, db, env):
    job, me, other, _ = env
    mine = scan(client, job).json()["id"]
    app.dependency_overrides[get_current_aspirant] = lambda: other
    assert client.get(f"/api/resume-match/scans/{mine}").status_code == 404
    assert client.delete(f"/api/resume-match/scans/{mine}").status_code == 404
    assert client.get(f"/api/resume-match/jobs/{job.id}/scans").json() == []
    app.dependency_overrides[get_current_aspirant] = lambda: me
    assert client.get(f"/api/resume-match/scans/{mine}").status_code == 200
    assert client.delete(f"/api/resume-match/scans/{mine}").status_code == 204


def test_bad_inputs(client, env):
    job, *_ = env
    assert scan(client, job, "too short").status_code == 400
    r = client.post("/api/resume-match/scan-upload", data={"job_id": str(uuid.uuid4())}, files={"file": ("cv.pdf", RESUME.encode(), "application/pdf")})
    assert r.status_code == 404
    assert client.get("/api/resume-match/scans/not-a-uuid").status_code == 404
    assert client.post("/api/resume-match/scan", json={"job_id": str(job.id)}).status_code in (400, 422)


def test_provider_busy_maps_to_503_and_nothing_is_saved(client, db, env, monkeypatch):
    job, me, *_ = env

    async def busy(*a, **k):
        raise RateLimitedError("busy")
    monkeypatch.setattr(service.engine, "analyze", busy)
    assert scan(client, job).status_code == 503
    assert service.scans_used_today(me, db) == 0


def test_rewrite_daily_cap_is_enforced_through_redis(client, env, monkeypatch):
    job, *_ = env
    scan_id = scan(client, job).json()["id"]

    class FakeRedis:
        n = 30
        def incr(self, key):
            self.n += 1
            return self.n
        def expire(self, *a):
            pass
    import app.database as database
    monkeypatch.setattr(database, "get_redis_client", lambda: FakeRedis())
    r = client.post(f"/api/resume-match/scans/{scan_id}/answer", json={"requirement": "Python", "answer": "I built ETL pipelines in Python at my last job."})
    assert r.status_code == 429 and "suggestions" in r.json()["detail"]


def test_rewrite_limiter_fails_open_when_redis_is_down(monkeypatch):
    import app.database as database
    monkeypatch.setattr(database, "get_redis_client", lambda: (_ for _ in ()).throw(ConnectionError("down")))
    service._spend_rewrite(SimpleUser())               # must not raise


class SimpleUser:
    id = uuid.uuid4()


# ── privacy: consent, deletion, retention ────────────────────────────────────

from app.modules.resume_match import privacy


def test_scanning_needs_consent_and_the_consent_screen_text_says_what_happens(client, db, env):
    job, me, *_ = env
    prof = db.query(AspirantProfile).filter(AspirantProfile.user_id == me.id).first()
    prof.resume_scan_consent_at = None
    db.flush()
    r = scan(client, job)
    assert r.status_code == 403 and r.json()["detail"]["code"] == "consent_required"
    assert client.post("/api/resume-match/scan", json={"job_id": str(job.id), "resume_id": str(uuid.uuid4())}).status_code == 403
    status = client.get("/api/resume-match/consent").json()
    assert status["consented"] is False and "180 days" in status["text"] and "employers" in status["text"]
    assert client.post("/api/resume-match/consent").json()["consented"] is True
    assert scan(client, job).status_code == 200


def test_delete_my_data_removes_only_my_scans_and_withdraws_consent(client, db, env):
    job, me, other, _ = env
    mine = scan(client, job).json()["id"]
    app.dependency_overrides[get_current_aspirant] = lambda: other
    theirs = scan(client, job, RESUME + " other person's different resume").json()["id"]
    app.dependency_overrides[get_current_aspirant] = lambda: me
    assert client.delete("/api/resume-match/data").json() == {"deleted_scans": 1}
    assert client.get(f"/api/resume-match/scans/{mine}").status_code == 404
    assert client.get("/api/resume-match/consent").json()["consented"] is False
    app.dependency_overrides[get_current_aspirant] = lambda: other
    assert client.get(f"/api/resume-match/scans/{theirs}").status_code == 200


def test_purge_deletes_only_scans_past_the_window(db, env):
    job, me, *_ = env
    now = datetime.now(timezone.utc)
    for label, age in (("old", 200), ("recent", 10)):
        db.add(ResumeMatchScan(user_id=me.id, job_id=job.id, resume_source="upload", resume_label=label, resume_hash=label,
                               job_source_hash="j", scoring_version="v", score=50, band="Fair", profile={}, report={},
                               created_at=now - timedelta(days=age)))
    db.flush()
    assert privacy.purge_expired(db, 180) == 1
    left = [s.resume_label for s in db.query(ResumeMatchScan).filter(ResumeMatchScan.user_id == me.id)]
    assert left == ["recent"]
    assert privacy.purge_expired(db, 0) == 0 and privacy.purge_expired(db, -5) == 0       # a bad setting never wipes everything


# ── "Did you hear back?" ─────────────────────────────────────────────────────

from app.models.applications import Application


def _application(db, job, user):
    a = Application(aspirant_id=user.id, job_id=job.id, status="applied")
    db.add(a)
    db.flush()
    return a


def test_outcome_is_set_by_the_applicant_only_and_validated(client, db, env):
    job, me, other, _ = env
    mine, theirs = _application(db, job, me), _application(db, job, other)
    r = client.put(f"/api/resume-match/applications/{mine.id}/outcome", json={"outcome": "interview"})
    assert r.status_code == 200 and r.json() == {"application_id": str(mine.id), "outcome": "interview"}
    assert client.put(f"/api/resume-match/applications/{theirs.id}/outcome", json={"outcome": "offer"}).status_code == 404
    assert client.put(f"/api/resume-match/applications/{mine.id}/outcome", json={"outcome": "hired!"}).status_code == 400
    assert client.put("/api/resume-match/applications/not-a-uuid/outcome", json={"outcome": "offer"}).status_code == 404
    assert client.get("/api/resume-match/applications/outcomes").json() == {str(mine.id): "interview"}
    client.put(f"/api/resume-match/applications/{mine.id}/outcome", json={"outcome": "offer"})       # answers can be corrected
    assert client.get("/api/resume-match/applications/outcomes").json() == {str(mine.id): "offer"}


def test_application_fit_records_which_scan_it_came_from(db, env):
    from app.modules.resume_match.application_fit import record_result
    job, me, *_ = env
    a = _application(db, job, me)
    s = ResumeMatchScan(user_id=me.id, job_id=job.id, resume_source="file", resume_label="x", resume_hash="h", job_source_hash="j",
                        scoring_version="v", score=61, band="Good", profile={}, report=_report().model_dump(mode="json"))
    db.add(s)
    db.flush()
    record_result(a, s)
    assert a.resume_match_scan_id == s.id and a.match_score == 61 and a.resume_fit_status == "ready"
