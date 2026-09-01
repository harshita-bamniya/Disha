"""Admin platform management APIs — Phase 3.

Routes (all require admin role):
  GET  /api/admin/platform/settings           → list all platform settings
  PUT  /api/admin/platform/settings/{key}     → update a setting value
  GET  /api/admin/platform/flags              → list all feature flags
  PUT  /api/admin/platform/flags/{flag_name}  → update a flag
  POST /api/admin/platform/prompts/seed       → seed built-in prompts to DB
  GET  /api/admin/platform/prompts            → list all prompt templates
  POST /api/admin/platform/prompts            → create a new prompt version
"""
from __future__ import annotations

import logging
from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.rbac import require_role, require_super_admin
from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/platform", tags=["Admin Platform"])

_admin = require_role("admin", "super_admin")
_super_admin = require_super_admin


# ── Schemas ───────────────────────────────────────────────────────────────────

class UpdateSettingRequest(BaseModel):
    value: Union[str, int, float, bool] = Field(..., description="Must be a scalar: string (max 2000 chars), int, float, or bool")
    description: Optional[str] = Field(None, max_length=500)

    @field_validator("value")
    @classmethod
    def validate_value(cls, v: Union[str, int, float, bool]) -> Union[str, int, float, bool]:
        if isinstance(v, str) and len(v) > 2000:
            raise ValueError("Setting value string must be at most 2000 characters.")
        return v


class UpdateFlagRequest(BaseModel):
    is_enabled: bool
    rollout_pct: int = Field(0, ge=0, le=100)
    target_roles: Optional[list[str]] = None
    description: Optional[str] = None


class CreatePromptRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    use_case: str = Field(..., min_length=3, max_length=100)
    prompt_type: str = Field("system", pattern="^(system|user|assistant)$")
    content: str = Field(..., min_length=10)
    model_hint: Optional[str] = None
    notes: Optional[str] = None


# ── Platform settings ─────────────────────────────────────────────────────────

@router.get("/settings")
def list_settings(
    current_user: User = Depends(_super_admin),
    db: Session = Depends(get_db),
):
    from app.models.platform import PlatformSetting
    rows = db.query(PlatformSetting).order_by(PlatformSetting.key).all()
    return [
        {
            "id": str(r.id),
            "key": r.key,
            "value": r.value,
            "description": r.description,
            "updated_at": r.updated_at,
        }
        for r in rows
    ]


@router.put("/settings/{key}")
def update_setting(
    key: str,
    body: UpdateSettingRequest,
    current_user: User = Depends(_super_admin),
    db: Session = Depends(get_db),
):
    from app.models.platform import PlatformSetting
    row = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found.")
    row.value = body.value
    if body.description is not None:
        row.description = body.description
    row.updated_by = current_user.id
    db.commit()
    return {"key": key, "value": row.value}


# ── Feature flags ─────────────────────────────────────────────────────────────

@router.get("/flags")
def list_flags(
    current_user: User = Depends(_super_admin),
    db: Session = Depends(get_db),
):
    from app.models.platform import FeatureFlag
    rows = db.query(FeatureFlag).order_by(FeatureFlag.flag_name).all()
    return [
        {
            "id": str(r.id),
            "flag_name": r.flag_name,
            "is_enabled": r.is_enabled,
            "rollout_pct": r.rollout_pct,
            "target_roles": r.target_roles,
            "description": r.description,
            "updated_at": r.updated_at,
        }
        for r in rows
    ]


@router.put("/flags/{flag_name}")
def update_flag(
    flag_name: str,
    body: UpdateFlagRequest,
    current_user: User = Depends(_super_admin),
    db: Session = Depends(get_db),
):
    from app.models.platform import FeatureFlag
    flag = db.query(FeatureFlag).filter(FeatureFlag.flag_name == flag_name).first()
    if not flag:
        raise HTTPException(status_code=404, detail=f"Feature flag '{flag_name}' not found.")
    flag.is_enabled = body.is_enabled
    flag.rollout_pct = body.rollout_pct
    flag.target_roles = body.target_roles
    if body.description is not None:
        flag.description = body.description
    flag.updated_by = current_user.id
    db.commit()
    logger.info(
        "[PLATFORM] Flag '%s' updated by admin %s: enabled=%s, pct=%s",
        flag_name, current_user.id, body.is_enabled, body.rollout_pct,
    )
    return {"flag_name": flag_name, "is_enabled": flag.is_enabled, "rollout_pct": flag.rollout_pct}


