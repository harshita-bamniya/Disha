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

from app.core.rbac import require_role
from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/platform", tags=["Admin Platform"])

_admin = require_role("admin")


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
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    from app.models.mvp3 import PlatformSetting
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
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    from app.models.mvp3 import PlatformSetting
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
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    from app.models.mvp3 import FeatureFlag
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
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    from app.models.mvp3 import FeatureFlag
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
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Seed all built-in prompt templates into the DB (idempotent)."""
    from app.ai.prompts.loader import seed_builtin_prompts
    inserted = seed_builtin_prompts(db)
    return {"inserted": inserted, "message": f"Seeded {inserted} prompt(s). Existing active rows were skipped."}


@router.get("/prompts")
def list_prompts(
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    from app.models.mvp3 import PromptTemplate
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
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Insert a new prompt version and deactivate the previous active version."""
    from app.models.mvp3 import PromptTemplate

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


# ── Embedding backfill ────────────────────────────────────────────────────────

@router.post("/embeddings/backfill")
def backfill_embeddings(
    current_user: User = Depends(_admin),
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
