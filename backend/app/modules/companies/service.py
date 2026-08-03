import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import AuthException, BadRequestException, ForbiddenException, NotFoundException
from app.models.company import Company, CompanyDepartment, CompanyInvite, CompanyOffice
from app.models.subscription import CompanySubscription, SubscriptionPlan
from app.models.user import EmployerProfile, JobPosting, Role, User
from app.modules.companies.schemas import (
    AssignDepartmentRequest, CompanyProfileResponse, CompanyProfileUpdateRequest,
    CompanySubscriptionResponse,
    DepartmentCreateRequest, DepartmentOut, DepartmentUpdateRequest,
    EmployerProfileSelfResponse, EmployerProfileUpdateRequest,
    MessageResponse, OfficeCreateRequest, OfficeOut,
    SubscriptionPlanEntry, SubscriptionUsageResponse,
    TeamInviteRequest, TeamMemberEntry, TEAM_ROLE_NAMES,
)


def _get_own_profile(user: User, db: Session) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise AuthException("Employer profile not found.")
    return profile


def _get_company_or_404(profile: EmployerProfile, db: Session) -> Company:
    if not profile.company_id:
        raise NotFoundException("No company associated with this account.")
    company = db.query(Company).filter(Company.id == profile.company_id).first()
    if not company:
        raise NotFoundException("Company not found.")
    return company


def _company_to_response(company: Company) -> CompanyProfileResponse:
    return CompanyProfileResponse(
        id=str(company.id), name=company.name, industry=company.industry,
        company_size=company.company_size, website=company.website,
        logo_url=company.logo_url, cover_banner_url=company.cover_banner_url,
        headquarters=company.headquarters, founded_year=company.founded_year,
        social_links=company.social_links, description=company.description,
        verification_status=company.verification_status, created_at=company.created_at,
    )


def get_company_profile(user: User, db: Session) -> CompanyProfileResponse:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    return _company_to_response(company)


def update_company_profile(user: User, data: CompanyProfileUpdateRequest, db: Session) -> CompanyProfileResponse:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)

    for field in (
        "name", "industry", "company_size", "website", "logo_url", "cover_banner_url",
        "headquarters", "founded_year", "social_links", "description",
    ):
        val = getattr(data, field)
        if val is not None:
            setattr(company, field, val)

    db.commit()
    db.refresh(company)
    return _company_to_response(company)


def update_employer_profile(user: User, data: EmployerProfileUpdateRequest, db: Session) -> EmployerProfileSelfResponse:
    """Updates recruiter-side fields. full_name/email save to the users row;
    the rest (contact_person, designation, city, gst_number) go to EmployerProfile."""
    profile = _get_own_profile(user, db)
    # Save user-level fields
    if data.full_name is not None:
        user.full_name = data.full_name
        # Mirror into contact_person so admin views stay consistent
        if not data.contact_person:
            profile.contact_person = data.full_name
    if data.email is not None:
        user.email = data.email
    for field in ("contact_person", "designation", "city", "gst_number"):
        val = getattr(data, field)
        if val is not None:
            setattr(profile, field, val)
    db.commit()
    db.refresh(profile)
    return EmployerProfileSelfResponse(
        id=str(profile.id), full_name=user.full_name, email=user.email,
        contact_person=profile.contact_person, designation=profile.designation,
        city=profile.city, gst_number=profile.gst_number,
    )


def set_company_logo(user: User, url: str, db: Session) -> CompanyProfileResponse:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    company.logo_url = url
    db.commit()
    db.refresh(company)
    return _company_to_response(company)


def set_company_banner(user: User, url: str, db: Session) -> CompanyProfileResponse:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    company.cover_banner_url = url
    db.commit()
    db.refresh(company)
    return _company_to_response(company)


def list_team_members(user: User, db: Session) -> list[TeamMemberEntry]:
    profile = _get_own_profile(user, db)
    if not profile.company_id:
        return [_member_to_entry(profile)]

    rows = (
        db.query(EmployerProfile, User)
        .join(User, EmployerProfile.user_id == User.id)
        .filter(EmployerProfile.company_id == profile.company_id, User.deleted_at == None)
        .order_by(EmployerProfile.is_owner.desc(), EmployerProfile.created_at)
        .all()
    )
    return [_member_to_entry(p, u) for p, u in rows]


