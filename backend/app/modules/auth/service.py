import logging
from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.exceptions import (
    AuthException,
    BadRequestException,
    ConflictException,
    OtpExpiredException,
    OtpInvalidException,
)
from app.core.security import (
    create_access_token,
    generate_otp,
    generate_raw_refresh_token,
    hash_otp,
    hash_password,
    hash_token,
    verify_otp,
    verify_password,
)
from app.models.user import (
    AuditLog,
    EmployerProfile,
    OtpVerification,
    RefreshToken,
    Role,
    User,
)
from app.modules.auth.schemas import (
    EmployerProfileResponse,
    EmployerRegisterResponse,
    MessageResponse,
    TokenResponse,
    UserResponse,
)

settings = get_settings()
logger = logging.getLogger(__name__)

OTP_TTL_MINUTES = 10


def _build_token_payload(user: User) -> dict:
    return {"sub": str(user.id), "role": user.role_name, "lang": user.preferred_language}


def _issue_token_pair(user: User, db: Session, request: Request | None = None) -> TokenResponse:
    payload = _build_token_payload(user)
    access_token = create_access_token(payload)

    raw_refresh = generate_raw_refresh_token()

    db_token = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expire_days),
        issued_ip=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
    )
    db.add(db_token)
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

def register_user(phone: str, password: str, preferred_language: str, db: Session, request: Request | None = None) -> str:
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

    logger.info(f"[REGISTER] New user phone={phone}, OTP sent (dev_otp={otp if settings.environment == 'local' else '***'})")

    # In production this triggers MSG91 SMS. In local, we return the OTP.
    if settings.environment != "local":
        _send_sms_otp(phone, otp)

    return otp if settings.environment == "local" else ""


def verify_phone(phone: str, otp: str, db: Session, request: "Request | None" = None) -> "TokenResponse":
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
    logger.info(f"[VERIFY] Phone verified + auto-login for user_id={user.id}")
    return tokens


def send_otp(phone: str, purpose: str, db: Session) -> str:
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

    if settings.environment != "local":
        _send_sms_otp(phone, otp)

    return otp if settings.environment == "local" else ""


def login_user(phone: str, password: str, db: Session, request: Request | None = None) -> TokenResponse:
    """Authenticates user and returns a JWT token pair."""
    # First check without is_active filter to give specific error for pending employers
    any_user = db.query(User).filter(
        User.phone == phone,
        User.deleted_at == None,
    ).first()

    if any_user and not any_user.is_active and verify_password(password, any_user.password_hash):
        # Credentials are correct but account is inactive — give a helpful message
        raise AuthException(
            "Your employer account is pending admin approval. "
            "You'll receive an SMS once your account is activated."
        )

    user = db.query(User).filter(
        User.phone == phone,
        User.is_active == True,
        User.deleted_at == None,
    ).first()

    if not user or not verify_password(password, user.password_hash):
        raise AuthException("Incorrect phone number or password.")

    user.last_login_at = datetime.now(timezone.utc)
    _audit(db, "user_login", user_id=user.id, resource="auth", request=request)

    tokens = _issue_token_pair(user, db, request)
    logger.info(f"[LOGIN] user_id={user.id} phone={phone}")
    return tokens


def refresh_tokens(raw_refresh_token: str, db: Session, request: Request | None = None) -> TokenResponse:
    """Rotates refresh token and issues a new access + refresh pair."""
    token_hash = hash_token(raw_refresh_token)
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()

    if not db_token:
        raise AuthException("Invalid refresh token.")

    if not db_token.is_valid:
        # Token reuse detected — revoke all tokens for this user (theft mitigation)
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

    # Revoke old token
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


def register_employer(
    phone: str,
    password: str,
    company_name: str,
    industry: str,
    company_size: str,
    contact_person: str,
    city: str,
    website: str | None,
    gst_number: str | None,
    designation: str | None,
    description: str | None,
    db: Session,
    request: Request | None = None,
) -> EmployerRegisterResponse:
    """Creates an employer account + profile. Account is inactive until admin approves."""
    existing = db.query(User).filter(User.phone == phone, User.deleted_at == None).first()
    if existing:
        raise ConflictException("An account with this phone number already exists.")

    role = _get_employer_role(db)
    user = User(
        phone=phone,
        password_hash=hash_password(password),
        preferred_language="en",
        role_id=role.id,
        is_active=False,  # Inactive until admin approves
    )
    db.add(user)
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

    logger.info(f"[EMPLOYER-REGISTER] company={company_name} phone={phone}")

    if settings.environment != "local":
        _send_sms_otp(phone, otp)

    return EmployerRegisterResponse(
        message="Company account created. Please verify your phone, then await admin approval before logging in.",
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


def verify_employer_phone(phone: str, otp: str, db: Session, request: Request | None = None) -> MessageResponse:
    """Verifies OTP for employer — does NOT auto-login (account needs admin approval first)."""
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
    _audit(db, "employer_phone_verified", user_id=user.id, resource="user",
           resource_id=user.id, request=request)
    db.commit()
    logger.info(f"[EMPLOYER-VERIFY] phone verified for user_id={user.id}, pending admin approval")
    return MessageResponse(message="Phone verified. Your account is pending admin approval. We'll notify you once approved.")


def request_password_reset(phone: str, db: Session) -> str:
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

    if settings.environment != "local":
        _send_sms_otp(phone, otp)

    logger.info(f"[RESET] Password reset OTP sent for phone={phone}")
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
    # Revoke all refresh tokens on password reset
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"revoked_at": datetime.now(timezone.utc)})
    db.commit()
    logger.info(f"[RESET] Password reset successfully for user_id={user.id}")


def _send_sms_otp(phone: str, otp: str) -> None:
    """Production SMS dispatch via MSG91. Placeholder for Phase 1."""
    # TODO: integrate MSG91 SDK
    logger.warning(f"[SMS] SMS sending not yet integrated. OTP for {phone}: {otp}")
