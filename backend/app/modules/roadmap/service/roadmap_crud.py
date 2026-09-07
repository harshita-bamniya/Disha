"""Roadmap creation and retrieval."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.roadmap import (
    UserRoadmap,
)
from app.models.user import (
    AspirantProfile, CareerTrack, JobPosting, KrsScore,
    User,
)
from app.modules.roadmap.personalization import get_personalization_from_user
from app.modules.krs.skill_gap import compute_gap
from app.modules.roadmap.schemas import (
    RoadmapOut, RoadmapSummaryOut,
)
from app.modules.roadmap.service import core

logger = logging.getLogger(__name__)


def generate_roadmap(career_track_id: str, user: User, db: Session) -> UserRoadmap:
    """Generate or regenerate a roadmap for the given career track.

    Algorithm:
    1. Load user profile + KRS scores.
    2. Fetch career track + top-5 active jobs for that track.
    3. Compute skill gap (semantic, using existing skill_gap.py).
    4. Prioritise gap skills by frequency across jobs.
    5. Build stage_config linking Stage 2 to relevant learning paths.
    6. Upsert UserRoadmap and compute initial JRS.
    """
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    track = db.query(CareerTrack).filter(CareerTrack.id == career_track_id).first()

    if not track:
        raise ValueError("Career track not found.")
    if not profile:
        raise ValueError("Onboarding not complete.")

    # Top 5 active jobs for this track (by sector match)
    target_jobs = (
        db.query(JobPosting)
        .filter(JobPosting.is_active == True, JobPosting.sector == track.sector)
        .order_by(JobPosting.created_at.desc())
        .limit(5)
        .all()
    )

    # Aggregate required skills: career track required_skills + job required_skills
    all_required: list[str] = list(track.required_skills or [])
    job_skill_freq: dict[str, int] = {}
    for job in target_jobs:
        for skill in (job.required_skills or []):
            key = skill.lower().strip()
            job_skill_freq[key] = job_skill_freq.get(key, 0) + 1
            if skill not in all_required:
                all_required.append(skill)

    user_skills = list(profile.skills or [])
    _, gap_skills, _ = compute_gap(user_skills, all_required, db)

    # Sort gap skills: skills appearing in more jobs come first
    gap_skills.sort(key=lambda s: job_skill_freq.get(s.lower().strip(), 0), reverse=True)

    # Build stage_config
    stage_config = core._build_stage_config(gap_skills, track, target_jobs, db)

    target_job_ids = [str(j.id) for j in target_jobs]

    # Upsert roadmap
    existing = (
        db.query(UserRoadmap)
        .filter(UserRoadmap.user_id == user.id, UserRoadmap.career_track_id == career_track_id)
        .first()
    )
    if existing:
        existing.target_job_ids = target_job_ids
        existing.gap_skills = gap_skills
        existing.stage_config = stage_config
        existing.last_recalibrated = datetime.now(timezone.utc)
        existing.is_active = True
        roadmap = existing
    else:
        roadmap = UserRoadmap(
            user_id=user.id,
            career_track_id=career_track_id,
            target_job_ids=target_job_ids,
            gap_skills=gap_skills,
            stage_config=stage_config,
            current_stage=1,
        )
        db.add(roadmap)

    db.flush()

    # Apply personalization config and store in stage_config
    try:
        pcfg = get_personalization_from_user(user, db)
        if isinstance(stage_config, dict):
            stage_config["personalization"] = pcfg.to_dict()
            roadmap.stage_config = stage_config
    except Exception as e:
        logger.warning("[ROADMAP] Personalization failed: %s", e)

    # Compute and persist initial JRS
    jrs = core._compute_jrs_internal(user, roadmap, db)
    roadmap.job_readiness_score = jrs
    db.commit()
    db.refresh(roadmap)

    logger.info(
        "[ROADMAP] Generated for user=%s track=%s gap_skills=%d JRS=%d",
        user.id, track.slug, len(gap_skills), jrs,
    )
    return roadmap


def get_all_roadmaps(user: User, db: Session) -> list[UserRoadmap]:
    """Return every roadmap the user has ever generated, most recent first."""
    return (
        db.query(UserRoadmap)
        .filter(UserRoadmap.user_id == user.id)
        .order_by(UserRoadmap.generated_at.desc())
        .all()
    )


def get_roadmap_by_id(roadmap_id: str, user: User, db: Session) -> UserRoadmap:
    """Fetch a specific roadmap owned by the user (active or historical)."""
    return core._get_owned_roadmap(roadmap_id, user, db)


def get_all_roadmaps_out(user: User, db: Session) -> list[RoadmapSummaryOut]:
    """Build summary cards for the roadmap history page — one entry per career track."""
    all_roadmaps = get_all_roadmaps(user, db)  # already sorted newest-first
    seen_tracks: set[str | None] = set()
    roadmaps = []
    for r in all_roadmaps:
        key = str(r.career_track_id) if r.career_track_id else r.id
        if key in seen_tracks:
            continue
        seen_tracks.add(key)
        roadmaps.append(r)

    track_ids = {str(r.career_track_id) for r in roadmaps if r.career_track_id}
    tracks = {
        str(t.id): t.title
        for t in db.query(CareerTrack).filter(CareerTrack.id.in_(track_ids)).all()
    } if track_ids else {}
    return [
        RoadmapSummaryOut(
            id=str(r.id),
            career_track_id=str(r.career_track_id) if r.career_track_id else None,
            career_track_name=tracks.get(str(r.career_track_id)) if r.career_track_id else None,
            current_stage=r.current_stage,
            job_readiness_score=r.job_readiness_score,
            generated_at=r.generated_at,
            last_recalibrated=r.last_recalibrated,
            is_active=r.is_active,
        )
        for r in roadmaps
    ]


def get_roadmap_out(roadmap: UserRoadmap, db: Session) -> RoadmapOut:
    """Build the full RoadmapOut response with computed stage statuses."""
    from app.models.user import AspirantProfile, JobPosting
    track = db.query(CareerTrack).filter(CareerTrack.id == roadmap.career_track_id).first()
    stages = [core._build_stage_status(i, roadmap, db) for i in range(1, 7)]

    # Resolve active prep job for Stage 2 job-specific roadmap
    active_prep_job_id = None
    active_prep_job_title = None
    active_prep_job_company = None
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == roadmap.user_id).first()
    if profile and profile.active_prep_job_id:
        job = db.query(JobPosting).filter(JobPosting.id == profile.active_prep_job_id).first()
        if job:
            active_prep_job_id = str(job.id)
            active_prep_job_title = job.title
            active_prep_job_company = job.employer.company_name if job.employer else None

    return RoadmapOut(
        id=str(roadmap.id),
        career_track_id=str(roadmap.career_track_id) if roadmap.career_track_id else None,
        career_track_name=track.title if track else None,
        current_stage=roadmap.current_stage,
        gap_skills=roadmap.gap_skills or [],
        job_readiness_score=roadmap.job_readiness_score,
        narrative_score=roadmap.narrative_score,
        narrative_feedback=roadmap.narrative_feedback,
        stages=stages,
        generated_at=roadmap.generated_at,
        last_recalibrated=roadmap.last_recalibrated,
        active_prep_job_id=active_prep_job_id,
        active_prep_job_title=active_prep_job_title,
        active_prep_job_company=active_prep_job_company,
    )

