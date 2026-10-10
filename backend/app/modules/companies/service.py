import re
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import hash_token
from app.core.exceptions import (
    AuthException,
    BadRequestException,
    ForbiddenException,
    NotFoundException,
)
from app.models.company import INVITE_TTL_DAYS, Company, CompanyDepartment, CompanyInvite, CompanyOffice
from app.models.subscription import CompanySubscription, SubscriptionPlan
from app.models.user import EmployerProfile, JobPosting, Role, User
from app.modules.companies.schemas import (
    AssignDepartmentRequest,
    CompanyProfileResponse,
    CompanyProfileUpdateRequest,
    CompanySubscriptionResponse,
    DepartmentCreateRequest,
    DepartmentOut,
    DepartmentUpdateRequest,
    EmployerProfileSelfResponse,
    EmployerProfileUpdateRequest,
    MessageResponse,
    OfficeCreateRequest,
    OfficeOut,
    SubscriptionPlanEntry,
    SubscriptionUsageResponse,
    TeamBulkInviteRequest,
    TeamBulkInviteResponse,
    TeamBulkInviteResult,
    TeamInviteEntry,
    TeamInviteRequest,
    TeamMemberEntry,
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


def _own_department_id(profile: EmployerProfile):
    """Department a user is confined to, or None for company-wide users.
    Owners are always company-wide even if a department id is set on them."""
    return profile.department_id if (profile.department_id and not profile.is_owner) else None


def _assert_company_wide(profile: EmployerProfile) -> None:
    """Company-level settings (branding, offices, creating/deleting departments)
    belong to the owner and company-wide HR — never to a department-scoped member,
    even one whose role (department head) otherwise carries companies:edit."""
    if _own_department_id(profile) is not None:
        raise ForbiddenException("Only the company owner can change company-level settings.")


def _apply_invite_scope(profile: EmployerProfile, role_name: str, department_id):
    """Delegated administration: a department head may only add people to their
    own department, and never appoint another head. Owners/company-wide HR are unrestricted."""
    own = _own_department_id(profile)
    if own is None:
        return department_id
    if role_name == "hr_manager":
        raise ForbiddenException("Only the company owner can appoint a department head.")
    return str(own)


def _assert_department_access(profile: EmployerProfile, department_id) -> None:
    """Department-scoped members may only look at their own department. A
    different department is reported as not found so its existence isn't leaked."""
    own = _own_department_id(profile)
    if own is not None and str(own) != str(department_id):
        raise NotFoundException("Department not found.")


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
    _assert_company_wide(profile)
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
    _assert_company_wide(profile)
    company = _get_company_or_404(profile, db)
    company.logo_url = url
    db.commit()
    db.refresh(company)
    return _company_to_response(company)


def set_company_banner(user: User, url: str, db: Session) -> CompanyProfileResponse:
    profile = _get_own_profile(user, db)
    _assert_company_wide(profile)
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
    )
    own_dept = _own_department_id(profile)
    if own_dept is not None:
        # Department members only see their own department's team.
        rows = rows.filter(EmployerProfile.department_id == own_dept)
    rows = rows.order_by(EmployerProfile.is_owner.desc(), EmployerProfile.created_at).all()
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


_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


# ── Invitations ───────────────────────────────────────────────────────────────
# An invite is not an account. The invitee gets a one-time emailed link, sets their own name and
# password on it, and only then does a User + EmployerProfile exist (see invites.accept_invite).

