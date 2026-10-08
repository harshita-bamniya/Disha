from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_DEFAULTS = {
    "dev_secret_change_in_production_local_only",
    "dev_refresh_secret_change_in_production_only",
    "change_me_in_production",
    "change_me_in_production_minimum_32_chars",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "BeginablAI"
    environment: str = "local"
    log_level: str = "DEBUG"
    debug: bool = True

    # CORS — comma-separated list of allowed origins
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # File storage — local disk for now; swap for S3/GCS in production
    upload_dir: str = "uploads"

    # ClamAV — virus scanning for uploaded documents (resumes, KYC files).
    # Empty host = scanning disabled, uploads proceed unscanned (same
    # graceful-degradation pattern as Brevo/reCAPTCHA below). Set CLAMAV_HOST
    # once the clamav container/service is reachable to enable real scanning.
    clamav_host: str = ""
    clamav_port: int = 3310

    # Database
    database_url: str = "postgresql://beginablai:beginablai_dev@postgres:5432/beginablai_db"
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
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite"
    # When true, roadmaps are only generated from blueprints an expert has marked reviewed.
    roadmap_require_reviewed_blueprint: bool = False
    # Stored resume-vs-job scans (parsed resume profile + report) are deleted after this many days. 0 disables the purge.
    resume_match_retention_days: int = 180
    # Which provider the roadmap engine tries first: "groq" or "gemini". The other is the automatic
    # failover on rate limits / 413 / 5xx. Flip via ROADMAP_LLM_PRIMARY in .env without a code change.
    roadmap_llm_primary: str = "groq"
    # Model for the heavy, once-per-role blueprint drafting. The cheap default (gemini_model) drafted
    # 6 coarse skills where 12-16 were required, so drafting gets a stronger model.
    gemini_strong_model: str = "gemini-3.8-flash"
    # Tried in order when the strong model hits its (free-tier, per-model) daily cap. Each model has its
    # own quota. For production, enable billing on the Google AI project instead of relying on this.
    gemini_strong_fallback_models: str = "gemini-3.7-flash,gemini-2.5-flash"
    openai_api_key: str = ""

    # AI interview voice. Server-side speech-to-text uses Groq Whisper (falls back to Gemini audio
    # input), text-to-speech uses Gemini TTS. With none of these keys set, the interview uses the
    # browser's own speech recognition/synthesis instead. Model names are config so a vendor rename
    # is an .env change, not a code change.
    interview_stt_groq_model: str = "whisper-large-v3-turbo"
    interview_stt_gemini_model: str = ""          # empty = use gemini_model
    # Fastest first (~4 s for a sentence vs ~6 s on the old preview model). Each model has its own
    # rate-limit quota, so a 429 on one moves on to the next instead of dropping to the browser voice.
    interview_tts_gemini_model: str = "gemini-3.8-flash-lite-tts"
    interview_tts_gemini_fallback_models: str = "gemini-3.8-flash-tts,gemini-2.5-flash-preview-tts"
    interview_tts_voice: str = "Kore"
    interview_max_audio_mb: int = 10
    interview_tts_max_chars: int = 800
    interview_tts_calls_per_session: int = 80
    # Answer audio is only kept when the candidate opts in; it is deleted after this many days.
    interview_audio_retention_days: int = 30
    # Verified (employer-shared) interviews are deleted after this many days.
    verified_interview_retention_days: int = 180

    # YouTube Data API v3 (roadmap video ranking). Optional: without it the
    # video library falls back to yt-dlp search, which has no likes/subscriber data.
    youtube_api_key: str = ""

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

    # Google OAuth (login)
    google_client_id: str = ""

    # Google Calendar OAuth (separate client for Calendar API scope)
    google_calendar_client_id: str = ""
    google_calendar_client_secret: str = ""
    google_calendar_redirect_uri: str = "http://localhost:8000/api/auth/google/calendar/callback"

    # CAPTCHA (Google reCAPTCHA v3) — verification no-ops until secret key is set
    recaptcha_site_key: str = ""    # public, safe to expose to frontend
    recaptcha_secret_key: str = ""  # server-side only, never expose

    # Monitoring
    sentry_dsn: str = ""

    # Payments (Razorpay) — empty = payments disabled, checkout endpoints
    # return 503 (same graceful-degradation pattern as clamav_host/brevo_smtp_key).
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

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
            if not self.sentry_dsn:
                raise ValueError("SENTRY_DSN must be set in production for error monitoring.")
            if not (self.razorpay_key_id and self.razorpay_key_secret and self.razorpay_webhook_secret):
                raise ValueError(
                    "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET must all be set in production."
                )
        return self

    def get_allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    def uses_real_email(self) -> bool:
        """True once Brevo SMTP credentials are configured — mirrors
        get_email_provider()'s own check in app/core/email.py. Used to hide
        the dev-mode OTP (which exists so you can register without a real
        inbox) once real emails are actually going out, so it doesn't linger
        just because ENVIRONMENT is still 'local'."""
        return bool(self.brevo_smtp_login and self.brevo_smtp_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