def _member_to_entry(profile: EmployerProfile, user: User | None = None) -> TeamMemberEntry:
    u = user or profile.user
    dept_name = profile.department.name if profile.department else None
    return TeamMemberEntry(
        user_id=str(u.id), employer_profile_id=str(profile.id), email=u.email, phone=u.phone,
        contact_person=profile.contact_person, role_name=u.role_name or "employer",
        is_owner=profile.is_owner, is_active=u.is_active,
        department_id=str(profile.department_id) if profile.department_id else None,
        department_name=dept_name,
        created_at=profile.created_at,
    )


def invite_team_member(user: User, data: TeamInviteRequest, db: Session) -> TeamMemberEntry:
    """Creates the teammate's account immediately (no email-token flow yet —
    they sign in via the existing forgot-password/OTP path to set credentials)."""
    profile = _get_own_profile(user, db)
    if not profile.is_owner and user.role_name != "hr_manager":
        raise ForbiddenException("Only the company owner or HR manager can invite team members.")
    company = _get_company_or_404(profile, db)

    seat_limit = _get_recruiter_seat_limit(company.id, db)
    if seat_limit is not None:
        current_seats = db.query(EmployerProfile).filter(EmployerProfile.company_id == company.id).count()
        if current_seats >= seat_limit:
            raise BadRequestException(
                f"Your plan allows {seat_limit} recruiter seat(s). Upgrade your subscription to add more."
            )

    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise BadRequestException(f"A user with email '{data.email}' already exists.")

    role = db.query(Role).filter(Role.name == data.role_name).first()
    if not role:
        raise BadRequestException(f"Role '{data.role_name}' not seeded in database.")

    from app.core.security import hash_password
    new_user = User(
        email=data.email, role_id=role.id, email_verified=True, is_active=True,
        password_hash=hash_password(data.password) if data.password else None,
    )
    db.add(new_user)
    db.flush()

    dept_id = None
    if data.department_id:
        dept = db.query(CompanyDepartment).filter(
            CompanyDepartment.id == data.department_id,
            CompanyDepartment.company_id == company.id,
        ).first()
        if not dept:
            raise BadRequestException("Department not found in this company.")
        dept_id = dept.id

    new_profile = EmployerProfile(
        user_id=new_user.id,
        company_name=company.name, industry=company.industry, company_size=company.company_size,
        website=company.website, contact_person=data.contact_person, city=profile.city or "",
        is_approved=True,   # company already passed admin KYC — seats inherit that
        company_id=company.id, is_owner=False,
        department_id=dept_id,
    )
    db.add(new_profile)

    db.add(CompanyInvite(
        company_id=company.id, email=data.email, role_id=role.id,
        invited_by=user.id, accepted_at=datetime.now(timezone.utc),
    ))
    db.commit()
    db.refresh(new_profile)

    return _member_to_entry(new_profile, new_user)


def remove_team_member(user: User, employer_profile_id: str, db: Session) -> MessageResponse:
    profile = _get_own_profile(user, db)
    if not profile.is_owner and user.role_name != "hr_manager":
        raise ForbiddenException("Only the company owner or HR manager can remove team members.")

    target = db.query(EmployerProfile).filter(
        EmployerProfile.id == employer_profile_id, EmployerProfile.company_id == profile.company_id,
    ).first()
    if not target:
        raise NotFoundException("Team member not found.")
    if target.is_owner:
        raise BadRequestException("Cannot remove the company owner — transfer ownership first.")
    if target.id == profile.id:
        raise BadRequestException("Cannot remove yourself.")

    target_user = db.query(User).filter(User.id == target.user_id).first()
    if target_user:
        target_user.deleted_at = datetime.now(timezone.utc)
        target_user.is_active = False
    db.commit()
    return MessageResponse(message="Team member removed.")


