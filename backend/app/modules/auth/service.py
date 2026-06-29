import logging
from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.exceptions import (
    AuthException, BadRequestException, ConflictException,
    OtpExpiredException, OtpInvalidException,
)
from app.core.security import (
    generate_otp, generate_raw_refresh_token,
    hash_otp, hash_password, hash_token,
    verify_otp, verify_password,
    create_access_token, create_refresh_token,
    decode_refresh_token,
    create_2fa_challenge_token, decode_2fa_challenge_token,
)
from app.core.sms import send_otp_sms
from app.models.company import Company
from app.models.user import AuditLog, DeviceSession, EmployerProfile, LoginHistory, OtpVerification, RefreshToken, Role, TwoFactorCredential, User
from app.core import totp as totp_core
from app.modules.auth.schemas import (
    EmployerProfileResponse, EmployerRegisterResponse,
    MessageResponse, TokenResponse, UserResponse,
    TwoFactorEnableResponse, TwoFactorSetupResponse, TwoFactorStatusResponse,
)

settings = get_settings()
logger = logging.getLogger(__name__)

OTP_TTL_MINUTES = 10
MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _build_token_payload(user: User) -> dict:
    return {"sub": str(user.id), "role": user.role_name, "lang": user.preferred_language}


def _device_label(user_agent: str | None) -> str | None:
    """Crude UA -> 'Browser on OS' label, good enough for the device session list."""
    if not user_agent:
        return None
    ua = user_agent.lower()
    browser = (
        "Edge" if "edg/" in ua else
        "Chrome" if "chrome" in ua else
        "Firefox" if "firefox" in ua else
        "Safari" if "safari" in ua else "Browser"
    )
    os_name = (
        "Windows" if "windows" in ua else
        "macOS" if "mac os" in ua else
        "Android" if "android" in ua else
        "iOS" if "iphone" in ua or "ipad" in ua else
        "Linux" if "linux" in ua else "Unknown OS"
    )
    return f"{browser} on {os_name}"


def _record_login(user: User, db: Session, request: Request | None, success: bool, failure_reason: str | None = None) -> None:
    ip = request.client.host if request and request.client else None
    ua = request.headers.get("user-agent") if request else None
    db.add(LoginHistory(
        user_id=user.id, ip_address=ip, user_agent=ua,
        device_label=_device_label(ua), success=success, failure_reason=failure_reason,
    ))
    if success:
        user.failed_login_attempts = 0
    else:
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1


def _issue_token_pair(user: User, db: Session, request: Request | None = None) -> TokenResponse:
    payload = _build_token_payload(user)
    access_token = create_access_token(payload)

    raw_refresh = generate_raw_refresh_token()
    create_refresh_token({"sub": str(user.id)})  # JWT form — not stored, raw token is

    ip = request.client.host if request and request.client else None
    ua = request.headers.get("user-agent") if request else None

    db_token = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expire_days),
        issued_ip=ip,
        user_agent=ua,
    )
    db.add(db_token)
    db.flush()  # need db_token.id before creating the session row

    db.add(DeviceSession(
        user_id=user.id, refresh_token_id=db_token.id,
        device_label=_device_label(ua), ip_address=ip,
    ))
    _record_login(user, db, request, success=True)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        user=UserResponse.from_user(user),
    )


def _get_aspirant_role(db: Session) -> Role:
    role = db.query(Role).filter(Role.name == "aspirant").first()
    if not role:
        raise Exception("Role 'aspirant' not seeded in database. Run migrations.")
    return role


def _audit(db: Session, action: str, user_id=None, resource: str | None = None,
           resource_id=None, request: Request | None = None, metadata: dict | None = None):
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        resource_id=resource_id,
        ip_address=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
        log_metadata=metadata,
    )
    db.add(log)


# ── Public service functions ──────────────────────────────────────────────────

async def register_user(
    phone: str, password: str, preferred_language: str, db: Session, request: Request | None = None
) -> str:
    """Creates a new aspirant account and sends phone OTP. Returns dev_otp in local env."""
    existing = db.query(User).filter(User.phone == phone, User.deleted_at == None).first()
    if existing:
        raise ConflictException("An account with this phone number already exists.")

    role = _get_aspirant_role(db)
    user = User(
        phone=phone,
        password_hash=hash_password(password),
        preferred_language=preferred_language,
        role_id=role.id,
    )
    db.add(user)
    db.flush()

    otp = generate_otp()
    otp_record = OtpVerification(
        user_id=user.id,
        target=phone,
        otp_hash=hash_otp(otp),
        purpose="register",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
    )
    db.add(otp_record)
    _audit(db, "user_registered", user_id=user.id, resource="user",
           resource_id=user.id, request=request)
    db.commit()

    await send_otp_sms(phone, otp)
    logger.info("[REGISTER] New user phone=%s", phone)

    return otp if settings.environment == "local" else ""


