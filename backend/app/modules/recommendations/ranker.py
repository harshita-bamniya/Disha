"""
Production two-stage job ranker — v2.0

Stage 1 — Retrieve
    pgvector HNSW ANN query using the <=> cosine-distance operator.
    Hard filters (active, approved, unexpired, caller-supplied extras) applied
    in SQL WHERE.  Index-accelerated — O(log n) regardless of job table size.

Stage 2 — Re-rank
    Blended scoring on at most CANDIDATE_POOL (200) candidates in Python:
        semantic      45%  (cosine similarity from Stage 1)
        skill_overlap 35%  (exact skill set intersection)
        k_fit         20%  (K-score vs job's min_k_score)
    + collaborative boost up to +5 pts (item-item co-occurrence)
    + sector-affinity bonus +8 pts for user-selected career track sectors.
    All capped at 100.

Stage 3 — MMR Diversity Re-ranking  [NEW]
    Maximal Marginal Relevance with dynamic λ based on user maturity:
      New user  (0 applications)  → λ=0.30  maximum exploration/diversity
      Learning  (1-3 applications)→ λ=0.50  balanced
      Established (3-10)          → λ=0.75  mostly precision, some variety
      Power user (10+)            → λ=0.90  pure precision

Collaborative Filtering  [NEW]
    Item-item co-occurrence from Application table.
    Jobs co-applied with user's history get up to +5 pts boost.

Stretch Goals  [NEW]
    Jobs where the user is missing only 1-2 required skills are kept
    and surfaced with a "Learn X to qualify" nudge instead of being hidden.

Match Quality Grouping  [NEW]
    perfect   → score ≥ 75, no skill gap
    strong    → score 50-74, no skill gap
    potential → score 30-49, no skill gap
    skill_gap → missing 1-2 skills (any score) — stretch goal
"""
from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Sequence

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.user import EmployerProfile, JobPosting, AspirantProfile, KrsScore
from app.modules.krs.matching import _krs_fit

logger = logging.getLogger(__name__)

CANDIDATE_POOL = 200
_SECTOR_BONUS = 8
_RECENCY_DAYS = 7
_RECENCY_BONUS = 5
_COLLAB_MAX_BOOST = 5   # collaborative filtering adds at most +5 pts


# ── Dynamic λ ─────────────────────────────────────────────────────────────────

def _dynamic_lambda(num_applications: int) -> float:
    """
    Adjust MMR exploration vs exploitation based on how many jobs the user
    has applied to.  New users see diverse results; power users get precision.
    """
    if num_applications == 0:
        return 0.30
    if num_applications <= 3:
        return 0.50
    if num_applications < 10:
        return 0.75
    return 0.90


# ── Collaborative Filtering ───────────────────────────────────────────────────

class CollaborativeRecommender:
    """Item-item co-occurrence collaborative filter.

    Trained on the full application history of all users.
    Given a user's applied job IDs, returns normalised co-occurrence scores
    for every other job.
    """

    def __init__(self):
        self._co_occurrence: dict[str, dict[str, int]] = defaultdict(dict)

    def train(self, application_history: list[dict[str, Any]]) -> None:
        user_items: dict[Any, set] = {}
        for app in application_history:
            uid = app["user_id"]
            jid = str(app["job_id"])
            user_items.setdefault(uid, set()).add(jid)

        for items in user_items.values():
            items_list = list(items)
            for i, a in enumerate(items_list):
                for b in items_list[i + 1:]:
                    self._co_occurrence[a][b] = self._co_occurrence[a].get(b, 0) + 1
                    self._co_occurrence[b][a] = self._co_occurrence[b].get(a, 0) + 1

    def scores_for_user(
        self,
        applied_ids: list[str],
        all_job_ids: list[str],
    ) -> dict[str, float]:
        """Return normalised co-occurrence scores (0-1) per job."""
        raw: dict[str, float] = {}
        for seed in applied_ids:
            for job_id, count in self._co_occurrence.get(seed, {}).items():
                if job_id not in applied_ids:
                    raw[job_id] = raw.get(job_id, 0) + count

        if not raw:
            return {}

        max_score = max(raw.values())
        return {k: v / max_score for k, v in raw.items()}


