"""Aspirant: browse + search jobs."""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.user import (
    AspirantProfile,
    JobPosting,
    KrsScore,
    User,
)
from app.modules.matching.schemas import (
    JobDetail,
    JobRecommendationsResponse,
)
from app.modules.recommendations.ranker import rank_jobs_for_user

from app.modules.matching.service import core

logger = logging.getLogger(__name__)


def get_job_recommendations(
    user: User,
    db: Session,
    sector: Optional[str] = None,
    job_type: Optional[str] = None,
    min_salary: Optional[int] = None,
    q: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> JobRecommendationsResponse:
    """Return active jobs ranked by match score for the current aspirant.

    Uses the production two-stage ranker:
      - With profile embedding:   pgvector ANN (HNSW) → re-rank top 200
      - Without profile embedding: rule-based skill_overlap + k_fit fallback
    """
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()

    # Build caller-specified SQL filters
    sql_filters = []
    if sector:
        sql_filters.append(JobPosting.sector.ilike(f"%{sector}%"))
    if job_type:
        sql_filters.append(JobPosting.job_type == job_type)
    if min_salary is not None:
        sql_filters.append(JobPosting.salary_min >= min_salary)
    if q:
        keyword = f"%{q}%"
        from sqlalchemy import or_
        sql_filters.append(
            or_(
                JobPosting.title.ilike(keyword),
                JobPosting.description.ilike(keyword),
            )
        )

    # Load application history for collaborative filtering.
    # Cap at 2000 most-recent rows so we never pull the full table into memory.
    from app.models.applications import Application as AppModel
    recent_apps = (
        db.query(AppModel.aspirant_id, AppModel.job_id)
        .order_by(AppModel.created_at.desc())
        .limit(2000)
        .all()
    )
    application_history = [
        {"user_id": str(a.aspirant_id), "job_id": str(a.job_id)}
        for a in recent_apps
    ]
    # Fetch only this user's applied job IDs — no need to scan the full table.
    user_applied_ids = [
        str(a.job_id)
        for a in db.query(AppModel.job_id).filter(AppModel.aspirant_id == user.id).all()
    ]

    page, total = rank_jobs_for_user(
        profile, krs, db,
        extra_sql_filters=sql_filters,
        selected_sectors=core._user_selected_sectors(user, db),
        application_history=application_history,
        applied_job_ids=user_applied_ids,
        limit=limit,
        offset=offset,
    )

    return JobRecommendationsResponse(
        total=total,
        jobs=[core._ranked_to_list_item(r) for r in page],
    )


def get_job_detail(job_id: str, user: User, db: Session) -> JobDetail:
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()

    # Rank this single job using the same ranker — produces correct blended score
    page, _ = rank_jobs_for_user(
        profile, krs, db,
        extra_sql_filters=[JobPosting.id == job_id],
        selected_sectors=core._user_selected_sectors(user, db),
        limit=1,
        offset=0,
    )
    if not page:
        raise NotFoundException("Job not found or no longer active.")

    r = page[0]
    return JobDetail(
        **core._ranked_to_list_item(r).model_dump(),
        description=r.job.description,
        growth_outlook=r.job.growth_outlook,
        match_summary=None,
    )

