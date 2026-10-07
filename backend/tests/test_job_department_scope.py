"""A company-wide owner/manager (no department_id) can no longer create jobs
directly — only a department-scoped team member can. Matches the split real
ATS platforms (LinkedIn Recruiter, Naukri) use between an org admin managing
structure and individual recruiters owning postings."""
from datetime import date, timedelta

import pytest

from app.core.exceptions import BadRequestException
from app.models.company import CompanyDepartment
from app.models.user import EmployerProfile
from app.modules.jobs import service
from app.modules.jobs.schemas import JobPostingRequest


def _payload(**overrides) -> JobPostingRequest:
    defaults = dict(
        title="Software Engineer",
        description="Build and ship backend services.",
        sector="IT & Technology",
        required_skills=["Computer Skills"],
        job_type="remote",
        location="Remote",
        employment_type="full_time",
        expires_at=date.today() + timedelta(days=30),
    )
    defaults.update(overrides)
    return JobPostingRequest(**defaults)


class TestCreateJobRequiresDepartment:
    def test_company_wide_owner_cannot_create_job(self, db, owner_and_company):
        owner_user, _company = owner_and_company
        with pytest.raises(BadRequestException):
            service.create_job(owner_user, _payload(), db)

    def test_department_scoped_member_can_create_job(self, db, owner_and_company):
        import uuid

        from app.models.user import Role, User

        owner_user, company = owner_and_company
        company.industry = "IT & Technology"
        company.company_size = "11-50"
        dept = CompanyDepartment(company_id=company.id, name=f"Engineering {uuid.uuid4().hex[:6]}")
        db.add(dept)
        db.flush()

        role = db.query(Role).filter(Role.name == "hr_manager").first()
        member_user = User(
            email=f"dept-head-{uuid.uuid4().hex[:8]}@example.com",
            role_id=role.id, email_verified=True, is_active=True,
        )
        db.add(member_user)
        db.flush()
        member_profile = EmployerProfile(
            user_id=member_user.id, company_name=company.name,
            is_approved=True, company_id=company.id, is_owner=False,
            department_id=dept.id,
        )
        db.add(member_profile)
        db.commit()

        result = service.create_job(member_user, _payload(), db)
        assert result.department_id == str(dept.id)

    def test_owner_assigned_to_own_department_can_create_job(self, db, owner_and_company):
        """The data model doesn't forbid an owner also carrying a department_id
        — assigning themselves to a department they created is a valid way for
        a solo/free-tier company to unlock job posting without a second person."""
        owner_user, company = owner_and_company
        company.industry = "IT & Technology"
        company.company_size = "1-10"
        dept = CompanyDepartment(company_id=company.id, name="Solo Owner Dept")
        db.add(dept)
        db.flush()

        profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == owner_user.id).first()
        profile.department_id = dept.id
        db.commit()

        result = service.create_job(owner_user, _payload(), db)
        assert result.department_id == str(dept.id)
