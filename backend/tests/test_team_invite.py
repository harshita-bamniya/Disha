"""Regression test for the employer-audit bug: inviting a team member never
sent an email, so invitees had no way to learn their login existed — and if
no password was supplied, the account had no password and no phone on file,
so it could never sign in at all (password reset is phone-OTP only).

Fix under test: app.modules.companies.service.invite_team_member now always
generates a password when one isn't supplied, and emails the login +
password via app.core.notifications.team_invite_email / notify().
"""
from __future__ import annotations

import uuid
from unittest.mock import patch

from app.core.security import verify_password
from app.models.user import User
from app.modules.companies.schemas import TeamInviteRequest
from app.modules.companies.service import invite_team_member


def test_invite_without_password_generates_one_and_emails_it(db, owner_and_company):
    owner_user, company = owner_and_company
    invitee_email = f"invitee-{uuid.uuid4().hex[:8]}@example.com"

    with patch("app.core.notifications.notify") as mock_notify:
        entry = invite_team_member(
            owner_user,
            TeamInviteRequest(
                email=invitee_email, contact_person="Jane Recruiter",
                role_name="recruiter",  # password intentionally omitted
            ),
            db,
        )

    # 1. The invite actually notified the invitee.
    mock_notify.assert_called_once()
    call_args = mock_notify.call_args.args
    sent_to, subject, html = call_args[0], call_args[1], call_args[2]
    assert sent_to == invitee_email
    assert company.name in subject or company.name in html

    # 2. A password was generated (not left blank/unusable).
    new_user = db.query(User).filter(User.email == invitee_email).first()
    assert new_user is not None
    assert new_user.password_hash is not None

    # 3. The password actually emailed matches the one stored — not a stale
    #    or placeholder value.
    import re
    m = re.search(r"Temporary password:</strong>\s*([^<]+)</li>", html)
    assert m, "email body did not contain a temporary password"
    emailed_password = m.group(1).strip()
    assert verify_password(emailed_password, new_user.password_hash)

    assert entry.email == invitee_email
    assert entry.role_name == "recruiter"


def test_invite_with_explicit_password_still_emails_it(db, owner_and_company):
    owner_user, company = owner_and_company
    invitee_email = f"invitee-{uuid.uuid4().hex[:8]}@example.com"

    with patch("app.core.notifications.notify") as mock_notify:
        invite_team_member(
            owner_user,
            TeamInviteRequest(
                email=invitee_email, contact_person="Jane Recruiter",
                role_name="recruiter", password="MyChosenPass123",
            ),
            db,
        )

    mock_notify.assert_called_once()
    new_user = db.query(User).filter(User.email == invitee_email).first()
    assert verify_password("MyChosenPass123", new_user.password_hash)


def test_invite_hiring_manager_role_is_seeded(db, owner_and_company):
    """Regression test: role_name="hiring_manager" has always been an accepted
    TeamInviteRequest value (companies/schemas.py) and is used elsewhere as a
    per-job assignment tag (job_hiring_team.job_role), but no such row ever
    existed in the roles table — every hiring_manager invite 400'd with
    "Role 'hiring_manager' not seeded in database." Fixed by migration
    y5z6a7b8c9d0."""
    owner_user, company = owner_and_company
    invitee_email = f"invitee-{uuid.uuid4().hex[:8]}@example.com"

    with patch("app.core.notifications.notify"):
        entry = invite_team_member(
            owner_user,
            TeamInviteRequest(
                email=invitee_email, contact_person="Jane Hiring Manager",
                role_name="hiring_manager", password="MyChosenPass123",
            ),
            db,
        )

    assert entry.role_name == "hiring_manager"
    new_user = db.query(User).filter(User.email == invitee_email).first()
    assert new_user is not None
    assert verify_password("MyChosenPass123", new_user.password_hash)
