import logging
from datetime import datetime, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.user import (
    AspirantProfile,
    CareerMatch,
    CareerTrack,
    EmployerProfile,
    JobPosting,
    KrsScore,
    PsychologicalAssessment,
    User,
    UserCareerSelection,
    UserJobPreparation,
)
from app.modules.krs import matching, scoring
from app.modules.krs.schemas import (
    CareerMatchResponse,
    CareerTrackResponse,
    KrsDashboardResponse,
    KrsScoreResponse,
    LiveJobResponse,
    PrepareJobResponse,
)
from app.modules.recommendations import embedder

logger = logging.getLogger(__name__)


def compute_and_store(user: User, db: Session) -> KrsScore:
    """Compute KRS scores + career matches and persist them. Idempotent."""
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    if not profile or not profile.is_completed:
        raise ValueError("Onboarding not complete — cannot compute KRS score.")

    psych = db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user.id).first()
    scores = scoring.compute_all(profile, psych)

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
    ranked = matching.rank_tracks(profile, tracks, scores["k_score"], top_n=5)

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

    # Generate and store profile embedding for semantic job matching
    try:
        text = embedder.build_user_text(profile, psych)
        vec = embedder.embed(text)
        if vec:
            krs.profile_embedding = vec
            db.commit()
            logger.info(f"[EMBEDDER] Profile embedding stored for user={user.id}")
    except Exception as exc:
        logger.warning(f"[EMBEDDER] Profile embedding failed for user={user.id}: {exc}")

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
        missing = list(set(matches[0].track.required_skills) - user_skills)[:4]

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


def get_live_jobs(user: User, db: Session) -> list[LiveJobResponse]:
    """
    Return active employer job postings ranked by a combined score:
      - When embeddings exist: semantic(45%) + skill_overlap(35%) + krs_fit(20%)
      - Fallback (no embeddings yet): skill_overlap(60%) + krs_fit(40%)
    """
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()

    if not profile or not krs:
        return []

    # ── Step 1: SQL pre-filters — eliminate hard mismatches before scoring ──
    query = (
        db.query(JobPosting, EmployerProfile)
        .join(EmployerProfile, JobPosting.employer_id == EmployerProfile.id)
        .filter(JobPosting.is_active == True, EmployerProfile.is_approved == True)
    )

    # Location filter — only applied when user has preferences AND is not open to relocation
    # Uses ILIKE so "Delhi" matches "New Delhi" and "Delhi NCR" etc.
    if profile.preferred_locations and not profile.open_to_relocation:
        location_clauses = [
            JobPosting.location.ilike(f"%{loc}%")
            for loc in profile.preferred_locations
        ]
        # Always include jobs with no location set — don't penalise unspecified listings
        query = query.filter(or_(*location_clauses, JobPosting.location == None))

    # Salary filter — only exclude jobs whose stated max is below user's minimum expectation
    # Jobs with no salary listed are kept — many employers don't publish salary
    if profile.expected_salary_min:
        query = query.filter(
            or_(
                JobPosting.salary_max == None,
                JobPosting.salary_max >= profile.expected_salary_min,
            )
        )

    rows = query.all()

    user_skills = set(profile.skills or [])
    user_emb = krs.profile_embedding

    # ── Pre-fetch prepared job IDs for this user ──────────────────────────────
    prepared_ids: set[str] = {
        str(p.job_id)
        for p in db.query(UserJobPreparation).filter(UserJobPreparation.user_id == user.id).all()
    }

    def _split_skills(user_lower: set[str], required: list[str]) -> tuple[list[str], list[str]]:
        have = [s for s in required if s.lower().strip() in user_lower]
        gap  = [s for s in required if s.lower().strip() not in user_lower]
        return have, gap

    # ── Sector boost from selected career tracks ──────────────────────────────
    # Jobs whose sector aligns with a user-chosen path get +10 bonus points.
    selected_sectors: set[str] = set()
    sels = db.query(UserCareerSelection).filter(UserCareerSelection.user_id == user.id).all()
    for sel in sels:
        if sel.track and sel.track.sector:
            selected_sectors.add(sel.track.sector.lower())

    results: list[LiveJobResponse] = []

    user_lower = {s.lower().strip() for s in user_skills}

    for job, employer in rows:
        required = job.required_skills or []
        overlap = matching._skill_overlap_pct(user_skills, required)
        fit = matching._krs_fit(krs.k_score, job.min_k_score)
        have, gap = _split_skills(user_lower, required)

        # Semantic score via cosine similarity if both embeddings are available
        semantic_score: int | None = None
        if user_emb is not None and job.description_embedding is not None:
            sim = embedder.cosine_similarity(user_emb, job.description_embedding)
            # Cosine similarity on normalised vectors is in [-1, 1]; clamp to [0, 100]
            semantic_score = max(0, round(sim * 100))

        if semantic_score is not None:
            match_score = round(semantic_score * 0.45 + overlap * 0.35 + fit * 0.20)
        else:
            match_score = round(overlap * 0.60 + fit * 0.40)

        # +10 bonus when job sector aligns with a user-chosen career path
        if selected_sectors and job.sector and job.sector.lower() in selected_sectors:
            match_score = min(100, match_score + 10)

        results.append(LiveJobResponse(
            id=str(job.id),
            company_name=employer.company_name,
            title=job.title,
            description=job.description,
            sector=job.sector,
            required_skills=required,
            min_k_score=job.min_k_score,
            salary_min=job.salary_min,
            salary_max=job.salary_max,
            growth_outlook=job.growth_outlook,
            job_type=job.job_type,
            location=job.location,
            employment_type=job.employment_type,
            expires_at=job.expires_at,
            posted_at=job.created_at,
            match_score=match_score,
            skill_overlap=overlap,
            semantic_score=semantic_score,
            employer_website=employer.website,
            is_prepared=str(job.id) in prepared_ids,
            skills_you_have=have,
            skills_to_develop=gap,
        ))

    results.sort(key=lambda x: x.match_score, reverse=True)
    return results[:10]


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
    db.query(UserJobPreparation).filter(
        UserJobPreparation.user_id == user.id,
        UserJobPreparation.job_id == job_id,
    ).delete()
    db.commit()
    return PrepareJobResponse(job_id=job_id, is_prepared=False, message="Removed from your preparation list.")


