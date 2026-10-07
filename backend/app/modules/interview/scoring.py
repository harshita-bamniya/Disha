"""Deterministic scoring for the interview report.

The model scores each answer (0-10) against the rubric; the numbers that
decide a candidate's readiness score, skill breakdown and recommendation are
computed here, in code, from those per-answer scores and the role's
competency weights. The LLM writes the narrative only. This makes a score
reproducible and explainable ("which answers produced this number?") instead
of being whatever a single model call said.

Pure functions, no DB or LLM.
"""
from __future__ import annotations

import re
from typing import Any, Iterable

DIFFICULTY_WEIGHT = {"easy": 0.8, "medium": 1.0, "hard": 1.25}

# Thresholds line up with dynamic_interview_engine._enforce_completeness_cap
# (<=45 No Hire, <=65 at most Maybe).
STRONG_HIRE_MIN = 80
HIRE_MIN = 66
MAYBE_MIN = 46

REVIEW_SCORE_GAP = 15          # code score vs the model's own estimate
REVIEW_FALLBACK_SHARE = 0.3    # share of answers the AI could not score
MAX_STRENGTHS = 3
MAX_GAPS = 3

_FILLERS = {"um", "uh", "umm", "uhh", "hmm", "like", "basically", "actually", "literally", "matlab", "toh"}
_FILLER_PHRASES = ("you know", "i mean", "sort of", "kind of")
_HEDGES = {"maybe", "perhaps", "probably", "possibly", "guess"}
_HEDGE_PHRASES = ("i think", "i guess", "i suppose", "not sure")


def recommendation_for(score: float) -> str:
    if score >= STRONG_HIRE_MIN:
        return "Strong Hire"
    if score >= HIRE_MIN:
        return "Hire"
    if score >= MAYBE_MIN:
        return "Maybe"
    return "No Hire"


def _weight(entry: dict) -> float:
    return DIFFICULTY_WEIGHT.get((entry.get("difficulty") or "medium"), 1.0)


def _scorable(entries: Iterable[dict]) -> list[dict]:
    """Answers that have a real AI score (not a fallback placeholder)."""
    return [
        e for e in entries
        if not e.get("is_fallback") and isinstance(e.get("overall"), (int, float))
    ]


def _norm(name: str | None) -> str:
    return (name or "").strip().casefold()


def skill_scores(entries: Iterable[dict], competencies: list[dict]) -> dict[str, float]:
    """Per-competency score 0-100: difficulty-weighted mean of that
    competency's answers (x10). Competencies with no scorable answer are
    omitted rather than invented."""
    by_skill: dict[str, list[dict]] = {}
    for e in _scorable(entries):
        by_skill.setdefault(_norm(e.get("skill_assessed")), []).append(e)

    out: dict[str, float] = {}
    for comp in competencies:
        rows = by_skill.get(_norm(comp.get("skill")))
        if not rows:
            continue
        total_w = sum(_weight(r) for r in rows)
        out[comp["skill"]] = round(sum(r["overall"] * _weight(r) for r in rows) / total_w * 10, 1)
    return out


def weighted_overall(skills: dict[str, float], competencies: list[dict]) -> float | None:
    """Competency-weighted overall 0-100, renormalised over the competencies
    that were actually assessed."""
    num = den = 0.0
    for comp in competencies:
        score = skills.get(comp.get("skill"))
        if score is None:
            continue
        w = float(comp.get("weight") or 0)
        num += score * w
        den += w
    return round(num / den, 1) if den else None


def plain_overall(entries: Iterable[dict]) -> float | None:
    """Fallback when no answer maps to a known competency."""
    rows = _scorable(entries)
    if not rows:
        return None
    total_w = sum(_weight(r) for r in rows)
    return round(sum(r["overall"] * _weight(r) for r in rows) / total_w * 10, 1)