def verify_phone(phone: str, otp: str, db: Session, request: Request | None = None) -> TokenResponse:
    """Verifies the OTP, marks phone as verified, and returns a token pair (auto-login)."""
    user = db.query(User).filter(User.phone == phone, User.deleted_at == None).first()
    if not user:
        raise AuthException("No account found for this phone number.")

    otp_record = (
        db.query(OtpVerification)
        .filter(
            OtpVerification.user_id == user.id,
            OtpVerification.purpose == "register",
            OtpVerification.used_at == None,
        )
        .order_by(OtpVerification.created_at.desc())
        .first()
    )

    if not otp_record:
        raise BadRequestException("No active OTP found. Please request a new one.")
    if otp_record.is_expired:
        raise OtpExpiredException()
    if not verify_otp(otp, otp_record.otp_hash):
        raise OtpInvalidException()

    otp_record.used_at = datetime.now(timezone.utc)
    user.phone_verified = True
    user.last_login_at = datetime.now(timezone.utc)
    _audit(db, "phone_verified_and_logged_in", user_id=user.id, resource="user",
           resource_id=user.id, request=request)

    tokens = _issue_token_pair(user, db, request)
    logger.info("[VERIFY] Phone verified + auto-login for user_id=%s", user.id)
    return tokens


async def send_otp(phone: str, purpose: str, db: Session) -> str:
    """Generates and sends a new OTP. Returns it only in local env."""
    user = db.query(User).filter(User.phone == phone, User.deleted_at == None).first()
    if not user:
        raise AuthException("No account found for this phone number.")

    otp = generate_otp()
    otp_record = OtpVerification(
        user_id=user.id,
        target=phone,
        otp_hash=hash_otp(otp),
        purpose=purpose,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
    )
    db.add(otp_record)
    db.commit()

    await send_otp_sms(phone, otp)
    return otp if settings.environment == "local" else ""


