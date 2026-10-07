"""Parse and validate one row of the UPSC market-roles workbook, and assemble its description.

Pure functions, no database. The importer refuses to write anything if any row fails validation, so a
bad cell is reported with its company, role and column rather than silently stored wrong.

The description is built ONLY from the record's own fields: it adds labels and layout, never facts.
"""
from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

# workbook header -> internal key
HEADERS: dict[str, str] = {
    "Company Name": "company_name",
    "Industry": "industry",
    "Sub-Industry": "sub_industry",
    "Company Type": "company_type",
    "Headquarters": "headquarters",
    "Hiring Locations": "hiring_locations",
    "Website": "website_raw",
    "Department": "department",
    "Job Role": "job_role",
    "Job Description": "job_description",
    "Key Responsibilities": "key_responsibilities",
    "Required Skills": "required_skills",
    "Preferred Skills": "preferred_skills",
    "Transferable UPSC Skills": "transferable_upsc_skills",
    "UPSC Skill Mapping Explanation": "upsc_skill_mapping",
    "Suitable Candidate Category": "suitable_candidate_categories",
    "Candidate Fit Score (0-100)": "candidate_fit_score",
    "Employability Score (0-100)": "employability_score",
    "Hiring Suitability Score (0-100)": "hiring_suitability_score",
    "Entry-Level Salary (INR PA)": "entry_salary_text",
    "Mid-Level Salary (INR PA)": "mid_salary_text",
    "Senior-Level Salary (INR PA)": "senior_salary_text",
    "Career Progression Path": "career_path",
    "Future Growth Potential": "future_growth",
    "Why UPSC Candidates Are Suitable": "why_suitable",
    "Additional Notes": "additional_notes",
}

REQUIRED_NONEMPTY = [
    "company_name", "industry", "job_role", "job_description", "key_responsibilities", "required_skills",
    "hiring_locations", "career_path", "why_suitable",
]
SCORE_KEYS = ["candidate_fit_score", "employability_score", "hiring_suitability_score"]
LEVELS = ["entry", "mid", "senior"]

_SALARY = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*LPA\s*(?:\((.*)\))?\s*$", re.I)
_DOMAIN = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:/[^\s]*)?$", re.I)


def clean(value: Any) -> str:
    """Trim and collapse whitespace; None and dash placeholders become ''."""
    if value is None:
        return ""
    text = re.sub(r"\s+", " ", str(value)).strip()
    return "" if text in {"-", "–", "N/A", "NA", "n/a"} else text


def split_semicolons(text: str) -> list[str]:
    return [p.strip() for p in text.split(";") if p.strip()]


def split_commas_outside_brackets(text: str) -> list[str]:
    """"Delhi NCR, Mumbai (HQ, Fort), Pune" -> three items; commas inside brackets stay."""
    parts, depth, cur = [], 0, []
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            parts.append("".join(cur).strip())
            cur = []
        else:
            cur.append(ch)
    parts.append("".join(cur).strip())
    return [p for p in parts if p]


def split_path(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"→|->", text) if p.strip()]


def parse_salary(text: str) -> tuple[Decimal, Decimal, str | None]:
    """"8–12 LPA" -> (8, 12, None); "3.5–5 LPA (Stipend)" -> (3.5, 5, "Stipend"). Raises ValueError."""
    m = _SALARY.match(text or "")
    if not m:
        raise ValueError(f"not a salary range like '8–12 LPA': {text!r}")
    low, high = Decimal(m.group(1)), Decimal(m.group(2))
    if low > high:
        raise ValueError(f"salary range is reversed: {text!r}")
    return low, high, (m.group(3).strip() or None) if m.group(3) else None


def normalise_website(raw: str) -> str:
    """"deloitte.com/in" -> "https://deloitte.com/in". Raises ValueError for anything that is not a domain."""
    value = (raw or "").strip()
    value = re.sub(r"^https?://", "", value, flags=re.I).rstrip("/")
    if not _DOMAIN.match(value):
        raise ValueError(f"not a website address: {raw!r}")
    host, _, path = value.partition("/")
    return "https://" + host.lower() + (("/" + path) if path else "")


def parse_score(value: Any) -> int:
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"score is not a number: {value!r}")
    if number != int(number) or not 0 <= number <= 100:
        raise ValueError(f"score must be a whole number from 0 to 100: {value!r}")
    return int(number)


