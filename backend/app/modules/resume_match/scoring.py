"""Deterministic scoring: requirement credits in, explainable report out.

No LLM and no I/O here. The matcher produces a credit per requirement; this
module rolls them into weighted sub-scores, applies knock-out caps, assigns the
likelihood band and works out how many points each fix would gain by re-scoring
with that requirement fully met. Same inputs always give the same report.
"""
from __future__ import annotations

from datetime import date

from .quality import assess_quality
from .schemas import (
    AtsCheck, AtsSignals, CandidateProfile, Fix, JobRequirements, MatchReport,
    RequirementResult, SubScore,
)

SCORING_VERSION = "1.3"

# (key, label, weight) — starting weights from the design doc; tune against the
# hand-labelled set. Groups with no items are dropped and their weight spread
# across the rest.
WEIGHTS: list[tuple[str, str, float]] = [
    ("must_have_skills", "Must-have skills", 0.35),
    ("experience", "Experience & seniority", 0.20),
    ("role_relevance", "Role relevance", 0.10),
    ("nice_to_have_skills", "Nice-to-have skills", 0.10),
    ("education", "Education & certifications", 0.10),
    ("industry", "Industry / domain", 0.05),
    ("soft_skills", "Soft skills", 0.05),
    ("ats", "ATS readability", 0.05),
]

KNOCKOUT_CAP = 40
MET_THRESHOLD = 0.7
BANDS = [
    (80, "Strong", "Good chance of passing screening. Apply now."),
    (65, "Good", "Competitive. Fix the top 2–3 gaps below to move to Strong."),
    (45, "Fair", "Possible but risky. Several must-haves are weak or missing."),
    (0, "Low", "Unlikely to be shortlisted. Consider the gaps, or similar roles that fit better."),
]


def band_for(score: int) -> tuple[str, str]:
    for floor, label, msg in BANDS:
        if score >= floor:
            return label, msg
    return BANDS[-1][1], BANDS[-1][2]


def verdict_for(credit: float) -> str:
    if credit >= MET_THRESHOLD:
        return "met"
    return "partial" if credit > 0 else "missing"


# ── Experience ───────────────────────────────────────────────────────────────

def _month_index(value: str | None, today: date, is_end: bool) -> int | None:
    if not value:
        return None
    v = value.strip().lower()
    if v in {"present", "current", "now", "ongoing"}:
        return today.year * 12 + today.month
    parts = v.split("-")
    try:
        year = int(parts[0])
        month = int(parts[1]) if len(parts) > 1 else (12 if is_end else 1)
    except ValueError:
        return None
    if not 1 <= month <= 12 or not 1900 <= year <= 2100:
        return None
    return year * 12 + month


def total_years_experience(profile: CandidateProfile, today: date | None = None) -> float:
    """Years of work history with overlapping roles merged (no double counting)."""
    today = today or date.today()
    spans: list[tuple[int, int]] = []
    for role in profile.roles:
        start = _month_index(role.start, today, is_end=False)
        end = _month_index(role.end, today, is_end=True)
        if start is None or end is None or end < start:
            continue
        spans.append((start, end))
    spans.sort()
    total, cur_start, cur_end = 0, None, None
    for s, e in spans:
        if cur_end is None or s > cur_end:
            if cur_end is not None:
                total += cur_end - cur_start
            cur_start, cur_end = s, e
        else:
            cur_end = max(cur_end, e)
    if cur_end is not None:
        total += cur_end - cur_start
    return round(total / 12, 1)


def experience_score(candidate_years: float, job: JobRequirements) -> float | None:
    if not job.min_years_experience:
        return None
    s = min(1.0, candidate_years / job.min_years_experience)
    if job.max_years_experience and candidate_years > 2 * job.max_years_experience:
        s *= 0.9  # small penalty for being far over the range
    return s


# ── ATS readability ──────────────────────────────────────────────────────────

_CORE_SECTIONS = {"experience", "education", "skills"}


