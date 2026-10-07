"""Data contracts for resume-vs-job match scoring.

Two structured documents drive everything: a CandidateProfile parsed from the
resume and a JobRequirements list parsed from the employer's posting. The LLM
only fills these structures; every score is then computed by plain code.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ReqType = Literal["hard_skill", "soft_skill", "education", "certification", "domain", "eligibility"]
Importance = Literal["must_have", "nice_to_have"]
Verdict = Literal["met", "partial", "missing"]
FixType = Literal["reword", "add_evidence", "real_gap", "confirm"]

# Ordinal degree levels shared by the JD parser, profile parser and scorer.
DEGREE_LEVELS = {"none": 0, "diploma": 1, "bachelor": 2, "master": 3, "doctorate": 4}


# ── Candidate profile (parsed from the resume) ───────────────────────────────

class ProfileRole(BaseModel):
    title: str = ""
    company: str = ""
    start: str | None = None   # "YYYY-MM" or "YYYY"
    end: str | None = None     # "YYYY-MM", "YYYY" or "present"
    bullets: list[str] = Field(default_factory=list)


class ProfileProject(BaseModel):
    name: str = ""
    bullets: list[str] = Field(default_factory=list)


class ProfileSkill(BaseModel):
    name: str
    category: Literal["hard", "soft"] = "hard"
    # Bullets (verbatim from the resume) that prove the skill. Empty = listed only.
    evidence: list[str] = Field(default_factory=list)
    last_used_year: int | None = None


class ProfileEducation(BaseModel):
    degree_level: Literal["none", "diploma", "bachelor", "master", "doctorate"] = "none"
    field: str = ""
    year: int | None = None


class CandidateProfile(BaseModel):
    roles: list[ProfileRole] = Field(default_factory=list)
    projects: list[ProfileProject] = Field(default_factory=list)
    skills: list[ProfileSkill] = Field(default_factory=list)
    education: list[ProfileEducation] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    industries: list[str] = Field(default_factory=list)


# ── Job requirements (parsed from the posting) ───────────────────────────────

class Requirement(BaseModel):
    name: str
    type: ReqType
    importance: Importance = "must_have"
    years: float | None = None          # years asked for this specific skill, if stated
    min_degree_level: str | None = None  # education only: a DEGREE_LEVELS key
    fields: list[str] = Field(default_factory=list)  # education only: acceptable fields
    knockout: bool = False              # a recruiter filter: legally / strictly required
    # generic = a broad ability any professional could claim (analytical thinking, problem solving,
    # communication); specific = a named tool, method, qualification or body of knowledge.
    specificity: Literal["specific", "generic"] = "specific"
    source_line: str = ""


class JobRequirements(BaseModel):
    title: str = ""
    seniority: str = ""
    industry: str = ""
    min_years_experience: float | None = None
    max_years_experience: float | None = None
    responsibilities: list[str] = Field(default_factory=list)
    requirements: list[Requirement] = Field(default_factory=list)


# ── ATS readability signals (measured at extraction time) ────────────────────

class AtsSignals(BaseModel):
    text_extractable: bool = True
    char_count: int = 0
    sections_found: list[str] = Field(default_factory=list)  # standard headings detected
    has_contact_info: bool = True
    dates_consistent: bool = True
    table_count: int = 0
    image_count: int = 0
    multi_column: bool = False


# ── Scoring output ───────────────────────────────────────────────────────────

class AtsCheck(BaseModel):
    key: str
    label: str
    passed: bool
    detail: str = ""


class QualityCheck(BaseModel):
    key: str
    label: str
    score: float                  # 0..1
    detail: str = ""
    examples: list[str] = Field(default_factory=list)   # the lines / skills that failed the check


class ResumeQuality(BaseModel):
    """How well the resume is written, independent of the job."""
    score: int
    label: Literal["Strong", "Decent", "Needs work"]
    checks: list[QualityCheck]


class RequirementResult(BaseModel):
    requirement: Requirement
    credit: float                        # 0, 0.4, 0.7 or 1.0 (education/exp may be fractional)
    verdict: Verdict
    method: Literal["exact", "embedding", "llm", "none", "rule"] = "none"
    evidence: str = ""                   # resume line used as proof
    reason: str = ""
    generic_capped: bool = False         # a broad skill shown without a measurable result: credit held at 0.7


class Fix(BaseModel):
    requirement: str
    type: FixType
    points_gained: float
    action: str


class SubScore(BaseModel):
    key: str
    label: str
    score: float | None      # 0..1, None = no items in this group (weight redistributed)
    weight: float            # nominal weight
    effective_weight: float  # after redistribution


class MatchReport(BaseModel):
    score: int
    band: Literal["Strong", "Good", "Fair", "Low"]
    band_message: str
    must_haves_met: int
    must_haves_total: int
    # Must-haves with only equivalent / weak evidence (credit above 0 but below full)
    must_haves_partial: int = 0
    capped: bool = False
    cap_reasons: list[str] = Field(default_factory=list)
    sub_scores: list[SubScore]
    requirements: list[RequirementResult]
    fixes: list[Fix]
    to_confirm: list[str] = Field(default_factory=list)   # eligibility items a resume can't prove
    ats_notes: list[str] = Field(default_factory=list)
    ats_checks: list[AtsCheck] = Field(default_factory=list)
    # True when the posting lists too few concrete requirements for the score to be precise.
    low_signal: bool = False
    quality: ResumeQuality | None = None
    scoring_version: str


# ── API models ───────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    job_id: str
    resume_id: str | None = None        # Resume Builder resume
    resume_file_id: str | None = None   # file in the candidate's resume library


class RequirementChange(BaseModel):
    requirement: str
    before: float
    after: float


class ScanOut(BaseModel):
    id: str
    job_id: str
    job_title: str = ""
    resume_source: str
    resume_label: str | None = None
    created_at: str
    cached: bool = False                # true = identical resume+job as last scan, nothing recomputed
    previous_score: int | None = None
    score_delta: int | None = None
    changes: list[RequirementChange] = Field(default_factory=list)
    roadmap: "RoadmapLink | None" = None
    report: MatchReport


class ScanSummary(BaseModel):
    id: str
    resume_source: str
    resume_label: str | None = None
    score: int
    band: str
    must_haves_met: int
    must_haves_total: int
    score_delta: int | None = None
    created_at: str


class QuotaOut(BaseModel):
    limit: int
    used: int
    remaining: int


class RewriteRequest(BaseModel):
    requirement: str


class AnswerRequest(BaseModel):
    requirement: str
    answer: str = Field(min_length=1, max_length=2000)


class RewriteOut(BaseModel):
    requirement: str
    # rewrite: reworded from an existing bullet | from_answer: written from the user's own answer
    # needs_input: we need the user to tell us where they used it | not_applicable: nothing to write
    kind: Literal["rewrite", "from_answer", "needs_input", "not_applicable"]
    original: str | None = None
    suggestion: str | None = None
    relationship: str | None = None       # same | same_family | comparable
    role: str | None = None               # "Title, Company" the new bullet belongs under
    missing_detail: str | None = None     # what the user could add to strengthen it (a number, a result)
    question: str | None = None
    warnings: list[str] = Field(default_factory=list)


class RoadmapLink(BaseModel):
    job_id: str
    plan_status: Literal["none", "generating", "ready", "failed"]
    progress_pct: int = 0
    covered: list[str] = Field(default_factory=list)       # gap skills already in the job's roadmap
    not_covered: list[str] = Field(default_factory=list)   # gap skills the roadmap doesn't cover


ScanOut.model_rebuild()
