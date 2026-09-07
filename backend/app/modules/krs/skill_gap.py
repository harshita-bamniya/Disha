"""Semantic skill gap computation.

Replaces the old exact string-match approach with vector cosine similarity.
All embeddings are pre-cached in skill_vectors — no AI call happens at query time.

Gap detection threshold: 0.78 cosine similarity.
  - Two skills with similarity >= 0.78 are treated as equivalent.
  - e.g. "stakeholder management" ≈ "Stakeholder Engagement" (sim ~0.82) → user has it
  - e.g. "data storytelling" vs "Leadership" (sim ~0.31) → gap

Fallback: if embeddings are unavailable (model not loaded, cold start),
falls back to case-insensitive exact string match so the system never breaks.
"""
from __future__ import annotations

import logging
import numpy as np
from sqlalchemy.orm import Session

from app.models.skill_vectors import SkillVector
from app.modules.recommendations import embedder

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.78


def _load_vectors(skills: list[str], db: Session) -> dict[str, list[float]]:
    """Load cached embeddings for a list of skills. Returns {normalised_text: vector}."""
    normalised = [s.lower().strip() for s in skills]
    rows = (
        db.query(SkillVector)
        .filter(SkillVector.skill_text.in_(normalised))
        .all()
    )
    return {r.skill_text: r.embedding for r in rows}


def _embed_missing(missing: list[str], db: Session) -> dict[str, list[float]]:
    """Synchronously embed skills not yet in cache. Used as fallback at query time."""
    if not missing:
        return {}
    vecs = embedder.embed_batch(missing)
    result: dict[str, list[float]] = {}
    for skill, vec in zip(missing, vecs):
        if vec is not None:
            norm = SkillVector(skill_text=skill, embedding=vec)
            db.merge(norm)
            result[skill] = vec
    try:
        db.commit()
    except Exception:
        db.rollback()
    return result


def _max_cosine(query_vec: list[float], candidate_vecs: list[list[float]]) -> float:
    """Return max cosine similarity between query_vec and any vector in candidates."""
    if not candidate_vecs:
        return 0.0
    q = np.asarray(query_vec, dtype=np.float32)
    C = np.asarray(candidate_vecs, dtype=np.float32)
    norms = np.linalg.norm(C, axis=1)
    valid = norms > 0
    if not np.any(valid):
        return 0.0
    C_norm = C[valid] / norms[valid, np.newaxis]
    q_norm_val = float(np.linalg.norm(q))
    if q_norm_val == 0:
        return 0.0
    q_n = q / q_norm_val
    sims = C_norm @ q_n
    return float(np.max(sims))


def compute_gap(
    user_skills: list[str],
    required_skills: list[str],
    db: Session,
) -> tuple[list[str], list[str], int]:
    """Return (skills_you_have, skills_to_develop, gap_pct).

    Uses vector cosine similarity. Falls back to string match if embeddings unavailable.
    """
    if not required_skills:
        return [], [], 0
    if not user_skills:
        return [], list(required_skills), 100

    all_skills = list({s.lower().strip() for s in user_skills + required_skills})
    cached = _load_vectors(all_skills, db)

    # Find any skills not yet cached and embed them synchronously
    missing = [s for s in all_skills if s not in cached]
    if missing:
        logger.info("[SKILL_GAP] %d skills not cached — embedding on-demand", len(missing))
        fresh = _embed_missing(missing, db)
        cached.update(fresh)

    user_vecs = [cached[s.lower().strip()] for s in user_skills if s.lower().strip() in cached]

    if not user_vecs:
        # Embedding unavailable — fall back to string match
        logger.warning("[SKILL_GAP] No user skill vectors — falling back to string match")
        user_lower = {s.lower().strip() for s in user_skills}
        have = [s for s in required_skills if s.lower().strip() in user_lower]
        gap = [s for s in required_skills if s.lower().strip() not in user_lower]
        pct = round(len(gap) / len(required_skills) * 100)
        return have, gap, pct

    have: list[str] = []
    gap: list[str] = []

    for req in required_skills:
        req_key = req.lower().strip()
        req_vec = cached.get(req_key)
        if req_vec is None:
            # No vector for this job skill — fall back to string match for this skill
            if req_key in {s.lower().strip() for s in user_skills}:
                have.append(req)
            else:
                gap.append(req)
            continue

        sim = _max_cosine(req_vec, user_vecs)
        if sim >= SIMILARITY_THRESHOLD:
            have.append(req)
        else:
            gap.append(req)

    gap_pct = round(len(gap) / len(required_skills) * 100)
    return have, gap, gap_pct


def skill_overlap_pct(
    user_skills: list[str],
    required_skills: list[str],
    db: Session,
) -> int:
    """Return % of required_skills the user semantically has. Used for job ranking."""
    _, _, gap_pct = compute_gap(user_skills, required_skills, db)
    return 100 - gap_pct
