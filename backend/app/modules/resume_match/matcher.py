"""Three-level requirement matching: exact/alias -> embedding -> LLM judge.

Cheapest check first. Only requirements that are neither clearly present nor
clearly absent reach the LLM, and all of those go in a single batched call.
Every "met" from the judge must quote resume text that actually exists, or it
is downgraded — the score never rests on something the model made up.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date
from typing import Awaitable, Callable

import numpy as np
from pydantic import BaseModel, Field

from .llm import complete_structured
from .schemas import (
    DEGREE_LEVELS, CandidateProfile, JobRequirements, Requirement, RequirementResult,
)
from .scoring import verdict_for

logger = logging.getLogger(__name__)

SAME = 0.78          # embedding similarity treated as an equivalent skill (matches krs.skill_gap)
AMBIGUOUS = 0.60     # below this a skill name is unrelated; between = ask the judge
BULLET_AMBIGUOUS = 0.55
RECENT_YEARS = 5
LISTED_PREFIX = "Skill listed: "


class JudgeUnavailable(RuntimeError):
    """The LLM judge could not give a usable answer; the scan must fail rather than score without it."""

# Canonical spellings. Everything else falls through to the embedding tier.
_ALIASES: dict[str, list[str]] = {
    "javascript": ["js", "ecmascript", "es6", "java script"],
    "typescript": ["ts"],
    "postgresql": ["postgres", "psql", "postgre sql"],
    "mysql": ["my sql"],
    "mongodb": ["mongo", "mongo db"],
    "kubernetes": ["k8s"],
    "node.js": ["node", "nodejs", "node js"],
    "react": ["react.js", "reactjs", "react js"],
    "vue": ["vue.js", "vuejs"],
    "angular": ["angular.js", "angularjs"],
    "power bi": ["powerbi", "microsoft power bi"],
    "machine learning": ["ml"],
    "artificial intelligence": ["ai"],
    "natural language processing": ["nlp"],
    "amazon web services": ["aws"],
    "google cloud platform": ["gcp", "google cloud"],
    "microsoft azure": ["azure"],
    "c#": ["c sharp", "csharp"],
    "c++": ["cpp"],
    "ci/cd": ["cicd", "ci cd", "continuous integration"],
    "rest api": ["rest", "restful api", "restful apis", "rest apis"],
    "ms excel": ["excel", "microsoft excel"],
    "search engine optimization": ["seo"],
    "user experience": ["ux"],
    "project management": ["project manager"],
    "stakeholder management": ["stakeholder communication", "stakeholder engagement"],
}
_CANON: dict[str, str] = {}
for _canon, _alts in _ALIASES.items():
    _CANON[_canon] = _canon
    for _a in _alts:
        _CANON[_a] = _canon


def normalize(s: str) -> str:
    s = re.sub(r"\([^)]*\)", " ", s.lower())
    s = re.sub(r"[^a-z0-9+#./ ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def canon(s: str) -> str:
    n = normalize(s)
    return _CANON.get(n, n)


def _variants(term: str) -> set[str]:
    c = canon(term)
    return {c} | {a for a, k in _CANON.items() if k == c}


def _mentions(text: str, term: str) -> bool:
    """Whole-token mention of the term (or any alias) in free text."""
    low = text.lower()
    return any(
        re.search(rf"(?<![\w+#]){re.escape(v)}(?![\w+#])", low) for v in _variants(term) if len(v) > 1
    )


# ── Judge (level 3) ──────────────────────────────────────────────────────────

class JudgeVerdict(BaseModel):
    index: int
    verdict: str = "missing"      # met | partial | missing
    quote: str = ""               # verbatim resume line that supports the verdict
    reason: str = ""


class JudgeBatch(BaseModel):
    verdicts: list[JudgeVerdict] = Field(default_factory=list)


@dataclass
class JudgeItem:
    index: int
    requirement: str
    type: str
    evidence: list[str]


JudgeFn = Callable[[list[JudgeItem]], Awaitable[list[JudgeVerdict]]]
EmbedFn = Callable[[list[str]], list[list[float] | None]]

JUDGE_SYSTEM = """You judge whether a candidate's resume evidence satisfies job requirements, like a careful recruiter.
For each item you get a requirement and lines from the resume. Decide:
- met: the lines clearly show the candidate has done this / has this skill.
- partial: the lines show a related or equivalent skill (e.g. MySQL for SQL, Looker for Tableau) or a weak claim.
- missing: the lines do not support it.
Be strict, as a recruiter screening many applicants would be:
- met needs the lines to directly show the specific skill or trait, not something merely adjacent to it.
- A generic trait (analytical thinking, problem solving, communication, leadership, decision making, resilience) is met when a line shows it being exercised concretely (analysing data -> analytical thinking; "led a team of 4" -> leadership; "presented to the board" -> presentation). It is partial when only loosely implied, and missing when the only lines are unrelated activities. Never infer a trait from a task that does not involve it.
- A bare mention that a topic exists is not evidence of having done it.
Never give credit for what is not written. For met or partial, "quote" must be copied VERBATIM from the \
provided lines. "reason" is one short sentence."""


async def llm_judge(items: list[JudgeItem]) -> list[JudgeVerdict]:
    if not items:
        return []
    body = "\n\n".join(
        f"[{i.index}] REQUIREMENT ({i.type}): {i.requirement}\nRESUME LINES:\n" + "\n".join(f"- {e}" for e in i.evidence)
        for i in items
    )
    batch = await complete_structured(JUDGE_SYSTEM, body, JudgeBatch, max_tokens=3000)
    return batch.verdicts


# ── Helpers ──────────────────────────────────────────────────────────────────

def _unit(vecs: list[list[float] | None]) -> np.ndarray:
    dim = next((len(v) for v in vecs if v is not None), 1)
    arr = np.array([v if v is not None else [0.0] * dim for v in vecs], dtype=np.float32)
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return arr / norms


def _recent(year: int | None, today: date) -> bool:
    return year is None or year >= today.year - RECENT_YEARS


@dataclass
class _Corpus:
    """Everything on the resume a requirement can be proven by."""
    skills: list           # ProfileSkill
    lines: list[str]       # every bullet, roles then projects
    line_year: list[int | None]

    @classmethod
    def build(cls, profile: CandidateProfile, today: date) -> "_Corpus":
        lines: list[str] = []
        years: list[int | None] = []
        for role in profile.roles:
            end = (role.end or role.start or "")
            year = today.year if end.strip().lower() in {"present", "current", "now", "ongoing"} else (
                int(m.group(1)) if (m := re.match(r"\s*(\d{4})", end)) else None)
            for b in role.bullets:
                lines.append(b)
                years.append(year)
        for proj in profile.projects:
            for b in proj.bullets:
                lines.append(b)
                years.append(today.year)
        return cls(profile.skills, lines, years)


def _exact(req: Requirement, corpus: _Corpus, today: date) -> RequirementResult | None:
    key = canon(req.name)
    for s in corpus.skills:
        if canon(s.name) == key:
            if s.evidence and _recent(s.last_used_year, today):
                return RequirementResult(requirement=req, credit=1.0, verdict="met", method="exact",
                                         evidence=s.evidence[0], reason="Used in a recent role.")
            return RequirementResult(
                requirement=req, credit=0.4, verdict="partial", method="exact",
                evidence=s.evidence[0] if s.evidence else "",
                reason="Used more than 5 years ago." if s.evidence else "Listed in skills but not shown in any role.")
    for line, year in zip(corpus.lines, corpus.line_year):
        if _mentions(line, req.name):
            if _recent(year, today):
                return RequirementResult(requirement=req, credit=1.0, verdict="met", method="exact",
                                         evidence=line, reason="Mentioned in your experience.")
            return RequirementResult(requirement=req, credit=0.4, verdict="partial", method="exact",
                                     evidence=line, reason="Used more than 5 years ago.")
    return None


# ── Education / certification (rule based) ───────────────────────────────────

_LEVEL_WORDS = [("doctor", "doctorate"), ("phd", "doctorate"), ("master", "master"), ("mba", "master"),
                ("m.tech", "master"), ("bachelor", "bachelor"), ("b.tech", "bachelor"), ("degree", "bachelor"),
                ("diploma", "diploma")]


def _required_level(req: Requirement) -> int:
    if req.min_degree_level in DEGREE_LEVELS:
        return DEGREE_LEVELS[req.min_degree_level]
    low = req.name.lower()
    return next((DEGREE_LEVELS[lv] for word, lv in _LEVEL_WORDS if word in low), DEGREE_LEVELS["bachelor"])


def _match_education(req: Requirement, profile: CandidateProfile, embed: EmbedFn) -> RequirementResult:
    need = _required_level(req)
    if need == 0:
        return RequirementResult(requirement=req, credit=1.0, verdict="met", method="rule", reason="No degree required.")
    best = max(profile.education, key=lambda e: DEGREE_LEVELS.get(e.degree_level, 0), default=None)
    have = DEGREE_LEVELS.get(best.degree_level, 0) if best else 0
    label = f"{best.degree_level.title()} in {best.field}".strip() if best and have else ""
    if have >= need:
        credit, reason = 1.0, "Degree level meets the requirement."
        if req.fields and best and best.field:
            vecs = _unit(embed([best.field] + req.fields))
            if vecs.shape[0] > 1 and float((vecs[1:] @ vecs[0]).max()) < AMBIGUOUS:
                credit, reason = 0.7, "Degree level meets the requirement but the field differs from those listed."
    elif have == need - 1 and have > 0:
        credit, reason = 0.5, "One degree level below the requirement."
    else:
        credit, reason = 0.0, "Required degree not found."
    return RequirementResult(requirement=req, credit=credit, verdict=verdict_for(credit), method="rule",
                             evidence=label if credit else "", reason=reason)


def _match_certification(req: Requirement, profile: CandidateProfile, embed: EmbedFn) -> RequirementResult:
    key = canon(req.name)
    for cert in profile.certifications:
        c = canon(cert)
        if c == key or key in c or c in key:
            return RequirementResult(requirement=req, credit=1.0, verdict="met", method="exact",
                                     evidence=cert, reason="Certification listed.")
    if profile.certifications:
        vecs = _unit(embed([req.name] + profile.certifications))
        sims = vecs[1:] @ vecs[0]
        i = int(np.argmax(sims))
        if float(sims[i]) >= 0.85:
            return RequirementResult(requirement=req, credit=0.7, verdict="partial", method="embedding",
                                     evidence=profile.certifications[i], reason="A closely related certification is listed.")
    return RequirementResult(requirement=req, credit=0.0, verdict="missing", method="none",
                             reason="Certification not found on the resume.")


def _match_domain(req: Requirement, profile: CandidateProfile, embed: EmbedFn) -> RequirementResult | None:
    """Industry/domain requirements are checked against the candidate's employer industries first."""
    if not profile.industries:
        return None
    options = [o.strip() for o in re.split(r"or|/|,", req.name) if o.strip()] or [req.name]
    vecs = _unit(embed(options + profile.industries))
    n = len(options)
    if not np.any(vecs):
        return None
    sims = vecs[n:] @ vecs[:n].T
    j, k = np.unravel_index(int(np.argmax(sims)), sims.shape)
    if float(sims[j, k]) >= 0.75:
        return RequirementResult(requirement=req, credit=1.0, verdict="met", method="embedding",
                                 evidence=f"Industry: {profile.industries[j]}",
                                 reason=f"Worked in {profile.industries[j]}.")
    return None