def transfer_ownership(user: User, new_owner_employer_profile_id: str, db: Session) -> MessageResponse:
    profile = _get_own_profile(user, db)
    if not profile.is_owner:
        raise ForbiddenException("Only the current owner can transfer ownership.")

    new_owner = db.query(EmployerProfile).filter(
        EmployerProfile.id == new_owner_employer_profile_id, EmployerProfile.company_id == profile.company_id,
    ).first()
    if not new_owner:
        raise NotFoundException("Target team member not found in this company.")
    if new_owner.id == profile.id:
        raise BadRequestException("You are already the owner.")

    profile.is_owner = False
    new_owner.is_owner = True
    db.commit()
    return MessageResponse(message=f"Ownership transferred to {new_owner.contact_person}.")


# ── Subscriptions ──────────────────────────────────────────────────────────────

def _plan_to_entry(plan: SubscriptionPlan) -> SubscriptionPlanEntry:
    return SubscriptionPlanEntry(
        id=str(plan.id), name=plan.name, price_monthly=plan.price_monthly,
        max_active_jobs=plan.max_active_jobs, max_recruiter_seats=plan.max_recruiter_seats,
        resume_access=plan.resume_access, candidate_search_limit=plan.candidate_search_limit,
        is_active=plan.is_active,
    )


def _get_company_subscription(company_id, db: Session) -> CompanySubscription:
    sub = db.query(CompanySubscription).filter(CompanySubscription.company_id == company_id).first()
    if not sub:
        raise NotFoundException("No subscription found for this company.")
    return sub


def _get_recruiter_seat_limit(company_id, db: Session) -> int | None:
    sub = db.query(CompanySubscription).filter(CompanySubscription.company_id == company_id).first()
    if not sub:
        return None
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
    return plan.max_recruiter_seats if plan else None


def get_company_subscription(user: User, db: Session) -> CompanySubscriptionResponse:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    sub = _get_company_subscription(company.id, db)
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()

    return CompanySubscriptionResponse(
        plan=_plan_to_entry(plan), status=sub.status,
        current_period_start=sub.current_period_start, current_period_end=sub.current_period_end,
    )


def get_subscription_usage(user: User, db: Session) -> SubscriptionUsageResponse:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    sub = _get_company_subscription(company.id, db)
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()

    company_employer_ids = [
        r[0] for r in db.query(EmployerProfile.id).filter(EmployerProfile.company_id == company.id).all()
    ]
    active_jobs = db.query(JobPosting).filter(
        JobPosting.employer_id.in_(company_employer_ids), JobPosting.is_active == True,
    ).count()
    recruiter_seats = len(company_employer_ids)

    return SubscriptionUsageResponse(
        active_jobs_used=active_jobs, active_jobs_limit=plan.max_active_jobs if plan else None,
        recruiter_seats_used=recruiter_seats, recruiter_seats_limit=plan.max_recruiter_seats if plan else None,
    )


def upgrade_subscription(user: User, plan_id: str, db: Session) -> CompanySubscriptionResponse:
    profile = _get_own_profile(user, db)
    if not profile.is_owner:
        raise ForbiddenException("Only the company owner can change the subscription plan.")
    company = _get_company_or_404(profile, db)

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id, SubscriptionPlan.is_active == True).first()
    if not plan:
        raise NotFoundException("Subscription plan not found.")

    sub = _get_company_subscription(company.id, db)
    sub.plan_id = plan.id
    sub.status = "active"
    sub.current_period_start = datetime.now(timezone.utc)
    sub.current_period_end = datetime.now(timezone.utc) + timedelta(days=365)
    db.commit()

    return CompanySubscriptionResponse(
        plan=_plan_to_entry(plan), status=sub.status,
        current_period_start=sub.current_period_start, current_period_end=sub.current_period_end,
    )


def list_subscription_plans(db: Session) -> list[SubscriptionPlanEntry]:
    plans = db.query(SubscriptionPlan).order_by(SubscriptionPlan.price_monthly).all()
    return [_plan_to_entry(p) for p in plans]


# ── Offices & departments ──────────────────────────────────────────────────────

def list_offices(user: User, db: Session) -> list[OfficeOut]:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    rows = db.query(CompanyOffice).filter(CompanyOffice.company_id == company.id).order_by(CompanyOffice.created_at).all()
    return [OfficeOut(id=str(r.id), name=r.name, city=r.city, state=r.state, is_headquarters=r.is_headquarters) for r in rows]


