from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.captcha import verify_recaptcha
from app.core.rbac import get_current_user
from app.database import get_db
from app.models.user import User
from app.modules.auth import service
from app.modules.auth.schemas import (
    ChangePasswordRequest, EmployerRegisterRequest, EmployerRegisterResponse,
    ForgotPasswordRequest, ResetPasswordRequest,
    GoogleLoginRequest, LoginRequest, MessageResponse, RefreshRequest,
    RegisterRequest, SendOtpRequest, TokenResponse,
    UserResponse, VerifyPhoneRequest,
    TwoFactorDisableRequest, TwoFactorEnableRequest, TwoFactorEnableResponse,
    TwoFactorSetupResponse, TwoFactorStatusResponse, TwoFactorVerifyLoginRequest,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
limiter = Limiter(key_func=get_remote_address)
_settings = get_settings()


def _dev_otp(otp: str | None) -> str | None:
    """Return the OTP only in local development. Belt-and-suspenders guard —
    the service layer already filters this, but we enforce it here too so no
    code path can accidentally leak a live OTP into a production response."""
    return otp if _settings.environment == "local" else None


@router.post("/register", response_model=MessageResponse, status_code=201)
@limiter.limit("5/minute;10/hour")
async def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    try:
        await verify_recaptcha(body.recaptcha_token, "register")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    dev_otp = await service.register_user(
        phone=body.phone,
        email=body.email,
        password=body.password,
        preferred_language=body.preferred_language,
        db=db,
        request=request,
    )
    return MessageResponse(
        message="Account created. Please verify your phone number with the OTP sent.",
        dev_otp=_dev_otp(dev_otp),
    )


@router.post("/verify-phone", response_model=TokenResponse)
@limiter.limit("5/minute")
def verify_phone(body: VerifyPhoneRequest, request: Request, db: Session = Depends(get_db)):
    return service.verify_phone(phone=body.phone, otp=body.otp, db=db, request=request)


@router.post("/send-otp", response_model=MessageResponse)
@limiter.limit("3/minute;5/hour")
async def send_otp(body: SendOtpRequest, request: Request, db: Session = Depends(get_db)):
    dev_otp = await service.send_otp(phone=body.phone, purpose=body.purpose, db=db)
    return MessageResponse(
        message="OTP sent successfully.",
        dev_otp=_dev_otp(dev_otp),
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute;30/hour")
async def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    try:
        await verify_recaptcha(body.recaptcha_token, "login")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return service.login_user(identifier=body.identifier, password=body.password, db=db, request=request)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
def refresh(body: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    return service.refresh_tokens(
        raw_refresh_token=body.refresh_token, db=db, request=request
    )


@router.post("/logout", response_model=MessageResponse)
def logout(
    body: RefreshRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db),
):
    service.logout_user(raw_refresh_token=body.refresh_token, db=db)
    # Immediately blacklist the current access token so it can't be reused
    if credentials:
        from app.core.security import blacklist_access_token
        blacklist_access_token(credentials.credentials)
    return MessageResponse(message="Logged out successfully.")


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse.from_user(current_user)


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("3/minute;5/hour")
async def forgot_password(body: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    try:
        await verify_recaptcha(body.recaptcha_token, "forgot_password")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    dev_otp = await service.request_password_reset(phone=body.phone, db=db)
    return MessageResponse(
        message="OTP sent to your phone. Use it to reset your password.",
        dev_otp=_dev_otp(dev_otp),
    )


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("5/minute")
def reset_password(body: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    service.reset_password(phone=body.phone, otp=body.otp, new_password=body.new_password, db=db)
    return MessageResponse(message="Password reset successfully. You can now log in.")


@router.post("/register/employer", response_model=EmployerRegisterResponse, status_code=201)
@limiter.limit("5/minute;10/hour")
async def register_employer(body: EmployerRegisterRequest, request: Request, db: Session = Depends(get_db)):
    try:
        await verify_recaptcha(body.recaptcha_token, "employer_register")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await service.register_employer(
        phone=body.phone,
        password=body.password,
        company_name=body.company_name,
        industry=body.industry,
        company_size=body.company_size,
        contact_person=body.contact_person,
        city=body.city,
        website=body.website,
        gst_number=body.gst_number,
        designation=body.designation,
        description=body.description,
        db=db,
        request=request,
    )


@router.post("/google", response_model=TokenResponse)
@limiter.limit("20/minute")
def google_login(body: GoogleLoginRequest, request: Request, db: Session = Depends(get_db)):
    return service.google_login(credential=body.credential, db=db, request=request)


@router.post("/verify-phone/employer", response_model=TokenResponse)
@limiter.limit("5/minute")
def verify_employer_phone(body: VerifyPhoneRequest, request: Request, db: Session = Depends(get_db)):
    return service.verify_employer_phone(phone=body.phone, otp=body.otp, db=db, request=request)


# ── Two-factor authentication ─────────────────────────────────────────────────

@router.post("/2fa/verify-login", response_model=TokenResponse)
@limiter.limit("10/minute")
def verify_login_2fa(body: TwoFactorVerifyLoginRequest, request: Request, db: Session = Depends(get_db)):
    return service.verify_login_2fa(challenge_token=body.challenge_token, code=body.code, db=db, request=request)


@router.get("/2fa/status", response_model=TwoFactorStatusResponse)
def get_2fa_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_2fa_status(current_user, db)


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
@limiter.limit("5/minute")
def setup_2fa(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.setup_2fa(current_user, db)


@router.post("/2fa/enable", response_model=TwoFactorEnableResponse)
@limiter.limit("5/minute")
def enable_2fa(body: TwoFactorEnableRequest, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.enable_2fa(current_user, body.code, db)


@router.post("/2fa/disable", response_model=MessageResponse)
@limiter.limit("5/minute")
def disable_2fa(body: TwoFactorDisableRequest, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.disable_2fa(current_user, body.password, db)


@router.post("/change-password", response_model=MessageResponse)
@limiter.limit("5/minute")
def change_password(body: ChangePasswordRequest, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.change_password(current_user, body.current_password, body.new_password, db)


# ── Email verification ────────────────────────────────────────────────────────

@router.post("/send-email-verification", response_model=MessageResponse)
@limiter.limit("3/minute;10/hour")
async def send_email_verification(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await service.send_email_verification(current_user, db)


@router.get("/verify-email", response_model=MessageResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    return service.verify_email_token(token, db)