# ── Prompt templates ──────────────────────────────────────────────────────────

@router.post("/prompts/seed")
def seed_prompts(
    current_user: User = Depends(_super_admin),
    db: Session = Depends(get_db),
):
    """Seed all built-in prompt templates into the DB (idempotent)."""
    from app.ai.prompts.loader import seed_builtin_prompts
    inserted = seed_builtin_prompts(db)
    return {"inserted": inserted, "message": f"Seeded {inserted} prompt(s). Existing active rows were skipped."}


@router.get("/prompts")
def list_prompts(
    current_user: User = Depends(_super_admin),
    db: Session = Depends(get_db),
):
    from app.models.prompts import PromptTemplate
    rows = (
        db.query(PromptTemplate)
        .order_by(PromptTemplate.use_case, PromptTemplate.version.desc())
        .all()
    )
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "use_case": r.use_case,
            "prompt_type": r.prompt_type,
            "version": r.version,
            "is_active": r.is_active,
            "model_hint": r.model_hint,
            "notes": r.notes,
            "content_preview": r.content[:200] + "..." if len(r.content) > 200 else r.content,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.post("/prompts", status_code=201)
def create_prompt(
    body: CreatePromptRequest,
    current_user: User = Depends(_super_admin),
    db: Session = Depends(get_db),
):
    """Insert a new prompt version and deactivate the previous active version."""
    from app.models.prompts import PromptTemplate

    # Determine next version number
    latest = (
        db.query(PromptTemplate)
        .filter(PromptTemplate.use_case == body.use_case)
        .order_by(PromptTemplate.version.desc())
        .first()
    )
    next_version = (latest.version + 1) if latest else 1

    # Deactivate the old active version
    if latest and latest.is_active:
        latest.is_active = False

    new_row = PromptTemplate(
        name=body.name,
        use_case=body.use_case,
        prompt_type=body.prompt_type,
        content=body.content,
        version=next_version,
        is_active=True,
        model_hint=body.model_hint,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(new_row)
    db.commit()
    db.refresh(new_row)

    logger.info(
        "[PLATFORM] Prompt '%s' v%d created by admin %s",
        body.use_case, next_version, current_user.id,
    )
    return {"id": str(new_row.id), "use_case": body.use_case, "version": next_version}


# ── Integrations health check ─────────────────────────────────────────────────

def _tcp_reachable(host: str, port: int, timeout: float = 2.0) -> tuple[bool, float | None]:
    """Returns (reachable, latency_ms). Never raises."""
    import socket, time
    try:
        t0 = time.monotonic()
        with socket.create_connection((host, port), timeout=timeout):
            ms = round((time.monotonic() - t0) * 1000, 1)
        return True, ms
    except Exception:
        return False, None


@router.get("/integrations")
def list_integrations(
    current_user: User = Depends(_super_admin),
):
    """Return live connection status for all external integrations.

    Checks are lightweight: key-presence for API-key services, real TCP ping
    for SMTP, ClamAV, and Redis (services that have an addressable host:port).
    """
    from datetime import datetime, timezone
    from app.config import get_settings
    from app.database import get_redis_client

    cfg = get_settings()
    now = datetime.now(timezone.utc).isoformat()

    def _key(label: str, configured: bool, detail: str = "") -> dict:
        return {
            "id": label,
            "status": "connected" if configured else "not_configured",
            "detail": detail,
            "latency_ms": None,
        }

    results = []

    # ── Email (Brevo SMTP) ──────────────────────────────────────────────────
    brevo_ok = bool(cfg.brevo_smtp_login and cfg.brevo_smtp_key)
    if brevo_ok:
        reachable, ms = _tcp_reachable(cfg.brevo_smtp_host, cfg.brevo_smtp_port)
        results.append({
            "id": "brevo_smtp",
            "name": "Email — Brevo SMTP",
            "category": "Messaging",
            "status": "connected" if reachable else "error",
            "detail": f"{cfg.brevo_smtp_host}:{cfg.brevo_smtp_port} · login {cfg.brevo_smtp_login}",
            "latency_ms": ms,
        })
    else:
        results.append({**_key("brevo_smtp", False, "BREVO_SMTP_LOGIN / BREVO_SMTP_KEY not set"),
                        "name": "Email — Brevo SMTP", "category": "Messaging"})

    # ── AI — Anthropic ──────────────────────────────────────────────────────
    results.append({**_key(
        "anthropic", bool(cfg.anthropic_api_key),
        "ANTHROPIC_API_KEY configured" if cfg.anthropic_api_key else "ANTHROPIC_API_KEY not set",
    ), "name": "AI — Anthropic Claude", "category": "AI"})

    # ── AI — Groq ───────────────────────────────────────────────────────────
    results.append({**_key(
        "groq", bool(cfg.groq_api_key),
        "GROQ_API_KEY configured" if cfg.groq_api_key else "GROQ_API_KEY not set",
    ), "name": "AI — Groq", "category": "AI"})

    # ── SMS — MSG91 ─────────────────────────────────────────────────────────
    msg91_ok = bool(cfg.msg91_api_key)
    results.append({**_key(
        "msg91", msg91_ok,
        f"sender {cfg.msg91_sender_id} · template set" if msg91_ok and cfg.msg91_template_id else
        "MSG91_API_KEY configured" if msg91_ok else "MSG91_API_KEY not set",
    ), "name": "SMS — MSG91", "category": "Messaging"})

    # ── Google OAuth ────────────────────────────────────────────────────────
    results.append({**_key(
        "google_oauth", bool(cfg.google_client_id),
        "GOOGLE_CLIENT_ID configured" if cfg.google_client_id else "GOOGLE_CLIENT_ID not set",
    ), "name": "Google OAuth (login)", "category": "Auth"})

    # ── Google Calendar ─────────────────────────────────────────────────────
    cal_ok = bool(cfg.google_calendar_client_id and cfg.google_calendar_client_secret)
    results.append({**_key(
        "google_calendar", cal_ok,
        "Client ID + secret configured" if cal_ok else "GOOGLE_CALENDAR_CLIENT_ID / CLIENT_SECRET not set",
    ), "name": "Google Calendar", "category": "Auth"})

    # ── reCAPTCHA ───────────────────────────────────────────────────────────
    results.append({**_key(
        "recaptcha", bool(cfg.recaptcha_secret_key),
        "Site key + secret configured" if cfg.recaptcha_secret_key else "RECAPTCHA_SECRET_KEY not set",
    ), "name": "Google reCAPTCHA v3", "category": "Security"})

    # ── ClamAV (virus scanning) ─────────────────────────────────────────────
    if cfg.clamav_host:
        reachable, ms = _tcp_reachable(cfg.clamav_host, cfg.clamav_port)
        results.append({
            "id": "clamav",
            "name": "ClamAV (virus scan)",
            "category": "Security",
            "status": "connected" if reachable else "error",
            "detail": f"{cfg.clamav_host}:{cfg.clamav_port}",
            "latency_ms": ms,
        })
    else:
        results.append({**_key("clamav", False, "CLAMAV_HOST not set — uploads proceed unscanned"),
                        "name": "ClamAV (virus scan)", "category": "Security"})

    # ── Sentry ──────────────────────────────────────────────────────────────
    results.append({**_key(
        "sentry", bool(cfg.sentry_dsn),
        "DSN configured" if cfg.sentry_dsn else "SENTRY_DSN not set — errors not reported",
    ), "name": "Sentry (error tracking)", "category": "Monitoring"})

    # ── Redis ───────────────────────────────────────────────────────────────
    import time as _time
    try:
        t0 = _time.monotonic()
        get_redis_client().ping()
        redis_ms = round((_time.monotonic() - t0) * 1000, 1)
        results.append({
            "id": "redis", "name": "Redis (cache / sessions)", "category": "Infrastructure",
            "status": "connected", "detail": cfg.redis_url.split("@")[-1],  # strip credentials
            "latency_ms": redis_ms,
        })
    except Exception as exc:
        results.append({
            "id": "redis", "name": "Redis (cache / sessions)", "category": "Infrastructure",
            "status": "error", "detail": str(exc)[:120], "latency_ms": None,
        })

    # ── PostgreSQL ──────────────────────────────────────────────────────────
    # If this endpoint responded, the DB is reachable — no extra ping needed.
    db_host = cfg.database_url.split("@")[-1] if "@" in cfg.database_url else "configured"
    results.append({
        "id": "postgres", "name": "PostgreSQL (primary DB)", "category": "Infrastructure",
        "status": "connected", "detail": db_host, "latency_ms": None,
    })

    return {"checked_at": now, "integrations": results}


# ── System monitoring ─────────────────────────────────────────────────────────

import time as _boot_time_mod
_PROCESS_START = _boot_time_mod.monotonic()


def _git_sha() -> str:
    import subprocess
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
            timeout=2,
        ).decode().strip()
    except Exception:
        return "unknown"


