"""Regression test for the employer-audit request: the Analytics page's
Activity card needs to group actions by department, but
get_team_activity_log() previously returned no department info at all for
each entry — there was nothing to group by.

Fix under test: app.modules.companies.service.get_team_activity_log now
enriches each entry with department_id/department_name, resolved from the
acting user's EmployerProfile.
"""
from __future__ import annotations

import uuid

from app.models.company import CompanyDepartment
from app.models.user import AuditLog, EmployerProfile, Role, User
from app.modules.companies.service import get_team_activity_log


def test_activity_log_includes_actor_department(db, owner_and_company):
    owner_user, company = owner_and_company

    dept = CompanyDepartment(company_id=company.id, name="Engineering")
    db.add(dept)
    db.flush()

    recruiter_role = db.query(Role).filter(Role.name == "recruiter").first()
    assert recruiter_role is not None

    recruiter_user = User(
        email=f"recruiter-{uuid.uuid4().hex[:8]}@example.com",
        role_id=recruiter_role.id, email_verified=True, is_active=True,
    )
    db.add(recruiter_user)
    db.flush()

    recruiter_profile = EmployerProfile(
        user_id=recruiter_user.id, company_name=company.name, city="Delhi",
        is_approved=True, company_id=company.id, is_owner=False,
        department_id=dept.id, contact_person="Dept Recruiter",
    )
    db.add(recruiter_profile)

    db.add(AuditLog(user_id=recruiter_user.id, action="job.published", resource="job_posting"))
    db.add(AuditLog(user_id=owner_user.id, action="department.created", resource="company_department"))
    db.commit()

    entries = get_team_activity_log(owner_user, db)
    by_action = {e["action"]: e for e in entries}

    dept_entry = by_action["job.published"]
    assert dept_entry["department_id"] == str(dept.id)
    assert dept_entry["department_name"] == "Engineering"
    assert dept_entry["actor_name"] == "Dept Recruiter"

    # Owner has no department — should stay null, not inherit the recruiter's.
    owner_entry = by_action["department.created"]
    assert owner_entry["department_id"] is None
    assert owner_entry["department_name"] is None