def compose_description(r: dict[str, Any]) -> str:
    """The role description a person reads. Uses only fields from the record; adds labels, never facts."""
    lines: list[str] = [r["job_description"], ""]

    about = ", ".join(x for x in [r.get("company_type"), r["industry"] + (f" ({r['sub_industry']})" if r.get("sub_industry") else "")] if x)
    lines.append(f"Company: {r['company_name']} — {about}.")
    if r.get("headquarters"):
        lines.append(f"Headquarters: {r['headquarters']}.")
    if r.get("website_url"):
        lines.append(f"Website: {r['website_url']}")
    if r.get("department"):
        lines.append(f"Department: {r['department']}")
    lines.append(f"Hiring locations: {r['hiring_locations']}")

    def bullets(title: str, items: list[str]) -> None:
        if items:
            lines.extend(["", title, *[f"- {i}" for i in items]])

    # the source writes duties in lower case after each semicolon; capitalise for reading (stored list is unchanged)
    bullets("Key responsibilities", [i[0].upper() + i[1:] if i[:1].islower() else i for i in r["responsibilities_list"]])
    bullets("Required skills", r["required_skills"])
    bullets("Preferred skills", r["preferred_skills"])
    bullets("UPSC preparation that carries over", r["transferable_upsc_skills"])
    if r.get("upsc_skill_mapping"):
        lines.extend(["", r["upsc_skill_mapping"]])
    if r["suitable_candidate_categories"]:
        lines.extend(["", "Candidate profiles this suits: " + "; ".join(r["suitable_candidate_categories"])])

    salary = [(lvl.capitalize() + " level", r.get(f"{lvl}_salary_text")) for lvl in LEVELS if r.get(f"{lvl}_salary_text")]
    if salary:
        lines.extend(["", "Salary benchmarks (INR lakh per annum)", *[f"- {name}: {text}" for name, text in salary]])

    if r["career_path_steps"]:
        lines.extend(["", "Career progression", " → ".join(r["career_path_steps"])])
    if r.get("future_growth"):
        lines.append(f"Growth outlook: {r['future_growth']}")
    if r.get("why_suitable"):
        lines.extend(["", "Why UPSC candidates are suitable", r["why_suitable"]])
    if r.get("additional_notes"):
        lines.extend(["", "Notes", r["additional_notes"]])
    return "\n".join(lines).strip()


def parse_row(raw: dict[str, Any], source: str, source_row: int) -> tuple[dict[str, Any] | None, list[str]]:
    """Returns (record, errors). The record is None if any error was found."""
    r: dict[str, Any] = {key: clean(raw.get(header)) for header, key in HEADERS.items()}
    label = f"row {source_row} ({r['company_name'] or '?'} / {r['job_role'] or '?'})"
    errors: list[str] = []

    for key in REQUIRED_NONEMPTY:
        if not r[key]:
            errors.append(f"{label}: '{key}' is empty")

    r["hiring_locations_list"] = split_commas_outside_brackets(r["hiring_locations"])
    r["responsibilities_list"] = split_semicolons(r["key_responsibilities"])
    for key in ("required_skills", "preferred_skills", "transferable_upsc_skills", "suitable_candidate_categories"):
        r[key] = split_semicolons(r[key])
    r["career_path_steps"] = split_path(r["career_path"])
    if r["career_path"] and len(r["career_path_steps"]) < 2:
        errors.append(f"{label}: career path should have at least two steps: {r['career_path']!r}")

    if r["website_raw"]:
        try:
            r["website_url"] = normalise_website(r["website_raw"])
        except ValueError as exc:
            errors.append(f"{label}: {exc}")
    else:
        r["website_url"] = None

    for key in SCORE_KEYS:
        try:
            r[key] = parse_score(raw.get(next(h for h, k in HEADERS.items() if k == key)))
        except ValueError as exc:
            errors.append(f"{label}: {key}: {exc}")

    notes: dict[str, str] = {}
    for lvl in LEVELS:
        text = r[f"{lvl}_salary_text"]
        try:
            low, high, note = parse_salary(text)
            r[f"{lvl}_salary_min"], r[f"{lvl}_salary_max"] = low, high
            if note:
                notes[lvl] = note
        except ValueError as exc:
            errors.append(f"{label}: {lvl} salary: {exc}")
    r["salary_notes"] = notes
    if not errors:
        e, m, s = (r[f"{lvl}_salary_min"] for lvl in LEVELS)
        if not e <= m <= s:
            errors.append(f"{label}: salary does not rise from entry to senior ({e} / {m} / {s} LPA minimums)")

    if errors:
        return None, errors
    r["source"], r["source_row"] = source, source_row
    r["full_description"] = compose_description(r)
    return r, []
