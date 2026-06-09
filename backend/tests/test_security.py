"""Unit tests for security utilities and auth edge cases."""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

from app.core.security import (
    hash_password, verify_password,
    generate_otp, hash_otp, verify_otp,
    create_access_token, decode_access_token,
    generate_raw_refresh_token, hash_token,
)
from app.modules.interview.feedback_ai import validate_response_text
from app.core.exceptions import BadRequestException


# ── Password hashing ──────────────────────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        hashed = hash_password("mypassword123")
        assert hashed != "mypassword123"
        assert len(hashed) > 30

    def test_correct_password_verifies(self):
        hashed = hash_password("correct-horse-battery-staple")
        assert verify_password("correct-horse-battery-staple", hashed) is True

    def test_wrong_password_fails(self):
        hashed = hash_password("correct-horse-battery-staple")
        assert verify_password("wrong-password", hashed) is False

    def test_same_password_different_hashes(self):
        h1 = hash_password("same_password")
        h2 = hash_password("same_password")
        assert h1 != h2  # bcrypt uses random salts


# ── OTP ───────────────────────────────────────────────────────────────────────

class TestOtp:
    def test_otp_is_6_digits(self):
        otp = generate_otp()
        assert len(otp) == 6
        assert otp.isdigit()

    def test_otp_verify_correct(self):
        otp = generate_otp()
        hashed = hash_otp(otp)
        assert verify_otp(otp, hashed) is True

    def test_otp_verify_wrong(self):
        otp = generate_otp()
        hashed = hash_otp(otp)
        assert verify_otp("000000", hashed) is False

    def test_otp_hash_deterministic(self):
        assert hash_otp("123456") == hash_otp("123456")

    def test_otp_custom_length(self):
        otp = generate_otp(length=4)
        assert len(otp) == 4


# ── JWT ───────────────────────────────────────────────────────────────────────

class TestJwt:
    def test_access_token_roundtrip(self):
        payload = {"sub": "42", "role": "aspirant"}
        token = create_access_token(payload)
        decoded = decode_access_token(token)
        assert decoded["sub"] == "42"
        assert decoded["role"] == "aspirant"
        assert decoded["type"] == "access"

    def test_expired_token_raises(self):
        from jose import JWTError
        from app.config import get_settings
        from jose import jwt

        settings = get_settings()
        expired_token = jwt.encode(
            {"sub": "1", "exp": datetime.now(timezone.utc) - timedelta(seconds=1)},
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )
        with pytest.raises(JWTError):
            decode_access_token(expired_token)

    def test_tampered_token_raises(self):
        from jose import JWTError
        token = create_access_token({"sub": "42"})
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(JWTError):
            decode_access_token(tampered)


# ── Refresh token ─────────────────────────────────────────────────────────────

class TestRefreshToken:
    def test_raw_token_sufficient_entropy(self):
        token = generate_raw_refresh_token()
        assert len(token) >= 64

    def test_hash_is_consistent(self):
        raw = generate_raw_refresh_token()
        assert hash_token(raw) == hash_token(raw)

    def test_different_tokens_different_hashes(self):
        t1 = generate_raw_refresh_token()
        t2 = generate_raw_refresh_token()
        assert hash_token(t1) != hash_token(t2)


# ── Interview response validation ─────────────────────────────────────────────

class TestInterviewResponseValidation:
    def test_empty_string_raises(self):
        with pytest.raises(BadRequestException):
            validate_response_text("")

    def test_too_short_raises(self):
        with pytest.raises(BadRequestException):
            validate_response_text("short")

    def test_whitespace_only_raises(self):
        with pytest.raises(BadRequestException):
            validate_response_text("   \n  \t  ")

    def test_valid_response_passes(self):
        validate_response_text("This is a valid response that is long enough to be meaningful for AI feedback.")

    def test_too_long_raises(self):
        with pytest.raises(BadRequestException):
            validate_response_text("x" * 5001)

    def test_exactly_at_min_passes(self):
        # 30 chars exactly
        validate_response_text("a" * 30)


# ── Config validation ─────────────────────────────────────────────────────────

class TestConfigValidation:
    def test_short_jwt_secret_raises(self):
        import os
        from pydantic import ValidationError
        with pytest.raises((ValidationError, Exception)):
            from app.config import Settings
            Settings(
                jwt_secret_key="short",
                jwt_refresh_secret_key="short",
                _env_file=None,
            )

    def test_valid_secrets_accepted(self):
        from app.config import Settings
        s = Settings(
            jwt_secret_key="a" * 32,
            jwt_refresh_secret_key="b" * 32,
            _env_file=None,
        )
        assert s.jwt_secret_key == "a" * 32
