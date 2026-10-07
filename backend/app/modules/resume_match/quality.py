"""Resume quality: how well the resume is written, independent of any job.

The match score answers "does this resume fit this job?". This answers "is this a strong
resume?": are the bullets specific, measurable and action-led, or vague duty lists. It is
rule-based on the parsed profile (no LLM), so it is instant, repeatable and free.
"""
from __future__ import annotations

import re

from .schemas import CandidateProfile, QualityCheck, ResumeQuality

_ACTION_VERBS = {
    "built", "led", "ran", "wrote", "drove", "grew", "made", "cut", "won", "managed", "created",
    "designed", "developed", "delivered", "launched", "improved", "reduced", "increased", "automated",
    "analysed", "analyzed", "presented", "implemented", "optimised", "optimized", "negotiated", "trained",
    "coordinated", "established", "streamlined", "resolved", "saved", "generated", "organised", "organized",
    "migrated", "deployed", "architected", "engineered", "mentored", "forecast", "audited", "produced",
    "drafted", "researched", "maintained", "cleaned", "mapped", "tabulated", "summarised", "summarized",
}
_WEAK_OPENERS = (
    "worked on", "worked with", "responsible for", "helped", "assisted", "supported", "involved in",
    "duties included", "tasked with", "in charge of", "handled", "participated in", "various",
)
_FILLER = re.compile(
    r"\b(various|etc\.?|hard[- ]?working|team player|passionate|results[- ]oriented|detail[- ]oriented|"
    r"dynamic|go[- ]getter|self[- ]motivated|responsible for|and so on)\b", re.I)
_NUMBER = re.compile(r"\d")

# (key, label, weight)
_CHECKS = [
    ("quantified", "Results you can measure", 0.30),
    ("action_verbs", "Strong action verbs", 0.20),
    ("depth", "Enough detail per role", 0.15),
    ("skills_shown", "Skills backed by real work", 0.15),
    ("length", "Lines that are easy to scan", 0.10),
    ("filler", "No filler phrases", 0.10),
]


def _bullets(profile: CandidateProfile) -> list[str]:
    return [b for r in profile.roles for b in r.bullets] + [b for p in profile.projects for b in p.bullets]


def _starts_weak(b: str) -> bool:
    return b.lower().lstrip("-•* ").startswith(_WEAK_OPENERS)


def _starts_strong(b: str) -> bool:
    first = re.sub(r"[^a-z]", "", b.lower().lstrip("-•* ").split(" ")[0]) if b.strip() else ""
    return not _starts_weak(b) and (first in _ACTION_VERBS or (len(first) > 3 and first.endswith("ed")))


def _short(text: str, n: int = 90) -> str:
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def assess_quality(profile: CandidateProfile) -> ResumeQuality | None:
    """None when there is no experience or project text to judge (e.g. a skills-only resume)."""
    bullets = _bullets(profile)
    if not bullets:
        return None

    checks: list[QualityCheck] = []

    with_numbers = [b for b in bullets if _NUMBER.search(b)]
    share = len(with_numbers) / len(bullets)
    plain = [b for b in bullets if not _NUMBER.search(b)]
    checks.append(QualityCheck(
        key="quantified", label="Results you can measure", score=min(1.0, share / 0.5),
        detail=f"{len(with_numbers)} of {len(bullets)} lines include a number. Aim for at least half.",
        examples=[_short(b) for b in plain[:2]]))

    strong = [b for b in bullets if _starts_strong(b)]
    weak = [b for b in bullets if not _starts_strong(b)]
    checks.append(QualityCheck(
        key="action_verbs", label="Strong action verbs", score=len(strong) / len(bullets),
        detail=f"{len(strong)} of {len(bullets)} lines open with a clear action verb (built, led, cut…).",
        examples=[_short(b) for b in weak[:2]]))

    roles = list(profile.roles)
    if roles:
        avg = sum(len(r.bullets) for r in roles) / len(roles)
        bare = [f"{r.title or 'A role'} at {r.company}".strip() for r in roles if len(r.bullets) < 2]
        checks.append(QualityCheck(
            key="depth", label="Enough detail per role", score=min(1.0, avg / 3),
            detail=f"About {avg:.1f} lines per role. Recent roles should have 3–5.",
            examples=bare[:2]))

    if profile.skills:
        shown = sum(1 for s in profile.skills if s.evidence)
        listed_only = [s.name for s in profile.skills if not s.evidence]
        checks.append(QualityCheck(
            key="skills_shown", label="Skills backed by real work",
            score=min(1.0, (shown / len(profile.skills)) / 0.6),
            detail=f"{shown} of {len(profile.skills)} listed skills appear in a line describing real work.",
            examples=listed_only[:4]))

    lengths = [len(b.split()) for b in bullets]
    ok = [b for b, n in zip(bullets, lengths) if 8 <= n <= 30]
    off = [b for b, n in zip(bullets, lengths) if not 8 <= n <= 30]
    checks.append(QualityCheck(
        key="length", label="Lines that are easy to scan", score=len(ok) / len(bullets),
        detail=f"{len(ok)} of {len(bullets)} lines are between 8 and 30 words.",
        examples=[_short(b) for b in off[:2]]))

    filler_hits = [m.group(0).lower() for b in bullets for m in _FILLER.finditer(b)]
    checks.append(QualityCheck(
        key="filler", label="No filler phrases", score=1 - min(1.0, len(filler_hits) / 3),
        detail=("Found: " + ", ".join(sorted(set(filler_hits)))) if filler_hits else "No vague filler found.",
        examples=[]))

    weights = {k: w for k, _, w in _CHECKS}
    total_w = sum(weights[c.key] for c in checks)
    score = round(100 * sum(c.score * weights[c.key] for c in checks) / total_w)
    label = "Strong" if score >= 75 else "Decent" if score >= 55 else "Needs work"
    return ResumeQuality(score=score, label=label, checks=checks)
