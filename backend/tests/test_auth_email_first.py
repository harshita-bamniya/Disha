"""Tests for the email-first registration/login migration:
  - Aspirant registration is email + password only (phone is added afterwards); employer registration
    still stores a phone when given
  - Employer registration now sends its OTP by email instead of SMS, and
    reuses the same /auth/verify-email-otp endpoint as aspirants
  - Forgot-password / reset-password now work by email instead of phone
"""
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.config import Settings
from app.models.user import User


@pytest.fixture(autouse=True)
def _console_email_provider():
    """These tests read the OTP the API hands back in local dev, which only happens while no real email
    provider is configured. The Docker backend has Brevo credentials, so pin the console behaviour here
    instead of depending on whichever environment the suite runs in."""
    with patch.object(Settings, "uses_real_email", return_value=False):
        yield


def _unique_phone() -> str:
    # Valid 10-digit Indian mobile pattern ([6-9]\d{9}), collision-safe per test run.
    return "9" + str(uuid.uuid4().int)[:9]


def _unique_email(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}@example.com"


class TestAspirantRegisterDoesNotAskForPhone:
    """Signup is email + password only. The phone number is collected afterwards (onboarding step 1,
    POST /auth/phone), so it is neither required nor accepted at registration."""

    def test_register_needs_only_email_and_password(self, client, db):
        email = _unique_email("no-phone")
        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock):
            r = client.post("/api/auth/register", json={"email": email, "password": "SecurePass@123"})
        assert r.status_code == 201
        user = db.query(User).filter(User.email == email).first()
        assert user is not None and user.phone is None and user.phone_verified is False

    def test_a_phone_sent_at_registration_is_ignored(self, client, db):
        email = _unique_email("ignored-phone")
        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock):
            r = client.post("/api/auth/register", json={
                "email": email, "phone": _unique_phone(), "password": "SecurePass@123",
            })
        assert r.status_code == 201
        assert db.query(User).filter(User.email == email).first().phone is None

    def test_weak_password_still_rejected(self, client):
        r = client.post("/api/auth/register", json={"email": _unique_email("weak"), "password": "short"})
        assert r.status_code == 422


class TestRegisteringAgainBeforeVerifying:
    """Registration saves the account before the email code is entered. Going back ("Edit details")
    and submitting again used to fail with 'already exists', locking the real owner out of their own
    address. Only a verified account may keep an address."""

    def _register(self, client, email, password="SecurePass@123"):
        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock):
            return client.post("/api/auth/register", json={"email": email, "password": password})

    def test_unverified_signup_can_be_restarted_with_a_new_password(self, client, db):
        email = _unique_email("restart")
        assert self._register(client, email, "FirstPass@123").status_code == 201
        user = db.query(User).filter(User.email == email).first()
        first_hash = user.password_hash

        assert self._register(client, email, "SecondPass@123").status_code == 201
        db.refresh(user)
        assert user.password_hash != first_hash
        assert db.query(User).filter(User.email == email).count() == 1          # restarted, not duplicated

    def test_restart_invalidates_the_earlier_code(self, client, db):
        from app.models.user import OtpVerification
        email = _unique_email("old-code")
        self._register(client, email)
        user = db.query(User).filter(User.email == email).first()
        self._register(client, email)
        active = db.query(OtpVerification).filter_by(user_id=user.id, purpose="register", used_at=None).count()
        assert active == 1

    def test_a_verified_account_keeps_its_address(self, client, db):
        email = _unique_email("verified")
        self._register(client, email, "OriginalPass@123")
        user = db.query(User).filter(User.email == email).first()
        user.email_verified = True
        db.commit()
        original_hash = user.password_hash

        assert self._register(client, email, "AttackerPass@123").status_code == 409
        db.refresh(user)
        assert user.password_hash == original_hash                              # nothing was overwritten

    def test_a_suspended_account_cannot_be_restarted(self, client, db):
        email = _unique_email("suspended")
        self._register(client, email)
        user = db.query(User).filter(User.email == email).first()
        user.status = "suspended"
        db.commit()
        assert self._register(client, email).status_code == 409