# ── Main entry ───────────────────────────────────────────────────────────────

_LLM_TYPES = {"hard_skill", "soft_skill", "domain"}


_ALTERNATIVES = re.compile(r"\s+or\s+", re.I)


def _alternatives(req: Requirement) -> list[Requirement]:
    """"Power BI or Tableau" -> [Power BI, Tableau]. Only for named skills, where "or" means either will do."""
    if req.type != "hard_skill":
        return [req]
    parts = [p.strip(" ,;()") for p in _ALTERNATIVES.split(req.name)]
    parts = [p for p in parts if len(p) >= 2]
    return [req.model_copy(update={"name": p}) for p in parts] if len(parts) > 1 else [req]


async def match_requirements(
    job: JobRequirements,
    profile: CandidateProfile,
    embed: EmbedFn,
    judge: JudgeFn = llm_judge,
    today: date | None = None,
) -> list[RequirementResult]:
    """One result per requirement. A requirement with alternatives ("X or Y") takes its best alternative."""
    flat: list[Requirement] = []
    group: list[int] = []
    for gi, req in enumerate(job.requirements):
        for alt in _alternatives(req):
            flat.append(alt)
            group.append(gi)
    flat_results = await _match_flat(job.model_copy(update={"requirements": flat}), profile, embed, judge, today)

    out: list[RequirementResult] = []
    for gi, req in enumerate(job.requirements):
        members = [r for r, g in zip(flat_results, group) if g == gi]
        best = max(members, key=lambda r: r.credit)
        out.append(best.model_copy(update={"requirement": req}))
    return out


