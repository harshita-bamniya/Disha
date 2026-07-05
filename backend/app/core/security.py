import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

logger = logging.getLogger(__name__)

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
    # jti (JWT ID) is used by the Redis blacklist to invalidate individual tokens
    data.update({"exp": expire, "type": "access", "jti": secrets.token_hex(16)})
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


# ── Access token blacklist (Redis) ────────────────────────────────────────────
# When a user logs out or an admin force-revokes a session, we can't un-issue
# an already-signed JWT — it will stay cryptographically valid until it expires.
# The blacklist stores revoked JTIs in Redis with a TTL matching the token's
# remaining lifetime, so the window of vulnerability is bounded.

_BLACKLIST_PREFIX = "token:revoked:"


def _get_redis():
    """Lazy import to avoid circular deps and unnecessary connections in workers."""
    import redis as redis_lib
    return redis_lib.from_url(get_settings().redis_url, decode_responses=True)


def blacklist_access_token(token: str) -> None:
    """Add an access token's JTI to the Redis blacklist until it expires."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm],
            options={"verify_exp": False},  # decode even if already expired
        )
        jti = payload.get("jti") or payload.get("sub", "")
        exp = payload.get("exp")
        if not jti or not exp:
            return
        ttl = int(exp - datetime.now(timezone.utc).timestamp())
        if ttl <= 0:
            return  # Already expired — no need to blacklist
        r = _get_redis()
        r.setex(f"{_BLACKLIST_PREFIX}{jti}", ttl, "1")
    except Exception as exc:
        logger.warning("[SECURITY] Could not blacklist token: %s", exc)


def is_access_token_blacklisted(jti: str) -> bool:
    """Returns True if the given JTI has been revoked."""
    try:
        r = _get_redis()
        return r.exists(f"{_BLACKLIST_PREFIX}{jti}") == 1
    except Exception as exc:
        logger.warning("[SECURITY] Blacklist check failed, allowing token: %s", exc)
        return False  # Fail open — blacklist unavailability must not lock out all users
