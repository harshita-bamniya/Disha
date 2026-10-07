"""Role blueprints: match a job to one, or draft one from real postings.

Blueprints are drafted once per role family (with the strongest model available),
validated in code, judged, and then reused for every user. A human review
promotes `draft` -> `reviewed`; drafts are usable but flagged.
"""
from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import logging
import re
import socket
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from app.models.user import JobPosting
from app.models.role_blueprint import RoleBlueprint
from app.modules.recommendations import embedder
from app.modules.roadmap_engine import corpus as corpus_mod
from app.modules.roadmap_engine.schema import apply_repair, normalise_graph, slugify, validate_graph, validate_graph_skeleton

logger = logging.getLogger(__name__)

MATCH_THRESHOLD = 0.62          # shortlist floor only (embedding score); see 'matching' below
REF_MIN_OVERLAP = 1             # significant skill tokens that must appear in the page title
_STOP = {"and", "the", "for", "with", "of", "to", "in", "on", "a", "an", "&", "using", "basics", "introduction"}

_draft_locks: dict[str, asyncio.Lock] = {}


# ── helpers ──────────────────────────────────────────────────────────────────

def job_text(job: JobPosting) -> str:
    skills = ", ".join(job.required_skills or [])
    return f"{job.title}. {skills}. {(job.description or '')[:1200]}"


def blueprint_text(bp_title: str, graph: dict[str, Any]) -> str:
    names = ", ".join(s["name"] for s in graph.get("skills", []))
    return f"{bp_title}. {names}"


def _tokens(text: str) -> set[str]:
    return {t[:6] for t in re.findall(r"[a-z0-9]{3,}", (text or "").lower()) if t not in _STOP}