class TestPhoneAfterSignup:
    def _user_with_token(self, client, db):
        from app.core.security import create_access_token
        email = _unique_email("phone-later")
        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock):
            client.post("/api/auth/register", json={"email": email, "password": "SecurePass@123"})
        user = db.query(User).filter(User.email == email).first()
        user.email_verified = True
        db.commit()
        return user, {"Authorization": f"Bearer {create_access_token({'sub': str(user.id)})}"}

    def test_phone_is_saved_after_signup(self, client, db):
        user, h = self._user_with_token(client, db)
        phone = _unique_phone()
        assert client.post("/api/auth/phone", json={"phone": phone}, headers=h).status_code == 200
        db.refresh(user)
        assert user.phone == phone and user.phone_verified is False

    def test_a_phone_already_used_by_someone_else_is_rejected(self, client, db):
        _, h1 = self._user_with_token(client, db)
        _, h2 = self._user_with_token(client, db)
        phone = _unique_phone()
        assert client.post("/api/auth/phone", json={"phone": phone}, headers=h1).status_code == 200
        assert client.post("/api/auth/phone", json={"phone": phone}, headers=h2).status_code == 409

    def test_invalid_phone_is_rejected(self, client, db):
        _, h = self._user_with_token(client, db)
        assert client.post("/api/auth/phone", json={"phone": "12345"}, headers=h).status_code == 422


class TestEmployerRegisterRequiresEmail:
    def _payload(self, **overrides):
        payload = {
            "email": _unique_email("employer"),
            "phone": _unique_phone(),
            "password": "SecurePass@123",
            "company_name": "Test Co",
        }
        payload.update(overrides)
        return payload

    def test_register_missing_email_rejected(self, client):
        payload = self._payload()
        del payload["email"]
        r = client.post("/api/auth/register/employer", json=payload)
        assert r.status_code == 422

    def test_register_sends_otp_by_email_not_sms(self, client, db):
        email = _unique_email("employer-otp")
        phone = _unique_phone()
        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock) as mock_email, \
             patch("app.modules.auth.service.send_otp_sms", new_callable=AsyncMock) as mock_sms:
            r = client.post("/api/auth/register/employer", json=self._payload(email=email, phone=phone))

        assert r.status_code == 201
        mock_email.assert_awaited_once()
        assert mock_email.await_args.args[0] == email
        mock_sms.assert_not_awaited()

        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        assert user.phone == phone
        assert user.phone_verified is False
        assert user.email_verified is False

    def test_register_duplicate_email_rejected(self, client):
        email = _unique_email("dup-employer")
        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock):
            r1 = client.post("/api/auth/register/employer", json=self._payload(email=email))
        assert r1.status_code == 201

        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock):
            r2 = client.post("/api/auth/register/employer", json=self._payload(email=email))
        assert r2.status_code == 409

    def test_verify_email_otp_endpoint_is_reused_for_employer(self, client, db):
        """The same /auth/verify-email-otp endpoint aspirants use should also
        verify + auto-login a freshly registered employer — it's role-agnostic."""
        email = _unique_email("employer-verify")
        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock):
            reg = client.post("/api/auth/register/employer", json=self._payload(email=email))
        dev_otp = reg.json()["dev_otp"]
        assert dev_otp

        r = client.post("/api/auth/verify-email-otp", json={"email": email, "otp": dev_otp})
        assert r.status_code == 200
        data = r.json()
        assert data["access_token"]
        assert data["user"]["email"] == email

        user = db.query(User).filter(User.email == email).first()
        assert user.email_verified is True


class TestForgotPasswordByEmail:
    def _register_aspirant(self, client, email, phone, password="SecurePass@123"):
        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock):
            client.post("/api/auth/register", json={"email": email, "phone": phone, "password": password})

    def test_forgot_password_missing_email_rejected(self, client):
        r = client.post("/api/auth/forgot-password", json={})
        assert r.status_code == 422

    def test_forgot_password_sends_otp_by_email(self, client):
        email = _unique_email("forgot")
        self._register_aspirant(client, email, _unique_phone())

        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock) as mock_email:
            r = client.post("/api/auth/forgot-password", json={"email": email})
        assert r.status_code == 200
        mock_email.assert_awaited_once()
        assert mock_email.await_args.args[0] == email
        assert r.json()["dev_otp"]

    def test_reset_password_end_to_end(self, client):
        email = _unique_email("reset")
        phone = _unique_phone()
        self._register_aspirant(client, email, phone, password="OldPass@123")

        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock):
            forgot = client.post("/api/auth/forgot-password", json={"email": email})
        dev_otp = forgot.json()["dev_otp"]

        reset = client.post("/api/auth/reset-password", json={
            "email": email, "otp": dev_otp, "new_password": "NewPass@456",
        })
        assert reset.status_code == 200

        login = client.post("/api/auth/login", json={"identifier": email, "password": "NewPass@456"})
        assert login.status_code == 200
        assert login.json()["access_token"]