def _process_memory_mb() -> float | None:
    try:
        import psutil, os
        return round(psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024, 1)
    except ImportError:
        pass
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return round(int(line.split()[1]) / 1024, 1)
    except Exception:
        pass
    return None


@router.get("/system")
def system_status(
    current_user: User = Depends(_super_admin),
):
    """Live system health: DB pool, Celery queue depths, Redis memory, process info."""
    from datetime import datetime, timezone
    from app.database import engine, get_redis_client
    from app.config import get_settings
    from app.tasks.worker import celery_app

    cfg = get_settings()
    now = datetime.now(timezone.utc).isoformat()
    uptime_s = int(_boot_time_mod.monotonic() - _PROCESS_START)

    # ── DB pool ────────────────────────────────────────────────────────────────
    pool = engine.pool
    db_pool = {
        "size":       pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow":   pool.overflow(),
        "max_size":   cfg.db_pool_size + cfg.db_max_overflow,
    }

    # ── Celery queues ──────────────────────────────────────────────────────────
    redis = get_redis_client()
    known_queues = ["celery", "high_priority", "low_priority", "embeddings"]
    queue_depths: list[dict] = []
    for q in known_queues:
        try:
            depth = redis.llen(q)
            queue_depths.append({"queue": q, "pending": depth})
        except Exception:
            queue_depths.append({"queue": q, "pending": None})

    # Beat schedule names
    beat_tasks = list(celery_app.conf.beat_schedule.keys())

    # ── Redis info ─────────────────────────────────────────────────────────────
    try:
        info = redis.info()
        redis_info = {
            "used_memory_mb": round(info["used_memory"] / 1024 / 1024, 2),
            "connected_clients": info["connected_clients"],
            "uptime_days": info.get("uptime_in_days", 0),
            "version": info.get("redis_version", "?"),
        }
    except Exception as exc:
        redis_info = {"error": str(exc)[:120]}

    # ── Process ────────────────────────────────────────────────────────────────
    process = {
        "uptime_seconds": uptime_s,
        "memory_mb": _process_memory_mb(),
        "git_sha": _git_sha(),
        "environment": cfg.environment,
        "python_debug": cfg.debug,
    }

    # ── Sentry ────────────────────────────────────────────────────────────────
    sentry = {
        "configured": bool(cfg.sentry_dsn),
        "dsn_hint": cfg.sentry_dsn[:40] + "…" if cfg.sentry_dsn else None,
    }

    return {
        "checked_at": now,
        "db_pool": db_pool,
        "celery": {
            "broker": cfg.redis_url.split("@")[-1],
            "queues": queue_depths,
            "beat_tasks": beat_tasks,
        },
        "redis": redis_info,
        "process": process,
        "sentry": sentry,
    }


