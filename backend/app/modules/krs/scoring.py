"""
KRS Scoring Engine — rule-based, no AI keys required.

K = Knowledge  (0-100)  — depth of UPSC / competitive exam journey
R = Readiness  (0-100)  — education + work experience + skill breadth + psychological state
S = Skills     (0-100)  — how well the user's skills cover real market demand

Composite = K*0.40 + R*0.35 + S*0.25  (0-100)

S-score (fully dynamic):
  Anchors = all unique required_skills across every career track in the DB.
  For each user skill vector, find max cosine similarity to any anchor vector.
  S = mean(max_sims) × breadth_bonus × 100
  Falls back to breadth-only when DB or embeddings are unavailable.
  All vectors are fetched from the skill_vectors cache table — no AI call at
  score-time; Celery pre-populates the cache when skills are saved/extracted.
"""
from __future__ import annotations
import logging
import numpy as np
from sqlalchemy.orm import Session
from app.models.user import AspirantProfile

logger = logging.getLogger(__name__)


def _clamp(val: float, lo: float = 0, hi: float = 100) -> int:
    return max(lo, min(hi, round(val)))


# ── K score ───────────────────────────────────────────────────────────────────

def compute_k_score(profile: AspirantProfile) -> int:
    """Knowledge score: how deep has the aspirant gone in UPSC preparation."""
    raw = 0.0

    stage_pts = {"none": 10, "prelims": 35, "mains": 60, "interview": 80}
    raw += stage_pts.get(profile.highest_stage_cleared or "none", 10)

    yrs = profile.years_preparing or 0
    if yrs >= 6:
        raw += 18
    elif yrs >= 3:
        raw += 12
    elif yrs >= 1:
        raw += 5

    exam_pts = {"cse": 12, "ies": 10, "cms": 10, "capf": 8, "cds": 8, "state_pcs": 6, "other": 4}
    raw += exam_pts.get(profile.upsc_exam or "other", 4)

    return _clamp(raw / 110 * 100)


# ── R score ───────────────────────────────────────────────────────────────────

def compute_r_score(profile: AspirantProfile, psych=None) -> int:
    """Readiness score: education + experience + skill breadth + psychological readiness."""
    raw = 0.0

    edu_pts = {"doctorate": 30, "post_graduate": 22, "graduate": 16, "diploma": 12, "other": 10}
    raw += edu_pts.get(profile.highest_qualification or "other", 10)

    if profile.has_work_experience:
        yrs = profile.work_experience_years or 0
        if yrs >= 5:
            raw += 40
        elif yrs >= 3:
            raw += 30
        elif yrs >= 1:
            raw += 18

    n_skills = len(profile.skills or [])
    if n_skills >= 7:
        raw += 25
    elif n_skills >= 4:
        raw += 15
    elif n_skills >= 1:
        raw += 5

    if not psych:
        return _clamp(raw / 95 * 100)

    psych_score = (psych.confidence_index * 0.6 + (100 - psych.burnout_score) * 0.4)
    raw += (psych_score / 100) * 30

    return _clamp(raw / 125 * 100)


# ── S score ───────────────────────────────────────────────────────────────────

def _fetch_anchor_vectors(db: Session) -> list[list[float]]:
    """
    Fetch embeddings for all unique required_skills across every career track.
    These represent real market demand — no hardcoded anchors.
    Skills not yet in skill_vectors are embedded on-demand and cached.
    """
    from app.models.user import CareerTrack
    from app.models.mvp2 import SkillVector

    tracks = db.query(CareerTrack).all()
    all_skills: set[str] = set()
    for t in tracks:
        for s in (t.required_skills or []):
            all_skills.add(s.lower().strip())

    if not all_skills:
        return []

    cached = {
        r.skill_text: r.embedding
        for r in db.query(SkillVector).filter(SkillVector.skill_text.in_(list(all_skills))).all()
    }

    missing = [s for s in all_skills if s not in cached]
    if missing:
        try:
            from app.modules.recommendations.embedder import embed_batch
            vecs = embed_batch(missing)
            for skill, vec in zip(missing, vecs):
                if vec is not None:
                    db.merge(SkillVector(skill_text=skill, embedding=vec))
                    cached[skill] = vec
            db.commit()
        except Exception as exc:
            logger.warning("[KRS] On-demand anchor embedding failed: %s", exc)

    return [v for v in cached.values() if v is not None]


def compute_s_score(profile: AspirantProfile, db: Session | None = None) -> int:
    """
    Skills score: how well the user's skill set covers real market demand.

    With DB: anchors = all required_skills from career tracks (dynamic).
    Without DB: breadth-only fallback.
    """
    skills = list(profile.skills or [])
    if not skills:
        return 0

    breadth_mult = 1.0 if len(skills) >= 7 else (0.85 if len(skills) >= 4 else 0.65)

    if db is None:
        n = len(skills)
        if n >= 7: return 70
        if n >= 4: return 50
        return 30

    try:
        from app.models.mvp2 import SkillVector
        from app.modules.recommendations.embedder import embed_batch

        # Fetch or embed user skill vectors
        normalised = [s.lower().strip() for s in skills]
        cached = {
            r.skill_text: r.embedding
            for r in db.query(SkillVector).filter(SkillVector.skill_text.in_(normalised)).all()
        }
        missing = [s for s in normalised if s not in cached]
        if missing:
            vecs = embed_batch(missing)
            for skill, vec in zip(missing, vecs):
                if vec is not None:
                    db.merge(SkillVector(skill_text=skill, embedding=vec))
                    cached[skill] = vec
            try:
                db.commit()
            except Exception:
                db.rollback()

        user_vecs = [cached[s] for s in normalised if s in cached]
        if not user_vecs:
            n = len(skills)
            return 70 if n >= 7 else (50 if n >= 4 else 30)

        anchor_vecs = _fetch_anchor_vectors(db)
        if not anchor_vecs:
            n = len(skills)
            return 70 if n >= 7 else (50 if n >= 4 else 30)

        A = np.asarray(anchor_vecs, dtype=np.float32)
        A_norms = np.linalg.norm(A, axis=1, keepdims=True)
        A_norm = A / np.where(A_norms > 0, A_norms, 1)

        max_sims: list[float] = []
        for vec in user_vecs:
            v = np.asarray(vec, dtype=np.float32)
            v_norm_val = float(np.linalg.norm(v))
            if v_norm_val == 0:
                continue
            v_n = v / v_norm_val
            sims = A_norm @ v_n
            max_sims.append(float(np.max(sims)))

        if not max_sims:
            return 30

        return _clamp(float(np.mean(max_sims)) * breadth_mult * 100)

    except Exception as exc:
        logger.warning("[KRS] S-score computation failed: %s", exc)
        n = len(skills)
        return 70 if n >= 7 else (50 if n >= 4 else 30)


# ── Composite ─────────────────────────────────────────────────────────────────

def compute_composite(k: int, r: int, s: int) -> int:
    return _clamp(k * 0.40 + r * 0.35 + s * 0.25)


def compute_all(profile: AspirantProfile, psych=None, db: Session | None = None) -> dict[str, int]:
    k = compute_k_score(profile)
    r = compute_r_score(profile, psych)
    s = compute_s_score(profile, db)
    return {"k_score": k, "r_score": r, "s_score": s, "composite": compute_composite(k, r, s)}
