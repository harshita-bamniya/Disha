import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password ──────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(payload: dict[str, Any]) -> str:
    data = payload.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_expire_minutes)
    data.update({"exp": expire, "type": "access"})
    return jwt.encode(data, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(payload: dict[str, Any]) -> str:
    data = payload.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expire_days)
    data.update({"exp": expire, "type": "refresh"})
    return jwt.encode(data, settings.jwt_refresh_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def create_2fa_challenge_token(user_id: str) -> str:
    """Short-lived token proving the password step already succeeded — issued
    by /auth/login when 2FA is enabled, consumed by /auth/2fa/verify-login."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    return jwt.encode(
        {"sub": user_id, "type": "2fa_challenge", "exp": expire},
        settings.jwt_secret_key, algorithm=settings.jwt_algorithm,
    )


def decode_2fa_challenge_token(token: str) -> str:
    """Returns the user_id, or raises JWTError if invalid/expired/wrong type."""
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != "2fa_challenge":
        raise JWTError("Not a 2FA challenge token")
    return payload["sub"]


def decode_refresh_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_refresh_secret_key, algorithms=[settings.jwt_algorithm])


def is_token_valid(token: str, secret: str) -> bool:
    try:
        jwt.decode(token, secret, algorithms=[settings.jwt_algorithm])
        return True
    except JWTError:
        return False


# ── Refresh token storage ─────────────────────────────────────────────────────

def generate_raw_refresh_token() -> str:
    """Generates a cryptographically secure random token string."""
    return secrets.token_urlsafe(64)


def hash_token(raw_token: str) -> str:
    """SHA-256 hash of a raw token — stored in DB, never the raw token."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


# ── OTP ───────────────────────────────────────────────────────────────────────

def generate_otp(length: int = 6) -> str:
    return "".join([str(secrets.randbelow(10)) for _ in range(length)])


def hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


def verify_otp(plain_otp: str, stored_hash: str) -> bool:
    return hash_otp(plain_otp) == stored_hash
