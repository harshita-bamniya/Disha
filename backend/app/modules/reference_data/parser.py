"""Strict parsers for the research sheets of UPSC_Master_Database_v2.xlsx.

Each parser takes the sheet's rows as `(row_number, values)` (values = the row's cells, column A first) and returns
`(records, errors)`. A sheet whose header row is not exactly what is expected yields an error and no records, so a
changed workbook fails loudly instead of loading shifted columns.
"""
from __future__ import annotations

import re
from typing import Any

from app.modules.market_roles.parser import clean, parse_salary, parse_score, split_semicolons

SKILL_FRAMEWORK = {
    "sheet": "Skill Framework", "header_row": 2,
    "headers": ["Skill Category", "UPSC Activity / Subject", "Skill Developed", "Corporate Translation",
                "Relevant Job Roles", "Skill Depth (1-10)", "Industry Applicability"],
}
SALARY = {
    "sheet": "Salary Benchmarks", "header_row": 2,
    "headers": ["Role Category", "Specific Role", "Entry Level (0–3 yrs)", "Mid Level (3–7 yrs)",
                "Senior Level (7+ yrs)", "Notes"],
}
INDUSTRY = {
    "sheet": "Industry Analysis", "header_row": 2,
    "headers": ["#", "Industry", "Why UPSC Candidates Fit", "Top Suitable Roles", "Hiring Potential",
                "Growth Trajectory", "Primary UPSC Skills Used", "Overall Fit Score"],
}
SEGMENTS = {
    "sheet": "Candidate Segmentation", "header_row": 2,
    "headers": ["Cat#", "Category Name", "Knowledge Depth", "Analytical Ability", "Research Capability",
                "Communication", "Strategic Thinking", "Problem Solving", "Leadership Traits",
                "Professional Maturity", "Employability Strengths", "Employability Limitations",
                "Overall Score (0-100)"],
}
ECOSYSTEM = {
    "sheet": "UPSC Ecosystem & Skills",
    "sections": {
        "A": ["Stage", "Paper / Component", "Subjects & Content Covered", "Marks", "Nature", "Professional Skills Developed"],
        "B": ["Activity", "Frequency", "Duration", "Skill Developed", "Corporate Equivalent"],
        "C": ["Candidate Stage", "Policy Analysis", "Research", "Writing", "Regulatory", "Ethics",
              "Stakeholder Mgmt", "Leadership", "Data Analysis", "Strategic Thinking"],
        "D": ["Optional Subject", "Knowledge / Expertise Developed", "Corporate Roles Suited", "Industries", "Differentiation Value"],
        "E": ["Coaching Organisation", "Location", "Mode", "Specialisation", "Career Opportunities for Aspirants"],
    },
}
_HEALTH = re.compile(r"^\s*(\d{1,2})\s*/\s*10\s*$")
_SECTION = re.compile(r"^SECTION\s+([A-E])\s*[—–-]\s*(.+)$", re.I)


def _cells(values: tuple, n: int) -> list[str]:
    """Columns B.. of a row as cleaned strings (column A is an empty margin)."""
    return [clean(v) for v in list(values)[1:1 + n]]


def _extra(values: tuple, n: int) -> bool:
    return any(clean(v) for v in list(values)[1 + n:])


def _check_header(spec: dict, rows: list[tuple[int, tuple]]) -> list[str]:
    by_no = dict(rows)
    h = by_no.get(spec["header_row"])
    if h is None:
        return [f"{spec['sheet']}: header row {spec['header_row']} not found"]
    got = _cells(h, len(spec["headers"]))
    want = [clean(x) for x in spec["headers"]]
    if got != want:
        return [f"{spec['sheet']}: header row is {got}, expected {want}"]
    return []


def _data_rows(spec: dict, rows: list[tuple[int, tuple]]):
    return [(n, v) for n, v in rows if n > spec["header_row"] and any(clean(c) for c in v)]


def _int(text: str, lo: int, hi: int, what: str) -> int:
    try:
        f = float(text)
    except ValueError:
        raise ValueError(f"{what} is not a number: {text!r}")
    if f != int(f) or not lo <= f <= hi:
        raise ValueError(f"{what} must be a whole number from {lo} to {hi}: {text!r}")
    return int(f)