async def _match_flat(
    job: JobRequirements,
    profile: CandidateProfile,
    embed: EmbedFn,
    judge: JudgeFn = llm_judge,
    today: date | None = None,
) -> list[RequirementResult]:
    today = today or date.today()
    corpus = _Corpus.build(profile, today)
    results: dict[int, RequirementResult] = {}
    pending: list[tuple[int, Requirement]] = []

    for i, req in enumerate(job.requirements):
        if req.type == "eligibility":
            results[i] = RequirementResult(requirement=req, credit=0.0, verdict="missing", method="rule",
                                           reason="A resume can't prove this — confirm it before applying.")
        elif req.type == "education":
            results[i] = _match_education(req, profile, embed)
        elif req.type == "certification":
            results[i] = _match_certification(req, profile, embed)
        elif req.type == "domain" and (dom := _match_domain(req, profile, embed)) is not None:
            results[i] = dom
        elif (hit := _exact(req, corpus, today)) is not None:
            results[i] = hit
        else:
            pending.append((i, req))

    if pending:
        await _match_semantic(pending, corpus, embed, judge, results, today)

    return [_cap_generic(results[i]) for i in range(len(job.requirements))]


_HAS_NUMBER = re.compile(r"\d")
GENERIC_CAP = 0.7


def _cap_generic(r: RequirementResult) -> RequirementResult:
    """A broad ability (problem solving, analytical thinking) is shown, not proven, by an ordinary duty
    line. Full credit needs a line with a measurable result (a number, a size, a saving)."""
    if r.requirement.specificity != "generic" or r.credit <= GENERIC_CAP or _HAS_NUMBER.search(r.evidence or ""):
        return r
    return r.model_copy(update={
        "credit": GENERIC_CAP, "verdict": verdict_for(GENERIC_CAP), "generic_capped": True,
        "reason": (r.reason + " " if r.reason else "") + "Shown, but without a measurable result.",
    })