def _cos(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b:
        return 0.0
    return float(embedder.cosine_similarity(a, b))


def _extract_json(raw: str) -> dict[str, Any]:
    from app.modules.jobs.plan_generator import _extract_json as ex
    return ex(raw)


# ── matching ─────────────────────────────────────────────────────────────────
#
# Embeddings alone CANNOT be trusted here: these vectors score almost every pair of
# job titles between 0.55 and 0.71, so an embedding threshold happily hands a
# "Programme Officer – Rural Development" a compliance roadmap. Embeddings only
# shortlist; an LLM judges whether a blueprint genuinely covers the job's duties.

HIGH_MATCH = 0.85               # near-identical role: accept without asking the LLM
MIN_COVERAGE_PCT = 80           # share of the job's core duties that a named blueprint skill teaches

MATCH_SYSTEM = "You are a strict hiring manager deciding whether a training blueprint prepares someone for a specific job. Output ONLY JSON."
DUTIES_PROMPT = """JOB POSTING
Title: {title}
Required skills: {skills}
Description: {description}

List the 6 CORE DAILY DUTIES of this job: what the person actually does all week, in the order of importance.
Be specific to this role (not generic abilities like "communicate well"). Return {{"duties": ["<short duty>", ...]}}"""

MATCH_PROMPT = """CANDIDATE BLUEPRINT "{bp_title}" teaches exactly these skills:
{bp_skills}

For the job "{title}", decide for EACH duty below whether ONE blueprint skill above directly teaches it.
Copy that skill's name EXACTLY from the list, or set covered=false. Sharing a sector, a seniority level or generic
abilities (writing, analysis, communication) does NOT count as covered.

DUTIES (fixed, do not change or reorder):
{duties}

Return {{"duties": [{{"duty": "<the duty>", "covered": true|false, "skill": "<exact blueprint skill name or null>"}}]}}"""

MIN_DUTIES = 4


def accept_match(
    verdict: dict[str, Any], blueprint_skill_names: list[str] | None = None, expected_duties: int | None = None,
) -> bool:
    """Pure decision rule. Coverage is COMPUTED here from the judge's duty list — not taken from the judge's
    own score — and every claimed skill must really exist in the blueprint. `expected_duties` is the size of
    the fixed, blueprint-independent duty list: the judge cannot shrink the denominator by dropping duties."""
    duties = verdict.get("duties")
    if not isinstance(duties, list) or len(duties) < MIN_DUTIES:
        return False
    known = {n.strip().lower() for n in (blueprint_skill_names or [])}
    covered = 0
    for d in duties:
        if not isinstance(d, dict) or d.get("covered") is not True:
            continue
        skill = str(d.get("skill") or "").strip().lower()
        if blueprint_skill_names is not None and skill not in known:
            continue                      # claimed a skill that is not in this blueprint
        covered += 1
    return covered / max(len(duties), expected_duties or 0) >= MIN_COVERAGE_PCT / 100


async def _job_duties(job: JobPosting) -> list[str]:
    """The job's core duties, derived from the posting ALONE (so a blueprint cannot bend them) and cached."""
    cache_key = f"bp:duties:v1:{job.id}"
    try:
        from app.modules.jobs.plan_router import _redis
        cached = _redis().get(cache_key)
        if cached:
            import json as _json
            return _json.loads(cached)
    except Exception:
        pass
    from app.modules.roadmap_engine.llm import complete_json
    data = await complete_json(
        MATCH_SYSTEM,
        DUTIES_PROMPT.format(title=job.title, skills=", ".join(job.required_skills or []), description=(job.description or "")[:900]),
        900, 0.0, tier="strong",
    )
    duties = [str(d).strip()[:160] for d in (data.get("duties") or []) if str(d).strip()][:7]
    if len(duties) >= MIN_DUTIES:
        try:
            import json as _json
            from app.modules.jobs.plan_router import _redis
            _redis().set(cache_key, _json.dumps(duties), ex=60 * 60 * 24 * 30)
        except Exception:
            pass
    return duties


def candidate_blueprints(db: Session, job: JobPosting, limit: int = 3) -> list[tuple[RoleBlueprint, float]]:
    """Shortlist of current blueprints by embedding + title overlap, best first."""
    blueprints = db.query(RoleBlueprint).filter(RoleBlueprint.is_current.is_(True)).all()
    if not blueprints:
        return []
    jv = embedder.embed(job_text(job))
    scored = []
    for bp in blueprints:
        sim = _cos(jv, bp.embedding)
        # Title token overlap breaks ties between semantically close families.
        overlap = len(_tokens(job.title) & _tokens(bp.title)) / max(1, len(_tokens(job.title)))
        scored.append((bp, sim + 0.15 * overlap))
    scored.sort(key=lambda p: p[1], reverse=True)
    return [(bp, sc) for bp, sc in scored[:limit] if sc >= MATCH_THRESHOLD]


def find_blueprint(db: Session, job: JobPosting) -> tuple[RoleBlueprint | None, float]:
    """Cheap, synchronous, CONFIDENT-ONLY lookup (near-identical roles). No LLM."""
    cands = candidate_blueprints(db, job, 1)
    if cands and cands[0][1] >= HIGH_MATCH:
        return cands[0]
    return None, cands[0][1] if cands else 0.0


async def _llm_same_role(job: JobPosting, bp: RoleBlueprint) -> bool:
    """Ask the LLM whether this blueprint really covers the job. Cached per (job, blueprint)."""
    cache_key = f"bp:match:v3:{job.id}:{bp.id}"
    try:
        from app.modules.jobs.plan_router import _redis
        cached = _redis().get(cache_key)
        if cached in ("1", "0"):
            return cached == "1"
    except Exception:
        pass
    from app.modules.roadmap_engine.llm import complete_json
    duties = await _job_duties(job)
    if len(duties) < MIN_DUTIES:
        return False                      # cannot judge without a duty list -> never guess a match
    skill_names = [sk["name"] for sk in (bp.graph or {}).get("skills", [])]
    # Strong tier: a cheap model was too lenient and matched a Strategy Consultant to a Policy Research blueprint.
    verdict = await complete_json(
        MATCH_SYSTEM,
        MATCH_PROMPT.format(
            title=job.title, bp_title=bp.title,
            bp_skills="\n".join(f"- {n}" for n in skill_names),
            duties="\n".join(f"{i}. {d}" for i, d in enumerate(duties, 1)),
        ),
        1500, 0.0, tier="strong",
    )
    ok = accept_match(verdict, skill_names, expected_duties=len(duties))
    judged = verdict.get("duties") if isinstance(verdict.get("duties"), list) else []
    logger.info("[BLUEPRINT_MATCH] job=%r blueprint=%r -> %s (%d/%d duties covered)", job.title, bp.title, ok,
                sum(1 for d in judged if isinstance(d, dict) and d.get("covered") is True), len(duties))
    try:
        from app.modules.jobs.plan_router import _redis
        _redis().set(cache_key, "1" if ok else "0", ex=60 * 60 * 24 * 30)
    except Exception:
        pass
    return ok


async def resolve_blueprint(db: Session, job: JobPosting) -> RoleBlueprint | None:
    """The blueprint that genuinely covers this job, or None (=> draft a new one)."""
    cands = await asyncio.to_thread(candidate_blueprints, db, job)
    if cands and cands[0][1] >= HIGH_MATCH:
        return cands[0][0]
    for bp, _score in cands:
        try:
            if await _llm_same_role(job, bp):
                return bp
        except Exception as exc:
            # Cannot verify -> do not guess. Drafting a fresh blueprint is safer than a wrong one.
            logger.warning("Blueprint match check failed for %r vs %r: %s", job.title, bp.title, exc)
    return None


# ── reference verification ───────────────────────────────────────────────────

_OFFICIAL_SUFFIXES = (".gov.in", ".nic.in", ".gov", ".edu", ".ac.in", ".org.in", "iso.org", "rbi.org.in", "sebi.gov.in")


def _is_official_domain(host: str) -> bool:
    host = host.lower()
    return any(host.endswith(sfx) for sfx in _OFFICIAL_SUFFIXES)


def _is_public_host(host: str) -> bool:
    try:
        for info in socket.getaddrinfo(host, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        return True
    except Exception:
        return False


def body_fingerprint(text: str) -> str:
    """Whitespace-insensitive fingerprint of a page body (first 20k chars)."""
    return hashlib.sha1(re.sub(r"\s+", " ", text[:20000]).encode("utf-8", "ignore")).hexdigest()


async def is_soft_404_site(client: httpx.AsyncClient, url: str, page_fp: str, cache: dict[str, str | None]) -> bool:
    """True when this host answers "200 OK" with the SAME page for a path that cannot exist.

    Such a site (many single-page apps, including some government portals) makes any invented
    deep link look valid, so a deep link on it proves nothing."""
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if host not in cache:
        probe = f"{parsed.scheme}://{parsed.netloc}/__rm_probe_{uuid.uuid4().hex[:10]}"
        try:
            r = await client.get(probe, follow_redirects=True, timeout=8)
            cache[host] = body_fingerprint(r.text) if r.status_code == 200 else None
        except Exception:
            cache[host] = None
    return cache[host] is not None and cache[host] == page_fp


async def _verify_one(
    client: httpx.AsyncClient, skill_name: str, role: str, ref: dict[str, str],
    probe_cache: dict[str, str | None] | None = None,
) -> dict[str, Any] | None:
    url = ref["url"]
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return None
    if not await asyncio.to_thread(_is_public_host, parsed.hostname):
        return None
    try:
        r = await client.get(url, follow_redirects=True, timeout=8)
    except Exception:
        return None
    final = urlparse(str(r.url))
    if not final.hostname or not await asyncio.to_thread(_is_public_host, final.hostname):
        return None
    if r.status_code in (401, 403, 429) and _is_official_domain(final.hostname):
        # Official portals often block scripted requests, so the page itself can't be read. Accept only when
        # the deep link's own path or the model's label clearly names the skill, and say it was not auto-checked.
        hint = _tokens(ref.get("title", "") + " " + final.path.replace("/", " ").replace("-", " "))
        if len(_tokens(skill_name) & hint) < 2:
            return None
        return {
            "title": ref.get("title", ""), "url": str(r.url), "source": final.hostname.removeprefix("www."),
            "kind": "article", "verified": False, "verified_at": None,
        }
    if r.status_code != 200:
        return None
    ctype = r.headers.get("content-type", "")
    title = ref.get("title") or ""
    if "html" in ctype and final.path not in ("", "/") and probe_cache is not None:
        if await is_soft_404_site(client, str(r.url), body_fingerprint(r.text), probe_cache):
            return None                    # this site returns the same page for any path: the deep link is unverifiable
    if "html" in ctype:
        m = re.search(r"<title[^>]*>(.*?)</title>", r.text[:60000], re.I | re.S)
        if m:
            title = re.sub(r"\s+", " ", m.group(1)).strip()[:200] or title
    elif "pdf" not in ctype:
        return None
    # Relevance must come from the PAGE (its real <title> or URL path) — not from the model's own
    # label, which would let a generic regulator homepage pass for any skill.
    page_tokens = _tokens(title + " " + final.path.replace("/", " ").replace("-", " ").replace("_", " "))
    if len(_tokens(skill_name) & page_tokens) < REF_MIN_OVERLAP:
        return None
    return {
        "title": title or ref.get("title", ""),
        "url": str(r.url),
        "source": final.hostname.removeprefix("www."),
        "kind": "pdf" if "pdf" in ctype else "article",
        "verified": True,
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }


async def verify_references(skills: list[dict[str, Any]], role: str) -> None:
    """Keep only references that load (200), are public, and match the skill's topic."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/pdf;q=0.9,*/*;q=0.5",
    }
    async with httpx.AsyncClient(headers=headers) as client:
        sem = asyncio.Semaphore(6)
        probe_cache: dict[str, str | None] = {}

        async def one(skill: dict[str, Any], ref: dict[str, str]):
            async with sem:
                return skill, await _verify_one(client, skill["name"], role, ref, probe_cache)

        results = await asyncio.gather(*[one(s, r) for s in skills for r in s.get("reference_candidates", [])])
    for s in skills:
        s["references"] = []
    seen: set[str] = set()
    for skill, ok in results:
        norm = re.sub(r"^https?://(www\.)?", "", ok["url"]).rstrip("/").lower() if ok else ""
        if ok and norm not in seen:
            seen.add(norm)
            skill["references"].append(ok)
    for s in skills:
        s.pop("reference_candidates", None)


async def reverify_references(skills: list[dict[str, Any]], role: str) -> int:
    """Re-check the references already stored on a blueprint with the current rules. Returns how many were dropped."""
    before = sum(len(s.get("references") or []) for s in skills)
    for s in skills:
        s["reference_candidates"] = [
            {"title": r.get("title", ""), "url": r["url"], "source": r.get("source", ""), "kind": r.get("kind", "article")}
            for r in s.get("references") or [] if r.get("url")
        ]
    await verify_references(skills, role)
    return before - sum(len(s.get("references") or []) for s in skills)


# ── drafting ─────────────────────────────────────────────────────────────────

DRAFT_SYSTEM = """You are a senior hiring manager AND an instructional designer building the \
definitive, job-ready learning blueprint for ONE specific role in India. Your output is a \
reviewed skeleton that thousands of learners will follow, so it must reflect what employers \
actually hire for in 2026 — not generic self-help. Every skill must be concrete and teachable \
(a tool, a regulation, a method, a deliverable) and specific to THIS role. Never output vague \
filler like "Critical Thinking" or "Communication" as a skill unless it is tied to a concrete \
practice (e.g. "Writing a policy brief for a non-expert minister's office"). Use the law, regulation and standard names that are IN FORCE in 2026 (e.g. India's Digital Personal Data Protection Act 2023 and its Rules — never the withdrawn Personal Data Protection Bill; current versions such as ISO 27001:2022). Never teach repealed or withdrawn instruments as current. Output ONLY compact JSON."""

SKELETON_PROMPT = """ROLE: {title}
SECTOR: {sector}

MARKET EVIDENCE for this role family: [R] = reference roles from a research catalogue of what organisations hire for; [P] = live postings on our platform. Extract what employers ask for from THESE only:
{postings}

Return the SKELETON of the blueprint as JSON:
{{
  "role_title": str,
  "summary": "one sentence: what a person in this role does and what makes a candidate hireable",
  "job_ready_definition": [3-5 concrete, verifiable statements, e.g. '3 portfolio pieces reviewed against a rubric', 'passes a 45-min mock interview'],
  "phases": [4-5 phases in order: Foundations, Core skills, Specialization, Portfolio, Job search;
     each {{"id":"phase-1","name":str,"goal":str,"gate":{{"type":"quiz|project|exercise|case_study|mock_test|portfolio_piece","description":str,"pass_criteria":[2-4 checkable criteria]}}}}],
  "skills": [12-16 skills, PREREQUISITES LISTED BEFORE THEIR DEPENDENTS, every phase must own at least one skill, each {{
     "id": kebab-case slug,
     "name": specific skill name,
     "phase": a phase id,
     "prerequisites": [ids of EARLIER skills],
     "base_hours": honest hours for a complete beginner to reach working level (2-40),
     "why_for_role": "why this exact role needs it, in terms of real day-to-day tasks (1-2 sentences)",
     "concept_type": "concept|tool|practice",
     "shelf_life_years": how long good tutorials stay valid (AI tools 2, regulation 3, maths 10),
     "core_topic": "2-4 word plain topic name for broad YouTube search, e.g. 'Power BI dashboards', 'ISO 27001', 'DPDP Act'",
     "search_queries": [2 precise YouTube queries a learner would type, include level/context],
     "vetted_channels": [0-3 real, well-known educators for this skill; only ones you are certain exist]
  }}]
}}
Rules: total base_hours across skills should be realistic for an entry-level offer (typically 120-350). The Portfolio and Job search phases must contain skills too (e.g. building a capstone, interview practice for this role)."""

DETAIL_PROMPT = """ROLE: {title}
Job-ready definition: {ready}

For each skill below, design the PROOF task and list authoritative references.
Skills:
{skills}

Return JSON: {{"details": {{"<skill id>": {{
   "proof": {{"type": "project|quiz|exercise|case_study|mock_test|portfolio_piece", "title": str, "brief": "what to produce, realistic scope, 2-3 sentences", "rubric": [3-5 criteria a reviewer would check]}},
   "references": [0-2 objects {{"title": str, "url": str}} for authoritative PRIMARY sources. Prefer STABLE LANDING PAGES you are sure exist (an official docs home page, a regulator or ministry page, an act page on indiacode.nic.in, prsindia.org, learn.microsoft.com, official standards pages) over deep links that may have moved. Full https URLs. Omit rather than guess]
}}}}}}"""

KIT_PROMPT = """ROLE: {title}
Proof tasks a learner will complete: {proofs}

Return JSON: {{"job_search_kit": {{
  "resume_bullet_templates": [4-6 templates with [metric]/[tool] placeholders tied to the proofs above],
  "interview_questions": [14-18 realistic questions asked for THIS role: technical, situational, behavioural],
  "where_to_apply": [4-8 employer types or portals relevant in India],
  "profile_checklist": [5-8 concrete LinkedIn/portfolio items]
}}}}
Do NOT invent salary figures."""


REPAIR_PROMPT = """ROLE: {title}

Your blueprint skeleton has these problems:
{problems}

Current phases (id | name | goal):
{phases}

Current skills (id | phase | name):
{skills}

Fix ONLY the problems above. Return JSON:
{{
  "add_skills": [full skill objects, same schema as before (id, name, phase, prerequisites (existing ids only), base_hours, why_for_role, concept_type, core_topic, shelf_life_years, search_queries, vetted_channels), one or more for EACH empty phase, concrete and specific to the role],
  "fix_skills": {{"<existing skill id>": {{"why_for_role": "<1-2 sentences on the real day-to-day need>"}} }}
}}
Use [] / {{}} when nothing is needed for a part."""


JUDGE_SYSTEM = "You are a skeptical hiring manager reviewing a training blueprint. Output ONLY JSON."
JUDGE_PROMPT = """Role: {title}

Blueprint skills (in order): {skills}
Job-ready definition: {ready}
Proof tasks: {proofs}

Would a hiring manager for this role consider a candidate who completed this blueprint credible for an entry-level offer?
Return JSON: {{"credible": true|false, "score": 0-100, "missing_skills": [up to 5 concrete gaps], "weak_or_generic": [skill names that are vague or filler], "notes": "one sentence"}}"""


class BlueprintQualityError(RuntimeError):
    """A draft failed structural validation or the hiring-manager check. It is never stored."""


async def _llm_json(system: str, prompt: str, max_tokens: int, temperature: float) -> dict[str, Any]:
    """Blueprint drafting/judging always uses the strong tier (see llm._providers)."""
    from app.modules.roadmap_engine.llm import complete_json
    return await complete_json(system, prompt, max_tokens, temperature, tier="strong")


async def draft_blueprint(
    db: Session,
    job: JobPosting,
    on_progress: Callable[[str], Awaitable[None]] | None = None,
    force: bool = False,
) -> RoleBlueprint:
    """Draft, validate (retry once with the errors), verify references, judge, store.
    `force` re-drafts even when a near-identical blueprint exists (the old version is retired, not deleted)."""
    slug = slugify(job.title)
    lock = _draft_locks.setdefault(slug, asyncio.Lock())
    async with lock:
        # Another request may have drafted it while we waited for the lock.
        existing, _ = find_blueprint(db, job)
        if existing and not force:
            return existing

        # The asyncio lock only covers this process. A publish-time prep task and an aspirant's
        # on-demand request run in different worker processes, so also take a Redis lock; if another
        # process is already drafting this role, wait for its result instead of drafting a duplicate.
        redis_lock_key = f"bp:draft_lock:{slug}"
        got_lock = True
        try:
            from app.modules.jobs.plan_router import _redis
            got_lock = bool(_redis().set(redis_lock_key, "1", nx=True, ex=1800))
        except Exception:
            got_lock = True          # Redis down: proceed rather than block roadmaps
        if not got_lock:
            for _ in range(60):      # up to ~10 minutes
                await asyncio.sleep(10)
                db.expire_all()
                found = await resolve_blueprint(db, job)
                if found:
                    return found
            raise RuntimeError("Another blueprint draft for this role is taking too long — please retry shortly.")
        try:
            from app.modules.roadmap_engine import llm
            order = llm.provider_names("strong")
            last: Exception | None = None
            # A weak draft is never stored. Retry once with the other provider first, then give up.
            # primary, the other provider, then the primary once more (empty/garbled output is often transient)
            attempts = (order[:2] + order[:1]) if order else [None]
            for name in attempts:
                try:
                    with llm.prefer(name):
                        return await _draft_locked(db, job, slug, on_progress)
                except BlueprintQualityError as exc:
                    last = exc
                    logger.warning("[BLUEPRINT] draft via %s rejected: %s", name, exc)
            raise RuntimeError(f"Could not draft a blueprint that passes quality checks for '{job.title}': {last}")
        finally:
            try:
                from app.modules.jobs.plan_router import _redis
                _redis().delete(redis_lock_key)
            except Exception:
                pass


async def _draft_locked(
    db: Session,
    job: JobPosting,
    slug: str,
    on_progress: Callable[[str], Awaitable[None]] | None = None,
) -> RoleBlueprint:
    if True:

        async def note(msg: str) -> None:
            if on_progress:
                await on_progress(msg)

        await note("Collecting reference roles and postings for this role")
        roles = await asyncio.to_thread(corpus_mod.similar_roles, db, job)
        live = await asyncio.to_thread(corpus_mod.similar_live_postings, db, job)
        postings = corpus_mod.roles_block(roles, live)
        await note("Drafting the role's skill graph")
        skeleton = await _llm_json(
            DRAFT_SYSTEM,
            SKELETON_PROMPT.format(title=job.title, sector=job.sector or "General", postings=postings),
            4500, 0.3,
        )
        raw: dict[str, Any] = dict(skeleton)
        graph = normalise_graph(raw)
        errors = validate_graph_skeleton(graph)
        # Targeted repair first: models tend to repeat the same omission when the whole prompt is re-sent,
        # but reliably fill a specific gap (an empty phase, a missing "why") when asked for just that.
        for _ in range(2):
            if not errors:
                break
            await note("Repairing gaps in the draft")
            try:
                patch = await _llm_json(
                    DRAFT_SYSTEM,
                    REPAIR_PROMPT.format(
                        title=job.title,
                        problems="\n".join(f"- {e}" for e in errors[:10]),
                        phases="\n".join(f"{p['id']} | {p['name']} | {p['goal']}" for p in graph["phases"]),
                        skills="\n".join(f"{sk['id']} | {sk['phase']} | {sk['name']}" for sk in graph["skills"]),
                    ),
                    3500, 0.2,
                )
                graph = apply_repair(graph, patch)
                raw["phases"] = graph["phases"]
            except Exception as exc:
                logger.warning("Targeted repair failed: %s", exc)
                break
            errors = validate_graph_skeleton(graph)
        if errors:
            await note("Fixing structural problems in the draft")
            fix = SKELETON_PROMPT.format(title=job.title, sector=job.sector or "General", postings=postings[:2500]) + (
                "\n\nYour previous skeleton failed these checks — return a corrected FULL skeleton:\n- "
                + "\n- ".join(errors[:12])
            )
            raw = dict(await _llm_json(DRAFT_SYSTEM, fix, 4500, 0.2))
            graph = normalise_graph(raw)
            errors = validate_graph_skeleton(graph)
        if not graph["skills"]:
            raise RuntimeError(f"Could not draft a valid blueprint for '{job.title}': {errors[:3]}")

        # Proofs + references in small batches (far more reliable than one giant JSON).
        skills = graph["skills"]
        ready = "; ".join(graph["job_ready_definition"])
        for i in range(0, len(skills), 5):
            batch = skills[i:i + 5]
            await note(f"Designing proof tasks ({min(i + 5, len(skills))}/{len(skills)})")
            listing = "\n".join(f"- id={s['id']} | {s['name']} | needed because: {s['why_for_role']}" for s in batch)
            try:
                det = (await _llm_json(
                    DRAFT_SYSTEM, DETAIL_PROMPT.format(title=job.title, ready=ready, skills=listing), 3500, 0.3,
                )).get("details", {})
            except Exception as exc:
                logger.warning("Proof batch failed (%s): %s", [s["id"] for s in batch], exc)
                det = {}
            for s in batch:
                d = det.get(s["id"]) or {}
                one = normalise_graph({
                    "phases": raw.get("phases", []),
                    "skills": [{"name": s["name"], "id": s["id"], "phase": s["phase"], "base_hours": s["base_hours"],
                                "proof": d.get("proof", {}), "references": d.get("references", [])}],
                })["skills"]
                if one:
                    s["proof"], s["reference_candidates"] = one[0]["proof"], one[0]["reference_candidates"]

        # Any skill the model skipped gets one more targeted attempt; unfixable ones are dropped
        # (a skill without a proof task is not a valid roadmap step).
        missing = [s for s in skills if not s["proof"]["title"] or not s["proof"]["brief"]]
        if missing:
            await note(f"Completing {len(missing)} missing proof tasks")
            listing = "\n".join(f"- id={s['id']} | {s['name']} | needed because: {s['why_for_role']}" for s in missing)
            try:
                det = (await _llm_json(
                    DRAFT_SYSTEM, DETAIL_PROMPT.format(title=job.title, ready=ready, skills=listing), 3500, 0.2,
                )).get("details", {})
            except Exception as exc:
                logger.warning("Proof retry failed: %s", exc)
                det = {}
            for s in missing:
                d = det.get(s["id"]) or {}
                one = normalise_graph({"phases": raw.get("phases", []), "skills": [
                    {"name": s["name"], "id": s["id"], "phase": s["phase"], "base_hours": s["base_hours"],
                     "proof": d.get("proof", {}), "references": d.get("references", [])}]})["skills"]
                if one and one[0]["proof"]["title"] and one[0]["proof"]["brief"]:
                    s["proof"] = one[0]["proof"]
                    s["reference_candidates"] = s.get("reference_candidates") or one[0]["reference_candidates"]
        dropped = {s["id"] for s in skills if not s["proof"]["title"] or not s["proof"]["brief"]}
        if dropped:
            logger.warning("[BLUEPRINT] dropping skills without proofs: %s", dropped)
            skills = [s for s in skills if s["id"] not in dropped]
            for s in skills:
                s["prerequisites"] = [p for p in s["prerequisites"] if p not in dropped]
            graph["skills"] = skills

        await note("Writing the job-search kit")
        try:
            kit_raw = await _llm_json(
                DRAFT_SYSTEM,
                KIT_PROMPT.format(title=job.title, proofs="; ".join(s["proof"]["title"] for s in skills if s["proof"]["title"])),
                3000, 0.3,
            )
            graph["job_search_kit"] = normalise_graph(kit_raw)["job_search_kit"]
        except Exception as exc:
            logger.warning("Job-search kit failed: %s", exc)
        errors = validate_graph(graph)

        await note("Verifying reference links")
        await verify_references(graph["skills"], job.title)
        corpus_mod.compute_evidence(
            graph["skills"], [corpus_mod.role_text(r) for r in roles], [job_text(p) for p in live])

        await note("Running hiring-manager review")
        judge: dict[str, Any] = {}
        try:
            judge = await _llm_json(
                JUDGE_SYSTEM,
                JUDGE_PROMPT.format(
                    title=job.title,
                    skills="; ".join(s["name"] for s in graph["skills"]),
                    ready="; ".join(graph["job_ready_definition"]),
                    proofs="; ".join(s["proof"]["title"] for s in graph["skills"]),
                ),
                800, 0.1,
            )
        except Exception as exc:
            logger.warning("Blueprint judge failed for %s: %s", job.title, exc)

        # Quality gate: structurally invalid or not-credible drafts are rejected, never stored.
        if errors:
            raise BlueprintQualityError("; ".join(errors[:4]))
        if judge.get("credible") is False:
            raise BlueprintQualityError(f"hiring-manager review says not credible: {judge.get('notes', '')}")

        # Retire older versions of this family.
        version = 1
        old = db.query(RoleBlueprint).filter(RoleBlueprint.slug == slug, RoleBlueprint.is_current.is_(True)).all()
        for o in old:
            o.is_current = False
            version = max(version, o.version + 1)

        title = graph["role_title"] or job.title
        bp = RoleBlueprint(
            slug=slug,
            title=title,
            version=version,
            review_status="draft",
            is_current=True,
            graph=graph,
            sources={
                **corpus_mod.sources_record(roles, live),
                "validation_errors": errors,
                "judge": judge,
                "drafted_at": datetime.now(timezone.utc).isoformat(),
            },
            embedding=embedder.embed(blueprint_text(title, graph)),
        )
        db.add(bp)
        db.commit()
        db.refresh(bp)
        logger.info("[BLUEPRINT] drafted %s v%d: %d skills, errors=%d, judge=%s", slug, version, len(graph["skills"]), len(errors), judge.get("score"))
        return bp


async def get_or_draft_blueprint(
    db: Session,
    job: JobPosting,
    on_progress: Callable[[str], Awaitable[None]] | None = None,
) -> RoleBlueprint:
    bp = await resolve_blueprint(db, job)
    return bp or await draft_blueprint(db, job, on_progress)