def get_prepared_jobs(user: User, db: Session) -> list[LiveJobResponse]:
    """Return jobs the user is preparing for, with full match scores."""
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    if not profile or not krs:
        return []

    preps = (
        db.query(UserJobPreparation)
        .filter(UserJobPreparation.user_id == user.id)
        .order_by(UserJobPreparation.prepared_at.desc())
        .all()
    )
    if not preps:
        return []

    user_skills = set(profile.skills or [])
    user_lower_prep = {s.lower().strip() for s in user_skills}
    user_emb = krs.profile_embedding

    def _split_prep(required: list[str]) -> tuple[list[str], list[str]]:
        have = [s for s in required if s.lower().strip() in user_lower_prep]
        gap  = [s for s in required if s.lower().strip() not in user_lower_prep]
        return have, gap

    results: list[LiveJobResponse] = []
    for prep in preps:
        job = prep.job
        if not job:
            continue
        employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()
        if not employer:
            continue
        required = job.required_skills or []
        overlap = matching._skill_overlap_pct(user_skills, required)
        fit = matching._krs_fit(krs.k_score, job.min_k_score)
        have, gap = _split_prep(required)
        semantic_score: int | None = None
        if user_emb is not None and job.description_embedding is not None:
            sim = embedder.cosine_similarity(user_emb, job.description_embedding)
            semantic_score = max(0, round(sim * 100))
        if semantic_score is not None:
            match_score = round(semantic_score * 0.45 + overlap * 0.35 + fit * 0.20)
        else:
            match_score = round(overlap * 0.60 + fit * 0.40)

        results.append(LiveJobResponse(
            id=str(job.id),
            company_name=employer.company_name,
            title=job.title,
            description=job.description,
            sector=job.sector,
            required_skills=required,
            min_k_score=job.min_k_score,
            salary_min=job.salary_min,
            salary_max=job.salary_max,
            growth_outlook=job.growth_outlook,
            job_type=job.job_type,
            location=job.location,
            employment_type=job.employment_type,
            expires_at=job.expires_at,
            posted_at=job.created_at,
            match_score=match_score,
            skill_overlap=overlap,
            semantic_score=semantic_score,
            employer_website=employer.website,
            is_prepared=True,
            skills_you_have=have,
            skills_to_develop=gap,
        ))

    return results