async def _match_semantic(
    pending: list[tuple[int, Requirement]],
    corpus: _Corpus,
    embed: EmbedFn,
    judge: JudgeFn,
    results: dict[int, RequirementResult],
    today: date,
) -> None:
    skill_names = [s.name for s in corpus.skills]
    texts = [r.name for _, r in pending] + skill_names + corpus.lines
    vecs = embed(texts)
    if not any(v is not None for v in vecs):
        logger.warning("[RESUME_MATCH] embeddings unavailable — sending unmatched requirements straight to the judge")
        vecs = [None] * len(texts)
    unit = _unit(vecs)
    n_req, n_sk = len(pending), len(skill_names)
    req_v, skill_v, line_v = unit[:n_req], unit[n_req:n_req + n_sk], unit[n_req + n_sk:]

    items: list[JudgeItem] = []
    meta: dict[int, tuple[Requirement, list[str]]] = {}
    for k, (idx, req) in enumerate(pending):
        embedded = bool(np.any(req_v[k]))
        best_skill_sim, best_skill = 0.0, None
        if embedded and n_sk:
            sims = skill_v @ req_v[k]
            j = int(np.argmax(sims))
            best_skill_sim, best_skill = float(sims[j]), corpus.skills[j]

        # A skill the resume lists that means the same thing (PostgreSQL for SQL).
        if best_skill is not None and best_skill_sim >= SAME:
            proven = bool(best_skill.evidence) and _recent(best_skill.last_used_year, today)
            results[idx] = RequirementResult(
                requirement=req, credit=0.7 if proven else 0.4, verdict="partial", method="embedding",
                evidence=(best_skill.evidence[0] if best_skill.evidence else best_skill.name),
                reason=f"“{best_skill.name}” is equivalent to “{req.name}”." if proven
                else f"“{best_skill.name}” is listed but not shown in a role.")
            continue

        # Otherwise gather the resume lines most likely to prove it and let the judge decide.
        cand: list[str] = []
        if embedded and len(corpus.lines):
            sims = line_v @ req_v[k]
            top = np.argsort(-sims)[:3]
            cand += [corpus.lines[t] for t in top if float(sims[t]) >= BULLET_AMBIGUOUS]
        if best_skill is not None and best_skill_sim >= AMBIGUOUS:
            cand += best_skill.evidence[:2] or [f"{LISTED_PREFIX}{best_skill.name}"]
        if not embedded and corpus.lines:  # no embeddings: give the judge the whole (short) evidence set
            cand = corpus.lines[:12] + [f"{LISTED_PREFIX}{n}" for n in skill_names[:15]]
        if not cand:
            results[idx] = RequirementResult(requirement=req, credit=0.0, verdict="missing", method="none",
                                             reason="Nothing on the resume relates to this.")
            continue
        items.append(JudgeItem(index=idx, requirement=req.name, type=req.type, evidence=cand))
        meta[idx] = (req, cand)

    if not items:
        return
    # A judge failure must fail the scan, not quietly score the ambiguous requirements as 0: a wrongly low
    # score would be saved and shown as if it were real. The caller turns this into a retryable error.
    verdicts = {v.index: v for v in await judge(items)}
    missing = [i for i in items if i.index not in verdicts]
    if missing:  # the model skipped some items: ask again for just those
        verdicts.update({v.index: v for v in await judge(missing)})
    still_missing = [i.requirement for i in items if i.index not in verdicts]
    if still_missing:
        raise JudgeUnavailable(f"The judge returned no verdict for: {', '.join(still_missing)}")

    for idx, (req, cand) in meta.items():
        v = verdicts[idx]
        matched = [c for c in cand
                   if v.quote and (normalize(v.quote) in normalize(c) or normalize(c) in normalize(v.quote))]
        quote_ok = bool(matched)
        if v.verdict == "met" and quote_ok:
            credit = 1.0
        elif v.verdict == "met":       # claimed but the quote can't be verified
            credit = 0.4
        elif v.verdict == "partial":
            credit = 0.7 if quote_ok else 0.4
        else:
            credit = 0.0
        reason = v.reason
        # Backed only by a skills-list entry, never by work shown in a role: same 0.4 cap as an exact listed-only skill.
        if quote_ok and credit > 0.4 and all(c.startswith(LISTED_PREFIX) for c in matched):
            credit, reason = 0.4, "Only listed as a skill; not shown in any role."
        results[idx] = RequirementResult(
            requirement=req, credit=credit, verdict=verdict_for(credit), method="llm",
            evidence=v.quote if (quote_ok and credit > 0) else "", reason=reason)


