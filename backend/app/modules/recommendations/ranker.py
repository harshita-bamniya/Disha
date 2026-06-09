"""
Production two-stage job ranker.

Stage 1 — Retrieve
    pgvector HNSW ANN query using the <=> cosine-distance operator.
    Hard filters (active, approved, unexpired, caller-supplied extras) applied
    in SQL WHERE.  Index-accelerated — O(log n) regardless of job table size.

Stage 2 — Re-rank
    Blended scoring on at most CANDIDATE_POOL (200) candidates in Python:
        semantic   45 %  (cosine similarity from Stage 1)
        skill_overlap 35 %  (exact skill set intersection)
        k_fit      20 %  (K-score vs job's min_k_score)
    Sector-affinity bonus: +8 pts when job sector matches a user-chosen
    career track sector.  Capped at 100.

Cold-start fallback (user has no profile embedding):
    Rule-based: skill_overlap 60 % + k_fit 40 % + recency +5 for jobs
    posted within the last 7 days.  All active jobs are candidates.

Usage
-----
Build caller-specific SQL filters (location, salary, sector keyword …) and
pass them as `extra_sql_filters`.  The ranker handles the rest.

    filters = []
    if sector:
        filters.append(JobPosting.sector.ilike(f"%{sector}%"))

    ranked, total = rank_jobs_for_user(
        profile, krs, db,
        extra_sql_filters=filters,
        selected_sectors=selected_sectors,
        prepared_job_ids=prepared_ids,
        limit=20, offset=0,
    )
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional, Sequence

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.user import EmployerProfile, JobPosting, AspirantProfile, KrsScore
from app.modules.krs.matching import _skill_overlap_pct, _krs_fit

logger = logging.getLogger(__name__)

# ANN retrieves this many nearest neighbors; Python re-ranks them.
# 200 gives good recall without memory pressure.
CANDIDATE_POOL = 200

# Sector-affinity bonus (clamped to 100)
_SECTOR_BONUS = 8

# Jobs posted within this window get a recency nudge in cold-start mode
_RECENCY_DAYS = 7
_RECENCY_BONUS = 5


@dataclass
class RankedJob:
    job: JobPosting
    employer: EmployerProfile
    match_score: int            # blended 0-100
    skill_overlap: int          # % of required skills the user already has
    semantic_score: Optional[int]   # cosine-sim * 100; None when no embeddings
    skills_you_have: list[str] = field(default_factory=list)
    skills_to_develop: list[str] = field(default_factory=list)
    is_prepared: bool = False


# ── Internal helpers ──────────────────────────────────────────────────────────

def _split_skills(user_lower: set[str], required: list[str]) -> tuple[list[str], list[str]]:
    have = [s for s in required if s.lower().strip() in user_lower]
    gap  = [s for s in required if s.lower().strip() not in user_lower]
    return have, gap


def _blended_score(
    semantic: Optional[int],
    skill_overlap: int,
    k_fit: int,
) -> int:
    if semantic is not None:
        return round(0.45 * semantic + 0.35 * skill_overlap + 0.20 * k_fit)
    return round(0.60 * skill_overlap + 0.40 * k_fit)


def _apply_sector_bonus(score: int, job: JobPosting, selected_sectors: frozenset[str]) -> int:
    if selected_sectors and job.sector and job.sector.lower() in selected_sectors:
        return min(100, score + _SECTOR_BONUS)
    return score


# ── Base query builder ────────────────────────────────────────────────────────

def _base_q(db: Session, extra_sql_filters: Sequence):
    """Common WHERE conditions for all job queries."""
    today = datetime.now(timezone.utc).date()
    q = (
        db.query(JobPosting, EmployerProfile)
        .join(EmployerProfile, JobPosting.employer_id == EmployerProfile.id)
        .filter(
            JobPosting.is_active == True,
            EmployerProfile.is_approved == True,
            or_(JobPosting.expires_at == None, JobPosting.expires_at >= today),
        )
    )
    for f in extra_sql_filters:
        q = q.filter(f)
    return q


# ── Stage 1+2: vector path ────────────────────────────────────────────────────

def _safe_krs_fit(k_score: Optional[int], min_k: int) -> int:
    """Wrapper around _krs_fit that handles k_score=None (user has no KRS yet)."""
    if k_score is None:
        return 50  # neutral — neither penalised nor rewarded
    return _krs_fit(k_score, min_k)


def _vector_rank(
    profile_emb: list[float],
    user_skills: set[str],
    user_lower: set[str],
    k_score: Optional[int],
    selected_sectors: frozenset[str],
    prepared_job_ids: frozenset[str],
    db: Session,
    extra_sql_filters: Sequence,
) -> list[RankedJob]:
    """
    Stage 1: ANN query — retrieve top-CANDIDATE_POOL nearest jobs by cosine distance.
    Stage 2: Re-rank with blended score.
    """
    distance_col = JobPosting.description_embedding.cosine_distance(profile_emb)

    candidates = (
        _base_q(db, extra_sql_filters)
        .add_columns(distance_col.label("dist"))
        .filter(JobPosting.description_embedding.isnot(None))
        .order_by(distance_col)           # ASC = closest (most similar) first
        .limit(CANDIDATE_POOL)
        .all()
    )

    results: list[RankedJob] = []
    for job, employer, dist in candidates:
        cosine_sim = max(0.0, 1.0 - float(dist))
        semantic_score = round(cosine_sim * 100)

        required = job.required_skills or []
        overlap = _skill_overlap_pct(user_skills, required)
        k_fit   = _safe_krs_fit(k_score, job.min_k_score)
        have, gap = _split_skills(user_lower, required)

        score = _blended_score(semantic_score, overlap, k_fit)
        score = _apply_sector_bonus(score, job, selected_sectors)

        results.append(RankedJob(
            job=job,
            employer=employer,
            match_score=score,
            skill_overlap=overlap,
            semantic_score=semantic_score,
            skills_you_have=have,
            skills_to_develop=gap,
            is_prepared=str(job.id) in prepared_job_ids,
        ))

    results.sort(key=lambda r: r.match_score, reverse=True)
    return results


# ── Cold-start path: rule-based fallback ─────────────────────────────────────

def _rule_rank(
    user_skills: set[str],
    user_lower: set[str],
    k_score: Optional[int],
    selected_sectors: frozenset[str],
    prepared_job_ids: frozenset[str],
    db: Session,
    extra_sql_filters: Sequence,
) -> list[RankedJob]:
    """
    Rule-based ranking for users without a profile embedding.
    All active jobs are candidates — no ANN retrieval limit.
    """
    now = datetime.now(timezone.utc)
    recency_cutoff = now - timedelta(days=_RECENCY_DAYS)

    rows = _base_q(db, extra_sql_filters).all()

    results: list[RankedJob] = []
    for job, employer in rows:
        required = job.required_skills or []
        overlap = _skill_overlap_pct(user_skills, required)
        k_fit   = _safe_krs_fit(k_score, job.min_k_score)
        have, gap = _split_skills(user_lower, required)

        score = round(0.60 * overlap + 0.40 * k_fit)
        score = _apply_sector_bonus(score, job, selected_sectors)

        # Recency nudge for fresh listings — helps new users see recent opportunities
        if job.created_at and job.created_at >= recency_cutoff:
            score = min(100, score + _RECENCY_BONUS)

        results.append(RankedJob(
            job=job,
            employer=employer,
            match_score=score,
            skill_overlap=overlap,
            semantic_score=None,
            skills_you_have=have,
            skills_to_develop=gap,
            is_prepared=str(job.id) in prepared_job_ids,
        ))

    results.sort(key=lambda r: r.match_score, reverse=True)
    return results


# ── Public API ────────────────────────────────────────────────────────────────

def rank_jobs_for_user(
    profile: AspirantProfile,
    krs: Optional[KrsScore],
    db: Session,
    *,
    extra_sql_filters: Sequence = (),
    selected_sectors: frozenset[str] = frozenset(),
    prepared_job_ids: frozenset[str] = frozenset(),
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[RankedJob], int]:
    """
    Rank active jobs for a user and return a paginated page.

    Returns (page, total_count) where page has at most `limit` items starting
    at `offset`.  total_count reflects the full result set before pagination.
    """
    # profile or krs may be None (e.g. admin user, or onboarding not yet complete)
    user_skills = set(profile.skills or []) if profile else set()
    user_lower  = {s.lower().strip() for s in user_skills}
    k_score     = krs.k_score if krs else None
    profile_emb = krs.profile_embedding if krs else None

    try:
        if profile_emb is not None:
            all_results = _vector_rank(
                profile_emb, user_skills, user_lower, k_score,
                selected_sectors, prepared_job_ids, db, extra_sql_filters,
            )
        else:
            all_results = _rule_rank(
                user_skills, user_lower, k_score,
                selected_sectors, prepared_job_ids, db, extra_sql_filters,
            )
    except Exception:
        logger.exception("[RANKER] Ranking failed — falling back to rule-based")
        all_results = _rule_rank(
            user_skills, user_lower, k_score,
            selected_sectors, prepared_job_ids, db, extra_sql_filters,
        )

    total = len(all_results)
    page  = all_results[offset : offset + limit]
    return page, total
