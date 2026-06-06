from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.rbac import get_current_user
from app.database import get_db
from app.models.user import User
from app.modules.auth import service
from app.modules.auth.schemas import (
    EmployerRegisterRequest, EmployerRegisterResponse,
    ForgotPasswordRequest, ResetPasswordRequest,
    LoginRequest, MessageResponse, RefreshRequest,
    RegisterRequest, SendOtpRequest, TokenResponse,
    UserResponse, VerifyPhoneRequest,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=MessageResponse, status_code=201)
def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    dev_otp = service.register_user(
        phone=body.phone,
        password=body.password,
        preferred_language=body.preferred_language,
        db=db,
        request=request,
    )
    return MessageResponse(
        message="Account created. Please verify your phone number with the OTP sent.",
        dev_otp=dev_otp or None,
    )


@router.post("/verify-phone", response_model=TokenResponse)
def verify_phone(body: VerifyPhoneRequest, request: Request, db: Session = Depends(get_db)):
    return service.verify_phone(phone=body.phone, otp=body.otp, db=db, request=request)


@router.post("/send-otp", response_model=MessageResponse)
def send_otp(body: SendOtpRequest, db: Session = Depends(get_db)):
    dev_otp = service.send_otp(phone=body.phone, purpose=body.purpose, db=db)
    return MessageResponse(
        message="OTP sent successfully.",
        dev_otp=dev_otp or None,
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    return service.login_user(phone=body.phone, password=body.password, db=db, request=request)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    return service.refresh_tokens(
        raw_refresh_token=body.refresh_token, db=db, request=request
    )


@router.post("/logout", response_model=MessageResponse)
def logout(body: RefreshRequest, db: Session = Depends(get_db)):
    service.logout_user(raw_refresh_token=body.refresh_token, db=db)
    return MessageResponse(message="Logged out successfully.")


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse.from_user(current_user)


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    dev_otp = service.request_password_reset(phone=body.phone, db=db)
    return MessageResponse(
        message="OTP sent to your phone. Use it to reset your password.",
        dev_otp=dev_otp or None,
    )


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    service.reset_password(phone=body.phone, otp=body.otp, new_password=body.new_password, db=db)
    return MessageResponse(message="Password reset successfully. You can now log in.")


@router.post("/register/employer", response_model=EmployerRegisterResponse, status_code=201)
def register_employer(body: EmployerRegisterRequest, request: Request, db: Session = Depends(get_db)):
    return service.register_employer(
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


@router.post("/verify-phone/employer", response_model=MessageResponse)
def verify_employer_phone(body: VerifyPhoneRequest, request: Request, db: Session = Depends(get_db)):
    return service.verify_employer_phone(phone=body.phone, otp=body.otp, db=db, request=request)