def ats_score(signals: AtsSignals) -> tuple[float, list[str]]:
    """0..1 readability score plus human-readable notes on what hurts it."""
    notes: list[str] = []
    if not signals.text_extractable or signals.char_count < 50:
        return 0.0, ["No readable text could be extracted. An employer's ATS will likely fail too — export a text-based PDF or DOCX."]
    found = _CORE_SECTIONS & {s.lower() for s in signals.sections_found}
    s = 0.3 * len(found) / len(_CORE_SECTIONS)
    for missing in sorted(_CORE_SECTIONS - found):
        notes.append(f"Add a standard “{missing.title()}” heading so the ATS can find that section.")
    if signals.has_contact_info:
        s += 0.10
    else:
        notes.append("Contact details were not found in the document body.")
    if signals.dates_consistent:
        s += 0.15
    else:
        notes.append("Dates use mixed formats; use one format (e.g. Jan 2023 – Mar 2025).")
    blockers = signals.table_count + signals.image_count
    s += 0.25 * max(0.0, 1 - 0.25 * blockers)
    if blockers:
        notes.append("Tables or images can hide content from an ATS; move key details into plain text.")
    if signals.multi_column:
        notes.append("A multi-column layout can scramble reading order in an ATS; use a single column.")
    else:
        s += 0.20
    return round(min(1.0, s), 4), notes


def ats_checks(signals: AtsSignals) -> list[AtsCheck]:
    """Pass/fail checklist behind the ATS readability score, for the report's ATS panel."""
    if not signals.text_extractable or signals.char_count < 50:
        return [AtsCheck(key="readable", label="Text can be read by an ATS", passed=False,
                         detail="No text could be extracted; this looks like a scanned image or a protected file.")]
    found = {s.lower() for s in signals.sections_found}
    checks = [AtsCheck(key="readable", label="Text can be read by an ATS", passed=True)]
    for name in ("experience", "education", "skills"):
        checks.append(AtsCheck(
            key=f"heading_{name}", label=f"Standard “{name.title()}” heading", passed=name in found,
            detail="" if name in found else f"Add a heading called “{name.title()}” so the ATS can file that section."))
    checks += [
        AtsCheck(key="contact", label="Contact details in the document body", passed=signals.has_contact_info),
        AtsCheck(key="dates", label="Dates use one consistent format", passed=signals.dates_consistent,
                 detail="" if signals.dates_consistent else "Mixed formats found; use e.g. Jan 2023 – Mar 2025 throughout."),
        AtsCheck(key="no_tables_images", label="No tables or images holding key information",
                 passed=signals.table_count + signals.image_count == 0,
                 detail="" if signals.table_count + signals.image_count == 0
                 else f"{signals.table_count} table(s) and {signals.image_count} image(s) found."),
        AtsCheck(key="single_column", label="Single-column layout", passed=not signals.multi_column,
                 detail="" if not signals.multi_column else "Columns can scramble reading order in an ATS."),
    ]
    return checks


# A posting needs at least this many concrete requirements (skills, degree, certs, years) for a precise score.
MIN_CONCRETE_REQUIREMENTS = 3


# ── Aggregation ──────────────────────────────────────────────────────────────

_SCORED_TYPES = {"hard_skill", "soft_skill", "education", "certification", "domain"}


GENERIC_WEIGHT = 0.5  # a broad trait counts half as much as a named tool or method within its group


def _avg(values: list[tuple[float, float]]) -> float | None:
    """Weighted mean of (credit, weight) pairs."""
    total = sum(w for _, w in values)
    return sum(c * w for c, w in values) / total if total else None


def _aggregate(
    results: list[RequirementResult],
    exp: float | None,
    role_relevance: float | None,
    industry_extra: float | None,
    ats: float,
) -> tuple[int, list[SubScore]]:
    scored = [r for r in results if r.requirement.type in _SCORED_TYPES]

    def credits(pred) -> list[tuple[float, float]]:
        return [(r.credit, GENERIC_WEIGHT if r.requirement.specificity == "generic" else 1.0)
                for r in scored if pred(r.requirement)]

    industry_items = credits(lambda q: q.type == "domain")
    if industry_extra is not None:
        industry_items.append((industry_extra, 1.0))

    raw: dict[str, float | None] = {
        "must_have_skills": _avg(credits(lambda q: q.type == "hard_skill" and q.importance == "must_have")),
        "experience": exp,
        "role_relevance": role_relevance,
        "nice_to_have_skills": _avg(credits(lambda q: q.type == "hard_skill" and q.importance == "nice_to_have")),
        "education": _avg(credits(lambda q: q.type in {"education", "certification"})),
        "industry": _avg(industry_items),
        "soft_skills": _avg(credits(lambda q: q.type == "soft_skill")),
        "ats": ats,
    }
    present_weight = sum(w for k, _, w in WEIGHTS if raw[k] is not None)
    subs: list[SubScore] = []
    total = 0.0
    for key, label, weight in WEIGHTS:
        val = raw[key]
        eff = weight / present_weight if val is not None and present_weight else 0.0
        subs.append(SubScore(key=key, label=label, score=None if val is None else round(val, 4),
                             weight=weight, effective_weight=round(eff, 4)))
        if val is not None:
            total += eff * val
    return round(100 * total), subs