# ── Stretch Goal Detection ────────────────────────────────────────────────────

def _stretch_goal(skills_to_develop: list[str]) -> tuple[bool, str | None]:
    """
    A job is a stretch goal if the user is missing exactly 1 or 2 required
    skills.  Returns (is_stretch_goal, human_readable_message).
    """
    gap = len(skills_to_develop)
    if gap == 1:
        return True, f"Learn '{skills_to_develop[0]}' to qualify for this role"
    if gap == 2:
        s0, s1 = skills_to_develop[0], skills_to_develop[1]
        return True, f"Learn '{s0}' and '{s1}' to unlock this opportunity"
    return False, None


# ── Match Quality Label ───────────────────────────────────────────────────────

def _match_quality(score: int, is_stretch_goal: bool) -> str:
    if is_stretch_goal:
        return "skill_gap"
    if score >= 75:
        return "perfect"
    if score >= 50:
        return "strong"
    if score >= 30:
        return "potential"
    return "exploratory"


# ── Match Reason Builder ──────────────────────────────────────────────────────

def _build_match_reasons(
    ranked: "RankedJob",
    profile: AspirantProfile,
    selected_sectors: frozenset[str],
) -> list[str]:
    reasons: list[str] = []

    # Stretch goal nudge always goes first
    if ranked.stretch_goal_message:
        reasons.append(ranked.stretch_goal_message)

    if ranked.skills_you_have:
        top = ranked.skills_you_have[:3]
        reasons.append(f"Your skills match: {', '.join(top)}")

    job = ranked.job
    if job.sector and selected_sectors and job.sector.lower() in selected_sectors:
        reasons.append(f"Aligns with your chosen sector: {job.sector}")

    if ranked.semantic_score and ranked.semantic_score >= 70:
        reasons.append("Strong profile-to-job description fit")
    elif ranked.semantic_score and ranked.semantic_score >= 50:
        reasons.append("Good profile-to-job description fit")

    if ranked.collab_boost > 0:
        reasons.append("Popular among aspirants with similar backgrounds")

    if job.expires_at:
        days_left = (job.expires_at - datetime.now(timezone.utc).date()).days
        if 0 < days_left <= 7:
            reasons.append(f"Closing in {days_left} day{'s' if days_left != 1 else ''} - apply soon")
        elif 0 < days_left <= 30:
            reasons.append(f"Deadline in {days_left} days")

    return reasons[:5]


# ── MMR Diversity Re-ranking ──────────────────────────────────────────────────

def _mmr_rerank(
    ranked_items: list["RankedJob"],
    top_k: int,
    lambda_mmr: float,
) -> list["RankedJob"]:
    """
    Maximal Marginal Relevance re-ranking.

    Selects items that are relevant but not too similar to already-selected
    items.  Similarity is computed on sector + location overlap.
    """
    if not ranked_items:
        return []

    selected: list[RankedJob] = []
    remaining = list(ranked_items)

    while len(selected) < top_k and remaining:
        best_item: RankedJob | None = None
        best_mmr = -float("inf")

        for item in remaining:
            relevance = item.match_score / 100.0

            if not selected:
                max_sim = 0.0
            else:
                sims = []
                for sel in selected:
                    sector_sim = 1.0 if item.job.sector == sel.job.sector else 0.0
                    loc_sim = 1.0 if (item.job.location or "") == (sel.job.location or "") else 0.0
                    sims.append(0.6 * sector_sim + 0.4 * loc_sim)
                max_sim = max(sims)

            mmr_score = lambda_mmr * relevance - (1 - lambda_mmr) * max_sim
            if mmr_score > best_mmr:
                best_mmr = mmr_score
                best_item = item

        if best_item:
            selected.append(best_item)
            remaining.remove(best_item)

    return selected


