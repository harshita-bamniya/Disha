"""Job posting -> JobRequirements, parsed once per posting and cached in the DB.

The employer's structured `required_skills` are treated as authoritative
must-haves: if the model misses one it is added, so the LLM can add nuance
(years, degree, nice-to-haves, knock-outs) but never drop what the employer
explicitly selected.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.resume_match import JobRequirementsRecord
from app.models.user import JobPosting

from .llm import complete_structured
from .schemas import JobRequirements, Requirement

logger = logging.getLogger(__name__)

PARSER_VERSION = "3"

SYSTEM = """You turn a job posting into a structured requirement list for a resume-matching system.
Rules:
- Extract only what the posting states. Do not invent requirements.
- requirements: one entry per distinct requirement. type is one of: hard_skill (tools, languages, methods, \
technical abilities), soft_skill (communication, leadership, stakeholder work), education (a degree), \
certification (a named certificate or professional licence), domain (industry/sector experience), \
eligibility (work authorization, notice period, location, relocation, shift or travel - things a resume cannot prove).
- importance: must_have for words like required, must, minimum, need, essential (and for anything in the \
core skills the employer selected); nice_to_have for preferred, a plus, bonus, good to have. Default must_have.
- When the posting accepts alternatives ("Power BI or Tableau", "either X or Y"), emit ONE requirement named "X or Y", never two separate ones.
- years: years of experience asked for that specific skill, if stated.
- education: min_degree_level is one of none, diploma, bachelor, master, doctorate; fields lists acceptable fields of study.
- knockout: true ONLY for hard filters a recruiter would reject on immediately - a legally/strictly required \
licence or certification, a mandatory degree, mandatory work authorization. Preferences are never knockouts.
- specificity: "specific" for a named tool, software, language, method, qualification, licence or body of knowledge (SQL, Power BI, budgeting, GST law, Indian polity); "generic" for a broad ability or trait that any professional could claim (analytical thinking, problem solving, attention to detail, communication, teamwork, quantitative aptitude, leadership, adaptability). When unsure, choose generic.
- source_line: the short phrase from the posting the requirement came from.
- min_years_experience / max_years_experience: overall experience range; leave null if not stated.
- responsibilities: the main duties of the role, as short phrases (max 8).
- industry: the industry of the employer/role in a word or two, or empty.
- Keep skill names short and canonical (e.g. "SQL", "Power BI", "Stakeholder management")."""


def source_hash(job: JobPosting) -> str:
    payload = json.dumps(
        [job.title, job.description or "", sorted(job.required_skills or []), job.sector or "", PARSER_VERSION],
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _prompt(job: JobPosting) -> str:
    skills = ", ".join(job.required_skills or []) or "(none selected)"
    return (
        f"TITLE: {job.title}\nSECTOR: {job.sector or ''}\n"
        f"CORE SKILLS SELECTED BY THE EMPLOYER: {skills}\n\nDESCRIPTION:\n{(job.description or '')[:8000]}"
    )


def merge_alternatives(parsed: JobRequirements) -> JobRequirements:
    """Fold "X" and "Y" back into one "X or Y" requirement when the posting said "X or Y".

    The model sometimes splits an either/or into two must-haves, which would wrongly demand both.
    """
    reqs = list(parsed.requirements)
    drop: set[int] = set()
    for i, a in enumerate(reqs):
        if i in drop or a.type != "hard_skill":
            continue
        for j, b in enumerate(reqs):
            if j <= i or j in drop or b.type != "hard_skill" or a.importance != b.importance:
                continue
            line = f"{a.source_line} {b.source_line}"
            pair = rf"{re.escape(a.name)}\s*(?:,|/)?\s*or\s+{re.escape(b.name)}|{re.escape(b.name)}\s*(?:,|/)?\s*or\s+{re.escape(a.name)}"
            if re.search(pair, line, re.I):
                reqs[i] = a.model_copy(update={"name": f"{a.name} or {b.name}"})
                drop.add(j)
                break
    parsed.requirements = [r for k, r in enumerate(reqs) if k not in drop]
    return parsed


def merge_employer_skills(parsed: JobRequirements, employer_skills: list[str]) -> JobRequirements:
    """Guarantee every employer-selected skill is present as a must-have hard skill."""
    have = {r.name.strip().lower() for r in parsed.requirements}
    for skill in employer_skills or []:
        if skill.strip().lower() in have:
            continue
        parsed.requirements.append(Requirement(name=skill.strip(), type="hard_skill", importance="must_have",
                                               source_line="Selected by the employer"))
    for r in parsed.requirements:
        if r.name.strip().lower() in {s.strip().lower() for s in employer_skills or []} and r.type == "hard_skill":
            r.importance = "must_have"
    return parsed


async def get_or_parse_requirements(db: Session, job: JobPosting) -> JobRequirements:
    """Cached structured requirements for a posting; re-parsed only if its content changed."""
    digest = source_hash(job)
    record = db.query(JobRequirementsRecord).filter(JobRequirementsRecord.job_id == job.id).first()
    if record and record.source_hash == digest:
        return JobRequirements.model_validate(record.data)

    parsed = await complete_structured(SYSTEM, _prompt(job), JobRequirements, max_tokens=4000)
    parsed = merge_alternatives(parsed)
    parsed = merge_employer_skills(parsed, job.required_skills or [])
    if not parsed.title:
        parsed.title = job.title

    data = parsed.model_dump()
    model = get_settings().gemini_model
    if record:
        record.source_hash, record.parser_version, record.model, record.data = digest, PARSER_VERSION, model, data
    else:
        db.add(JobRequirementsRecord(job_id=job.id, source_hash=digest, parser_version=PARSER_VERSION,
                                     model=model, data=data))
    db.commit()
    return parsed