def create_office(user: User, data: OfficeCreateRequest, db: Session) -> OfficeOut:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    row = CompanyOffice(
        company_id=company.id, name=data.name, city=data.city,
        state=data.state, is_headquarters=data.is_headquarters,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return OfficeOut(id=str(row.id), name=row.name, city=row.city, state=row.state, is_headquarters=row.is_headquarters)


def delete_office(user: User, office_id: str, db: Session) -> MessageResponse:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    row = db.query(CompanyOffice).filter(CompanyOffice.id == office_id, CompanyOffice.company_id == company.id).first()
    if not row:
        raise NotFoundException("Office not found.")
    db.delete(row)
    db.commit()
    return MessageResponse(message="Office removed.")


def _dept_to_out(dept: CompanyDepartment, db: Session) -> DepartmentOut:
    from app.models.user import JobPosting
    from app.models.mvp3 import Application

    member_count = db.query(EmployerProfile).filter(
        EmployerProfile.department_id == dept.id,
    ).count()

    job_ids_q = db.query(JobPosting.id).filter(JobPosting.department_id == dept.id)
    job_ids = [r[0] for r in job_ids_q.all()]

    total_job_count = len(job_ids)
    active_job_count = db.query(JobPosting).filter(
        JobPosting.department_id == dept.id, JobPosting.is_active == True,
    ).count()

    total_applicant_count = 0
    if job_ids:
        total_applicant_count = db.query(Application).filter(
            Application.job_id.in_(job_ids),
        ).count()

    head_name = dept.head.contact_person if dept.head else None

    return DepartmentOut(
        id=str(dept.id), name=dept.name, description=dept.description,
        head_employer_id=str(dept.head_employer_id) if dept.head_employer_id else None,
        head_name=head_name,
        member_count=member_count, total_job_count=total_job_count,
        active_job_count=active_job_count,
        total_applicant_count=total_applicant_count,
        created_at=dept.created_at,
    )


def list_departments(user: User, db: Session) -> list[DepartmentOut]:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    rows = db.query(CompanyDepartment).filter(
        CompanyDepartment.company_id == company.id,
    ).order_by(CompanyDepartment.name).all()
    return [_dept_to_out(r, db) for r in rows]


def get_department(user: User, department_id: str, db: Session) -> DepartmentOut:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    dept = db.query(CompanyDepartment).filter(
        CompanyDepartment.id == department_id,
        CompanyDepartment.company_id == company.id,
    ).first()
    if not dept:
        raise NotFoundException("Department not found.")
    return _dept_to_out(dept, db)


def create_department(user: User, data: DepartmentCreateRequest, db: Session) -> DepartmentOut:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    if db.query(CompanyDepartment).filter(
        CompanyDepartment.company_id == company.id, CompanyDepartment.name == data.name,
    ).first():
        raise BadRequestException(f"Department '{data.name}' already exists.")

    head_id = None
    if data.head_employer_id:
        head = db.query(EmployerProfile).filter(
            EmployerProfile.id == data.head_employer_id,
            EmployerProfile.company_id == company.id,
        ).first()
        if not head:
            raise BadRequestException("Department head must be a member of this company.")
        head_id = head.id

    row = CompanyDepartment(
        company_id=company.id, name=data.name,
        description=data.description, head_employer_id=head_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _dept_to_out(row, db)


def update_department(user: User, department_id: str, data: DepartmentUpdateRequest, db: Session) -> DepartmentOut:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    dept = db.query(CompanyDepartment).filter(
        CompanyDepartment.id == department_id,
        CompanyDepartment.company_id == company.id,
    ).first()
    if not dept:
        raise NotFoundException("Department not found.")

    if data.name is not None:
        conflict = db.query(CompanyDepartment).filter(
            CompanyDepartment.company_id == company.id,
            CompanyDepartment.name == data.name,
            CompanyDepartment.id != dept.id,
        ).first()
        if conflict:
            raise BadRequestException(f"Department '{data.name}' already exists.")
        dept.name = data.name

    if data.description is not None:
        dept.description = data.description

    if "head_employer_id" in data.model_fields_set:
        if data.head_employer_id:
            head = db.query(EmployerProfile).filter(
                EmployerProfile.id == data.head_employer_id,
                EmployerProfile.company_id == company.id,
            ).first()
            if not head:
                raise BadRequestException("Department head must be a member of this company.")
            dept.head_employer_id = head.id
        else:
            dept.head_employer_id = None

    db.commit()
    db.refresh(dept)
    return _dept_to_out(dept, db)


def delete_department(user: User, department_id: str, db: Session) -> MessageResponse:
    profile = _get_own_profile(user, db)
    if not profile.is_owner and user.role_name not in ("hr_manager",):
        raise ForbiddenException("Only the company owner or HR manager can delete departments.")
    company = _get_company_or_404(profile, db)
    dept = db.query(CompanyDepartment).filter(
        CompanyDepartment.id == department_id,
        CompanyDepartment.company_id == company.id,
    ).first()
    if not dept:
        raise NotFoundException("Department not found.")

    from app.models.user import JobPosting
    active_jobs = db.query(JobPosting).filter(
        JobPosting.department_id == dept.id, JobPosting.is_active == True,
    ).count()
    if active_jobs:
        raise BadRequestException(
            f"Cannot delete department with {active_jobs} active job(s). "
            "Close or reassign all jobs first."
        )

    assigned_members = db.query(EmployerProfile).filter(
        EmployerProfile.department_id == dept.id,
    ).count()
    if assigned_members:
        raise BadRequestException(
            f"Cannot delete department with {assigned_members} assigned team member(s). "
            "Reassign or remove them first."
        )

    db.delete(dept)
    db.commit()
    return MessageResponse(message="Department removed.")


def get_department_overview(user: User, department_id: str, db: Session):
    from datetime import timezone as _tz
    from app.models.user import JobPosting
    from app.models.mvp3 import Application, CandidateInterviewFeedback, OfferLetter
    from app.modules.companies.schemas import DepartmentOverviewOut

    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    dept = db.query(CompanyDepartment).filter(
        CompanyDepartment.id == department_id,
        CompanyDepartment.company_id == company.id,
    ).first()
    if not dept:
        raise NotFoundException("Department not found.")

    member_count = db.query(EmployerProfile).filter(EmployerProfile.department_id == dept.id).count()
    job_ids = [r[0] for r in db.query(JobPosting.id).filter(JobPosting.department_id == dept.id).all()]
    total_job_count = len(job_ids)
    active_job_count = db.query(JobPosting).filter(
        JobPosting.department_id == dept.id, JobPosting.is_active == True,
    ).count()

    applications = (
        db.query(Application).filter(Application.job_id.in_(job_ids)).all()
        if job_ids else []
    )
    total_applicant_count = len(applications)
    app_ids = [a.id for a in applications]

    # Pipeline funnel
    funnel: dict[str, int] = {}
    for app in applications:
        funnel[app.status] = funnel.get(app.status, 0) + 1

    # Interview and offer counts
    scheduled_interviews = (
        db.query(CandidateInterviewFeedback).filter(
            CandidateInterviewFeedback.application_id.in_(app_ids),
            CandidateInterviewFeedback.status == "scheduled",
        ).count()
        if app_ids else 0
    )
    pending_offers = (
        db.query(OfferLetter).filter(
            OfferLetter.application_id.in_(app_ids),
            OfferLetter.status == "sent",
        ).count()
        if app_ids else 0
    )

    # Avg days to hire: mean of (updated_at - created_at) for applications with status='hired'
    hired_apps = [a for a in applications if a.status == "hired"]
    avg_days = None
    if hired_apps:
        deltas = [
            (a.updated_at.replace(tzinfo=_tz.utc) - a.created_at.replace(tzinfo=_tz.utc)).total_seconds() / 86400
            for a in hired_apps
            if a.updated_at and a.created_at
        ]
        if deltas:
            avg_days = round(sum(deltas) / len(deltas), 1)

    return DepartmentOverviewOut(
        id=str(dept.id), name=dept.name, description=dept.description,
        head_employer_id=str(dept.head_employer_id) if dept.head_employer_id else None,
        head_name=dept.head.contact_person if dept.head else None,
        member_count=member_count, total_job_count=total_job_count,
        active_job_count=active_job_count, total_applicant_count=total_applicant_count,
        pipeline_funnel=funnel,
        scheduled_interviews_count=scheduled_interviews,
        pending_offers_count=pending_offers,
        avg_days_to_hire=avg_days,
        created_at=dept.created_at,
    )


def assign_member_department(
    user: User, employer_profile_id: str, data: AssignDepartmentRequest, db: Session
) -> TeamMemberEntry:
    """Assign or move a team member to a department (or clear to company-wide)."""
    profile = _get_own_profile(user, db)
    if not profile.is_owner and user.role_name not in ("hr_manager",):
        raise ForbiddenException("Only the company owner or HR manager can reassign departments.")
    company = _get_company_or_404(profile, db)

    target = db.query(EmployerProfile).filter(
        EmployerProfile.id == employer_profile_id,
        EmployerProfile.company_id == company.id,
    ).first()
    if not target:
        raise NotFoundException("Team member not found.")

    if data.department_id:
        dept = db.query(CompanyDepartment).filter(
            CompanyDepartment.id == data.department_id,
            CompanyDepartment.company_id == company.id,
        ).first()
        if not dept:
            raise BadRequestException("Department not found in this company.")
        target.department_id = dept.id
    else:
        target.department_id = None

    db.commit()
    db.refresh(target)
    target_user = db.query(User).filter(User.id == target.user_id).first()
    return _member_to_entry(target, target_user)


def list_department_jobs(user: User, department_id: str, db: Session) -> list[dict]:
    """Return all jobs (any status) belonging to a department, with applicant counts."""
    from app.models.user import JobPosting
    from app.models.mvp3 import Application
    from sqlalchemy import func

    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)

    dept = db.query(CompanyDepartment).filter(
        CompanyDepartment.id == department_id,
        CompanyDepartment.company_id == company.id,
    ).first()
    if not dept:
        raise NotFoundException("Department not found.")

    jobs = (
        db.query(JobPosting)
        .filter(JobPosting.department_id == dept.id)
        .order_by(JobPosting.created_at.desc())
        .all()
    )

    job_ids = [j.id for j in jobs]
    counts: dict = {}
    if job_ids:
        rows = (
            db.query(Application.job_id, func.count(Application.id))
            .filter(Application.job_id.in_(job_ids))
            .group_by(Application.job_id)
            .all()
        )
        counts = {str(r[0]): r[1] for r in rows}

    return [
        {
            "id": str(j.id),
            "title": j.title,
            "sector": j.sector,
            "job_type": j.job_type,
            "employment_type": j.employment_type,
            "location": j.location,
            "status": j.status,
            "is_active": j.is_active,
            "expires_at": str(j.expires_at) if j.expires_at else None,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "applicant_count": counts.get(str(j.id), 0),
        }
        for j in jobs
    ]


# ── Team activity log ──────────────────────────────────────────────────────────

def get_team_activity_log(user: User, db: Session, limit: int = 50) -> list[dict]:
    """Return recent audit log entries for all members of the same company."""
    from app.models.user import AuditLog

    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)

    # Collect user_ids for all employer profiles in this company
    company_profiles = (
        db.query(EmployerProfile)
        .filter(EmployerProfile.company_id == company.id)
        .all()
    )
    member_user_ids = [p.user_id for p in company_profiles]

    rows = (
        db.query(AuditLog, User)
        .outerjoin(User, AuditLog.user_id == User.id)
        .filter(AuditLog.user_id.in_(member_user_ids))
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

    result = []
    for log, actor in rows:
        result.append({
            "id": str(log.id),
            "action": log.action,
            "resource": log.resource,
            "resource_id": str(log.resource_id) if log.resource_id else None,
            "actor_email": actor.email if actor else None,
            "actor_name": None,  # EmployerProfile.contact_person looked up below if needed
            "created_at": log.created_at,
        })

    # Enrich with contact_person names via a single batch lookup
    actor_names: dict = {}
    for p in company_profiles:
        if p.contact_person:
            actor_names[p.user_id] = p.contact_person

    for i, (log, actor) in enumerate(rows):
        if actor and actor.id in actor_names:
            result[i]["actor_name"] = actor_names[actor.id]

    return result