def _run(spec, rows, source, build):
    errors = _check_header(spec, rows)
    if errors:
        return [], errors
    records, seen = [], {}
    n_cols = len(spec["headers"])
    for no, values in _data_rows(spec, rows):
        try:
            cells = _cells(values, n_cols)
            if _extra(values, n_cols):
                raise ValueError("has data beyond the expected columns")
            rec = build(no, cells, values)
            rec.update(source=source, source_row=no)
            key = rec.pop("_key")
            if key in seen:
                raise ValueError(f"duplicate of row {seen[key]}")
            seen[key] = no
            records.append(rec)
        except ValueError as exc:
            errors.append(f"{spec['sheet']} row {no}: {exc}")
    return (records if not errors else []), errors


def _need(cells: list[str], headers: list[str], skip: set[str] = frozenset()) -> None:
    for c, h in zip(cells, headers):
        if not c and h not in skip:
            raise ValueError(f"'{h}' is empty")


# ── Skill Framework ──────────────────────────────────────────────────────────

def parse_skill_framework(rows, source):
    spec = SKILL_FRAMEWORK

    def build(no, c, _v):
        _need(c, spec["headers"], {"Industry Applicability"})
        return {
            "_key": (c[0].lower(), c[1].lower()),
            "skill_category": c[0], "upsc_activity": c[1],
            "skill_developed": c[2], "skill_developed_list": split_semicolons(c[2]),
            "corporate_translation": c[3], "corporate_translation_list": split_semicolons(c[3]),
            "relevant_job_roles": c[4], "relevant_job_roles_list": split_semicolons(c[4]),
            "skill_depth": _int(c[5], 1, 10, "Skill Depth"),
            "industry_applicability": c[6] or None,
        }
    return _run(spec, rows, source, build)


# ── Salary Benchmarks ────────────────────────────────────────────────────────

def parse_salary_benchmarks(rows, source):
    spec = SALARY

    def build(no, c, _v):
        _need(c, spec["headers"], {"Notes"})
        out: dict[str, Any] = {"_key": (c[0].lower(), c[1].lower()), "role_category": c[0], "specific_role": c[1],
                               "notes": c[5] or None}
        for name, text in (("entry", c[2]), ("mid", c[3]), ("senior", c[4])):
            low, high, note = parse_salary(text)
            if note:
                raise ValueError(f"{name} salary has a qualifier I do not model: {text!r}")
            out[f"{name}_text"], out[f"{name}_min"], out[f"{name}_max"] = text, low, high
        if not (out["entry_min"] <= out["mid_min"] <= out["senior_min"]):
            raise ValueError("salary does not rise from entry to mid to senior")
        return out
    return _run(spec, rows, source, build)


# ── Industry Analysis ────────────────────────────────────────────────────────

def parse_industry_analysis(rows, source):
    spec = INDUSTRY

    def build(no, c, _v):
        _need(c, spec["headers"])
        return {
            "_key": c[1].lower(),
            "rank_no": _int(c[0], 1, 999, "#"), "industry": c[1], "why_upsc_fit": c[2],
            "top_roles": c[3], "top_roles_list": split_semicolons(c[3]),
            "hiring_potential": c[4], "growth_trajectory": c[5],
            "primary_upsc_skills": c[6], "primary_upsc_skills_list": split_semicolons(c[6]),
            "overall_fit_score": parse_score(c[7]),
        }
    return _run(spec, rows, source, build)


# ── Candidate Segmentation ───────────────────────────────────────────────────

def _realign_segment(values: tuple) -> tuple[list[str], bool]:
    """Some source rows (categories 7-9) have 12 cells, not 13: the 'Professional Maturity' cell is absent and
    everything after it moved one column left. Detect that shape exactly and leave maturity empty rather than
    shifting text into the wrong column. Returns (13 cells, maturity_was_absent)."""
    cells = [clean(v) for v in list(values)[1:14]]
    cells += [""] * (13 - len(cells))
    if cells[12] == "" and cells[11] != "" and re.fullmatch(r"\d{1,3}", cells[11]):
        return cells[:9] + [""] + cells[9:12], True
    return cells, False


