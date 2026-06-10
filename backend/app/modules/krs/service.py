import logging
from datetime import datetime, timezone
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.user import AspirantProfile, CareerMatch, CareerTrack, EmployerProfile, JobPosting, KrsScore, PsychologicalAssessment, User, UserCareerSelection, UserJobPreparation
from app.modules.krs import matching, scoring
from app.modules.krs.schemas import (
    ActivePrepJobContext, CareerMatchResponse, CareerTrackResponse,
    KrsDashboardResponse, KrsScoreResponse, LiveJobResponse, PrepareJobResponse,
)
from app.modules.recommendations.ranker import rank_jobs_for_user

logger = logging.getLogger(__name__)


def compute_and_store(user: User, db: Session) -> KrsScore:
    """Compute KRS scores + career matches and persist them. Idempotent."""
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    if not profile or not profile.is_completed:
        raise ValueError("Onboarding not complete — cannot compute KRS score.")

    psych = db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user.id).first()
    scores = scoring.compute_all(profile, psych, db)

    # Upsert krs_scores
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    if krs:
        krs.k_score = scores["k_score"]
        krs.r_score = scores["r_score"]
        krs.s_score = scores["s_score"]
        krs.composite = scores["composite"]
        krs.updated_at = datetime.now(timezone.utc)
    else:
        krs = KrsScore(user_id=user.id, **scores)
        db.add(krs)
    db.flush()

    # Compute career matches
    tracks = db.query(CareerTrack).all()
    ranked = matching.rank_tracks(profile, tracks, scores["k_score"], top_n=5, db=db)

    # Delete old matches, insert fresh
    db.query(CareerMatch).filter(CareerMatch.user_id == user.id).delete()
    for track, match_score, overlap in ranked:
        db.add(CareerMatch(
            user_id=user.id,
            track_id=track.id,
            match_score=match_score,
            skill_overlap=overlap,
        ))

    db.commit()
    db.refresh(krs)
    logger.info(f"[KRS] Computed for user={user.id}: K={scores['k_score']} R={scores['r_score']} S={scores['s_score']} → {scores['composite']}")

    # Dispatch profile embedding to Celery — retried automatically on failure
    try:
        from app.tasks.worker import embed_profile
        embed_profile.delay(str(user.id))
    except Exception as exc:
        logger.warning("[KRS] Could not dispatch embed_profile task for user=%s: %s", user.id, exc)

    return krs


def _build_match_response(
    track: CareerTrack,
    match_score: int,
    skill_overlap: int,
    user_skills: set[str],
) -> CareerMatchResponse:
    """Helper: build a CareerMatchResponse with gap analysis."""
    required = track.required_skills or []
    user_lower = {s.lower().strip() for s in user_skills}
    gap = sorted(s for s in required if s.lower().strip() not in user_lower)
    return CareerMatchResponse(
        track=CareerTrackResponse(
            id=str(track.id),
            slug=track.slug,
            title=track.title,
            description=track.description,
            sector=track.sector,
            required_skills=required,
            salary_range=track.salary_range,
            growth_outlook=track.growth_outlook,
            example_roles=track.example_roles or [],
        ),
        match_score=match_score,
        skill_overlap=skill_overlap,
        skills_to_develop=gap,
    )


def get_dashboard(user: User, db: Session) -> KrsDashboardResponse:
    """Return KRS score + top career matches + user's chosen paths for the dashboard."""
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()

    if not krs or not profile:
        if profile and profile.is_completed:
            krs = compute_and_store(user, db)
        else:
            raise ValueError("Profile not found or onboarding incomplete.")

    user_skills = set(profile.skills or [])

    # ── Top 3 KRS-computed matches ────────────────────────────────────────────
    matches_db = (
        db.query(CareerMatch)
        .filter(CareerMatch.user_id == user.id)
        .order_by(CareerMatch.match_score.desc())
        .limit(3)
        .all()
    )
    matches = [
        _build_match_response(m.track, m.match_score, m.skill_overlap, user_skills)
        for m in matches_db
    ]

    # ── User's manually selected career paths ────────────────────────────────
    selections = (
        db.query(UserCareerSelection)
        .filter(UserCareerSelection.user_id == user.id)
        .all()
    )
    # Build a lookup of pre-computed match scores (may not exist for all tracks)
    match_score_map = {
        str(m.track_id): (m.match_score, m.skill_overlap) for m in matches_db
    }
    # Include ALL career matches, not just top-3, for selected track lookup
    all_matches_db = db.query(CareerMatch).filter(CareerMatch.user_id == user.id).all()
    full_match_map = {
        str(m.track_id): (m.match_score, m.skill_overlap) for m in all_matches_db
    }

    selected_tracks: list[CareerMatchResponse] = []
    for sel in selections:
        track = sel.track
        ms, so = full_match_map.get(str(track.id), (0, 0))
        selected_tracks.append(_build_match_response(track, ms, so, user_skills))

    # ── Missing skills — from selected tracks when chosen, else top KRS match ─
    missing: list[str] = []
    if selected_tracks:
        # Union of gaps across both selected tracks, capped at 5
        gap_set: set[str] = set()
        for st in selected_tracks:
            gap_set.update(st.skills_to_develop)
        missing = sorted(gap_set)[:5]
    elif matches:
        user_lower = {s.lower().strip() for s in user_skills}
        missing = [
            s for s in matches[0].track.required_skills
            if s.lower().strip() not in user_lower
        ][:4]

    return KrsDashboardResponse(
        krs=KrsScoreResponse(
            k_score=krs.k_score,
            r_score=krs.r_score,
            s_score=krs.s_score,
            composite=krs.composite,
        ),
        matches=matches,
        missing_skills=missing,
        profile_complete=profile.is_completed,
        selected_tracks=selected_tracks,
        full_name=profile.full_name,
        skills=list(profile.skills or []),
    )


