"""
KRS Scoring Engine — rule-based, no AI keys required.

K = Knowledge  (0-100)  — depth of UPSC / competitive exam journey
R = Readiness  (0-100)  — education + work experience + skill breadth + psychological state
S = Skills     (0-100)  — quality & market demand of specific skills selected

Composite = K*0.40 + R*0.35 + S*0.25  (0-100)
"""
from app.models.user import AspirantProfile

# ── Skill market-demand weights ───────────────────────────────────────────────
# Weights reflect private-sector demand for UPSC-aspirant transferable skills.
# S-score = sum of selected skill weights / sum of top-10 weights × 100
SKILL_WEIGHTS: dict[str, int] = {
    # Core analytical / research (highest private-sector demand)
    "Analytical Reasoning":    9,
    "Research & Analysis":     9,
    "Data Interpretation":     8,
    "Data Analysis":           8,   # quantitative analysis, Excel/SQL work
    "Policy Research":         8,   # think tanks, govt liaison, consulting

    # Communication & delivery
    "Report Writing":          7,   # distinct from essay writing — structured reports
    "Essay Writing":           5,   # UPSC-style long-form writing
    "Public Speaking":         6,   # presentations, stakeholder meetings

    # Leadership & operations
    "Leadership":              7,
    "Management":              6,
    "Project Management":      7,   # planning, execution, delivery
    "Strategic Planning":      6,   # goal-setting, roadmaps

    # Domain knowledge
    "Economics":               7,
    "Public Administration":   7,
    "Polity & Governance":     6,
    "Ethics & Integrity":      6,
    "International Relations": 6,
    "Law & Legal Knowledge":   6,
    "Stakeholder Engagement":  5,   # govt, NGO, corporate liaison

    # Proficiency
    "Communication":           7,
    "English Proficiency":     5,
    "Hindi Proficiency":       4,
    "Computer Skills":         5,

    # UPSC subject knowledge (lower private-sector weight)
    "Science & Technology":    5,
    "Current Affairs":         5,
    "History":                 4,
    "Geography":               4,
    "Environment":             4,

    # Sector-specific transferable
    "Teaching & Training":     5,   # EdTech, coaching, L&D roles
    "Budget & Finance":        5,   # planning, NGO, govt roles
}

_MAX_SKILL_RAW = sum(sorted(SKILL_WEIGHTS.values(), reverse=True)[:10])  # top-10 sum


def _clamp(val: float, lo: float = 0, hi: float = 100) -> int:
    return max(lo, min(hi, round(val)))


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


def compute_r_score(profile: AspirantProfile, psych=None) -> int:
    """Readiness score: education + experience + skill breadth + psychological readiness.

    When psych (PsychologicalAssessment) is provided, it adds up to 30 additional
    points based on confidence and burnout — boosting the R-score maximum to 125
    before normalisation, enabling genuinely high R-scores for psychologically ready aspirants.
    """
    raw = 0.0

    # Education level: max 30
    edu_pts = {"doctorate": 30, "post_graduate": 22, "graduate": 16, "diploma": 12, "other": 10}
    raw += edu_pts.get(profile.highest_qualification or "other", 10)

    # Work experience: max 40
    if profile.has_work_experience:
        yrs = profile.work_experience_years or 0
        if yrs >= 5:
            raw += 40
        elif yrs >= 3:
            raw += 30
        elif yrs >= 1:
            raw += 18

    # Skill breadth (number of skills): max 25
    n_skills = len(profile.skills or [])
    if n_skills >= 7:
        raw += 25
    elif n_skills >= 4:
        raw += 15
    elif n_skills >= 1:
        raw += 5

    if not psych:
        # Without psychological data, normalise over 95
        return _clamp(raw / 95 * 100)

    # Psychological readiness: confidence and low burnout signal transition readiness
    # psych_score 0-100 where 100 = fully confident + zero burnout
    psych_score = (psych.confidence_index * 0.6 + (100 - psych.burnout_score) * 0.4)
    raw += (psych_score / 100) * 30   # adds 0–30 pts

    # Normalise over 125 (95 + 30)
    return _clamp(raw / 125 * 100)


def compute_s_score(profile: AspirantProfile) -> int:
    """Skills score: quality & market demand of selected skills."""
    selected = set(profile.skills or [])
    if not selected:
        return 0

    total = sum(SKILL_WEIGHTS.get(skill, 3) for skill in selected)
    return _clamp(total / _MAX_SKILL_RAW * 100)


def compute_composite(k: int, r: int, s: int) -> int:
    return _clamp(k * 0.40 + r * 0.35 + s * 0.25)


def compute_all(profile: AspirantProfile, psych=None) -> dict[str, int]:
    k = compute_k_score(profile)
    r = compute_r_score(profile, psych)
    s = compute_s_score(profile)
    return {"k_score": k, "r_score": r, "s_score": s, "composite": compute_composite(k, r, s)}