def _cap_reasons(results: list[RequirementResult], candidate_years: float, job: JobRequirements) -> list[str]:
    reasons = [
        f"This job requires “{r.requirement.name}”; none found on your resume."
        for r in results
        if r.requirement.knockout and r.requirement.type in _SCORED_TYPES and r.credit == 0
    ]
    if job.min_years_experience and candidate_years < 0.5 * job.min_years_experience:
        reasons.append(
            f"The job asks for {job.min_years_experience:g}+ years of experience; "
            f"your resume shows about {candidate_years:g}."
        )
    return reasons


def _final(score: int, reasons: list[str]) -> int:
    return min(score, KNOCKOUT_CAP) if reasons else score


def _fix_for(r: RequirementResult) -> tuple[str, str]:
    name = r.requirement.name
    if r.credit == 0:
        if r.requirement.type in {"education", "certification"}:
            return "real_gap", f"This role asks for {name}. If you hold it, add it to your resume; otherwise consider a plan to obtain it."
        return "real_gap", (
            f"“{name}” is not on your resume. If you have used it, tell us where and we'll help you "
            "write it up; otherwise add it to your learning roadmap."
        )
    if r.generic_capped:
        return "add_evidence", (
            f"Your resume touches on “{name}” but never with a result. Add a number to the line "
            "(how many, how much, how fast) so it shows the ability rather than just the duty.")
    if r.method == "exact" and not r.evidence:
        return "add_evidence", f"“{name}” is only listed. Add a bullet showing where you used it and the result."
    if r.method == "exact":
        return "add_evidence", f"Your use of “{name}” is dated. Show recent work with it in a current role."
    hint = f" ({r.evidence})" if r.evidence else ""
    return "reword", f"Your resume shows related experience{hint}. Use the exact term “{name}” where it is true."


def build_report(
    job: JobRequirements,
    profile: CandidateProfile,
    results: list[RequirementResult],
    ats_signals: AtsSignals,
    role_relevance: float | None,
    industry_score: float | None,
    today: date | None = None,
) -> MatchReport:
    years = total_years_experience(profile, today)
    exp = experience_score(years, job)
    ats, ats_notes = ats_score(ats_signals)
    industry_extra = industry_score if job.industry else None

    base, subs = _aggregate(results, exp, role_relevance, industry_extra, ats)
    reasons = _cap_reasons(results, years, job)
    final = _final(base, reasons)
    band, message = band_for(final)

    # Points gained per fix: re-score with that one requirement fully met.
    fixes: list[Fix] = []
    for i, r in enumerate(results):
        if r.requirement.type not in _SCORED_TYPES or r.credit >= 1.0:
            continue
        trial = list(results)
        trial[i] = r.model_copy(update={"credit": 1.0})
        t_base, _ = _aggregate(trial, exp, role_relevance, industry_extra, ats)
        gained = _final(t_base, _cap_reasons(trial, years, job)) - final
        if gained <= 0:
            continue
        fix_type, action = _fix_for(r)
        fixes.append(Fix(requirement=r.requirement.name, type=fix_type, points_gained=float(gained), action=action))
    fixes.sort(key=lambda f: (-f.points_gained, f.requirement))

    must = [r for r in results if r.requirement.importance == "must_have" and r.requirement.type in _SCORED_TYPES]
    return MatchReport(
        score=final, band=band, band_message=message,
        # "Met" means fully shown; equivalent or weakly evidenced skills are reported separately.
        must_haves_met=sum(1 for r in must if r.credit >= 1.0),
        must_haves_partial=sum(1 for r in must if 0 < r.credit < 1.0),
        must_haves_total=len(must),
        capped=bool(reasons) and base > KNOCKOUT_CAP, cap_reasons=reasons,
        sub_scores=subs, requirements=results, fixes=fixes,
        to_confirm=[r.requirement.name for r in results if r.requirement.type == "eligibility"],
        ats_notes=ats_notes, ats_checks=ats_checks(ats_signals),
        low_signal=(sum(1 for r in results if r.requirement.type in {"hard_skill", "education", "certification"})
                    + (1 if job.min_years_experience else 0)) < MIN_CONCRETE_REQUIREMENTS,
        quality=assess_quality(profile),
        scoring_version=SCORING_VERSION,
    )
