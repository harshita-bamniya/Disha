"""
KRS Scoring Engine — rule-based, no AI keys required.

K = Knowledge  (0-100)  — depth of UPSC / competitive exam journey
R = Readiness  (0-100)  — education + work experience + skill breadth + full psychological profile
S = Skills     (0-100)  — how well the user's skills cover real market demand

Composite = K×0.35 + R×0.30 + S×0.35  (0-100)
            Skills relevance shares equal weight with UPSC depth because
            employers screen primarily on skills, not exam history.

K score (max raw 123 → /123×100):
  stage_cleared (80) + years_preparing (18) + exam_type (12)
  + attempts/grit bonus (8) + optional_subject transferability (5)

R score:
  Without psych — max raw 95  → /95×100
  With psych    — max raw 160 → /160×100
  Uses ALL 7 mindset fields (previous engine ignored 5 of them).

S score (fully dynamic):
  Anchors = required_skills from all active JobPostings (real market demand)
            UNION required_skills from CareerTracks (curated UPSC archetypes).
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


# ── Optional subject transferability lookup ───────────────────────────────────

_OPTIONAL_TRANSFERABILITY: dict[str, int] = {
    "public administration": 5,
    "economics": 5,
    "law": 4,
    "international relations": 4,
    "political science": 2,
    "geography": 2,
    "history": 2,
    "sociology": 2,
    "philosophy": 1,
}


# ── K score ───────────────────────────────────────────────────────────────────

def compute_k_score(profile: AspirantProfile) -> int:
    """
    Knowledge score: how deep has the aspirant gone in UPSC preparation.

    Signals used:
      - Stage cleared  (max 80) — primary differentiator
      - Years preparing (max 18) — sustained effort
      - Exam type      (max 12) — CSE/IES > state exams
      - Attempts       (max  8) — grit/persistence
      - Optional subject (max 5) — private-sector transferability
    Max raw = 123.
    """
    raw = 0.0

    stage_pts = {"none": 10, "prelims": 35, "mains": 60, "interview": 80}
    raw += stage_pts.get(profile.highest_stage_cleared or "none", 10)

    yrs = profile.years_preparing or 0
    if yrs >= 6:   raw += 18
    elif yrs >= 3: raw += 12
    elif yrs >= 1: raw += 5

    exam_pts = {"cse": 12, "ies": 10, "cms": 10, "capf": 8, "cds": 8, "state_pcs": 6, "other": 4}
    raw += exam_pts.get(profile.upsc_exam or "other", 4)

    attempts = profile.upsc_attempts or 0
    if attempts >= 4:   raw += 8
    elif attempts >= 3: raw += 5
    elif attempts >= 2: raw += 3

    opt = (profile.optional_subject or "").lower().strip()
    raw += next((v for k, v in _OPTIONAL_TRANSFERABILITY.items() if k in opt), 1)

    return _clamp(raw / 123 * 100)


# ── R score ───────────────────────────────────────────────────────────────────

def compute_r_score(profile: AspirantProfile, psych=None) -> int:
    """
    Readiness score: education + work experience + skill breadth + psychological profile.

    Without psych → max raw 95  → normalised /95×100
    With psych    → max raw 160 → normalised /160×100

    All 7 mindset-assessment fields are used:
      confidence_index        → up to 18 pts (direct transition confidence)
      burnout_score           → up to 12 pts (lower burnout = more energy)
      risk_tolerance          → up to  8 pts (high = willing to leap)
      motivation_type         → up to  6 pts (extrinsic = aligned with private sector)
      identity_attachment     → up to  8 pts (low = mentally moved on)
      support_system          → up to  5 pts (strong = backing for the change)
      financial_pressure_score→ up to  8 pts (some pressure = motivating sweet spot)
    """
    raw = 0.0

    edu_pts = {"doctorate": 30, "post_graduate": 22, "graduate": 16, "diploma": 12, "other": 10}
    raw += edu_pts.get(profile.highest_qualification or "other", 10)

    if profile.has_work_experience:
        yrs = profile.work_experience_years or 0
        if yrs >= 5:   raw += 40
        elif yrs >= 3: raw += 30
        elif yrs >= 1: raw += 18

    n_skills = len(profile.skills or [])
    if n_skills >= 7:   raw += 25
    elif n_skills >= 4: raw += 15
    elif n_skills >= 1: raw += 5

    if not psych:
        return _clamp(raw / 95 * 100)

    # Confidence in private-sector transition (0-100 → 0-18 pts)
    raw += (psych.confidence_index / 100) * 18

    # Low burnout = more capacity to make the leap (0-100 → 0-12 pts, inverted)
    raw += ((100 - psych.burnout_score) / 100) * 12

    # Risk tolerance: high risk appetite = more likely to commit to the transition
    raw += {"low": 0, "medium": 5, "high": 8}.get(psych.risk_tolerance or "medium", 5)

    # Motivation: extrinsic (salary/recognition) is most aligned with private sector norms
    raw += {"intrinsic": 4, "extrinsic": 6, "mixed": 5}.get(psych.motivation_type or "mixed", 5)

    # Identity attachment: low = mentally moved on from UPSC identity = more ready
    raw += {"low": 8, "medium": 4, "high": 0}.get(psych.identity_attachment or "medium", 4)

    # Support system: family/friend backing eases the transition significantly
    raw += {"strong": 5, "moderate": 3, "weak": 0}.get(psych.support_system or "moderate", 3)

    # Financial pressure: some pressure motivates; urgency or none reduces decision quality
    # Stored values: no_rush=10, some_pressure=35, significant=65, urgent=90
    pressure_pts = {10: 3, 35: 8, 65: 5, 90: 2}
    raw += pressure_pts.get(psych.financial_pressure_score, 4)

    return _clamp(raw / 160 * 100)


# ── S score ───────────────────────────────────────────────────────────────────

def _fetch_anchor_vectors(db: Session) -> list[list[float]]:
    """
    Build the market-demand anchor set from two sources:
      1. Active JobPostings.required_skills — real skills employers are hiring for right now.
      2. CareerTracks.required_skills       — curated UPSC-to-private-sector archetypes.
    Using both means the score is immediately meaningful (career tracks) and
    grows more accurate as more employers join the platform (job postings).
    """
    from app.models.user import CareerTrack, JobPosting
    from app.models.mvp2 import SkillVector

    all_skills: set[str] = set()

    # Active job postings — reflects live market demand
    for j in db.query(JobPosting).filter(JobPosting.is_active == True).all():
        for s in (j.required_skills or []):
            all_skills.add(s.lower().strip())

    # Career track archetypes — always included as a curated baseline
    for t in db.query(CareerTrack).all():
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

    With DB:    anchors = active JobPostings + CareerTracks (dynamic + curated).
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
    # S shares equal weight with K — employers screen on skills, not just exam depth.
    return _clamp(k * 0.35 + r * 0.30 + s * 0.35)


def compute_all(profile: AspirantProfile, psych=None, db: Session | None = None) -> dict[str, int]:
    k = compute_k_score(profile)
    r = compute_r_score(profile, psych)
    s = compute_s_score(profile, db)
    return {"k_score": k, "r_score": r, "s_score": s, "composite": compute_composite(k, r, s)}
