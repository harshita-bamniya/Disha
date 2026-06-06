from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "DISHA AI"
    environment: str = "local"
    log_level: str = "DEBUG"
    debug: bool = True

    # Database
    database_url: str = "postgresql://disha:disha_dev@postgres:5432/disha_db"

    # Redis
    redis_url: str = "redis://:redis_dev@redis:6379/0"

    # JWT
    jwt_secret_key: str = "dev_secret_change_in_production"
    jwt_refresh_secret_key: str = "dev_refresh_secret_change_in_production"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 30

    # AI providers
    groq_api_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # SMS
    msg91_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
