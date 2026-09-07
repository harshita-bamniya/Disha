"""Roadmap Personalization Engine.

Adjusts roadmap configuration based on the user's KRS profile,
psychological assessment, and work experience. Called during
generate_roadmap() and recalibrate_roadmap() to set per-user
stage behavior.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class PersonalizationConfig:
    # Difficulty tier for ticket templates: junior / mid / senior
    preferred_difficulty: str = "junior"
    # Whether to skip Stage 2 foundations (S-score high → user has skills)
    skip_foundations: bool = False
    # Whether to insert a networking module in Stage 5
    insert_networking_module: bool = False
    # Whether to soften gate thresholds (low confidence users)
    soft_gates: bool = False
    # Whether to activate fast-track mode (financial pressure)
    fast_track: bool = False
    # Scaffolding level for exercises: minimal / moderate / heavy
    scaffolding_level: str = "moderate"
    # Coaching tone: encouraging / neutral / direct
    coaching_tone: str = "neutral"
    # Notes explaining configuration choices (shown to admins)
    notes: list[str] = None

    def __post_init__(self):
        if self.notes is None:
            self.notes = []

    def to_dict(self) -> dict:
        return {
            "preferred_difficulty": self.preferred_difficulty,
            "skip_foundations": self.skip_foundations,
            "insert_networking_module": self.insert_networking_module,
            "soft_gates": self.soft_gates,
            "fast_track": self.fast_track,
            "scaffolding_level": self.scaffolding_level,
            "coaching_tone": self.coaching_tone,
            "notes": self.notes,
        }


def build_personalization_config(
    k_score: int,
    r_score: int,
    s_score: int,
    burnout_score: float | None,
    confidence_index: float | None,
    work_experience_years: int,
) -> PersonalizationConfig:
    """
    Maps KRS scores and psychological signals to a PersonalizationConfig.

    Rules (applied in order — later rules can override earlier):
      K-high (≥70): elevate difficulty to mid/senior, user has domain mastery
      S-high (≥65): skip_foundations (user has applicable skills already)
      R-low (<35):  insert networking module — readiness requires network signals
      confidence_index < 40: soft_gates + encouraging tone
      burnout_score > 70: reduce scaffolding to avoid overwhelm
      work_experience_years ≥ 5: senior difficulty + minimal scaffolding
      work_experience_years < 1: heavy scaffolding + junior difficulty
    """
    cfg = PersonalizationConfig()

    # Knowledge score routing
    if k_score >= 70:
        cfg.preferred_difficulty = "mid"
        cfg.notes.append(f"K-score={k_score} → mid difficulty (strong domain knowledge)")
        if k_score >= 85:
            cfg.preferred_difficulty = "senior"
            cfg.notes.append(f"K-score={k_score} → senior difficulty (expert domain knowledge)")

    # Skills score routing
    if s_score >= 65:
        cfg.skip_foundations = True
        cfg.notes.append(f"S-score={s_score} → skip_foundations (existing applicable skills)")

    # Readiness score routing
    if r_score < 35:
        cfg.insert_networking_module = True
        cfg.notes.append(f"R-score={r_score} → networking module inserted (low market readiness)")

    # Confidence routing
    if confidence_index is not None and confidence_index < 40:
        cfg.soft_gates = True
        cfg.coaching_tone = "encouraging"
        cfg.notes.append(f"confidence_index={confidence_index:.0f} → soft gates + encouraging tone")

    # Burnout routing
    if burnout_score is not None and burnout_score > 70:
        cfg.scaffolding_level = "heavy"
        cfg.coaching_tone = "encouraging"
        cfg.notes.append(f"burnout_score={burnout_score:.0f} → heavy scaffolding (high burnout)")

    # Work experience routing
    if work_experience_years >= 5:
        cfg.preferred_difficulty = "senior"
        cfg.scaffolding_level = "minimal"
        cfg.notes.append(f"work_exp={work_experience_years}y → senior difficulty + minimal scaffolding")
    elif work_experience_years < 1:
        cfg.preferred_difficulty = "junior"
        cfg.scaffolding_level = "heavy"
        cfg.notes.append(f"work_exp={work_experience_years}y → junior difficulty + heavy scaffolding")

    logger.info(
        "[PERSONALIZATION] k=%d r=%d s=%d exp=%dy → diff=%s skip_found=%s net=%s soft=%s ft=%s",
        k_score, r_score, s_score, work_experience_years,
        cfg.preferred_difficulty, cfg.skip_foundations,
        cfg.insert_networking_module, cfg.soft_gates, cfg.fast_track,
    )

    return cfg


def get_personalization_from_user(user, db) -> PersonalizationConfig:
    """Convenience wrapper: pulls KRS + psych data for a user and builds config."""
    from app.models.user import AspirantProfile, KrsScore, PsychologicalAssessment

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    psych   = db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user.id).first()
    krs     = db.query(KrsScore).filter(KrsScore.user_id == user.id).order_by(KrsScore.computed_at.desc()).first()

    k_score = krs.k_score if krs else 50
    r_score = krs.r_score if krs else 50
    s_score = krs.s_score if krs else 50

    burnout     = float(psych.burnout_score)    if psych and psych.burnout_score is not None    else None
    confidence  = float(psych.confidence_index) if psych and psych.confidence_index is not None else None
    work_exp    = profile.work_experience_years if profile and profile.work_experience_years is not None else 0

    return build_personalization_config(
        k_score=k_score,
        r_score=r_score,
        s_score=s_score,
        burnout_score=burnout,
        confidence_index=confidence,
        work_experience_years=work_exp,
    )
