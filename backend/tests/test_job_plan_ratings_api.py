"""API: skills-to-rate and generate-with-ratings (ownership, validation, previous ratings reused)."""
import uuid

import pytest

from app.core.rbac import get_current_aspirant
from app.main import app
from app.models.job_plan import JobLearningPlan
from app.models.user import EmployerProfile, JobPosting, Role, User
from app.modules.jobs import plan_router

SKILLS = [("DPDP Act", "specific", "must_have"), ("Report Writing", "generic", "must_have"), ("Excel", "specific", "nice_to_have")]


def _user(db, label):
    role = db.query(Role).filter(Role.name == "aspirant").first()
    u = User(email=f"{label}-{uuid.uuid4().hex[:8]}@example.com", role_id=role.id, email_verified=True, is_active=True)
    db.add(u)
    db.flush()
    return u


@pytest.fixture
def setup(db, owner_and_company, monkeypatch):
    owner, company = owner_and_company
    emp = db.query(EmployerProfile).filter(EmployerProfile.user_id == owner.id).first()
    job = JobPosting(employer_id=emp.id, company_id=company.id, title="Compliance Officer", description="d", sector="Policy",
                     required_skills=["DPDP Act"], status="published", is_active=True)
    db.add(job)
    me, other = _user(db, "me"), _user(db, "other")
    db.flush()
    app.dependency_overrides[get_current_aspirant] = lambda: me

    async def fake_names(_db, _job):
        return SKILLS
    monkeypatch.setattr(plan_router, "_posting_skill_names", fake_names)
    monkeypatch.setattr(plan_router, "_check_and_set_regenerate_cooldown", lambda *a, **k: None)
    sent = []
    import app.tasks.worker as worker
    monkeypatch.setattr(worker, "safe_dispatch", lambda task, *args: sent.append(args) or True)
    yield job, me, other, sent
    app.dependency_overrides.pop(get_current_aspirant, None)


def test_skills_to_rate_lists_the_postings_skills_with_the_scale(client, setup):
    job, *_ = setup
    r = client.get(f"/api/jobs/{job.id}/learning-plan/skills-to-rate")
    assert r.status_code == 200
    body = r.json()
    assert [s["name"] for s in body["skills"]] == ["DPDP Act", "Report Writing", "Excel"]
    assert [s["value"] for s in body["scale"]] == [0, 1, 2, 3] and all(s["previous"] is None for s in body["skills"])


def test_skills_to_rate_unknown_job_is_404(client, setup):
    assert client.get(f"/api/jobs/{uuid.uuid4()}/learning-plan/skills-to-rate").status_code == 404


def test_previous_ratings_come_back_only_for_my_own_plan(client, db, setup):
    job, me, other, _ = setup
    db.add(JobLearningPlan(user_id=other.id, job_id=job.id, status="ready", plan={"self_ratings": {"DPDP Act": 3}}))
    db.flush()
    assert all(s["previous"] is None for s in client.get(f"/api/jobs/{job.id}/learning-plan/skills-to-rate").json()["skills"])
    db.add(JobLearningPlan(user_id=me.id, job_id=job.id, status="ready", plan={"self_ratings": {"dpdp act": 2}}))
    db.flush()
    prev = {s["name"]: s["previous"] for s in client.get(f"/api/jobs/{job.id}/learning-plan/skills-to-rate").json()["skills"]}
    assert prev == {"DPDP Act": 2, "Report Writing": None, "Excel": None}


def test_generate_passes_cleaned_ratings_to_the_task(client, setup):
    job, _, _, sent = setup
    r = client.post(f"/api/jobs/{job.id}/learning-plan", json={"skill_ratings": {
        "dpdp act": 3, "Report Writing": 9, "Excel": "2", "Not In Posting": 3, "": 1}})
    assert r.status_code == 202 and r.json()["status"] == "generating"
    assert sent[0][6] == {"DPDP Act": 3, "Excel": 2}           # 9 is out of range, unknown names dropped, "2" coerced


def test_generate_rejects_a_non_object_ratings_body(client, setup):
    job, *_ = setup
    assert client.post(f"/api/jobs/{job.id}/learning-plan", json={"skill_ratings": [1, 2]}).status_code == 422


def test_generate_without_ratings_reuses_the_previous_ones(client, db, setup):
    job, me, _, sent = setup
    db.add(JobLearningPlan(user_id=me.id, job_id=job.id, status="ready", plan={"self_ratings": {"Excel": 3}}))
    db.flush()
    assert client.post(f"/api/jobs/{job.id}/learning-plan").status_code == 202
    assert sent[0][6] == {"Excel": 3}


def test_generate_for_unknown_job_is_404(client, setup):
    assert client.post(f"/api/jobs/{uuid.uuid4()}/learning-plan", json={}).status_code == 404


def test_generate_while_one_is_running_does_not_dispatch_again(client, db, setup):
    job, me, _, sent = setup
    db.add(JobLearningPlan(user_id=me.id, job_id=job.id, status="generating", plan={}))
    db.flush()
    r = client.post(f"/api/jobs/{job.id}/learning-plan", json={"skill_ratings": {"Excel": 2}})
    assert r.status_code == 202 and "already in progress" in r.json()["message"] and sent == []
