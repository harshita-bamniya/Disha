"""Orchestrates one resume-vs-job analysis from parsed inputs to a MatchReport."""
from __future__ import annotations

import hashlib
from datetime import date

from app.modules.recommendations import embedder

from .matcher import EmbedFn, JudgeFn, industry_match, llm_judge, match_requirements, role_relevance
from .schemas import AtsSignals, CandidateProfile, JobRequirements, MatchReport
from .scoring import SCORING_VERSION, build_report


def embed_texts(texts: list[str]) -> list[list[float] | None]:
    """Local fastembed model (no API cost). Unavailable model -> Nones, handled downstream."""
    if not texts:
        return []
    return embedder.embed_batch(texts)


def resume_hash(resume_text: str) -> str:
    return hashlib.sha256(" ".join(resume_text.split()).lower().encode()).hexdigest()


def cache_key(resume_text: str, job_source_hash: str) -> str:
    """Same resume + same parsed job + same scoring version -> same report."""
    return hashlib.sha256(f"{resume_hash(resume_text)}|{job_source_hash}|{SCORING_VERSION}".encode()).hexdigest()


async def analyze(
    job: JobRequirements,
    profile: CandidateProfile,
    ats_signals: AtsSignals,
    *,
    embed: EmbedFn = embed_texts,
    judge: JudgeFn = llm_judge,
    today: date | None = None,
) -> MatchReport:
    results = await match_requirements(job, profile, embed, judge, today)
    return build_report(
        job, profile, results, ats_signals,
        role_relevance=role_relevance(job, profile, embed),
        industry_score=industry_match(job, profile, embed),
        today=today,
    )
