"""Checks whether jobs/plan_generator.py's PLAN_PROMPT actually personalizes
the generated learning plan, or just decorates it with unused context.

This calls the REAL Groq API — real tokens, real cost, non-deterministic
output. Not a unit test, not run by pytest/CI. Run it deliberately:

    docker exec disha_backend python evals/eval_plan_personalization.py

What it checks, per persona, against the concrete rules PLAN_PROMPT states:
  - Resource count per module matches the burnout tier (2 / 3 / 4)
  - estimated_hours per module respects the burnout-tier cap
  - Video:article split matches the stated learning-format preference
  - Low-confidence why_important opens with a named transferable UPSC skill
  - "Staying motivated" deliverables are broken into small numbered steps
  - "Getting started" modules lead with a beginner/fundamentals resource
  - Every module stays specific to the test job (not generic advice)
  - Every gap skill is actually covered somewhere in the plan

A failed check here means the prompt's rules aren't being followed — fix the
prompt (or the check, if the rule text itself changed) before trusting the
feature. Passing does NOT mean the plan is *good*, only that it's obeying
the rules we told it to follow — still worth a human skim of the JSON dumps
saved to evals/output/.

Uses max_tokens=5000 directly (not generate_job_plan's default 8000) to stay
under this environment's Groq TPM ceiling — see the 2026-08-25 investigation
in plan_generator.py's history for why 8000 alone can 413 on a constrained key.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ai.providers import create_provider
from app.modules.jobs.plan_generator import PLAN_PROMPT, SYSTEM_PROMPT, _extract_json

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")

# Self-contained test job — deliberately not read from the DB, so this eval
# doesn't silently break (or silently pass differently) when seed data changes.
JOB = {
    "job_title": "Policy Research Analyst",
    "company": "Meridian Policy Group",
    "sector": "Consulting",
    "description": (
        "Conduct policy research, prepare briefing notes, and present findings "
        "to senior consultants. Analyse legislative developments, draft policy "
        "recommendations, and engage with public-sector clients on governance "
        "reforms. Strong written communication and analytical ability required."
    ),
    "required_skills": ["Policy Research", "Report Writing", "Stakeholder Engagement", "Data Analysis"],
    "user_skills": ["Essay Writing", "Current Affairs", "Public Administration"],
    "gap_skills": ["Policy Research", "Report Writing", "Stakeholder Engagement", "Data Analysis"],
}

_FORMAT_LABELS = {
    "video": "Prefers video content",
    "reading": "Prefers reading/articles",
    "hands_on": "Prefers hands-on practice/building",
    "mixed": "No strong preference — mix of formats",
}
_CHALLENGE_LABELS = {
    "motivation": "Staying motivated/consistent",
    "understanding_concepts": "Understanding concepts deeply",
    "getting_started": "Not knowing where to start",
    "applying_practically": "Applying knowledge practically",
}

# Each persona isolates roughly one axis so a failure points at one rule,
# not an ambiguous mix. burnout/confidence bands mirror _score_label's
# thresholds in plan_generator.py (70 / 65).
PERSONAS = [
    {
        "name": "high_burnout_low_confidence_reading_motivation",
        "k_score": 44, "r_score": 40, "s_score": 49,
        "burnout_score": 85, "confidence_score": 30,
        "preferred_learning_format": "reading",
        "learning_challenge": "motivation",
    },
    {
        "name": "low_burnout_high_confidence_hands_on_applying",
        "k_score": 44, "r_score": 40, "s_score": 49,
        "burnout_score": 15, "confidence_score": 80,
        "preferred_learning_format": "hands_on",
        "learning_challenge": "applying_practically",
    },
    {
        "name": "moderate_video_getting_started",
        "k_score": 44, "r_score": 40, "s_score": 49,
        "burnout_score": 50, "confidence_score": 70,
        "preferred_learning_format": "video",
        "learning_challenge": "getting_started",
    },
    {
        "name": "high_k_score_understanding_concepts",
        # High K-score would normally justify harder content — this persona
        # checks that "understanding_concepts" overrides that, per the rule's
        # own "regardless of the burnout/K-score resource tier" clause.
        "k_score": 90, "r_score": 40, "s_score": 49,
        "burnout_score": 20, "confidence_score": 70,
        "preferred_learning_format": "mixed",
        "learning_challenge": "understanding_concepts",
    },
    {
        # Tests the Phase 1.2 "what's already been tried" regeneration rules:
        # a passed-quiz skill should not get a fresh module, and a failed-quiz
        # skill should be reprioritized with different resources than last time.
        "name": "resuming_after_mixed_results",
        "k_score": 44, "r_score": 40, "s_score": 49,
        "burnout_score": 50, "confidence_score": 70,
        "preferred_learning_format": "mixed",
        "learning_challenge": "applying_practically",
        "interaction_history": (
            "- Stakeholder Engagement: quiz passed (85%) — mastered.\n"
            "- Data Analysis: quiz failed (40%). Previously tried: "
            "Intro to Data Analysis for Beginners, Data Analysis Basics Explained."
        ),
        # Mirrors what plan_router.py's regeneration path actually does before
        # calling generate_job_plan: the mastered skill is dropped from the gap
        # list entirely (plan_router's _is_skill_mastered filter), not just
        # flagged in the prompt text.
        "gap_skills": ["Policy Research", "Report Writing", "Data Analysis"],
    },
]

_BEGINNER_WORDS = re.compile(r"\b(beginner|intro|introduction|fundamental|basics|explained|for beginners|crash course)\b", re.I)
_PRACTICE_WORDS = re.compile(
    r"\b(practice|exercise|walkthrough|hands-on|hands on|build|project|step-by-step|step by step|"
    r"checklist|template|worksheet|apply|applying|applicable|practical|role-play|roleplay|"
    r"immediately|real time|real-time|live example|do it yourself)\b", re.I,
)
_NUMBERED_STEPS = re.compile(r"(^|\s)[1１][.).]\s.*[2２][.).]\s", re.I | re.S)


def _burnout_tier(score: int) -> tuple[str, int, int]:
    """Returns (tier_name, expected_resource_count, hour_cap) per PLAN_PROMPT."""
    if score >= 70:
        return "high", 2, 4
    if score >= 40:
        return "moderate", 3, 6
    return "low", None, 12  # low burnout count depends on k_score too — checked separately


def _interaction_history_block(interaction_history: str | None) -> str:
    """Mirrors generate_job_plan's block construction exactly — this eval builds
    the prompt via PLAN_PROMPT.format() directly rather than going through
    generate_job_plan, so it must reproduce this piece to exercise it at all."""
    if not interaction_history:
        return ""
    return (
        "\nWHAT'S ALREADY BEEN TRIED (this is a regeneration — use this to avoid "
        "repeating what's already covered):\n"
        f"{interaction_history}\n\n"
        "CONCRETE RULES for regeneration:\n"
        "- Skills marked \"mastered\" above must NOT get a new module — they're done.\n"
        "- Skills marked \"failed quiz\" must be reprioritized near the top (priority "
        "1-2) and use a different resource angle (different channels/sources or "
        "resource types) than what's listed as already tried.\n"
    )


async def _generate(persona: dict) -> dict:
    prompt = PLAN_PROMPT.format(
        job_title=JOB["job_title"], company=JOB["company"], sector=JOB["sector"],
        description=JOB["description"],
        required_skills=", ".join(JOB["required_skills"]),
        user_skills=", ".join(JOB["user_skills"]),
        gap_skills=", ".join(persona.get("gap_skills", JOB["gap_skills"])),
        interaction_history_block=_interaction_history_block(persona.get("interaction_history")),
        k_score=persona["k_score"], k_score_label="",
        r_score=persona["r_score"], r_score_label="",
        s_score=persona["s_score"], s_score_label="",
        burnout_score=persona["burnout_score"],
        burnout_label=("High — exhausted" if persona["burnout_score"] >= 70 else "Moderate" if persona["burnout_score"] >= 40 else "Low — fresh"),
        confidence_score=persona["confidence_score"],
        confidence_label=("High confidence" if persona["confidence_score"] >= 65 else "Low confidence — needs encouragement"),
        work_experience="No prior work experience",
        upsc_exam_label="UPSC CSE", upsc_stage_label="Cleared Prelims",
        years_preparing_label="2 year(s)", optional_subject_label="Political Science",
        preferred_sectors_label="Government & Civil Services",
        learning_format_label=_FORMAT_LABELS[persona["preferred_learning_format"]],
        learning_challenge_label=_CHALLENGE_LABELS[persona["learning_challenge"]],
    )
    provider = create_provider()
    msg = await provider.complete(SYSTEM_PROMPT, [{"role": "user", "content": prompt}], max_tokens=5000, temperature=0.4)
    return _extract_json(msg.content)


# ── Checks — each returns (passed, detail) ────────────────────────────────────

def check_resource_count(plan: dict, persona: dict) -> tuple[bool, str]:
    tier, expected, _ = _burnout_tier(persona["burnout_score"])
    if expected is None:
        expected = 4 if persona["k_score"] >= 50 else 3
    actual = [len(m.get("resources", [])) for m in plan.get("modules", [])]
    ok = all(a == expected for a in actual)
    return ok, f"tier={tier} expected={expected} actual_per_module={actual}"


def check_hour_cap(plan: dict, persona: dict) -> tuple[bool, str]:
    _, _, cap = _burnout_tier(persona["burnout_score"])
    hours = [m.get("estimated_hours", 0) for m in plan.get("modules", [])]
    ok = all(h <= cap for h in hours)
    return ok, f"cap={cap} actual={hours}"


def check_format_split(plan: dict, persona: dict) -> tuple[bool, str]:
    fmt = persona["preferred_learning_format"]
    resources = [r for m in plan.get("modules", []) for r in m.get("resources", [])]
    total = len(resources) or 1
    yt = sum(1 for r in resources if r.get("type") == "youtube")
    article = total - yt
    yt_ratio = yt / total

    if fmt == "video":
        ok = yt_ratio >= 0.6
    elif fmt == "reading":
        ok = yt_ratio <= 0.4
    elif fmt == "hands_on":
        hits = sum(1 for r in resources if _PRACTICE_WORDS.search(f"{r.get('title', '')} {r.get('description', '')} {r.get('search_query', '')}"))
        ok = hits >= total // 2
        return ok, f"hands-on keyword hits={hits}/{total}"
    else:  # mixed
        ok = 0.3 <= yt_ratio <= 0.7
    return ok, f"video={yt} article={article} ratio={yt_ratio:.2f}"


def check_confidence_tone(plan: dict, persona: dict) -> tuple[bool, str]:
    if persona["confidence_score"] >= 65:
        return True, "high confidence — no transfer-opening rule applies"
    texts = [m.get("why_important", "") for m in plan.get("modules", [])]
    # The rule's own example says "Your UPSC essay writing..." but the actual
    # instruction is "name a concrete UPSC skill that transfers" — the model
    # correctly just names the skill (e.g. "Your essay writing...") without
    # literally repeating the word "UPSC" each time. Check the full pattern
    # instead: opens naming a skill as theirs + a because-clause + ends on a
    # concrete near-term action, not just one literal keyword.
    # `.+?` rather than a [\w\s-] charclass — AI-generated text often uses
    # typographic dashes (‑ U+2011, – U+2013) that an ASCII hyphen class misses.
    opens_with_transfer = re.compile(r"^\s*your\s+.+?\s+(directly\s+)?applies", re.I)
    # Phrasing varies run to run ("start by X", "begin with X", "first, X",
    # "as your first step") — all signal the same "small achievable action"
    # the rule asks for, so match the concept, not one fixed template.
    ends_with_first_step = re.compile(r"\bfirst\b|\bstart(ing)?\s+(by|with)\b|\bbegin(ning)?\s+(by|with)\b|\btoday\b", re.I)
    hits = sum(1 for t in texts if opens_with_transfer.search(t) and ends_with_first_step.search(t))
    ok = hits == len(texts) and len(texts) > 0
    return ok, f"opens naming a transferable skill + ends on a concrete first step in {hits}/{len(texts)} modules"


def check_challenge_structure(plan: dict, persona: dict) -> tuple[bool, str]:
    challenge = persona["learning_challenge"]
    modules = plan.get("modules", [])

    if challenge == "motivation":
        deliverables = [m.get("project_deliverable", "") for m in modules]
        hits = sum(1 for d in deliverables if _NUMBERED_STEPS.search(d))
        ok = hits == len(deliverables) and len(deliverables) > 0
        return ok, f"numbered-step deliverables in {hits}/{len(deliverables)} modules"

    if challenge == "understanding_concepts":
        hits = 0
        for m in modules:
            blob = " ".join(f"{r.get('title', '')} {r.get('description', '')}" for r in m.get("resources", []))
            if _BEGINNER_WORDS.search(blob):
                hits += 1
        ok = hits >= max(1, len(modules) // 2)
        return ok, f"beginner/explainer framing in {hits}/{len(modules)} modules"

    if challenge == "getting_started":
        hits = 0
        for m in modules:
            resources = m.get("resources", [])
            if resources and _BEGINNER_WORDS.search(f"{resources[0].get('title', '')} {resources[0].get('description', '')}"):
                hits += 1
        ok = hits >= max(1, len(modules) // 2)
        return ok, f"first resource reads as most-basic entry point in {hits}/{len(modules)} modules"

    if challenge == "applying_practically":
        hits = sum(1 for m in modules if JOB["job_title"].split()[0].lower() in m.get("project_deliverable", "").lower()
                    or JOB["company"].split()[0].lower() in m.get("project_deliverable", "").lower())
        ok = hits >= 1
        return ok, f"deliverables tied to {JOB['job_title']}/{JOB['company']} in {hits}/{len(modules)} modules"

    return True, "no rule for this challenge"


def check_job_specificity(plan: dict, persona: dict) -> tuple[bool, str]:
    texts = [m.get("why_important", "") for m in plan.get("modules", [])]
    job_word = JOB["job_title"].split()[0].lower()
    company_word = JOB["company"].split()[0].lower()
    hits = sum(1 for t in texts if job_word in t.lower() or company_word in t.lower())
    ok = hits == len(texts) and len(texts) > 0
    return ok, f"mentions job/company in {hits}/{len(texts)} modules"


def check_gap_coverage(plan: dict, persona: dict) -> tuple[bool, str]:
    gap_skills = persona.get("gap_skills", JOB["gap_skills"])
    covered = set()
    for m in plan.get("modules", []):
        blob = m.get("skill", "") + " " + " ".join(r.get("title", "") for r in m.get("resources", []))
        for gap in gap_skills:
            if gap.lower() in blob.lower():
                covered.add(gap)
    missing = [g for g in gap_skills if g not in covered]
    return len(missing) == 0, f"missing={missing}" if missing else "all gap skills covered"


def check_regeneration_history(plan: dict, persona: dict) -> tuple[bool, str]:
    """Only applies to personas carrying interaction_history (Phase 1.2): a
    mastered skill shouldn't get a fresh module, and a failed skill should be
    reprioritized with a different resource angle than what's already listed."""
    if not persona.get("interaction_history"):
        return True, "no interaction history for this persona"

    modules = plan.get("modules", [])
    data_analysis_mod = next((m for m in modules if "data analysis" in m.get("skill", "").lower()), None)
    if not data_analysis_mod:
        return False, "no module found for the failed skill 'Data Analysis'"

    priority_ok = data_analysis_mod.get("priority", 99) <= 2
    prior_titles = {"intro to data analysis for beginners", "data analysis basics explained"}
    new_titles = {r.get("title", "").strip().lower() for r in data_analysis_mod.get("resources", [])}
    angle_ok = not (new_titles & prior_titles)

    stakeholder_mod = next((m for m in modules if m.get("skill", "").lower() == "stakeholder engagement"), None)
    mastered_ok = stakeholder_mod is None

    ok = priority_ok and angle_ok and mastered_ok
    return ok, (
        f"failed-skill priority={data_analysis_mod.get('priority')} (want<=2), "
        f"reused a prior resource title={not angle_ok}, "
        f"mastered skill got its own new module={stakeholder_mod is not None}"
    )