def _selected_sectors(user_id, db: Session) -> frozenset[str]:
    """Return sectors from the user's chosen career tracks (lowercased)."""
    sels = db.query(UserCareerSelection).filter(UserCareerSelection.user_id == user_id).all()
    return frozenset(
        sel.track.sector.lower()
        for sel in sels
        if sel.track and sel.track.sector
    )


def _prepared_ids(user_id, db: Session) -> frozenset[str]:
    return frozenset(
        str(p.job_id)
        for p in db.query(UserJobPreparation).filter(UserJobPreparation.user_id == user_id).all()
    )


def _to_live_response(ranked: "RankedJob") -> LiveJobResponse:  # type: ignore[name-defined]
    job, employer = ranked.job, ranked.employer
    return LiveJobResponse(
        id=str(job.id),
        company_name=employer.company_name,
        title=job.title,
        description=job.description,
        sector=job.sector,
        required_skills=job.required_skills or [],
        min_k_score=job.min_k_score,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        growth_outlook=job.growth_outlook,
        job_type=job.job_type,
        location=job.location,
        employment_type=job.employment_type,
        expires_at=job.expires_at,
        posted_at=job.created_at,
        match_score=ranked.match_score,
        skill_overlap=ranked.skill_overlap,
        semantic_score=ranked.semantic_score,
        employer_website=employer.website,
        is_prepared=ranked.is_prepared,
        skills_you_have=ranked.skills_you_have,
        skills_to_develop=ranked.skills_to_develop,
    )


def get_live_jobs(user: User, db: Session) -> list[LiveJobResponse]:
    """
    Return active employer job postings ranked by match score for the aspirant.

    Uses the two-stage ranker:
      - With embedding:    pgvector ANN (HNSW) → re-rank top 200 candidates
      - Without embedding: rule-based skill_overlap + k_fit fallback
    Location and salary pre-filters are applied in SQL (hard constraints from
    the user's preferences).  Returns up to 10 results for the dashboard.
    """
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    if not profile:
        return []
    if not krs and profile.is_completed:
        try:
            krs = compute_and_store(user, db)
        except Exception as exc:
            logger.warning("[LIVE_JOBS] KRS recompute failed for user=%s: %s", user.id, exc)
            return []
    if not krs:
        return []

    # ── Build hard SQL filters from user profile preferences ─────────────────
    sql_filters = []

    # Location: only filter when user has preferences AND is not open to relocation.
    # Always include jobs with no location set — many employers don't specify.
    if profile.preferred_locations and not profile.open_to_relocation:
        location_clauses = [
            JobPosting.location.ilike(f"%{loc}%")
            for loc in profile.preferred_locations
        ]
        sql_filters.append(or_(*location_clauses, JobPosting.location == None))

    # Salary: exclude only when the job's stated max is below user's floor.
    # Jobs without salary listed are kept — employer may negotiate.
    if profile.expected_salary_min:
        sql_filters.append(
            or_(JobPosting.salary_max == None, JobPosting.salary_max >= profile.expected_salary_min)
        )

    page, _ = rank_jobs_for_user(
        profile, krs, db,
        extra_sql_filters=sql_filters,
        selected_sectors=_selected_sectors(user.id, db),
        prepared_job_ids=_prepared_ids(user.id, db),
        limit=10,
        offset=0,
    )
    return [_to_live_response(r) for r in page]


def prepare_job(user: User, job_id: str, db: Session) -> PrepareJobResponse:
    """Mark a job posting as 'preparing for'. Idempotent."""
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.is_active == True).first()
    if not job:
        raise ValueError("Job not found or no longer active.")
    existing = db.query(UserJobPreparation).filter(
        UserJobPreparation.user_id == user.id,
        UserJobPreparation.job_id == job_id,
    ).first()
    if not existing:
        db.add(UserJobPreparation(user_id=user.id, job_id=job_id))
        db.commit()
    return PrepareJobResponse(job_id=job_id, is_prepared=True, message="Added to your preparation list.")