def _new_invite_token() -> tuple[str, str]:
    """(raw token to email, SHA-256 hash to store). The raw token is never persisted."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def _live_invites_query(company_id, db: Session):
    """Invites that still occupy a seat: not accepted, not revoked, and not past their expiry."""
    return db.query(CompanyInvite).filter(
        CompanyInvite.company_id == company_id,
        CompanyInvite.accepted_at == None,  # noqa: E711
        CompanyInvite.revoked_at == None,   # noqa: E711
        CompanyInvite.token_hash != None,   # noqa: E711
        CompanyInvite.expires_at > datetime.now(timezone.utc),
    )


def _seats_in_use(company_id, db: Session) -> int:
    """Members (the owner is the account itself, not a seat) plus invitations still waiting."""
    members = db.query(EmployerProfile).filter(
        EmployerProfile.company_id == company_id, EmployerProfile.is_owner == False,  # noqa: E712
    ).count()
    return members + _live_invites_query(company_id, db).count()


def _invite_to_entry(inv: CompanyInvite, db: Session) -> TeamInviteEntry:
    inviter = inv.inviter
    inviter_profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == inv.invited_by).first() if inv.invited_by else None
    return TeamInviteEntry(
        id=str(inv.id), email=inv.email, role_name=inv.role.name if inv.role else "",
        department_id=str(inv.department_id) if inv.department_id else None,
        department_name=inv.department.name if inv.department else None,
        status="expired" if inv.status == "expired" else "pending",
        invited_by_name=(inviter_profile.contact_person if inviter_profile else None) or (inviter.email if inviter else None),
        created_at=inv.created_at, last_sent_at=inv.last_sent_at, expires_at=inv.expires_at,
    )


def _stage_invite(
    user: User, company: Company, email: str, role_name: str, department_id: str | None, db: Session,
) -> tuple[CompanyInvite, str]:
    """Validates and stages (flushes, does not commit) an invitation. Returns it with the raw token to
    email. Inviting someone who already has a waiting invitation re-issues it instead of duplicating."""
    email = (email or "").strip().lower()
    if not _EMAIL_RE.match(email):
        raise BadRequestException("Enter a valid email address.")
    if db.query(User).filter(User.email == email).first():
        raise BadRequestException(f"{email} already has a BeginablAI account. Ask them to sign in instead.")

    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        raise BadRequestException(f"Role '{role_name}' not seeded in database.")

    dept_id = None
    if department_id:
        dept = db.query(CompanyDepartment).filter(
            CompanyDepartment.id == department_id, CompanyDepartment.company_id == company.id,
        ).first()
        if not dept:
            raise BadRequestException("Department not found in this company.")
        dept_id = dept.id

    existing = db.query(CompanyInvite).filter(
        CompanyInvite.company_id == company.id, CompanyInvite.email == email,
        CompanyInvite.accepted_at == None, CompanyInvite.revoked_at == None,  # noqa: E711
        CompanyInvite.token_hash != None,                                       # noqa: E711
    ).first()

    seat_limit = _get_recruiter_seat_limit(company.id, db)
    if seat_limit is not None and not (existing and existing.status == "pending"):
        if _seats_in_use(company.id, db) >= seat_limit:
            raise BadRequestException(
                f"Your plan allows {seat_limit} recruiter seat(s), counting people who haven't accepted yet. "
                "Revoke an unused invitation or upgrade your subscription to add more."
            )

    raw, token_hash = _new_invite_token()
    now = datetime.now(timezone.utc)
    if existing:
        inv = existing
        inv.role_id, inv.department_id, inv.invited_by = role.id, dept_id, user.id
    else:
        inv = CompanyInvite(company_id=company.id, email=email, role_id=role.id, department_id=dept_id, invited_by=user.id)
        db.add(inv)
    inv.token_hash, inv.expires_at, inv.last_sent_at = token_hash, now + timedelta(days=INVITE_TTL_DAYS), now
    db.flush()
    return inv, raw


def _dispatch_invite(inv: CompanyInvite, raw_token: str, company: Company, inviter: User, db: Session) -> None:
    """Email the link. Called after the commit so a failed send can't undo the invitation (it can be resent)."""
    from app.core.notifications import notify, team_invite_email

    accept_url = f"{get_settings().frontend_url.rstrip('/')}/auth/accept-invite?token={raw_token}"
    inviter_profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == inviter.id).first()
    subject, html = team_invite_email(
        company.name, inv.role.name if inv.role else "recruiter",
        inv.department.name if inv.department else None, accept_url,
        invited_by=(inviter_profile.contact_person if inviter_profile else None) or inviter.email,
        expires_in_days=INVITE_TTL_DAYS,
    )
    notify(inv.email, subject, html)


def _assert_can_invite(profile: EmployerProfile, user: User, action: str = "invite") -> None:
    if not profile.is_owner and user.role_name != "hr_manager":
        raise ForbiddenException(f"Only the company owner or HR manager can {action} team members.")


def invite_team_member(user: User, data: TeamInviteRequest, db: Session) -> TeamInviteEntry:
    """Sends one invitation. No account is created until the invitee accepts."""
    profile = _get_own_profile(user, db)
    _assert_can_invite(profile, user)
    company = _get_company_or_404(profile, db)
    department_id = _apply_invite_scope(profile, data.role_name, data.department_id)
    inv, raw = _stage_invite(user, company, data.email, data.role_name, department_id, db)
    db.commit()
    db.refresh(inv)
    _dispatch_invite(inv, raw, company, user, db)
    return _invite_to_entry(inv, db)