def communication_score(entries: Iterable[dict]) -> float | None:
    """Content clarity + conciseness of what was said (never accent/delivery)."""
    vals: list[float] = []
    for e in _scorable(entries):
        for key in ("clarity", "conciseness"):
            v = e.get(key)
            if isinstance(v, (int, float)):
                vals.append(float(v))
    return round(sum(vals) / len(vals) * 10, 1) if vals else None


def delivery_signals(entries: Iterable[dict]) -> dict[str, Any]:
    """Objective, coaching-only signals from the transcript text. Never
    enters the readiness score."""
    words_total = fillers = hedges = 0
    answers = 0
    for e in entries:
        text = (e.get("response") or "").lower()
        if not text.strip():
            continue
        answers += 1
        tokens = re.findall(r"[a-z']+", text)
        words_total += len(tokens)
        fillers += sum(1 for t in tokens if t in _FILLERS) + sum(text.count(p) for p in _FILLER_PHRASES)
        hedges += sum(1 for t in tokens if t in _HEDGES) + sum(text.count(p) for p in _HEDGE_PHRASES)
    if not words_total:
        return {"answers": 0, "avg_words_per_answer": 0, "filler_per_100_words": 0.0, "hedging_per_100_words": 0.0}
    return {
        "answers": answers,
        "avg_words_per_answer": round(words_total / answers),
        "filler_per_100_words": round(fillers / words_total * 100, 1),
        "hedging_per_100_words": round(hedges / words_total * 100, 1),
    }


# ── Wording rules ─────────────────────────────────────────────────────────────

_REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bweaknesses\b", re.I), "growth areas"),
    (re.compile(r"\bweakness\b", re.I), "growth area"),
    (re.compile(r"\bweakly\b", re.I), "tentatively"),
    (re.compile(r"\bweakest\b", re.I), "least developed"),
    (re.compile(r"\bweaker\b", re.I), "less developed"),
    (re.compile(r"\bweak\b", re.I), "developing"),
    (re.compile(r"\bfailures\b", re.I), "setbacks"),
    (re.compile(r"\bfailure\b", re.I), "setback"),
    (re.compile(r"\bfailed\b", re.I), "did not yet succeed"),
    (re.compile(r"\bpoorly\b", re.I), "with room to grow"),
    (re.compile(r"\bpoor\b", re.I), "limited"),
]


def sanitize_text(text: str) -> str:
    """Replace discouraging labels with growth-framed wording (keeps capitals)."""
    def fix(pattern: re.Pattern[str], repl: str, s: str) -> str:
        def sub(m: re.Match[str]) -> str:
            return repl[:1].upper() + repl[1:] if m.group(0)[:1].isupper() else repl
        return pattern.sub(sub, s)

    for pattern, repl in _REPLACEMENTS:
        text = fix(pattern, repl, text)
    return text


def _clean_list(items: Any, limit: int | None = None) -> list[str]:
    if not isinstance(items, list):
        return []
    cleaned = [sanitize_text(str(i)) for i in items if str(i).strip()]
    return cleaned[:limit] if limit else cleaned


