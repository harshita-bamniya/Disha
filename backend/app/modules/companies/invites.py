"""The public half of team invitations: look at an invitation, and accept it.

Nothing here needs a login (the invitee has no account yet). Possession of the emailed one-time link is
the credential, so it is long and random, stored only as a hash, single-use, expiring, and these
endpoints are rate limited.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException, NotFoundException
from app.core.security import hash_password, hash_token
from app.models.company import Company, CompanyDepartment, CompanyInvite
from app.models.user import EmployerProfile, Role, User
from app.modules.auth.schemas import TokenResponse
from app.modules.companies.schemas import AcceptInviteRequest, InviteInfo

logger = logging.getLogger(__name__)

_GONE = {
    "accepted": "This invitation has already been used. Sign in instead.",
    "revoked": "This invitation was cancelled. Ask your admin to send a new one.",
    "expired": "This invitation has expired. Ask your admin to send a new one.",
}


def _find(token: str, db: Session, *, lock: bool = False) -> CompanyInvite:
    q = db.query(CompanyInvite).filter(CompanyInvite.token_hash == hash_token(token or ""))
    if lock:
        q = q.with_for_update()
    inv = q.first()
    if not inv:
        # Same answer for "never existed", "already used" (hash cleared) and "cancelled" (hash cleared):
        # a guessed token reveals nothing.
        raise NotFoundException("This invitation link is not valid. It may have been used or cancelled; ask your admin for a new one.")
    return inv


def get_invite_info(token: str, db: Session) -> InviteInfo:
    inv = _find(token, db)
    company = db.get(Company, inv.company_id)
    inviter = db.query(EmployerProfile).filter(EmployerProfile.user_id == inv.invited_by).first() if inv.invited_by else None
    return InviteInfo(
        email=inv.email, company_name=company.name if company else "",
        role_name=inv.role.name if inv.role else "",
        department_name=inv.department.name if inv.department else None,
        invited_by_name=inviter.contact_person if inviter else None,
        status=inv.status, expires_at=inv.expires_at,
    )


def accept_invite(data: AcceptInviteRequest, db: Session, request: Request | None = None) -> TokenResponse:
    """Creates the account (the invitee's own name and password) and signs them in."""
    inv = _find(data.token, db, lock=True)
    if inv.status != "pending":
        raise BadRequestException(_GONE.get(inv.status, "This invitation can no longer be used."))
    if db.query(User).filter(User.email == inv.email).first():
        raise BadRequestException(f"{inv.email} already has a BeginablAI account. Sign in instead.")

    company = db.get(Company, inv.company_id)
    if not company:
        raise NotFoundException("This company no longer exists.")
    role = inv.role or db.get(Role, inv.role_id)

    user = User(
        email=inv.email, role_id=role.id, password_hash=hash_password(data.password),
        # They proved they control this inbox by opening the link, so no separate email OTP is needed.
        email_verified=True, is_active=True, preferred_language="en",
    )
    db.add(user)
    db.flush()

    inviter_profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == inv.invited_by).first() if inv.invited_by else None
    dept = db.get(CompanyDepartment, inv.department_id) if inv.department_id else None
    profile = EmployerProfile(
        user_id=user.id, company_name=company.name, industry=company.industry, company_size=company.company_size,
        website=company.website, contact_person=data.full_name, city=(inviter_profile.city if inviter_profile else "") or "",
        is_approved=(company.verification_status == "verified"),     # seats inherit the company's verification
        company_id=company.id, is_owner=False, department_id=dept.id if dept else None,
    )
    db.add(profile)
    db.flush()
    if role.name == "hr_manager" and dept and dept.head_employer_id is None:
        dept.head_employer_id = profile.id           # leading a department they were invited to

    inv.accepted_at = datetime.now(timezone.utc)
    inv.token_hash = None                             # single use
    db.commit()

    # Imported here: auth.service imports models that import this package's siblings.
    from app.modules.auth import service as auth_service
    tokens = auth_service._issue_token_pair(user, db, request)
    db.commit()
    logger.info("[INVITE] accepted company=%s role=%s", company.id, role.name)
    return tokens
