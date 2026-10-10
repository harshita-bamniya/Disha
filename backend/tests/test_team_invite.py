"""Team invitations.

An invitation is not an account. The invitee gets a one-time emailed link, sets their own name and
password on it, and only then does a user exist. Before this flow, inviting someone (or typing a
"department head email" while creating a department) silently created a live account with a
placeholder name taken from the email ("Cs D"), a generated password sent in plain text, and the
email already marked verified.

No network: the email sender is always patched; the invite link is read back from the email body.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from app.config import get_settings
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.core.security import create_access_token, hash_token, verify_password
from app.models.company import CompanyDepartment, CompanyInvite
from app.models.user import EmployerProfile, User
from app.modules.companies import invites, service
from app.modules.companies.schemas import (
    AcceptInviteRequest,
    DepartmentCreateRequest,
    TeamBulkInviteRequest,
    TeamInviteRequest,
)

PASSWORD = "Sup3r$ecret!"


def _email(label="invitee") -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}@example.com"


def _send(db, owner, email, role="recruiter", department_id=None):
    """Invite and return (entry, raw_token, subject, html) read back from the email that went out."""
    with patch.object(get_settings(), "frontend_url", "http://localhost:5173"), \
         patch("app.core.notifications.notify") as notify:
        entry = service.invite_team_member(owner, TeamInviteRequest(email=email, role_name=role, department_id=department_id), db)
    to, subject, html = notify.call_args.args[:3]
    assert to == email
    token = re.search(r"token=([A-Za-z0-9_\-]+)", html).group(1)
    return entry, token, subject, html


def _accept(db, token, name="Priya Sharma", password=PASSWORD):
    return invites.accept_invite(AcceptInviteRequest(token=token, full_name=name, password=password), db)


def _user(db, email) -> User | None:
    return db.query(User).filter(User.email == email).first()


def _dept(db, company, name=None) -> CompanyDepartment:
    d = CompanyDepartment(company_id=company.id, name=name or f"Dept {uuid.uuid4().hex[:6]}")
    db.add(d)
    db.commit()
    return d


# ── An invitation is not an account ───────────────────────────────────────────

def test_inviting_creates_no_account_and_emails_a_link_without_a_password(db, owner_and_company):
    owner, company = owner_and_company
    email = _email()
    entry, token, subject, html = _send(db, owner, email)

    assert _user(db, email) is None                                   # nobody exists yet
    assert entry.status == "pending" and entry.email == email
    assert f"http://localhost:5173/auth/accept-invite?token={token}" in html
    assert company.name in subject
    assert "Temporary password" not in html and "Login:" not in html  # the old plain-text credentials
    assert len(token) >= 40                                           # long enough that it can't be guessed


def test_the_raw_token_is_never_stored(db, owner_and_company):
    owner, _ = owner_and_company
    _, token, _, _ = _send(db, owner, _email())
    stored = [i.token_hash for i in db.query(CompanyInvite).filter(CompanyInvite.token_hash != None)]  # noqa: E711
    assert hash_token(token) in stored
    assert token not in stored


# ── Accepting ─────────────────────────────────────────────────────────────────

def test_accepting_creates_the_account_with_the_invitees_own_name_and_password(db, owner_and_company):
    owner, company = owner_and_company
    dept = _dept(db, company)
    email = _email()
    _, token, _, _ = _send(db, owner, email, "recruiter", str(dept.id))

    tokens = _accept(db, token, "Priya Sharma")
    assert tokens.access_token

    user = _user(db, email)
    assert user is not None and user.email_verified and user.is_active
    assert user.role_name == "recruiter" and verify_password(PASSWORD, user.password_hash)
    profile = db.query(EmployerProfile).filter_by(user_id=user.id).one()
    assert profile.contact_person == "Priya Sharma"                   # not a name guessed from the email
    assert profile.company_id == company.id and profile.department_id == dept.id and not profile.is_owner


def test_a_link_works_only_once(db, owner_and_company):
    owner, _ = owner_and_company
    _, token, _, _ = _send(db, owner, _email())
    _accept(db, token)
    with pytest.raises(NotFoundException):
        _accept(db, token, "Someone Else", "An0ther$ecret!")


def test_a_garbage_token_reveals_nothing(db):
    with pytest.raises(NotFoundException) as e:
        invites.get_invite_info("x" * 43, db)
    assert "not valid" in e.value.detail


def test_an_expired_invitation_cannot_be_accepted(db, owner_and_company):
    owner, _ = owner_and_company
    email = _email()
    _, token, _, _ = _send(db, owner, email)
    db.query(CompanyInvite).filter_by(email=email).update({"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)})
    db.commit()

    assert invites.get_invite_info(token, db).status == "expired"
    with pytest.raises(BadRequestException) as e:
        _accept(db, token)
    assert "expired" in e.value.detail
    assert _user(db, email) is None


def test_someone_who_signed_up_meanwhile_is_told_to_sign_in(db, owner_and_company):
    owner, _ = owner_and_company
    email = _email()
    _, token, _, _ = _send(db, owner, email)
    db.add(User(email=email, role_id=owner.role_id, email_verified=True, is_active=True))
    db.commit()
    with pytest.raises(BadRequestException) as e:
        _accept(db, token)
    assert "already has" in e.value.detail


def test_a_weak_password_is_refused_before_anything_is_created():
    with pytest.raises(ValueError):
        AcceptInviteRequest(token="t" * 43, full_name="Priya", password="short")
    with pytest.raises(ValueError):
        AcceptInviteRequest(token="t" * 43, full_name="   ", password=PASSWORD)


def test_new_members_inherit_the_companys_verification(db, owner_and_company):
    owner, company = owner_and_company                                # the fixture company is verified
    email = _email()
    _, token, _, _ = _send(db, owner, email)
    _accept(db, token)
    assert db.query(EmployerProfile).filter_by(user_id=_user(db, email).id).one().is_approved is True


# ── Resend and cancel ─────────────────────────────────────────────────────────

def test_resending_replaces_the_old_link_and_restarts_the_clock(db, owner_and_company):
    owner, _ = owner_and_company
    email = _email()
    entry, old_token, _, _ = _send(db, owner, email)
    db.query(CompanyInvite).filter_by(email=email).update({"expires_at": datetime.now(timezone.utc) + timedelta(hours=1)})
    db.commit()

    with patch.object(get_settings(), "frontend_url", "http://localhost:5173"), patch("app.core.notifications.notify") as notify:
        again = service.resend_team_invite(owner, entry.id, db)
    new_token = re.search(r"token=([A-Za-z0-9_\-]+)", notify.call_args.args[2]).group(1)

    assert new_token != old_token
    assert again.expires_at > datetime.now(timezone.utc) + timedelta(days=6)
    with pytest.raises(NotFoundException):
        invites.get_invite_info(old_token, db)                        # the earlier email's link is dead
    assert _accept(db, new_token).access_token


def test_cancelling_kills_the_link_and_removes_it_from_the_list(db, owner_and_company):
    owner, _ = owner_and_company
    entry, token, _, _ = _send(db, owner, _email())
    service.revoke_team_invite(owner, entry.id, db)
    with pytest.raises(NotFoundException):
        _accept(db, token)
    assert entry.id not in [i.id for i in service.list_team_invites(owner, db)]


def test_pending_invitations_are_listed_and_accepted_ones_leave_the_list(db, owner_and_company):
    owner, _ = owner_and_company
    entry, token, _, _ = _send(db, owner, _email())
    assert entry.id in [i.id for i in service.list_team_invites(owner, db)]
    _accept(db, token)
    assert entry.id not in [i.id for i in service.list_team_invites(owner, db)]


def test_inviting_the_same_address_again_reissues_instead_of_duplicating(db, owner_and_company):
    owner, company = owner_and_company
    email = _email()
    _, first, _, _ = _send(db, owner, email)
    _, second, _, _ = _send(db, owner, email)
    assert db.query(CompanyInvite).filter_by(company_id=company.id, email=email).count() == 1
    with pytest.raises(NotFoundException):
        invites.get_invite_info(first, db)
    assert invites.get_invite_info(second, db).email == email


# ── Seats ─────────────────────────────────────────────────────────────────────

def test_waiting_invitations_count_against_the_seat_limit(db, owner_and_company):
    owner, _ = owner_and_company
    with patch.object(service, "_get_recruiter_seat_limit", return_value=2):
        a, _, _, _ = _send(db, owner, _email("a"))
        _send(db, owner, _email("b"))
        with pytest.raises(BadRequestException) as e:
            _send(db, owner, _email("c"))
        assert "seat" in e.value.detail
        service.revoke_team_invite(owner, a.id, db)                    # freeing one makes room again
        _send(db, owner, _email("d"))


def test_resending_does_not_need_a_free_seat(db, owner_and_company):
    owner, _ = owner_and_company
    with patch.object(service, "_get_recruiter_seat_limit", return_value=1):
        entry, _, _, _ = _send(db, owner, _email())
        with patch("app.core.notifications.notify"):
            assert service.resend_team_invite(owner, entry.id, db).id == entry.id


# ── Who may invite whom ───────────────────────────────────────────────────────

def test_an_address_that_already_has_an_account_is_refused(db, owner_and_company):
    owner, _ = owner_and_company
    with pytest.raises(BadRequestException) as e:
        _send(db, owner, owner.email)
    assert "already has" in e.value.detail


def test_bulk_invites_report_each_address_separately(db, owner_and_company):
    owner, _ = owner_and_company
    good = _email("good")
    with patch("app.core.notifications.notify"):
        out = service.invite_team_members_bulk(
            owner, TeamBulkInviteRequest(emails=[good, "not-an-email", owner.email, good.upper()], role_name="recruiter"), db)
    by_email = {r.email: r for r in out.results}
    assert out.created_count == 1 and out.failed_count == 2
    assert by_email[good].success and by_email[good].invite.status == "pending"
    assert not by_email["not-an-email"].success and not by_email[owner.email].success


def test_a_department_head_invites_only_into_their_own_department_and_never_another_head(db, owner_and_company):
    owner, company = owner_and_company
    mine, theirs = _dept(db, company), _dept(db, company)
    head_email = _email("head")
    _, token, _, _ = _send(db, owner, head_email, "hr_manager", str(mine.id))
    _accept(db, token, "Head Person")
    head = _user(db, head_email)

    # asking for the other department is overridden: heads can only add to their own
    entry, _, _, _ = _send(db, head, _email("rec"), "recruiter", str(theirs.id))
    assert entry.department_id == str(mine.id)
    with pytest.raises(ForbiddenException):
        _send(db, head, _email("rival"), "hr_manager", str(mine.id))   # only the owner appoints heads

    other, _, _, _ = _send(db, owner, _email("elsewhere"), "recruiter", str(theirs.id))
    seen = {i.id for i in service.list_team_invites(head, db)}
    assert entry.id in seen and other.id not in seen                  # and sees only their own department's


def test_a_recruiter_cannot_invite_anyone(db, owner_and_company):
    owner, _ = owner_and_company
    rec_email = _email("rec")
    _, token, _, _ = _send(db, owner, rec_email, "recruiter")
    _accept(db, token)
    with pytest.raises(ForbiddenException):
        _send(db, _user(db, rec_email), _email("x"))


# ── Departments: structure first, people optional ─────────────────────────────

def test_a_department_can_be_created_with_nobody_and_creates_no_member(db, owner_and_company):
    owner, company = owner_and_company
    users_before = db.query(User).count()
    profiles_before = db.query(EmployerProfile).filter_by(company_id=company.id).count()

    out = service.create_department(owner, DepartmentCreateRequest(name=f"Legal {uuid.uuid4().hex[:5]}"), db)

    assert out.head_employer_id is None and out.head_name is None and out.head_pending_email is None
    assert db.query(User).count() == users_before                      # the old code made a placeholder member here
    assert db.query(EmployerProfile).filter_by(company_id=company.id).count() == profiles_before


def test_naming_a_head_by_email_sends_an_invitation_not_an_account(db, owner_and_company):
    owner, company = owner_and_company
    email = _email("head")
    with patch.object(get_settings(), "frontend_url", "http://localhost:5173"), patch("app.core.notifications.notify") as notify:
        out = service.create_department(owner, DepartmentCreateRequest(name=f"Eng {uuid.uuid4().hex[:5]}", head_email=email), db)
    token = re.search(r"token=([A-Za-z0-9_\-]+)", notify.call_args.args[2]).group(1)

    assert _user(db, email) is None
    assert out.head_name is None and out.head_pending_email == email    # shown as "invited", not as a person

    _accept(db, token, "Asha Verma")
    dept = db.get(CompanyDepartment, out.id)
    head = db.query(EmployerProfile).filter_by(user_id=_user(db, email).id).one()
    assert dept.head_employer_id == head.id and head.department_id == dept.id
    after = service.get_department(owner, out.id, db)
    assert after.head_name == "Asha Verma" and after.head_pending_email is None


def test_a_head_invite_to_a_taken_address_creates_no_department(db, owner_and_company):
    owner, company = owner_and_company
    name = f"Ops {uuid.uuid4().hex[:5]}"
    with pytest.raises(BadRequestException):
        service.create_department(owner, DepartmentCreateRequest(name=name, head_email=owner.email), db)
    assert db.query(CompanyDepartment).filter_by(company_id=company.id, name=name).count() == 0


def test_a_head_can_be_assigned_later_from_existing_members(db, owner_and_company):
    from app.modules.companies.schemas import DepartmentUpdateRequest

    owner, company = owner_and_company
    dept = service.create_department(owner, DepartmentCreateRequest(name=f"HR {uuid.uuid4().hex[:5]}"), db)
    email = _email("later")
    _, token, _, _ = _send(db, owner, email, "recruiter")
    _accept(db, token, "Later Person")
    member = db.query(EmployerProfile).filter_by(user_id=_user(db, email).id).one()

    out = service.update_department(owner, dept.id, DepartmentUpdateRequest(head_employer_id=str(member.id)), db)
    assert out.head_name == "Later Person"
    cleared = service.update_department(owner, dept.id, DepartmentUpdateRequest(head_employer_id=None), db)
    assert cleared.head_employer_id is None


# ── Over HTTP ─────────────────────────────────────────────────────────────────

def _h(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': str(user.id)})}"}


def test_http_invite_accept_and_sign_in_flow(client, db, owner_and_company):
    owner, _ = owner_and_company
    email = _email("http")
    with patch.object(get_settings(), "frontend_url", "http://localhost:5173"), patch("app.core.notifications.notify") as notify:
        r = client.post("/api/employer/company/team/invite", json={"email": email, "role_name": "recruiter"}, headers=_h(owner))
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "pending" and "password" not in r.text.lower()
    token = re.search(r"token=([A-Za-z0-9_\-]+)", notify.call_args.args[2]).group(1)

    pending = client.get("/api/employer/company/team/invites", headers=_h(owner)).json()
    assert [i["email"] for i in pending] == [email]

    info = client.get("/api/auth/invite-info", params={"token": token})
    assert info.status_code == 200 and info.json()["email"] == email and info.json()["status"] == "pending"

    weak = client.post("/api/auth/accept-invite", json={"token": token, "full_name": "Priya", "password": "weak"})
    assert weak.status_code == 422
    ok = client.post("/api/auth/accept-invite", json={"token": token, "full_name": "Priya Sharma", "password": PASSWORD})
    assert ok.status_code == 200, ok.text
    assert ok.json()["access_token"]                                  # signed in straight away

    members = client.get("/api/employer/company/team", headers=_h(owner)).json()
    assert email in [m["email"] for m in members]                     # now a member...
    assert client.get("/api/employer/company/team/invites", headers=_h(owner)).json() == []   # ...no longer pending

    again = client.post("/api/auth/accept-invite", json={"token": token, "full_name": "Priya Sharma", "password": PASSWORD})
    assert again.status_code == 404
    assert not again.json()["detail"].startswith("404")               # a readable message, not "404: ..."


def test_http_old_clients_cannot_set_someone_elses_password(client, db, owner_and_company):
    owner, _ = owner_and_company
    email = _email("legacy")
    with patch("app.core.notifications.notify"):
        r = client.post("/api/employer/company/team/invite",
                        json={"email": email, "contact_person": "Ghost", "role_name": "recruiter", "password": "Chosen!Pass1"},
                        headers=_h(owner))
    assert r.status_code == 201
    assert _user(db, email) is None                                    # still just an invitation


def test_http_requires_a_login_to_manage_invitations_but_not_to_accept(client):
    assert client.get("/api/employer/company/team/invites").status_code in (401, 403)
    assert client.post("/api/employer/company/team/invite", json={"email": _email(), "role_name": "recruiter"}).status_code in (401, 403)
    assert client.get("/api/auth/invite-info", params={"token": "z" * 43}).status_code == 404   # reachable, just invalid
