"""Tenant and department isolation for employer-side verified interviews (audit B8).

Runs against the real test database inside a rolled-back transaction (see conftest),
so the SQL filters themselves are exercised, not mocked.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.applications import Application
from app.models.company import Company, CompanyDepartment
from app.models.interview_verified import InterviewInvitation, InterviewTemplate
from app.models.user import JobPosting
from app.models.user import EmployerProfile, Role, User
from app.modules.interview.service import verified
from app.modules.interview.service.verified import VerifiedError


def _user(db, role_name, label):
    role = db.query(Role).filter(Role.name == role_name).first()
    assert role is not None, f"role {role_name} must be seeded"
    u = User(email=f"{label}-{uuid.uuid4().hex[:8]}@example.com", role_id=role.id, email_verified=True, is_active=True)
    db.add(u)
    db.flush()
    return u


def _employer(db, company, label, *, owner=False, department=None, role="employer_owner"):
    u = _user(db, role, label)
    p = EmployerProfile(
        user_id=u.id, company_name=company.name, city="Delhi", is_approved=True,
        company_id=company.id, is_owner=owner, department_id=department.id if department else None,
    )
    db.add(p)
    db.flush()
    return u, p


@pytest.fixture
def world(db, owner_and_company):
    """One company, two departments, a company-wide owner, one recruiter per
    department, each department with a job, a template and one invitation; plus
    a second company with its own owner."""
    owner, company = owner_and_company
    owner_profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == owner.id).first()
    dept_a = CompanyDepartment(company_id=company.id, name="Policy " + uuid.uuid4().hex[:6])
    dept_b = CompanyDepartment(company_id=company.id, name="Research " + uuid.uuid4().hex[:6])
    db.add_all([dept_a, dept_b])
    db.flush()

    rec_a, _ = _employer(db, company, "rec-a", department=dept_a, role="recruiter")
    rec_b, _ = _employer(db, company, "rec-b", department=dept_b, role="recruiter")

    def make(dept, recruiter):
        job = JobPosting(employer_id=owner_profile.id, company_id=company.id, department_id=dept.id,
                         title="Analyst", description="d", sector="Policy", required_skills=["x"],
                         status="published", is_active=True)
        db.add(job)
        db.flush()
        cand = _user(db, "aspirant", "cand")
        app_ = Application(aspirant_id=cand.id, job_id=job.id, status="applied")
        db.add(app_)
        # the template and invitation are created by the OWNER (a colleague), not the recruiter
        tpl = InterviewTemplate(employer_user_id=owner.id, company_id=company.id, job_id=job.id,
                                title=f"T-{dept.name}", role="Analyst", language="en", duration_minutes=15,
                                competencies=[{"skill": "Policy", "weight": 100, "must_have": False}], custom_questions=[])
        db.add(tpl)
        db.flush()
        inv = InterviewInvitation(template_id=tpl.id, employer_user_id=owner.id, candidate_user_id=cand.id,
                                  application_id=app_.id, status="invited",
                                  expires_at=datetime.now(timezone.utc) + timedelta(days=5))
        db.add(inv)
        db.flush()
        return tpl, inv

    tpl_a, inv_a = make(dept_a, rec_a)
    tpl_b, inv_b = make(dept_b, rec_b)

    other_company = Company(name="Other " + uuid.uuid4().hex[:6], verification_status="verified")
    db.add(other_company)
    db.flush()
    outsider, _ = _employer(db, other_company, "outsider", owner=True)
    db.commit()
    return dict(owner=owner, rec_a=rec_a, rec_b=rec_b, outsider=outsider, tpl_a=tpl_a, tpl_b=tpl_b, inv_a=inv_a, inv_b=inv_b)


def _inv_ids(rows):
    return {r["id"] for r in rows}


def test_company_wide_owner_sees_every_departments_invitations(db, world):
    ids = _inv_ids(verified.list_invitations_for_employer(world["owner"], db))
    assert {str(world["inv_a"].id), str(world["inv_b"].id)} <= ids


def test_department_recruiter_sees_only_their_departments_invitations(db, world):
    ids = _inv_ids(verified.list_invitations_for_employer(world["rec_a"], db))
    assert str(world["inv_a"].id) in ids and str(world["inv_b"].id) not in ids


def test_department_recruiter_cannot_open_another_departments_result(db, world):
    with pytest.raises(VerifiedError) as exc:
        verified.get_result(world["rec_a"], str(world["inv_b"].id), db)
    assert exc.value.status == 404
    # in their own department they get past the scope check (and stop at "not completed yet")
    with pytest.raises(VerifiedError) as exc:
        verified.get_result(world["rec_a"], str(world["inv_a"].id), db)
    assert exc.value.status == 409


def test_department_recruiter_cannot_fetch_audio_or_decide_across_departments(db, world):
    with pytest.raises(VerifiedError) as exc:
        verified.employer_audio(world["rec_a"], str(world["inv_b"].id), None, db)
    assert exc.value.status == 403
    body = verified.DecisionIn(decision="shortlist", reason_code="strong_evidence")
    with pytest.raises(VerifiedError) as exc:
        verified.decide(world["rec_a"], str(world["inv_b"].id), body, db)
    assert exc.value.status == 404


def test_templates_follow_the_same_department_rule(db, world):
    titles = {t["title"] for t in verified.list_templates(world["rec_a"], db)}
    assert world["tpl_a"].title in titles and world["tpl_b"].title not in titles
    all_titles = {t["title"] for t in verified.list_templates(world["owner"], db)}
    assert {world["tpl_a"].title, world["tpl_b"].title} <= all_titles
    with pytest.raises(VerifiedError) as exc:
        verified._owned_template(world["rec_a"], str(world["tpl_b"].id), db)
    assert exc.value.status == 404


def test_other_company_sees_nothing(db, world):
    assert verified.list_invitations_for_employer(world["outsider"], db) == []
    assert verified.list_templates(world["outsider"], db) == []
    with pytest.raises(VerifiedError) as exc:
        verified.get_result(world["outsider"], str(world["inv_a"].id), db)
    assert exc.value.status == 404
