from pydantic import BaseModel, Field, field_validator
import re


# ── Request schemas ───────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    phone: str
    password: str
    preferred_language: str = "hi"
    recaptcha_token: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"\D", "", v)
        if cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = cleaned[2:]
        if not re.match(r"^[6-9]\d{9}$", cleaned):
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return cleaned

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        errors = []
        if len(v) < 8:
            errors.append("at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must not exceed 128 characters")
        if not re.search(r"[A-Z]", v):
            errors.append("one uppercase letter")
        if not re.search(r"[a-z]", v):
            errors.append("one lowercase letter")
        if not re.search(r"\d", v):
            errors.append("one number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            errors.append("one special character (!@#$%^&*...)")
        if errors:
            raise ValueError("Password must contain: " + ", ".join(errors))
        return v

    @field_validator("preferred_language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        if v not in ("en", "hi"):
            raise ValueError("Language must be 'en' or 'hi'")
        return v


class LoginRequest(BaseModel):
    phone: str
    password: str
    recaptcha_token: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"\D", "", v)
        if cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = cleaned[2:]
        return cleaned


class VerifyPhoneRequest(BaseModel):
    phone: str
    otp: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"\D", "", v)
        if cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = cleaned[2:]
        return cleaned

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        if not re.match(r"^\d{6}$", v):
            raise ValueError("OTP must be 6 digits")
        return v


class SendOtpRequest(BaseModel):
    phone: str
    purpose: str = "register"

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"\D", "", v)
        if cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = cleaned[2:]
        return cleaned

    @field_validator("purpose")
    @classmethod
    def validate_purpose(cls, v: str) -> str:
        if v not in ("register", "login", "reset", "verify"):
            raise ValueError("Invalid OTP purpose")
        return v


class EmployerRegisterRequest(BaseModel):
    """Minimal employer signup — everything else (industry, size, contact
    person, GST, branding, verification docs) is collected later via the
    post-login setup wizard, which every step of can be skipped."""
    phone: str
    password: str
    company_name: str
    industry: str | None = None
    company_size: str | None = None
    contact_person: str | None = None
    city: str | None = None
    website: str | None = None
    gst_number: str | None = None
    designation: str | None = None
    description: str | None = None
    recaptcha_token: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"\D", "", v)
        if cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = cleaned[2:]
        if not re.match(r"^[6-9]\d{9}$", cleaned):
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return cleaned

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        errors = []
        if len(v) < 8:
            errors.append("at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must not exceed 128 characters")
        if not re.search(r"[A-Z]", v):
            errors.append("one uppercase letter")
        if not re.search(r"[a-z]", v):
            errors.append("one lowercase letter")
        if not re.search(r"\d", v):
            errors.append("one number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            errors.append("one special character (!@#$%^&*...)")
        if errors:
            raise ValueError("Password must contain: " + ", ".join(errors))
        return v

    @field_validator("company_size")
    @classmethod
    def validate_company_size(cls, v: str | None) -> str | None:
        if v is None:
            return v
        valid = {"1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"}
        if v not in valid:
            raise ValueError(f"company_size must be one of: {', '.join(sorted(valid))}")
        return v

    @field_validator("company_name")
    @classmethod
    def non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("This field cannot be blank")
        return v.strip()


class GoogleLoginRequest(BaseModel):
    credential: str  # Google ID token from the frontend


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    phone: str
    recaptcha_token: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"\D", "", v)
        if cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = cleaned[2:]
        return cleaned


class ResetPasswordRequest(BaseModel):
    phone: str
    otp: str
    new_password: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"\D", "", v)
        if cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = cleaned[2:]
        return cleaned

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        if not re.match(r"^\d{6}$", v):
            raise ValueError("OTP must be 6 digits")
        return v

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        errors = []
        if len(v) < 8:
            errors.append("at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must not exceed 128 characters")
        if not re.search(r"[A-Z]", v):
            errors.append("one uppercase letter")
        if not re.search(r"[a-z]", v):
            errors.append("one lowercase letter")
        if not re.search(r"\d", v):
            errors.append("one number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            errors.append("one special character (!@#$%^&*...)")
        if errors:
            raise ValueError("Password must contain: " + ", ".join(errors))
        return v


# ── Response schemas ──────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: str
    phone: str | None
    email: str | None
    role: str | None
    preferred_language: str
    phone_verified: bool
    email_verified: bool

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user) -> "UserResponse":
        return cls(
            id=str(user.id),
            phone=user.phone,
            email=user.email,
            role=user.role_name,
            preferred_language=user.preferred_language,
            phone_verified=user.phone_verified,
            email_verified=user.email_verified,
        )


class TokenResponse(BaseModel):
    # All three are optional ONLY for the 2FA-challenge branch of /auth/login,
    # where no tokens are issued yet — every other caller always sets them.
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    user: UserResponse | None = None
    requires_2fa: bool = False
    challenge_token: str | None = None


class MessageResponse(BaseModel):
    message: str
    # Only present in local/dev environment — never in production
    dev_otp: str | None = None


class EmployerProfileResponse(BaseModel):
    id: str
    company_name: str
    industry: str | None
    company_size: str | None
    website: str | None
    contact_person: str | None
    city: str | None
    is_approved: bool

    model_config = {"from_attributes": True}


class EmployerRegisterResponse(BaseModel):
    message: str
    user: UserResponse
    employer_profile: EmployerProfileResponse
    dev_otp: str | None = None


# ── Two-factor authentication (TOTP) ────────────────────────────────────────────

class TwoFactorStatusResponse(BaseModel):
    is_enabled: bool


class TwoFactorSetupResponse(BaseModel):
    """Step 1 of enrollment — secret is NOT yet active (is_enabled stays
    false) until the user proves they scanned it correctly via /2fa/enable."""
    secret: str                # manual-entry fallback if they can't scan
    qr_code_data_uri: str      # data:image/png;base64,... — render directly in an <img>


class TwoFactorEnableRequest(BaseModel):
    code: str = Field(..., pattern=r"^\d{6}$")


class TwoFactorEnableResponse(BaseModel):
    message: str
    backup_codes: list[str]    # shown ONCE — not retrievable again after this


class TwoFactorDisableRequest(BaseModel):
    password: str


class TwoFactorVerifyLoginRequest(BaseModel):
    challenge_token: str
    code: str = Field(..., min_length=6, max_length=9)  # 6-digit TOTP or XXXX-XXXX backup code


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        errors = []
        if len(v) < 8:
            errors.append("at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must not exceed 128 characters")
        if not re.search(r"[A-Z]", v):
            errors.append("one uppercase letter")
        if not re.search(r"[a-z]", v):
            errors.append("one lowercase letter")
        if not re.search(r"\d", v):
            errors.append("one number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            errors.append("one special character (!@#$%^&*...)")
        if errors:
            raise ValueError("Password must contain: " + ", ".join(errors))
        return v