def invite_team_members_bulk(user: User, data: TeamBulkInviteRequest, db: Session) -> TeamBulkInviteResponse:
    """Invites many people by email. Each gets their own secure link; one bad address never blocks the others."""
    profile = _get_own_profile(user, db)
    _assert_can_invite(profile, user)
    company = _get_company_or_404(profile, db)
    department_id = _apply_invite_scope(profile, data.role_name, data.department_id)

    results: list[TeamBulkInviteResult] = []
    seen: set[str] = set()
    for raw_email in data.emails:
        email = raw_email.strip().lower()
        if not email or email in seen:
            continue
        seen.add(email)
        try:
            inv, raw = _stage_invite(user, company, email, data.role_name, department_id, db)
            db.commit()
            db.refresh(inv)
            _dispatch_invite(inv, raw, company, user, db)
            results.append(TeamBulkInviteResult(email=email, success=True, invite=_invite_to_entry(inv, db)))
        except (BadRequestException, ForbiddenException, NotFoundException) as e:
            # Validation fails before anything is staged, so there is nothing to undo (and earlier
            # addresses in this batch are already committed and must stay).
            results.append(TeamBulkInviteResult(email=email, success=False, error=str(e.detail)))

    created = sum(1 for r in results if r.success)
    return TeamBulkInviteResponse(results=results, created_count=created, failed_count=len(results) - created)


def _visible_invites(profile: EmployerProfile, db: Session):
    q = db.query(CompanyInvite).filter(
        CompanyInvite.company_id == profile.company_id,
        CompanyInvite.accepted_at == None, CompanyInvite.revoked_at == None,  # noqa: E711
        CompanyInvite.token_hash != None,                                       # noqa: E711
    )
    own_dept = _own_department_id(profile)
    if own_dept is not None:
        q = q.filter(CompanyInvite.department_id == own_dept)     # a department head sees only their own
    return q


def list_team_invites(user: User, db: Session) -> list[TeamInviteEntry]:
    profile = _get_own_profile(user, db)
    _assert_can_invite(profile, user, "see invitations for")
    rows = _visible_invites(profile, db).order_by(CompanyInvite.created_at.desc()).all()
    return [_invite_to_entry(i, db) for i in rows]


def _get_visible_invite(profile: EmployerProfile, invite_id: str, db: Session) -> CompanyInvite:
    inv = _visible_invites(profile, db).filter(CompanyInvite.id == invite_id).first()
    if not inv:
        raise NotFoundException("Invitation not found, or it has already been accepted or cancelled.")
    return inv


def resend_team_invite(user: User, invite_id: str, db: Session) -> TeamInviteEntry:
    """Issues a fresh link (the old one stops working) and restarts the 7-day clock."""
    profile = _get_own_profile(user, db)
    _assert_can_invite(profile, user)
    company = _get_company_or_404(profile, db)
    inv = _get_visible_invite(profile, invite_id, db)
    if db.query(User).filter(User.email == inv.email).first():
        raise BadRequestException(f"{inv.email} already has a BeginablAI account.")
    raw, token_hash = _new_invite_token()
    now = datetime.now(timezone.utc)
    inv.token_hash, inv.expires_at, inv.last_sent_at, inv.invited_by = token_hash, now + timedelta(days=INVITE_TTL_DAYS), now, user.id
    db.commit()
    db.refresh(inv)
    _dispatch_invite(inv, raw, company, user, db)
    return _invite_to_entry(inv, db)


def revoke_team_invite(user: User, invite_id: str, db: Session) -> MessageResponse:
    profile = _get_own_profile(user, db)
    _assert_can_invite(profile, user)
    inv = _get_visible_invite(profile, invite_id, db)
    inv.revoked_at = datetime.now(timezone.utc)
    inv.token_hash = None            # the emailed link stops working immediately
    db.commit()
    return MessageResponse(message="Invitation cancelled.")


def remove_team_member(user: User, employer_profile_id: str, db: Session) -> MessageResponse:
    profile = _get_own_profile(user, db)
    if not profile.is_owner and user.role_name != "hr_manager":
        raise ForbiddenException("Only the company owner or HR manager can remove team members.")

    target = db.query(EmployerProfile).filter(
        EmployerProfile.id == employer_profile_id, EmployerProfile.company_id == profile.company_id,
    ).first()
    if not target:
        raise NotFoundException("Team member not found.")
    own_dept = _own_department_id(profile)
    if own_dept is not None:
        # A department head can only remove non-head members of their own department.
        target_user = db.query(User).filter(User.id == target.user_id).first()
        if str(target.department_id) != str(own_dept) or (target_user and target_user.role_name == "hr_manager"):
            raise NotFoundException("Team member not found.")
    if target.is_owner:
        raise BadRequestException("Cannot remove the company owner.")
    if target.id == profile.id:
        raise BadRequestException("Cannot remove yourself.")

    target_user = db.query(User).filter(User.id == target.user_id).first()
    if target_user:
        target_user.deleted_at = datetime.now(timezone.utc)
        target_user.is_active = False
    db.commit()
    return MessageResponse(message="Team member removed.")


