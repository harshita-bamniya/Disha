import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import AuthException, BadRequestException, ForbiddenException, NotFoundException
from app.models.company import Company, CompanyInvite
from app.models.subscription import CompanySubscription, SubscriptionPlan
from app.models.user import EmployerProfile, JobPosting, Role, User
from app.modules.companies.schemas import (
    CompanyProfileResponse, CompanyProfileUpdateRequest, CompanySubscriptionResponse,
    EmployerProfileSelfResponse, EmployerProfileUpdateRequest,
    MessageResponse, SubscriptionPlanEntry, SubscriptionUsageResponse,
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
    """Updates the recruiter-side fields (contact person, designation, city, GST)
    that live on EmployerProfile rather than the shared Company row."""
    profile = _get_own_profile(user, db)
    for field in ("contact_person", "designation", "city", "gst_number"):
        val = getattr(data, field)
        if val is not None:
            setattr(profile, field, val)
    db.commit()
    db.refresh(profile)
    return EmployerProfileSelfResponse(
        id=str(profile.id), contact_person=profile.contact_person,
        designation=profile.designation, city=profile.city, gst_number=profile.gst_number,
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
    return TeamMemberEntry(
        user_id=str(u.id), employer_profile_id=str(profile.id), email=u.email, phone=u.phone,
        contact_person=profile.contact_person, role_name=u.role_name or "employer",
        is_owner=profile.is_owner, is_active=u.is_active, created_at=profile.created_at,
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

    new_user = User(
        email=data.email, role_id=role.id, email_verified=True, is_active=True,
    )
    db.add(new_user)
    db.flush()

    new_profile = EmployerProfile(
        user_id=new_user.id,
        company_name=company.name, industry=company.industry, company_size=company.company_size,
        website=company.website, contact_person=data.contact_person, city=profile.city or "",
        is_approved=True,   # company already passed admin KYC — seats inherit that
        company_id=company.id, is_owner=False,
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