def apply_code_scoring(
    report: dict,
    entries: list[dict],
    competencies: list[dict],
) -> dict:
    """Overwrite the model's numbers with code-computed ones and apply the
    wording rules. Returns the same dict. Keeps the model's own estimate as
    `llm_overall_readiness_score` so disagreement is auditable."""
    reasons: list[str] = []

    llm_overall = report.get("overall_readiness_score")
    llm_rec = report.get("hiring_recommendation")
    if isinstance(llm_overall, (int, float)):
        report["llm_overall_readiness_score"] = llm_overall

    skills = skill_scores(entries, competencies)
    overall = weighted_overall(skills, competencies) if skills else plain_overall(entries)
    if overall is not None:
        report["overall_readiness_score"] = overall
        if skills:
            report["skill_scores"] = skills
        code_rec = recommendation_for(overall)
        report["hiring_recommendation"] = code_rec
        if llm_rec != code_rec:
            # The model's explanation was written for a different verdict, so
            # replace it rather than show text that contradicts the label.
            assessed = len(skills) if skills else len(_scorable(entries))
            noun = "skill" if skills else "answer"
            unit = f"assessed {noun}{'' if assessed == 1 else 's'}" if skills else f"scored {noun}{'' if assessed == 1 else 's'}"
            report["hiring_recommendation_reason"] = (
                f"Your weighted score across {assessed} {unit} is {round(overall)}/100, "
                f"which corresponds to “{code_rec}”."
            )
        if isinstance(llm_overall, (int, float)) and abs(llm_overall - overall) > REVIEW_SCORE_GAP:
            reasons.append(
                f"The AI's own estimate ({round(llm_overall)}) differs from the score computed "
                f"from the individual answers ({round(overall)})."
            )

    comm = communication_score(entries)
    if comm is not None:
        report["communication_score"] = comm
    # Confidence can't be validly inferred from text or voice, so it is no
    # longer reported. Field kept at 0 for older clients.
    report["confidence_score"] = 0
    report["delivery"] = delivery_signals(entries)

    fallbacks = sum(1 for e in entries if e.get("is_fallback"))
    if entries and fallbacks / len(entries) >= REVIEW_FALLBACK_SHARE:
        reasons.append("Several answers could not be scored by the AI.")
    if any(e.get("judge_disagreement") for e in entries):
        reasons.append("Independent judges disagreed on at least one answer.")

    report["needs_human_review"] = bool(reasons)
    report["review_reasons"] = reasons
    report["fit_band"] = fit_band(report.get("overall_readiness_score"), bool(reasons))

    report["strengths"] = _clean_list(report.get("strengths"), MAX_STRENGTHS)
    report["critical_gaps"] = _clean_list(report.get("critical_gaps"), MAX_GAPS)
    for key in ("candidate_summary", "readiness_message", "hiring_recommendation_reason"):
        if isinstance(report.get(key), str):
            report[key] = sanitize_text(report[key])
    report["consistency_notes"] = _clean_list(report.get("consistency_notes"))
    return report


# ── Verified interviews ───────────────────────────────────────────────────────

PASS_DISAGREEMENT = 2          # per-answer overall scores further apart than this need a human

_PASS_NUMERIC = (
    "clarity_score", "conciseness_score", "impact_score", "relevance_score", "star_adherence", "overall_score",
)


def reconcile_passes(first: dict, second: dict) -> tuple[dict, bool]:
    """Combine two independent scoring passes of the same answer.

    Numbers are averaged (rounded half up); the wording, model answer and
    evidence quote come from the first pass. Returns (merged, disagreed) where
    `disagreed` is True when the two overall scores differ by more than
    PASS_DISAGREEMENT, which routes the interview to a human reviewer.
    """
    merged = dict(first)
    for key in _PASS_NUMERIC:
        a, b = first.get(key), second.get(key)
        if isinstance(a, (int, float)) and isinstance(b, (int, float)):
            merged[key] = int((a + b) / 2 + 0.5)
        elif isinstance(b, (int, float)) and not isinstance(a, (int, float)):
            merged[key] = int(b)
    a, b = first.get("overall_score"), second.get("overall_score")
    disagreed = isinstance(a, (int, float)) and isinstance(b, (int, float)) and abs(a - b) > PASS_DISAGREEMENT
    return merged, disagreed


FIT_STRONG = 80
FIT_GOOD = 65
FIT_DEVELOPING = 50


def fit_band(score: float | None, needs_human_review: bool) -> str | None:
    """Employer-facing band. Deliberately not "weak"/"poor": "Not yet a fit"
    describes the match, not the person. An uncertain score is never
    presented as a firm band."""
    if score is None:
        return None
    if needs_human_review:
        return "Needs human review"
    if score >= FIT_STRONG:
        return "Strong fit"
    if score >= FIT_GOOD:
        return "Good fit"
    if score >= FIT_DEVELOPING:
        return "Developing"
    return "Not yet a fit"