# ── Subscriptions ──────────────────────────────────────────────────────────────

def _plan_to_entry(plan: SubscriptionPlan) -> SubscriptionPlanEntry:
    return SubscriptionPlanEntry(
        id=str(plan.id), name=plan.name, plan_type=plan.plan_type, billing_interval=plan.billing_interval,
        price_monthly=plan.price_monthly,
        max_active_jobs=plan.max_active_jobs, max_recruiter_seats=plan.max_recruiter_seats,
        resume_access=plan.resume_access, candidate_search_limit=plan.candidate_search_limit,
        is_active=plan.is_active,
    )


def _get_company_subscription(company_id, db: Session) -> CompanySubscription:
    """Every company is implicitly on the free plan until it upgrades — there's
    no explicit provisioning step at registration that creates this row, so a
    company that has never upgraded legitimately has zero rows here. Lazily
    provision the free-plan subscription on first read instead of 404ing;
    without this, the Subscription page permanently errors for every employer
    who hasn't explicitly upgraded, which in practice is every new signup."""
    sub = db.query(CompanySubscription).filter(CompanySubscription.company_id == company_id).first()
    if not sub:
        free_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == "free").first()
        if not free_plan:
            raise NotFoundException("No subscription found for this company.")
        now = datetime.now(timezone.utc)
        sub = CompanySubscription(
            company_id=company_id, plan_id=free_plan.id, status="active",
            current_period_start=now, current_period_end=now + timedelta(days=365 * 100),
        )
        db.add(sub)
        try:
            db.commit()
        except IntegrityError:
            # Lost the race against another lazy-provisioner (e.g. payments
            # service's own _get_or_create_company_subscription) firing for
            # the same company at the same time — read back its row instead
            # of crashing the request.
            db.rollback()
            sub = db.query(CompanySubscription).filter(CompanySubscription.company_id == company_id).first()
            if not sub:
                raise
        else:
            db.refresh(sub)
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
    # Recruiter seats used = invited teammates only, not the owner — mirrors
    # the same exclusion in invite_team_member's seat-limit check, so the
    # Billing page's usage bar and the actual invite gate always agree.
    recruiter_seats = db.query(EmployerProfile).filter(
        EmployerProfile.company_id == company.id, EmployerProfile.is_owner == False,  # noqa: E712
    ).count()

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
    if plan.price_monthly > 0:
        raise BadRequestException("Paid plans require checkout — use POST /api/payments/checkout instead.")

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
    plans = (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.plan_type == "employer")
        .order_by(SubscriptionPlan.price_monthly)
        .all()
    )
    return [_plan_to_entry(p) for p in plans]


# ── Offices & departments ──────────────────────────────────────────────────────

def list_offices(user: User, db: Session) -> list[OfficeOut]:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    rows = db.query(CompanyOffice).filter(CompanyOffice.company_id == company.id).order_by(CompanyOffice.created_at).all()
    return [OfficeOut(id=str(r.id), name=r.name, city=r.city, state=r.state, is_headquarters=r.is_headquarters) for r in rows]


def create_office(user: User, data: OfficeCreateRequest, db: Session) -> OfficeOut:
    profile = _get_own_profile(user, db)
    _assert_company_wide(profile)
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
    _assert_company_wide(profile)
    company = _get_company_or_404(profile, db)
    row = db.query(CompanyOffice).filter(CompanyOffice.id == office_id, CompanyOffice.company_id == company.id).first()
    if not row:
        raise NotFoundException("Office not found.")
    db.delete(row)
    db.commit()
    return MessageResponse(message="Office removed.")


