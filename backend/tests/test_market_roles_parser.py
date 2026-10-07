"""Market-roles parser: strict parsing, loud validation, and a description made only of the record's own fields."""
from decimal import Decimal

import pytest

from app.modules.market_roles import parser as p

GOOD = {
    "Company Name": "Acme Policy Labs", "Industry": "Consulting", "Sub-Industry": "Policy Consulting",
    "Company Type": "Indian Startup", "Headquarters": "Delhi", "Hiring Locations": "Delhi NCR, Mumbai, Pan-India (12 offices)",
    "Website": "deloitte.com/in", "Department": "Public Sector Practice", "Job Role": "Research Analyst",
    "Job Description": "Support client work through policy research.",
    "Key Responsibilities": "Policy mapping; stakeholder interviews; report drafting",
    "Required Skills": "Policy Analysis; Report Writing", "Preferred Skills": "Excel; R or Python basics, Tableau",
    "Transferable UPSC Skills": "Current Affairs Synthesis; Governance Research",
    "UPSC Skill Mapping Explanation": "Answer writing maps to structured reports.",
    "Suitable Candidate Category": "Cleared Mains; Reached Interview",
    "Candidate Fit Score (0-100)": 82, "Employability Score (0-100)": 80.0, "Hiring Suitability Score (0-100)": "78",
    "Entry-Level Salary (INR PA)": "8–12 LPA", "Mid-Level Salary (INR PA)": "15–25 LPA", "Senior-Level Salary (INR PA)": "30–50 LPA",
    "Career Progression Path": "Analyst → Consultant → Manager", "Future Growth Potential": "High – growing demand",
    "Why UPSC Candidates Are Suitable": "They understand governance deeply.", "Additional Notes": "Lateral entry possible.",
}


def row(**over):
    return {**GOOD, **over}


def test_a_good_row_parses_every_field():
    rec, errs = p.parse_row(GOOD, "src", 3)
    assert errs == [] and rec["source_row"] == 3
    assert rec["responsibilities_list"] == ["Policy mapping", "stakeholder interviews", "report drafting"]
    assert rec["required_skills"] == ["Policy Analysis", "Report Writing"]
    assert rec["preferred_skills"] == ["Excel", "R or Python basics, Tableau"]        # a comma inside an item stays
    assert rec["hiring_locations_list"] == ["Delhi NCR", "Mumbai", "Pan-India (12 offices)"]
    assert rec["career_path_steps"] == ["Analyst", "Consultant", "Manager"]
    assert (rec["candidate_fit_score"], rec["employability_score"], rec["hiring_suitability_score"]) == (82, 80, 78)
    assert (rec["entry_salary_min"], rec["entry_salary_max"]) == (Decimal("8"), Decimal("12"))
    assert rec["website_url"] == "https://deloitte.com/in"


def test_salary_notes_in_brackets_are_kept_not_lost():
    assert p.parse_salary("3.5–5 LPA (Stipend)") == (Decimal("3.5"), Decimal("5"), "Stipend")
    rec, errs = p.parse_row(row(**{"Entry-Level Salary (INR PA)": "3.5–5 LPA (Stipend)",
                                   "Mid-Level Salary (INR PA)": "8–14 LPA (Post-fellowship)"}), "s", 3)
    assert errs == [] and rec["salary_notes"] == {"entry": "Stipend", "mid": "Post-fellowship"}
    assert rec["entry_salary_text"] == "3.5–5 LPA (Stipend)"                      # original text preserved


@pytest.mark.parametrize("bad", ["", "10 LPA", "12–8 LPA", "8–12", "eight–12 LPA"])
def test_unparseable_or_reversed_salaries_are_rejected(bad):
    with pytest.raises(ValueError):
        p.parse_salary(bad)


def test_salary_must_rise_with_seniority():
    _, errs = p.parse_row(row(**{"Entry-Level Salary (INR PA)": "20–25 LPA"}), "s", 9)
    assert any("does not rise" in e for e in errs)


@pytest.mark.parametrize("site,expected", [
    ("mckinsey.com", "https://mckinsey.com"), ("https://www.Pwc.in/", "https://www.pwc.in"),
    ("unicef.org/india", "https://unicef.org/india"),
])
def test_websites_become_https_urls(site, expected):
    assert p.normalise_website(site) == expected


@pytest.mark.parametrize("site", ["not a site", "localhost", "http://", ""])
def test_bad_websites_are_rejected(site):
    with pytest.raises(ValueError):
        p.normalise_website(site)


@pytest.mark.parametrize("value", [101, -1, 72.5, "abc", None])
def test_scores_must_be_whole_numbers_0_to_100(value):
    with pytest.raises(ValueError):
        p.parse_score(value)


def test_empty_required_fields_are_reported_with_row_company_and_column():
    _, errs = p.parse_row(row(**{"Key Responsibilities": "", "Industry": " "}), "s", 12)
    text = " ".join(errs)
    assert "row 12" in text and "Acme Policy Labs" in text and "'key_responsibilities' is empty" in text and "'industry' is empty" in text


def test_a_bad_row_yields_no_record():
    rec, errs = p.parse_row(row(Website="???"), "s", 4)
    assert rec is None and errs


def test_commas_inside_brackets_do_not_split_locations():
    assert p.split_commas_outside_brackets("Delhi, Mumbai (HQ, Fort), Pune") == ["Delhi", "Mumbai (HQ, Fort)", "Pune"]


def test_description_uses_only_fields_from_the_record():
    rec, _ = p.parse_row(GOOD, "s", 3)
    d = rec["full_description"]
    for fact in ["Support client work through policy research.", "Acme Policy Labs", "Indian Startup", "Delhi",
                 "https://deloitte.com/in", "Public Sector Practice", "Pan-India (12 offices)", "Policy mapping",
                 "Policy Analysis", "Tableau", "Governance Research", "Answer writing maps to structured reports.",
                 "Cleared Mains; Reached Interview", "8–12 LPA", "15–25 LPA", "30–50 LPA",
                 "Analyst → Consultant → Manager", "High – growing demand", "They understand governance deeply.",
                 "Lateral entry possible."]:
        assert fact in d, fact
    assert "vacanc" not in d.lower() and "apply" not in d.lower()          # it is a role description, not a job ad


def test_description_is_deterministic_and_skips_empty_optional_fields():
    a = p.parse_row(row(**{"Preferred Skills": "", "Additional Notes": "", "Department": ""}), "s", 3)[0]
    b = p.parse_row(row(**{"Preferred Skills": "", "Additional Notes": "", "Department": ""}), "s", 3)[0]
    assert a["full_description"] == b["full_description"]
    assert "Preferred skills" not in a["full_description"] and "Notes" not in a["full_description"] and "Department:" not in a["full_description"]
