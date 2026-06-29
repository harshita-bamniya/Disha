"""TOTP-based two-factor authentication helpers.

Secret encryption key is derived from jwt_secret_key (sha256 -> Fernet key)
rather than a separate setting — one less secret to provision, and the
threat model is the same: whoever has the JWT secret already controls
session issuance for every user.
"""
from __future__ import annotations

import base64
import hashlib
import io
import secrets

import pyotp
import qrcode
from cryptography.fernet import Fernet

from app.config import get_settings
from app.core.security import hash_otp, verify_otp

settings = get_settings()

ISSUER = "BeginablAI"
BACKUP_CODE_COUNT = 10


def _fernet() -> Fernet:
    key_material = hashlib.sha256(settings.jwt_secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))


def generate_secret() -> str:
    return pyotp.random_base32()


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(secret_encrypted: str) -> str:
    return _fernet().decrypt(secret_encrypted.encode()).decode()


def build_qr_code_data_uri(secret: str, account_label: str) -> str:
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=account_label, issuer_name=ISSUER)
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{encoded}"


def verify_totp_code(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code, valid_window=1)


def generate_backup_codes() -> list[str]:
    """Returns plaintext codes (shown once) — caller hashes them for storage."""
    return [f"{secrets.randbelow(10**4):04d}-{secrets.randbelow(10**4):04d}" for _ in range(BACKUP_CODE_COUNT)]


def hash_backup_codes(codes: list[str]) -> list[str]:
    return [hash_otp(c) for c in codes]


def consume_backup_code(code: str, hashed_codes: list[str]) -> list[str] | None:
    """Returns the remaining hashed codes list (with this one removed) if the
    code matched, or None if it didn't match anything."""
    for h in hashed_codes:
        if verify_otp(code, h):
            return [x for x in hashed_codes if x != h]
    return None