# ── Role relevance and industry (embedding based) ────────────────────────────

def role_relevance(job: JobRequirements, profile: CandidateProfile, embed: EmbedFn) -> float | None:
    """0..1: how closely past titles/bullets match the job's title and responsibilities."""
    targets = [t for t in [job.title, *job.responsibilities] if t]
    chunks = [r.title for r in profile.roles if r.title]
    chunks += [b for r in profile.roles for b in r.bullets] + [b for p in profile.projects for b in p.bullets]
    if not targets:
        return None
    if not chunks:
        return 0.0
    vecs = embed(targets + chunks)
    if not any(v is not None for v in vecs):
        return None
    unit = _unit(vecs)
    tv, cv = unit[:len(targets)], unit[len(targets):]
    best = (tv @ cv.T).max(axis=1)          # best-matching resume chunk per target
    sim = float(best.mean())
    return float(min(1.0, max(0.0, (sim - 0.45) / (0.80 - 0.45))))


def industry_match(job: JobRequirements, profile: CandidateProfile, embed: EmbedFn) -> float | None:
    if not job.industry:
        return None
    if not profile.industries:
        return 0.0
    vecs = embed([job.industry] + profile.industries)
    if not any(v is not None for v in vecs):
        return None
    unit = _unit(vecs)
    sim = float((unit[1:] @ unit[0]).max())
    return 1.0 if sim >= 0.85 else 0.6 if sim >= 0.65 else 0.0