# ── Embedding backfill ────────────────────────────────────────────────────────

@router.get("/prompts/{prompt_id}")
def get_prompt(
    prompt_id: str,
    current_user: User = Depends(_super_admin),
    db: Session = Depends(get_db),
):
    """Return the full content of a single prompt template (not truncated)."""
    import uuid as _uuid
    from app.models.prompts import PromptTemplate
    try:
        pid = _uuid.UUID(prompt_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid prompt ID.")
    row = db.query(PromptTemplate).filter(PromptTemplate.id == pid).first()
    if not row:
        raise HTTPException(status_code=404, detail="Prompt not found.")
    return {
        "id": str(row.id),
        "name": row.name,
        "use_case": row.use_case,
        "prompt_type": row.prompt_type,
        "version": row.version,
        "is_active": row.is_active,
        "model_hint": row.model_hint,
        "notes": row.notes,
        "content": row.content,
        "created_at": row.created_at,
    }


@router.patch("/prompts/{prompt_id}/activate")
def toggle_prompt_active(
    prompt_id: str,
    current_user: User = Depends(_super_admin),
    db: Session = Depends(get_db),
):
    """Toggle is_active on a prompt version.

    At most 2 active versions per use_case are allowed so Super Admins can
    run a simple A/B test. Attempting to activate a 3rd version returns 409.
    Deactivating always succeeds.
    """
    import uuid as _uuid
    from app.models.prompts import PromptTemplate
    try:
        pid = _uuid.UUID(prompt_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid prompt ID.")
    row = db.query(PromptTemplate).filter(PromptTemplate.id == pid).first()
    if not row:
        raise HTTPException(status_code=404, detail="Prompt not found.")

    if not row.is_active:
        active_count = (
            db.query(PromptTemplate)
            .filter(PromptTemplate.use_case == row.use_case, PromptTemplate.is_active == True)
            .count()
        )
        if active_count >= 2:
            raise HTTPException(
                status_code=409,
                detail="At most 2 active versions are allowed per use case for A/B testing. Deactivate one first.",
            )
    row.is_active = not row.is_active
    db.commit()
    logger.info(
        "[PLATFORM] Prompt '%s' v%d %s by admin %s",
        row.use_case, row.version, "activated" if row.is_active else "deactivated", current_user.id,
    )
    return {"id": str(row.id), "use_case": row.use_case, "version": row.version, "is_active": row.is_active}


@router.post("/embeddings/backfill")
def backfill_embeddings(
    current_user: User = Depends(_super_admin),
    db: Session = Depends(get_db),
):
    """Queue Celery embedding tasks for all jobs and user profiles that lack embeddings.

    Safe to call repeatedly — tasks are only queued for rows where the embedding column
    is NULL, so already-embedded rows are skipped without touching the DB.
    """
    from app.models.user import JobPosting, KrsScore
    from app.tasks.worker import embed_job, embed_profile

    jobs_missing = (
        db.query(JobPosting.id)
        .filter(JobPosting.description_embedding == None, JobPosting.is_active == True)
        .all()
    )
    profiles_missing = (
        db.query(KrsScore.user_id)
        .filter(KrsScore.profile_embedding == None)
        .all()
    )

    job_count = 0
    for (job_id,) in jobs_missing:
        try:
            embed_job.delay(str(job_id))
            job_count += 1
        except Exception as exc:
            logger.warning("[BACKFILL] Could not queue embed_job for %s: %s", job_id, exc)

    profile_count = 0
    for (user_id,) in profiles_missing:
        try:
            embed_profile.delay(str(user_id))
            profile_count += 1
        except Exception as exc:
            logger.warning("[BACKFILL] Could not queue embed_profile for %s: %s", user_id, exc)

    logger.info(
        "[BACKFILL] Queued %d job embeddings and %d profile embeddings",
        job_count, profile_count,
    )
    return {
        "jobs_queued": job_count,
        "profiles_queued": profile_count,
        "message": (
            f"Queued {job_count} job(s) and {profile_count} profile(s) for embedding. "
            "Jobs and profiles that already have embeddings were skipped."
        ),
    }