def parse_candidate_segments(rows, source):
    spec = SEGMENTS
    errors = _check_header(spec, rows)
    if errors:
        return [], errors
    records, seen = [], {}
    for no, values in _data_rows(spec, rows):
        try:
            c, absent = _realign_segment(values)
            if _extra(values, 13):
                raise ValueError("has data beyond the expected columns")
            _need(c, spec["headers"], {"Professional Maturity"} if absent else set())
            n = _int(c[0], 1, 99, "Cat#")
            if n in seen:
                raise ValueError(f"duplicate of row {seen[n]}")
            seen[n] = no
            records.append({
                "source": source, "source_row": no, "category_no": n, "category_name": c[1],
                "knowledge_depth": c[2], "analytical_ability": c[3], "research_capability": c[4],
                "communication": c[5], "strategic_thinking": c[6], "problem_solving": c[7],
                "leadership_traits": c[8], "professional_maturity": c[9] or None,
                "employability_strengths": c[10], "employability_limitations": c[11],
                "overall_score": parse_score(c[12]),
            })
        except ValueError as exc:
            errors.append(f"{spec['sheet']} row {no}: {exc}")
    return (records if not errors else []), errors


def segments_missing_maturity(records) -> list[str]:
    return [f"category {r['category_no']} ({r['category_name']})" for r in records if r["professional_maturity"] is None]


# ── UPSC Ecosystem & Skills ──────────────────────────────────────────────────

def parse_ecosystem(rows, source):
    spec = ECOSYSTEM
    records, errors = [], []
    current, title, headers, pos = None, "", None, 0
    for no, values in rows:
        first = clean(values[1]) if len(values) > 1 else ""
        m = _SECTION.match(first)
        if m:
            current, title, headers, pos = m.group(1).upper(), first, None, 0
            if current not in spec["sections"]:
                errors.append(f"{spec['sheet']} row {no}: unknown section {current}")
                current = None
            continue
        if not any(clean(v) for v in values):
            continue
        if current is None:
            errors.append(f"{spec['sheet']} row {no}: data outside any section")
            continue
        want = spec["sections"][current]
        if headers is None:
            got = _cells(values, len(want))
            if got != [clean(x) for x in want]:
                errors.append(f"{spec['sheet']} section {current}: header row {no} is {got}, expected {want}")
                current = None
                continue
            headers = want
            continue
        try:
            c = _cells(values, len(want))
            if _extra(values, len(want)):
                raise ValueError("has data beyond the expected columns")
            _need(c, want)
            data: dict[str, Any] = dict(zip(want, c))
            if current == "C":
                scores = {}
                for h, v in zip(want[1:], c[1:]):
                    mm = _HEALTH.match(v)
                    if not mm or not 0 <= int(mm.group(1)) <= 10:
                        raise ValueError(f"'{h}' should look like '7/10': {v!r}")
                    scores[h] = int(mm.group(1))
                data["_scores"] = scores
            pos += 1
            records.append({"source": source, "source_row": no, "section": current, "section_title": title,
                            "position": pos, "label": c[0], "data": data})
        except ValueError as exc:
            errors.append(f"{spec['sheet']} section {current} row {no}: {exc}")
    found = {r["section"] for r in records}
    for s in spec["sections"]:
        if s not in found and not errors:
            errors.append(f"{spec['sheet']}: section {s} has no rows")
    return (records if not errors else []), errors


SHEETS = [
    ("Skill Framework", parse_skill_framework, "UpscSkillFramework"),
    ("Salary Benchmarks", parse_salary_benchmarks, "SalaryBenchmark"),
    ("Industry Analysis", parse_industry_analysis, "IndustryAnalysis"),
    ("Candidate Segmentation", parse_candidate_segments, "CandidateSegment"),
    ("UPSC Ecosystem & Skills", parse_ecosystem, "UpscEcosystemEntry"),
]
