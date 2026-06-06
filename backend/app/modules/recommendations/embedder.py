"""
Singleton fastembed embedder (Qdrant).

Uses BAAI/bge-small-en-v1.5 (384-dim) via ONNX runtime.
Total download ~50 MB — no PyTorch required.
No API key needed. Model is cached locally on first call.
All operations are synchronous and non-fatal.
"""
from __future__ import annotations

import logging
import threading

import numpy as np

logger = logging.getLogger(__name__)

# BAAI/bge-small-en-v1.5 produces 384-dim normalised vectors — same dimension
# as all-MiniLM-L6-v2 so the pgvector column (vector(384)) needs no change.
_MODEL_NAME = "BAAI/bge-small-en-v1.5"
_model = None
_model_lock = threading.Lock()


# ── Model loader ──────────────────────────────────────────────────────────────

def _get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                try:
                    from fastembed import TextEmbedding
                    logger.info(f"[EMBEDDER] Loading {_MODEL_NAME} via fastembed…")
                    _model = TextEmbedding(model_name=_MODEL_NAME)
                    logger.info("[EMBEDDER] Model ready.")
                except Exception as exc:
                    logger.warning(f"[EMBEDDER] Model load failed: {exc}")
    return _model


# ── Public API ────────────────────────────────────────────────────────────────

def embed(text: str) -> list[float] | None:
    """Return a normalised 384-dim embedding, or None if model unavailable."""
    model = _get_model()
    if model is None:
        return None
    try:
        # fastembed returns a generator; take the first (and only) result
        vec = next(model.embed([text]))
        return vec.tolist()
    except Exception as exc:
        logger.warning(f"[EMBEDDER] embed() failed: {exc}")
        return None


def cosine_similarity(a: list[float] | np.ndarray, b: list[float] | np.ndarray) -> float:
    """Cosine similarity in [0, 1]. Both vectors must be non-zero."""
    va = np.asarray(a, dtype=np.float32)
    vb = np.asarray(b, dtype=np.float32)
    norm_a = float(np.linalg.norm(va))
    norm_b = float(np.linalg.norm(vb))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


# ── Text builders ─────────────────────────────────────────────────────────────

def build_job_text(job) -> str:
    """
    Combine all employer-supplied job fields into a single rich text for embedding.
    The more context, the better the semantic match.
    """
    parts = [
        f"Job title: {job.title}.",
        f"Sector: {job.sector}.",
    ]
    if job.description:
        parts.append(f"Description: {job.description}")
    if job.required_skills:
        parts.append(f"Required skills: {', '.join(job.required_skills)}.")
    if job.employment_type:
        parts.append(f"Employment type: {job.employment_type.replace('_', ' ')}.")
    if job.job_type:
        parts.append(f"Work arrangement: {job.job_type.replace('_', ' ')}.")
    if job.growth_outlook:
        parts.append(f"Growth outlook: {job.growth_outlook}.")
    if job.location:
        parts.append(f"Location: {job.location}.")
    return " ".join(parts)


def build_user_text(profile, psych=None) -> str:
    """
    Convert structured aspirant profile data into a natural-language paragraph
    that captures UPSC background, education, work experience, skills, and preferences.
    This is what gets embedded to represent the user.
    """
    parts: list[str] = []

    # UPSC journey
    exam = (profile.upsc_exam or "cse").upper()
    attempts = profile.upsc_attempts or 0
    stage = (profile.highest_stage_cleared or "none").replace("_", " ")
    years = profile.years_preparing or 0
    parts.append(
        f"UPSC {exam} aspirant with {attempts} attempt(s), cleared {stage} stage, "
        f"prepared for {years} year(s)."
    )
    if profile.optional_subject:
        parts.append(f"Optional subject: {profile.optional_subject}.")

    # Education
    qual = (profile.highest_qualification or "graduate").replace("_", " ")
    field = profile.field_of_study or ""
    institution = profile.institution or ""
    year = profile.graduation_year
    edu = f"{qual} in {field}" if field else qual
    if institution:
        edu += f" from {institution}"
    if year:
        edu += f" ({year})"
    parts.append(f"Education: {edu}.")

    # Work experience
    if profile.has_work_experience:
        exp_years = profile.work_experience_years or 0
        domain = profile.work_experience_domain or "an unspecified sector"
        designation = profile.last_designation or ""
        work = f"{exp_years} year(s) of work experience in {domain}"
        if designation:
            work += f" as {designation}"
        parts.append(f"Work experience: {work}.")
    else:
        parts.append("No prior formal work experience.")

    # Skills
    skills = profile.skills or []
    if skills:
        parts.append(f"Skills: {', '.join(skills)}.")

    # Career preferences — sectors only
    # Location and salary are handled as SQL pre-filters in get_live_jobs(),
    # not here, because exact column values should not rely on embedding similarity.
    sectors = profile.preferred_sectors or []
    if sectors:
        parts.append(f"Interested in: {', '.join(sectors[:4])}.")

    # Psychological layer (optional — adds nuance to the embedding)
    if psych:
        if psych.motivation_type:
            label = {
                "intrinsic": "driven by personal satisfaction and meaningful work",
                "extrinsic": "motivated by recognition, salary, and career impact",
                "mixed": "motivated by both purpose and external recognition",
            }.get(psych.motivation_type, psych.motivation_type)
            parts.append(f"Motivation: {label}.")
        if psych.risk_tolerance:
            label = {
                "low": "prefers stability and predictability",
                "medium": "open to calculated risks",
                "high": "willing to take bold career moves",
            }.get(psych.risk_tolerance, psych.risk_tolerance)
            parts.append(f"Risk appetite: {label}.")
        if psych.support_system:
            parts.append(f"Support system: {psych.support_system}.")

    return " ".join(parts)