CHECKS = [check_resource_count, check_hour_cap, check_format_split, check_confidence_tone, check_challenge_structure, check_job_specificity, check_gap_coverage, check_regeneration_history]


async def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    total_checks = 0
    total_passed = 0

    for i, persona in enumerate(PERSONAS):
        if i > 0:
            # This environment's Groq key is capped at 8000 tokens/minute
            # (see the 2026-08-25 413 investigation) — one plan generation
            # alone uses most of that budget, so back-to-back calls hit a
            # 429 well before the next minute's budget resets.
            print("\n  (waiting 65s for the per-minute token budget to reset...)")
            await asyncio.sleep(65)
        print(f"\n{'=' * 70}\n{persona['name']}\n{'=' * 70}")
        try:
            plan = await _generate(persona)
        except Exception as exc:
            print(f"  GENERATION FAILED: {exc}")
            continue

        with open(os.path.join(OUTPUT_DIR, f"{persona['name']}.json"), "w") as f:
            json.dump(plan, f, indent=2)

        for check in CHECKS:
            total_checks += 1
            try:
                ok, detail = check(plan, persona)
            except Exception as exc:
                ok, detail = False, f"check raised {exc!r}"
            total_passed += ok
            print(f"  [{'PASS' if ok else 'FAIL'}] {check.__name__}: {detail}")

    print(f"\n{'=' * 70}\n{total_passed}/{total_checks} checks passed across {len(PERSONAS)} personas\nRaw plans saved to {OUTPUT_DIR}/\n{'=' * 70}")


if __name__ == "__main__":
    asyncio.run(main())