def unprepare_job(user: User, job_id: str, db: Session) -> PrepareJobResponse:
    """Remove a job from the preparation list."""
    deleted = db.query(UserJobPreparation).filter(
        UserJobPreparation.user_id == user.id,
        UserJobPreparation.job_id == job_id,
    ).delete()
    db.commit()
    return PrepareJobResponse(job_id=job_id, is_prepared=False, message="Removed from your preparation list.")


def get_prepared_jobs(user: User, db: Session) -> list[LiveJobResponse]:
    """Return jobs the user is preparing for, scored with the same ranker."""
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    if not profile or not krs:
        return []

    # Only show jobs the user has explicitly added to their prep list
    prep_ids: list[str] = [
        str(p.job_id)
        for p in db.query(UserJobPreparation)
        .filter(UserJobPreparation.user_id == user.id)
        .order_by(UserJobPreparation.prepared_at.desc())
        .all()
    ]
    if not prep_ids:
        return []

    page, _ = rank_jobs_for_user(
        profile, krs, db,
        extra_sql_filters=[JobPosting.id.in_(prep_ids)],
        selected_sectors=_selected_sectors(user.id, db),
        prepared_job_ids=frozenset(prep_ids),
        limit=len(prep_ids),
        offset=0,
    )
    return [_to_live_response(r) for r in page]


# ── Active Prep Job ───────────────────────────────────────────────────────────

def _best_career_track_for_job(job: JobPosting, profile: AspirantProfile, krs: KrsScore, db: Session):
    """Find the career track whose required_skills best overlap with the job's required_skills."""
    from app.modules.krs.skill_gap import skill_overlap_pct
    job_skills = list(job.required_skills or [])
    if not job_skills:
        return None, 0

    tracks = db.query(CareerTrack).all()
    best_track, best_score, best_overlap = None, -1, 0
    for track in tracks:
        score, overlap = matching.compute_match_score(profile, track, krs.k_score, db=db)
        # Semantic coverage of job skills by this track
        job_coverage = skill_overlap_pct(list(track.required_skills or []), job_skills, db) / 100
        combined = round(score * 0.5 + job_coverage * 50)
        if combined > best_score:
            best_score, best_overlap, best_track = combined, overlap, track

    return best_track, best_score


def start_prep(user: User, job_id: str, db: Session) -> ActivePrepJobContext:
    """
    Set a job as the user's active prep focus.
    Also adds it to the prep list if not already there.
    """
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.is_active == True).first()
    if not job:
        raise ValueError("Job not found or no longer active.")

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    if not profile:
        raise ValueError("Aspirant profile not found.")

    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()

    # Set active prep job on profile
    profile.active_prep_job_id = job.id

    # Auto-add to prep list if missing
    existing = db.query(UserJobPreparation).filter(
        UserJobPreparation.user_id == user.id,
        UserJobPreparation.job_id == job_id,
    ).first()
    if not existing:
        db.add(UserJobPreparation(user_id=user.id, job_id=job_id))

    db.commit()

    return _build_active_prep_context(job, profile, krs, db)


def clear_prep(user: User, db: Session) -> dict:
    """Clear the user's active prep job. Tools revert to generic mode."""
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    if profile:
        profile.active_prep_job_id = None
        db.commit()
    return {"message": "Active prep job cleared."}


def get_active_prep(user: User, db: Session) -> ActivePrepJobContext | None:
    """Return the active prep context, or None if no job is set."""
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    if not profile or not profile.active_prep_job_id:
        return None

    job = db.query(JobPosting).filter(
        JobPosting.id == profile.active_prep_job_id,
        JobPosting.is_active == True,
    ).first()

    if not job:
        # Job was deleted/deactivated — clear it silently
        profile.active_prep_job_id = None
        db.commit()
        return None

    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    return _build_active_prep_context(job, profile, krs, db)


def _build_active_prep_context(
    job: JobPosting,
    profile: AspirantProfile,
    krs: KrsScore | None,
    db: Session,
) -> ActivePrepJobContext:
    from app.modules.krs.skill_gap import compute_gap
    required = job.required_skills or []
    have, gap, gap_pct = compute_gap(profile.skills or [], required, db)

    # Get employer name
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()
    company = employer.company_name if employer else "Company"

    # Best-matching career track
    best_track, match_score = None, 0
    if krs:
        best_track, match_score = _best_career_track_for_job(job, profile, krs, db)

    return ActivePrepJobContext(
        job_id=str(job.id),
        job_title=job.title,
        company_name=company,
        sector=job.sector,
        location=job.location,
        required_skills=required,
        skills_you_have=have,
        skills_to_develop=gap,
        skill_gap_pct=gap_pct,
        matched_track_id=str(best_track.id) if best_track else None,
        matched_track_title=best_track.title if best_track else None,
        matched_track_slug=best_track.slug if best_track else None,
        match_score=match_score,
    )
