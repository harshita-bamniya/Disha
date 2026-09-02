"""Weekly recalibration job: refresh gap_skills from fresh job data."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.roadmap import (
    UserRoadmap,
)
from app.models.user import (
    AspirantProfile, CareerTrack, JobPosting,
)
from app.modules.krs.skill_gap import compute_gap

from app.modules.roadmap.service import core

logger = logging.getLogger(__name__)


def recalibrate_roadmap(roadmap: UserRoadmap, db: Session) -> None:
    """Update gap_skills ordering from fresh job data and recompute JRS."""
    track = db.query(CareerTrack).filter(CareerTrack.id == roadmap.career_track_id).first()
    if not track:
        return

    target_jobs = (
        db.query(JobPosting)
        .filter(JobPosting.is_active == True, JobPosting.sector == track.sector)
        .order_by(JobPosting.created_at.desc())
        .limit(5)
        .all()
    )

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == roadmap.user_id).first()
    user_skills = list(profile.skills or []) if profile else []

    all_required: list[str] = list(track.required_skills or [])
    job_skill_freq: dict[str, int] = {}
    for job in target_jobs:
        for skill in (job.required_skills or []):
            key = skill.lower().strip()
            job_skill_freq[key] = job_skill_freq.get(key, 0) + 1
            if skill not in all_required:
                all_required.append(skill)

    _, gap_skills, _ = compute_gap(user_skills, all_required, db)
    gap_skills.sort(key=lambda s: job_skill_freq.get(s.lower().strip(), 0), reverse=True)

    roadmap.gap_skills = gap_skills
    roadmap.target_job_ids = [str(j.id) for j in target_jobs]
    roadmap.last_recalibrated = datetime.now(timezone.utc)

    # Recompute JRS using lazy import to avoid circular dependency
    from app.models.user import User as UserModel
    user_obj = db.query(UserModel).filter(UserModel.id == roadmap.user_id).first()
    if user_obj:
        roadmap.job_readiness_score = core._compute_jrs_internal(user_obj, roadmap, db)

    db.commit()

