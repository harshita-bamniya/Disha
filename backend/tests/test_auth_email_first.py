"""Tests for the email-first registration/login migration:
  - Aspirant + employer registration both require phone (stored, unverified)
  - Employer registration now sends its OTP by email instead of SMS, and
    reuses the same /auth/verify-email-otp endpoint as aspirants
  - Forgot-password / reset-password now work by email instead of phone
"""
import uuid
from unittest.mock import AsyncMock, patch

from app.models.user import User


def _unique_phone() -> str:
    # Valid 10-digit Indian mobile pattern ([6-9]\d{9}), collision-safe per test run.
    return "9" + str(uuid.uuid4().int)[:9]


def _unique_email(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}@example.com"


class TestAspirantRegisterRequiresPhone:
    def test_register_missing_phone_rejected(self, client):
        r = client.post("/api/auth/register", json={
            "email": _unique_email("no-phone"), "password": "SecurePass@123",
        })
        assert r.status_code == 422

    def test_register_stores_phone_unverified(self, client, db):
        email = _unique_email("aspirant")
        phone = _unique_phone()
        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock):
            r = client.post("/api/auth/register", json={
                "email": email, "phone": phone, "password": "SecurePass@123",
            })
        assert r.status_code == 201

        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        assert user.phone == phone
        assert user.phone_verified is False

    def test_register_duplicate_phone_rejected(self, client):
        phone = _unique_phone()
        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock):
            r1 = client.post("/api/auth/register", json={
                "email": _unique_email("dup-phone-a"), "phone": phone, "password": "SecurePass@123",
            })
        assert r1.status_code == 201

        with patch("app.modules.auth.service.send_otp_email", new_callable=AsyncMock):
            r2 = client.post("/api/auth/register", json={
                "email": _unique_email("dup-phone-b"), "phone": phone, "password": "SecurePass@123",
            })
        assert r2.status_code == 409


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
