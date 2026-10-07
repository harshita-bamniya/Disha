"""Fact-checked resume line suggestions for a scan's weak or missing requirements.

Two paths, both guarded by `factcheck`: reword an existing bullet the resume already
has, or - for a skill the resume doesn't show - ask the candidate where they used it
and write the line from their answer. Nothing is ever added that the resume or the
candidate's own answer doesn't state.
"""
from __future__ import annotations

import logging

from pydantic import BaseModel

from . import factcheck
from .llm import complete_structured
from .schemas import CandidateProfile, RequirementResult, RewriteOut

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
MIN_ANSWER_CHARS = 15


class RewriteDraft(BaseModel):
    suggestion: str
    relationship: str = "comparable"   # same | same_family | comparable


class AnswerDraft(BaseModel):
    suggestion: str = ""
    role_index: int = -1
    missing_detail: str = ""


REWRITE_SYSTEM = """You improve ONE resume bullet so it supports a job requirement better, using ONLY facts already in the bullet.
Hard rules:
- Keep every fact in the bullet (tools, numbers, outcomes). Add NO new numbers, tools, employers, technologies or results.
- Start with a strong action verb; keep it under 30 words; keep a measurable result only if the bullet has one.
- Set relationship:
  - "same": the bullet already shows the requirement; just sharpen it.
  - "same_family": the requirement names a category and the bullet uses a specific member of it (requirement \
"SQL", bullet says PostgreSQL). You may use the requirement's term but MUST keep the specific tool named, e.g. \
"SQL (PostgreSQL)".
  - "comparable": the bullet shows a different product or skill that is only comparable (requirement "Tableau", \
bullet says Looker). Do NOT use the requirement's term at all; only sharpen what the bullet truly says.
- Never claim experience the bullet does not state."""

ANSWER_SYSTEM = """You write ONE resume bullet from a candidate's own description of work they did.
Hard rules:
- Use ONLY facts in the description. Add NO numbers, tools, employers or results it does not state.
- Start with a strong action verb; under 30 words.
- For a tool, technology or technical skill, name it (the candidate says they used it). For a soft skill or \
trait (attention to detail, leadership, resilience), do NOT label it ("demonstrated attention to detail"); \
describe the concrete work from the description that shows it.
- If the description does not show they actually used the skill, return an empty suggestion.
- missing_detail: one short sentence naming what they could add to make it stronger (a number, team size, time \
saved) if the description lacks it; empty if it already has a result.
- role_index: index of the role in the provided list that the work belongs under, or -1 if unclear or it was a \
personal/academic project."""


def find_result(report: dict, requirement: str) -> RequirementResult | None:
    for r in report.get("requirements", []):
        if r["requirement"]["name"].strip().lower() == requirement.strip().lower():
            return RequirementResult.model_validate(r)
    return None


def question_for(name: str) -> str:
    return (f"Have you used {name}? If yes, tell us where (a job or project), what you did with it and any result. "
            "We'll write the bullet from your answer; we never add experience you don't tell us about.")


async def _guarded(system: str, prompt: str, model_cls, check_text: str, allowed: str, accept_key: str):
    """Call the LLM until its draft passes the fact check (or attempts run out)."""
    feedback = ""
    last_bad: list[str] = []
    for _ in range(MAX_ATTEMPTS):
        draft = await complete_structured(system, prompt + feedback, model_cls, max_tokens=600)
        text = getattr(draft, accept_key).strip()
        if not text:
            return draft, []
        bad = factcheck.violations(text, check_text, allowed) or factcheck.too_embellished(text, check_text + " " + allowed)
        if not bad:
            return draft, []
        last_bad = bad
        feedback = (f"\n\nYour previous draft added details that are not in the source: {', '.join(bad)}. "
                    "Rewrite it using only what the source states.")
    return None, last_bad


async def rewrite_existing(result: RequirementResult, profile: CandidateProfile) -> RewriteOut:
    name = result.requirement.name
    original = result.evidence
    prompt = f"REQUIREMENT: {name}\nBULLET: {original}"
    feedback = ""
    for _ in range(MAX_ATTEMPTS):
        draft = await complete_structured(REWRITE_SYSTEM, prompt + feedback, RewriteDraft, max_tokens=600)
        text, rel = draft.suggestion.strip(), draft.relationship
        # The bullet is the only source of facts. The requirement's own words are allowed only when the
        # model says the bullet already shows it (same) or names a member of that category (same_family).
        allowed = name if rel in ("same", "same_family") else ""
        bad = factcheck.violations(text, original, allowed) or factcheck.too_embellished(text, original)
        if not bad and rel == "same_family":
            tools = factcheck.named_things(original)
            if tools and not (tools & factcheck.named_things(text)):
                bad = ["the specific tool from your bullet must stay named"]
        if bad:
            feedback = (f"\n\nYour previous draft added or dropped details: {', '.join(bad)}. "
                        "Use only what the bullet states.")
            continue
        warnings = [] if rel != "comparable" else [
            f"Your resume shows comparable experience, not {name} itself. Don't claim {name} unless you have used it."]
        return RewriteOut(requirement=name, kind="rewrite", original=original, suggestion=text,
                          relationship=rel, warnings=warnings)
    return RewriteOut(
        requirement=name, kind="rewrite", original=original, suggestion=None,
        warnings=["We couldn't produce a rewrite that stays strictly within what your resume says. "
                  "Add the detail yourself, then re-scan."])


async def write_from_answer(result: RequirementResult, answer: str, profile: CandidateProfile) -> RewriteOut:
    name = result.requirement.name
    if len(answer.strip()) < MIN_ANSWER_CHARS:
        return RewriteOut(requirement=name, kind="needs_input", question=question_for(name),
                          warnings=["Please describe where you used it in a sentence or two."])
    roles = "\n".join(f"{i}: {r.title}, {r.company} ({r.start or '?'} - {r.end or '?'})"
                      for i, r in enumerate(profile.roles)) or "(no roles listed)"
    prompt = f"REQUIREMENT: {name}\nROLES:\n{roles}\n\nCANDIDATE'S DESCRIPTION:\n{answer.strip()}"
    # Facts come from the candidate's own words; the requirement name is theirs to claim by answering.
    draft, bad = await _guarded(ANSWER_SYSTEM, prompt, AnswerDraft, answer, name, "suggestion")
    if draft is None:
        return RewriteOut(requirement=name, kind="from_answer",
                          warnings=["We couldn't write a line without adding details you didn't mention. "
                                    "Add a little more about what you did and try again."])
    if not draft.suggestion.strip():
        return RewriteOut(requirement=name, kind="needs_input", question=question_for(name),
                          warnings=[f"Your answer doesn't show you used {name}, so there's nothing to add."])
    role = None
    if 0 <= draft.role_index < len(profile.roles):
        r = profile.roles[draft.role_index]
        role = ", ".join(x for x in (r.title, r.company) if x) or None
    return RewriteOut(requirement=name, kind="from_answer", suggestion=draft.suggestion.strip(), role=role,
                      missing_detail=draft.missing_detail or None)