def _dept_to_out(dept: CompanyDepartment, db: Session) -> DepartmentOut:
    from app.models.applications import Application
    from app.models.user import JobPosting

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
    head_pending = None
    if not dept.head_employer_id:
        waiting = _live_invites_query(dept.company_id, db).filter(
            CompanyInvite.department_id == dept.id,
            CompanyInvite.role_id == db.query(Role.id).filter(Role.name == "hr_manager").scalar_subquery(),
        ).order_by(CompanyInvite.created_at.desc()).first()
        head_pending = waiting.email if waiting else None

    return DepartmentOut(
        id=str(dept.id), name=dept.name, description=dept.description,
        head_employer_id=str(dept.head_employer_id) if dept.head_employer_id else None,
        head_name=head_name, head_pending_email=head_pending,
        member_count=member_count, total_job_count=total_job_count,
        active_job_count=active_job_count,
        total_applicant_count=total_applicant_count,
        created_at=dept.created_at,
    )


def list_departments(user: User, db: Session) -> list[DepartmentOut]:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    query = db.query(CompanyDepartment).filter(CompanyDepartment.company_id == company.id)
    own_dept = _own_department_id(profile)
    if own_dept is not None:
        query = query.filter(CompanyDepartment.id == own_dept)
    return [_dept_to_out(r, db) for r in query.order_by(CompanyDepartment.name).all()]


def get_department(user: User, department_id: str, db: Session) -> DepartmentOut:
    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    _assert_department_access(profile, department_id)
    dept = db.query(CompanyDepartment).filter(
        CompanyDepartment.id == department_id,
        CompanyDepartment.company_id == company.id,
    ).first()
    if not dept:
        raise NotFoundException("Department not found.")
    return _dept_to_out(dept, db)


def create_department(user: User, data: DepartmentCreateRequest, db: Session) -> DepartmentOut:
    profile = _get_own_profile(user, db)
    _assert_company_wide(profile)
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

    if data.head_email and head_id:
        raise BadRequestException("Choose an existing member or enter a new head's email, not both.")
    head_email = data.head_email.strip().lower() if data.head_email else None
    if head_email and not _EMAIL_RE.match(head_email):
        raise BadRequestException("Enter a valid email address for the department head.")

    row = CompanyDepartment(
        company_id=company.id, name=data.name,
        description=data.description, head_employer_id=head_id,
    )
    db.add(row)
    if head_email:
        # Invite the head in the same step. It is only an invitation (no account until they accept), and the
        # department row is merely flushed, so if the invitation can't be created (existing account, seat
        # limit) nothing is left behind.
        db.flush()
        try:
            inv, raw = _stage_invite(user, company, head_email, "hr_manager", str(row.id), db)
        except Exception:
            db.delete(row)           # drop the department we just flushed; nothing else was staged
            db.flush()
            raise
        db.commit()
        db.refresh(row)
        db.refresh(inv)
        _dispatch_invite(inv, raw, company, user, db)
        return _dept_to_out(row, db)
    db.commit()
    db.refresh(row)
    return _dept_to_out(row, db)


def update_department(user: User, department_id: str, data: DepartmentUpdateRequest, db: Session) -> DepartmentOut:
    profile = _get_own_profile(user, db)
    _assert_company_wide(profile)
    company = _get_company_or_404(profile, db)
    _assert_department_access(profile, department_id)
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
    _assert_company_wide(profile)
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

    from app.models.applications import (
        Application,
        CandidateInterviewFeedback,
        OfferLetter,
    )
    from app.models.user import JobPosting
    from app.modules.companies.schemas import DepartmentOverviewOut

    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    _assert_department_access(profile, department_id)
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
    if _own_department_id(profile) is not None:
        raise ForbiddenException("Only the company owner can move people between departments.")
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
    from sqlalchemy import func

    from app.models.applications import Application
    from app.models.user import JobPosting

    profile = _get_own_profile(user, db)
    company = _get_company_or_404(profile, db)
    _assert_department_access(profile, department_id)

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
    company_q = db.query(EmployerProfile).filter(EmployerProfile.company_id == company.id)
    own_dept = _own_department_id(profile)
    if own_dept is not None:
        company_q = company_q.filter(EmployerProfile.department_id == own_dept)
    company_profiles = company_q.all()
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
            "department_id": None,
            "department_name": None,
            "created_at": log.created_at,
        })

    # Enrich with contact_person names + department via a single batch lookup
    # over the same company_profiles list already fetched above.
    profile_by_user: dict = {}
    for p in company_profiles:
        profile_by_user[p.user_id] = p

    for i, (log, actor) in enumerate(rows):
        p = profile_by_user.get(actor.id) if actor else None
        if p:
            if p.contact_person:
                result[i]["actor_name"] = p.contact_person
            if p.department_id:
                result[i]["department_id"] = str(p.department_id)
                result[i]["department_name"] = p.department.name if p.department else None

    return result