# ── Data class ────────────────────────────────────────────────────────────────

@dataclass
class RankedJob:
    job: JobPosting
    employer: EmployerProfile
    match_score: int
    skill_overlap: int
    semantic_score: Optional[int]
    skills_you_have: list[str] = field(default_factory=list)
    skills_to_develop: list[str] = field(default_factory=list)
    is_prepared: bool = False
    # v2.0 additions
    is_stretch_goal: bool = False
    stretch_goal_message: str | None = None
    match_quality: str = "exploratory"
    match_reasons: list[str] = field(default_factory=list)
    collab_boost: int = 0


# ── Internal helpers ──────────────────────────────────────────────────────────

def _skill_overlap_pct(user_skills: set[str], required: list[str]) -> int:
    if not required:
        return 100
    user_lower = {s.lower().strip() for s in user_skills}
    matched = sum(1 for s in required if s.lower().strip() in user_lower)
    return round(matched / len(required) * 100)


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


def _safe_krs_fit(k_score: Optional[int], min_k: int) -> int:
    if k_score is None:
        return 50
    return _krs_fit(k_score, min_k)


# ── Base query builder ────────────────────────────────────────────────────────

def _base_q(db: Session, extra_sql_filters: Sequence):
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

def _vector_rank(
    profile_emb: list[float],
    user_skills: set[str],
    user_lower: set[str],
    k_score: Optional[int],
    selected_sectors: frozenset[str],
    prepared_job_ids: frozenset[str],
    collab_scores: dict[str, float],
    db: Session,
    extra_sql_filters: Sequence,
) -> list[RankedJob]:
    distance_col = JobPosting.description_embedding.cosine_distance(profile_emb)

    candidates = (
        _base_q(db, extra_sql_filters)
        .add_columns(distance_col.label("dist"))
        .filter(JobPosting.description_embedding.isnot(None))
        .order_by(distance_col)
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

        # Collaborative boost
        collab_raw = collab_scores.get(str(job.id), 0.0)
        collab_boost = round(collab_raw * _COLLAB_MAX_BOOST)
        score = min(100, score + collab_boost)

        results.append(RankedJob(
            job=job,
            employer=employer,
            match_score=score,
            skill_overlap=overlap,
            semantic_score=semantic_score,
            skills_you_have=have,
            skills_to_develop=gap,
            is_prepared=str(job.id) in prepared_job_ids,
            collab_boost=collab_boost,
        ))

    results.sort(key=lambda r: r.match_score, reverse=True)
    return results


# ── Cold-start path ───────────────────────────────────────────────────────────

def _rule_rank(
    user_skills: set[str],
    user_lower: set[str],
    k_score: Optional[int],
    selected_sectors: frozenset[str],
    prepared_job_ids: frozenset[str],
    collab_scores: dict[str, float],
    db: Session,
    extra_sql_filters: Sequence,
) -> list[RankedJob]:
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

        if job.created_at and job.created_at >= recency_cutoff:
            score = min(100, score + _RECENCY_BONUS)

        collab_raw = collab_scores.get(str(job.id), 0.0)
        collab_boost = round(collab_raw * _COLLAB_MAX_BOOST)
        score = min(100, score + collab_boost)

        results.append(RankedJob(
            job=job,
            employer=employer,
            match_score=score,
            skill_overlap=overlap,
            semantic_score=None,
            skills_you_have=have,
            skills_to_develop=gap,
            is_prepared=str(job.id) in prepared_job_ids,
            collab_boost=collab_boost,
        ))

    results.sort(key=lambda r: r.match_score, reverse=True)
    return results


# ── Post-processing: semantic skill gap + stretch goals + quality labels ───────

def _post_process_page(
    page: list[RankedJob],
    user_skills: set[str],
    selected_sectors: frozenset[str],
    db: Session,
) -> list[RankedJob]:
    """
    For the final page (≤20 jobs):
    1. Upgrade skills_you_have / skills_to_develop to semantic match
    2. Detect stretch goals (1-2 missing skills)
    3. Assign match quality label
    4. Build human-readable match reasons
    """
    user_skill_list = list(user_skills)
    for ranked in page:
        required = ranked.job.required_skills or []

        # Semantic skill gap (replaces string-match split from ranking stage)
        if required and db is not None:
            try:
                from app.modules.krs.skill_gap import compute_gap
                have, gap, _ = compute_gap(user_skill_list, required, db)
                ranked.skills_you_have = have
                ranked.skills_to_develop = gap
            except Exception:
                logger.warning("[RANKER] Semantic skill split failed — keeping string-match results")

        # Stretch goal detection
        is_sg, msg = _stretch_goal(ranked.skills_to_develop)
        ranked.is_stretch_goal = is_sg
        ranked.stretch_goal_message = msg

        # Match quality
        ranked.match_quality = _match_quality(ranked.match_score, is_sg)

        # Match reasons
        ranked.match_reasons = _build_match_reasons(ranked, None, selected_sectors)

    return page


# ── Public API ────────────────────────────────────────────────────────────────

def rank_jobs_for_user(
    profile: AspirantProfile,
    krs: Optional[KrsScore],
    db: Session,
    *,
    extra_sql_filters: Sequence = (),
    selected_sectors: frozenset[str] = frozenset(),
    prepared_job_ids: frozenset[str] = frozenset(),
    application_history: list[dict[str, Any]] | None = None,
    applied_job_ids: list[str] | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[RankedJob], int]:
    """
    Rank active jobs for a user and return a paginated page.

    v2.0: adds collaborative filtering, MMR diversity re-ranking,
    stretch goal detection, and match quality grouping.

    Returns (page, total_count).
    """
    if db is None:
        return [], 0

    user_skills = set(profile.skills or []) if profile else set()
    user_lower  = {s.lower().strip() for s in user_skills}
    k_score     = krs.k_score if krs else None
    profile_emb = krs.profile_embedding if krs else None

    # ── Collaborative filtering ────────────────────────────────────────────────
    collab_scores: dict[str, float] = {}
    if application_history and applied_job_ids:
        try:
            collab = CollaborativeRecommender()
            collab.train(application_history)
            collab_scores = collab.scores_for_user(
                applied_ids=applied_job_ids,
                all_job_ids=[],  # not needed — scores_for_user iterates co-occurrence
            )
        except Exception as exc:
            logger.warning("[RANKER] Collaborative filtering failed: %s", exc)

    # ── Stage 1+2: rank all candidates ────────────────────────────────────────
    try:
        if profile_emb is not None:
            all_results = _vector_rank(
                profile_emb, user_skills, user_lower, k_score,
                selected_sectors, prepared_job_ids, collab_scores,
                db, extra_sql_filters,
            )
        else:
            all_results = _rule_rank(
                user_skills, user_lower, k_score,
                selected_sectors, prepared_job_ids, collab_scores,
                db, extra_sql_filters,
            )
    except Exception:
        logger.exception("[RANKER] Ranking failed — falling back to rule-based")
        all_results = _rule_rank(
            user_skills, user_lower, k_score,
            selected_sectors, prepared_job_ids, collab_scores,
            db, extra_sql_filters,
        )

    total = len(all_results)

    # ── Stage 3: MMR diversity re-ranking ─────────────────────────────────────
    num_applied = len(applied_job_ids or [])
    lambda_mmr = _dynamic_lambda(num_applied)

    # MMR pool: best (limit*3) candidates before pagination
    # We re-rank within the offset window so pagination stays consistent
    pool_end = offset + limit * 3
    mmr_pool = all_results[offset:pool_end] if offset < total else []
    mmr_results = _mmr_rerank(mmr_pool, top_k=limit, lambda_mmr=lambda_mmr)

    # ── Post-process the returned page ────────────────────────────────────────
    if mmr_results and db is not None:
        mmr_results = _post_process_page(mmr_results, user_skills, selected_sectors, db)

    return mmr_results, total
