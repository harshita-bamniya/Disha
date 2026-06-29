from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

_INSECURE_DEFAULTS = {
    "dev_secret_change_in_production_local_only",
    "dev_refresh_secret_change_in_production_only",
    "change_me_in_production",
    "change_me_in_production_minimum_32_chars",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "BeginablAI"
    environment: str = "local"
    log_level: str = "DEBUG"
    debug: bool = True

    # CORS — comma-separated list of allowed origins
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # File storage — local disk for now; swap for S3/GCS in production
    upload_dir: str = "uploads"

    # Database
    database_url: str = "postgresql://disha:disha_dev@postgres:5432/disha_db"
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30

    # Redis
    redis_url: str = "redis://:redis_dev@redis:6379/0"

    # JWT — MUST be set to strong random values in production
    jwt_secret_key: str = "dev_secret_change_in_production_local_only"
    jwt_refresh_secret_key: str = "dev_refresh_secret_change_in_production_only"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 30

    # AI providers
    groq_api_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # SMS (MSG91)
    msg91_api_key: str = ""
    msg91_template_id: str = ""
    msg91_sender_id: str = "BEGNBL"   # India DLT sender IDs must be exactly 6 alphanumeric chars

    # Email (Brevo SMTP relay — free tier: 300 emails/day)
    brevo_smtp_host: str = "smtp-relay.brevo.com"
    brevo_smtp_port: int = 587
    brevo_smtp_login: str = ""        # your Brevo account email
    brevo_smtp_key: str = ""          # Brevo SMTP key (not your account password)
    email_from_address: str = "no-reply@beginablai.in"
    email_from_name: str = "BeginablAI"

    # Google OAuth
    google_client_id: str = ""

    # CAPTCHA (Google reCAPTCHA v3) — verification no-ops until secret key is set
    recaptcha_site_key: str = ""    # public, safe to expose to frontend
    recaptcha_secret_key: str = ""  # server-side only, never expose

    # Monitoring
    sentry_dsn: str = ""

    @field_validator("jwt_secret_key", "jwt_refresh_secret_key", mode="before")
    @classmethod
    def _validate_jwt_secrets(cls, v: str, info) -> str:
        # Length check — weak secrets rejected everywhere, not just production
        if len(v) < 32:
            raise ValueError(
                f"{info.field_name} must be at least 32 characters. "
                "Generate one with: openssl rand -hex 32"
            )
        return v

    @model_validator(mode="after")
    def _block_insecure_in_production(self) -> "Settings":
        if self.environment == "production":
            for field in ("jwt_secret_key", "jwt_refresh_secret_key"):
                val = getattr(self, field)
                if val in _INSECURE_DEFAULTS or val.startswith("dev_"):
                    raise ValueError(
                        f"{field} must be changed from the default before running in production. "
                        "Generate one with: openssl rand -hex 32"
                    )
            if not self.groq_api_key and not self.anthropic_api_key:
                raise ValueError("At least one AI provider key (GROQ_API_KEY or ANTHROPIC_API_KEY) must be set in production.")
        return self

    def get_allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