def _check_lockout(user: User, db: Session) -> None:
    """Locks the account out for LOCKOUT_MINUTES after MAX_FAILED_LOGIN_ATTEMPTS
    consecutive failures. Uses LoginHistory (not a new column) to find out
    whether the lockout window has already elapsed."""
    if (user.failed_login_attempts or 0) < MAX_FAILED_LOGIN_ATTEMPTS:
        return
    last_attempt = db.query(LoginHistory).filter(
        LoginHistory.user_id == user.id,
    ).order_by(LoginHistory.created_at.desc()).first()
    if not last_attempt:
        return
    elapsed = datetime.now(timezone.utc) - last_attempt.created_at.replace(tzinfo=timezone.utc)
    if elapsed < timedelta(minutes=LOCKOUT_MINUTES):
        minutes_left = max(1, LOCKOUT_MINUTES - int(elapsed.total_seconds() // 60))
        raise AuthException(
            f"Too many failed attempts. Try again in {minutes_left} minute"
            f"{'s' if minutes_left != 1 else ''}, or reset your password."
        )
    # Lockout window has elapsed — give the account a clean slate.
    user.failed_login_attempts = 0


def login_user(phone: str, password: str, db: Session, request: Request | None = None) -> TokenResponse:
    """Authenticates user and returns a JWT token pair."""
    any_user = db.query(User).filter(
        User.phone == phone,
        User.deleted_at == None,
    ).first()

    if any_user:
        # Lockout applies regardless of which password was entered, so a locked-out
        # account is told why immediately rather than just getting "incorrect password".
        _check_lockout(any_user, db)

    if any_user and verify_password(password, any_user.password_hash):
        # status checks must come before the generic "pending approval" message —
        # suspend/ban also flips is_active=False, so order determines which message wins.
        if any_user.status == "suspended":
            raise AuthException(
                "Your account has been suspended."
                + (f" Reason: {any_user.status_reason}" if any_user.status_reason else "")
                + " Contact support if you believe this is a mistake."
            )
        if any_user.status == "banned":
            raise AuthException("This account has been permanently banned and cannot sign in.")
        if not any_user.is_active:
            # The only remaining way an employer ends up here is a manual admin
            # rejection/revocation — registration itself no longer blocks login.
            raise AuthException(
                "Your account access has been revoked. Contact support for details."
            )

    user = db.query(User).filter(
        User.phone == phone,
        User.is_active == True,
        User.deleted_at == None,
    ).first()

    if not user or not user.password_hash or not verify_password(password, user.password_hash):
        if any_user:
            _record_login(any_user, db, request, success=False, failure_reason="bad_password")
            db.commit()
        raise AuthException("Incorrect phone number or password.")

    user.last_login_at = datetime.now(timezone.utc)
    _audit(db, "user_login", user_id=user.id, resource="auth", request=request)

    twofa = db.query(TwoFactorCredential).filter(
        TwoFactorCredential.user_id == user.id, TwoFactorCredential.is_enabled == True,
    ).first()
    if twofa:
        # Password is correct — record that much now since _issue_token_pair
        # (which normally does this) won't run until /2fa/verify-login succeeds.
        _record_login(user, db, request, success=True)
        db.commit()
        logger.info("[LOGIN] user_id=%s password OK, awaiting 2FA code", user.id)
        return TokenResponse(requires_2fa=True, challenge_token=create_2fa_challenge_token(str(user.id)))

    tokens = _issue_token_pair(user, db, request)
    logger.info("[LOGIN] user_id=%s", user.id)
    return tokens


def verify_login_2fa(challenge_token: str, code: str, db: Session, request: Request | None = None) -> TokenResponse:
    """Second step of login when 2FA is enabled — exchanges a valid challenge
    token + TOTP/backup code for a real token pair."""
    from jose import JWTError
    try:
        user_id = decode_2fa_challenge_token(challenge_token)
    except JWTError:
        raise AuthException("This 2FA challenge has expired. Please log in again.")

    user = db.query(User).filter(User.id == user_id, User.is_active == True, User.deleted_at == None).first()
    if not user:
        raise AuthException("User not found.")

    twofa = db.query(TwoFactorCredential).filter(
        TwoFactorCredential.user_id == user.id, TwoFactorCredential.is_enabled == True,
    ).first()
    if not twofa:
        raise AuthException("Two-factor authentication is not enabled on this account.")

    secret = totp_core.decrypt_secret(twofa.secret_encrypted)
    if totp_core.verify_totp_code(secret, code):
        tokens = _issue_token_pair(user, db, request)
        _audit(db, "user_login_2fa", user_id=user.id, resource="auth", request=request)
        logger.info("[LOGIN-2FA] user_id=%s verified via TOTP", user.id)
        return tokens

    remaining = totp_core.consume_backup_code(code, twofa.backup_codes_hash or [])
    if remaining is not None:
        twofa.backup_codes_hash = remaining
        db.commit()
        tokens = _issue_token_pair(user, db, request)
        _audit(db, "user_login_2fa_backup_code", user_id=user.id, resource="auth", request=request)
        logger.info("[LOGIN-2FA] user_id=%s verified via backup code, %d remaining", user.id, len(remaining))
        return tokens

    raise AuthException("Invalid 2FA code.")


def get_2fa_status(user: User, db: Session) -> TwoFactorStatusResponse:
    twofa = db.query(TwoFactorCredential).filter(TwoFactorCredential.user_id == user.id).first()
    return TwoFactorStatusResponse(is_enabled=bool(twofa and twofa.is_enabled))


def setup_2fa(user: User, db: Session) -> TwoFactorSetupResponse:
    """Generates a new secret (not yet active) and its QR code. Calling this
    again before /enable just overwrites the pending secret — fine, since
    nothing is active until the code is verified."""
    secret = totp_core.generate_secret()
    label = user.email or user.phone or str(user.id)

    existing = db.query(TwoFactorCredential).filter(TwoFactorCredential.user_id == user.id).first()
    if existing:
        existing.secret_encrypted = totp_core.encrypt_secret(secret)
        existing.is_enabled = False
        existing.backup_codes_hash = None
    else:
        db.add(TwoFactorCredential(user_id=user.id, secret_encrypted=totp_core.encrypt_secret(secret), is_enabled=False))
    db.commit()

    return TwoFactorSetupResponse(secret=secret, qr_code_data_uri=totp_core.build_qr_code_data_uri(secret, label))


def enable_2fa(user: User, code: str, db: Session) -> TwoFactorEnableResponse:
    twofa = db.query(TwoFactorCredential).filter(TwoFactorCredential.user_id == user.id).first()
    if not twofa:
        raise BadRequestException("Call /auth/2fa/setup first to generate a secret.")
    if twofa.is_enabled:
        raise BadRequestException("Two-factor authentication is already enabled.")

    secret = totp_core.decrypt_secret(twofa.secret_encrypted)
    if not totp_core.verify_totp_code(secret, code):
        raise AuthException("Invalid code. Please check your authenticator app and try again.")

    backup_codes = totp_core.generate_backup_codes()
    twofa.is_enabled = True
    twofa.enabled_at = datetime.now(timezone.utc)
    twofa.backup_codes_hash = totp_core.hash_backup_codes(backup_codes)
    db.commit()
    logger.info("[2FA] enabled for user_id=%s", user.id)

    return TwoFactorEnableResponse(
        message="Two-factor authentication is now enabled.",
        backup_codes=backup_codes,
    )


def disable_2fa(user: User, password: str, db: Session) -> MessageResponse:
    if not user.password_hash or not verify_password(password, user.password_hash):
        raise AuthException("Incorrect password.")

    db.query(TwoFactorCredential).filter(TwoFactorCredential.user_id == user.id).delete()
    db.commit()
    logger.info("[2FA] disabled for user_id=%s", user.id)
    return MessageResponse(message="Two-factor authentication has been disabled.")


def refresh_tokens(raw_refresh_token: str, db: Session, request: Request | None = None) -> TokenResponse:
    """Rotates refresh token and issues a new access + refresh pair."""
    token_hash = hash_token(raw_refresh_token)
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()

    if not db_token:
        raise AuthException("Invalid refresh token.")

    if not db_token.is_valid:
        db.query(RefreshToken).filter(RefreshToken.user_id == db_token.user_id).delete()
        db.commit()
        raise AuthException("Refresh token reuse detected. Please log in again.")

    user = db.query(User).filter(
        User.id == db_token.user_id,
        User.is_active == True,
        User.deleted_at == None,
    ).first()
    if not user:
        raise AuthException("User not found.")

    db_token.revoked_at = datetime.now(timezone.utc)
    db.flush()

    return _issue_token_pair(user, db, request)


def logout_user(raw_refresh_token: str, db: Session) -> None:
    """Revokes the given refresh token."""
    token_hash = hash_token(raw_refresh_token)
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if db_token:
        db_token.revoked_at = datetime.now(timezone.utc)
        db.commit()


def _get_employer_role(db: Session) -> Role:
    role = db.query(Role).filter(Role.name == "employer").first()
    if not role:
        raise Exception("Role 'employer' not seeded in database. Run migrations.")
    return role


async def register_employer(
    phone: str,
    password: str,
    company_name: str,
    industry: str | None,
    company_size: str | None,
    contact_person: str | None,
    city: str | None,
    website: str | None,
    gst_number: str | None,
    designation: str | None,
    description: str | None,
    db: Session,
    request: Request | None = None,
) -> EmployerRegisterResponse:
    """Creates an employer account + profile. Account is active immediately
    (instant access, like LinkedIn/Naukri) — job posting itself is gated
    separately on profile completion + KYC verification, not account access."""
    existing = db.query(User).filter(User.phone == phone, User.deleted_at == None).first()
    if existing:
        raise ConflictException("An account with this phone number already exists.")

    role = _get_employer_role(db)
    user = User(
        phone=phone,
        password_hash=hash_password(password),
        preferred_language="en",
        role_id=role.id,
        is_active=True,
    )
    db.add(user)
    db.flush()

    # Every employer needs a Company row to back the post-login setup wizard
    # and team-management features — without it, _get_company_or_404() would
    # 404 the moment this employer tries to update their profile.
    company = Company(
        name=company_name,
        industry=industry,
        company_size=company_size,
        website=website,
        description=description,
    )
    db.add(company)
    db.flush()

    profile = EmployerProfile(
        user_id=user.id,
        company_name=company_name,
        industry=industry,
        company_size=company_size,
        website=website,
        gst_number=gst_number,
        contact_person=contact_person,
        designation=designation,
        city=city,
        description=description,
        company_id=company.id,
        is_owner=True,
    )
    db.add(profile)

    otp = generate_otp()
    otp_record = OtpVerification(
        user_id=user.id,
        target=phone,
        otp_hash=hash_otp(otp),
        purpose="register",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
    )
    db.add(otp_record)
    _audit(db, "employer_registered", user_id=user.id, resource="user",
           resource_id=user.id, request=request)
    db.commit()
    db.refresh(profile)

    await send_otp_sms(phone, otp)
    logger.info("[EMPLOYER-REGISTER] company=%s phone=%s", company_name, phone)

    return EmployerRegisterResponse(
        message="Company account created. Please verify your phone to log in.",
        user=UserResponse.from_user(user),
        employer_profile=EmployerProfileResponse(
            id=str(profile.id),
            company_name=profile.company_name,
            industry=profile.industry,
            company_size=profile.company_size,
            website=profile.website,
            contact_person=profile.contact_person,
            city=profile.city,
            is_approved=profile.is_approved,
        ),
        dev_otp=otp if settings.environment == "local" else None,
    )


def verify_employer_phone(phone: str, otp: str, db: Session, request: Request | None = None) -> TokenResponse:
    """Verifies OTP for employer and auto-logs in — account access is instant,
    same as aspirants. Job posting itself stays gated on profile + KYC verification."""
    user = db.query(User).filter(User.phone == phone, User.deleted_at == None).first()
    if not user:
        raise AuthException("No account found for this phone number.")

    otp_record = (
        db.query(OtpVerification)
        .filter(
            OtpVerification.user_id == user.id,
            OtpVerification.purpose == "register",
            OtpVerification.used_at == None,
        )
        .order_by(OtpVerification.created_at.desc())
        .first()
    )

    if not otp_record:
        raise BadRequestException("No active OTP found. Please request a new one.")
    if otp_record.is_expired:
        raise OtpExpiredException()
    if not verify_otp(otp, otp_record.otp_hash):
        raise OtpInvalidException()

    otp_record.used_at = datetime.now(timezone.utc)
    user.phone_verified = True
    user.last_login_at = datetime.now(timezone.utc)
    _audit(db, "employer_phone_verified_and_logged_in", user_id=user.id, resource="user",
           resource_id=user.id, request=request)

    tokens = _issue_token_pair(user, db, request)
    logger.info("[EMPLOYER-VERIFY] phone verified, auto-logged in for user_id=%s", user.id)
    return tokens


def google_login(credential: str, db: Session, request: Request | None = None) -> TokenResponse:
    """Verifies a Google ID token, creates account if new, returns JWT token pair."""
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    try:
        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError as e:
        logger.warning("[GOOGLE-LOGIN] Token verification failed: %s", e)
        raise AuthException("Invalid Google token. Please try again.")

    google_id = idinfo["sub"]
    email = idinfo.get("email")

    user = db.query(User).filter(User.google_id == google_id, User.deleted_at == None).first()

    if not user and email:
        # Link Google to an existing account that shares the same email
        user = db.query(User).filter(User.email == email, User.deleted_at == None).first()
        if user:
            user.google_id = google_id

    if not user:
        # New user — create aspirant account
        role = _get_aspirant_role(db)
        user = User(
            google_id=google_id,
            email=email,
            email_verified=True,
            phone_verified=False,
            preferred_language="en",
            role_id=role.id,
            is_active=True,
        )
        db.add(user)
        db.flush()
        _audit(db, "google_register", user_id=user.id, resource="user",
               resource_id=user.id, request=request)
        logger.info("[GOOGLE-LOGIN] New user created via Google: email=%s", email)

    if not user.is_active:
        raise AuthException("Your account has been deactivated.")

    user.last_login_at = datetime.now(timezone.utc)
    _audit(db, "google_login", user_id=user.id, resource="auth", request=request)

    return _issue_token_pair(user, db, request)


async def request_password_reset(phone: str, db: Session) -> str:
    """Sends a reset OTP to the phone. Returns dev_otp in local env."""
    user = db.query(User).filter(User.phone == phone, User.deleted_at == None, User.is_active == True).first()
    if not user:
        raise AuthException("No active account found for this phone number.")

    otp = generate_otp()
    otp_record = OtpVerification(
        user_id=user.id,
        target=phone,
        otp_hash=hash_otp(otp),
        purpose="reset",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
    )
    db.add(otp_record)
    db.commit()

    await send_otp_sms(phone, otp)
    logger.info("[RESET] Password reset OTP sent for phone=%s", phone)
    return otp if settings.environment == "local" else ""


def reset_password(phone: str, otp: str, new_password: str, db: Session) -> None:
    """Verifies reset OTP and updates the user's password."""
    user = db.query(User).filter(User.phone == phone, User.deleted_at == None, User.is_active == True).first()
    if not user:
        raise AuthException("No active account found for this phone number.")

    otp_record = (
        db.query(OtpVerification)
        .filter(
            OtpVerification.user_id == user.id,
            OtpVerification.purpose == "reset",
            OtpVerification.used_at == None,
        )
        .order_by(OtpVerification.created_at.desc())
        .first()
    )

    if not otp_record:
        raise BadRequestException("No active reset OTP found. Please request a new one.")
    if otp_record.is_expired:
        raise OtpExpiredException()
    if not verify_otp(otp, otp_record.otp_hash):
        raise OtpInvalidException()

    otp_record.used_at = datetime.now(timezone.utc)
    user.password_hash = hash_password(new_password)
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"revoked_at": datetime.now(timezone.utc)})
    db.commit()
    logger.info("[RESET] Password reset successfully for user_id=%s", user.id)
