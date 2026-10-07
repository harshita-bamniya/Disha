"""Strict parsers for the research sheets (fake rows; the real workbook is checked by the importer's --verify)."""
import os

import pytest

from app.modules.reference_data import parser as P

SRC = "test"


def rows(header_row, data, header_no=2, pad=1):
    """Build `(row_no, values)` with an empty margin column A, like the workbook."""
    out = [(1, (None, "TITLE"))]
    out.append((header_no, (None, *header_row)))
    for i, d in enumerate(data, header_no + 1):
        out.append((i, (None, *d)))
    return out


def test_skill_framework_ok_and_lists():
    r = rows(P.SKILL_FRAMEWORK["headers"], [["HARD SKILL", "GS-II", "Law; Governance", "Regulatory Affairs; Legal Research", "Analyst; Manager", "9", "All"]])
    recs, errs = P.parse_skill_framework(r, SRC)
    assert errs == [] and recs[0]["skill_depth"] == 9
    assert recs[0]["skill_developed_list"] == ["Law", "Governance"] and recs[0]["industry_applicability"] == "All"


@pytest.mark.parametrize("depth", ["0", "11", "x", "4.5"])
def test_skill_depth_out_of_range_is_rejected(depth):
    r = rows(P.SKILL_FRAMEWORK["headers"], [["HARD", "a", "b", "c", "d", depth, ""]])
    recs, errs = P.parse_skill_framework(r, SRC)
    assert recs == [] and "Skill Depth" in errs[0]


def test_changed_header_fails_loudly_with_no_records():
    bad = list(P.SKILL_FRAMEWORK["headers"])
    bad[2] = "Something Else"
    recs, errs = P.parse_skill_framework(rows(bad, [["a"] * 7]), SRC)
    assert recs == [] and "header row" in errs[0]


def test_duplicate_key_rejected():
    row = ["HARD", "same", "b", "c", "d", "5", ""]
    recs, errs = P.parse_skill_framework(rows(P.SKILL_FRAMEWORK["headers"], [row, row]), SRC)
    assert recs == [] and "duplicate" in errs[0]


def test_extra_cells_beyond_columns_rejected():
    r = rows(P.SKILL_FRAMEWORK["headers"], [["HARD", "a", "b", "c", "d", "5", "e", "STRAY"]])
    recs, errs = P.parse_skill_framework(r, SRC)
    assert recs == [] and "beyond" in errs[0]


def test_salary_ranges_parse_and_must_rise():
    h = P.SALARY["headers"]
    ok = rows(h, [["Consulting", "Analyst", "8–13 LPA", "16–28 LPA", "32–60 LPA", "note"]])
    recs, errs = P.parse_salary_benchmarks(ok, SRC)
    assert errs == [] and (recs[0]["entry_min"], recs[0]["senior_max"]) == (8, 60)
    bad = rows(h, [["Consulting", "Analyst", "16–28 LPA", "8–13 LPA", "32–60 LPA", ""]])
    assert "does not rise" in P.parse_salary_benchmarks(bad, SRC)[1][0]
    junk = rows(h, [["Consulting", "Analyst", "good money", "8–13 LPA", "32–60 LPA", ""]])
    assert "LPA" in P.parse_salary_benchmarks(junk, SRC)[1][0]


def test_decimal_salary_floor():
    h = P.SALARY["headers"]
    recs, errs = P.parse_salary_benchmarks(rows(h, [["State", "Analyst", "3–5.5 LPA", "5.5–9 LPA", "10–16 LPA", ""]]), SRC)
    assert errs == [] and float(recs[0]["entry_max"]) == 5.5


def test_industry_score_bounds():
    h = P.INDUSTRY["headers"]
    good = ["1", "Consulting", "why", "A; B", "High", "growth", "Policy; Research", "92"]
    assert P.parse_industry_analysis(rows(h, [good]), SRC)[0][0]["top_roles_list"] == ["A", "B"]
    bad = good[:-1] + ["120"]
    assert P.parse_industry_analysis(rows(h, [bad]), SRC)[0] == []


SEG = ["Name", "kd", "aa", "rc", "co", "st", "ps", "lt", "pm", "str", "lim", "80"]


def test_segment_full_row():
    h = P.SEGMENTS["headers"]
    recs, errs = P.parse_candidate_segments(rows(h, [["1", *SEG]]), SRC)
    assert errs == [] and recs[0]["professional_maturity"] == "pm" and recs[0]["overall_score"] == 80


def test_segment_row_missing_maturity_cell_is_realigned_not_shifted():
    h = P.SEGMENTS["headers"]
    short = ["7", *SEG[:8], *SEG[9:]]                 # the 'pm' cell is simply absent: 12 cells
    recs, errs = P.parse_candidate_segments(rows(h, [short]), SRC)
    assert errs == []
    r = recs[0]
    assert r["professional_maturity"] is None and r["employability_strengths"] == "str"
    assert r["employability_limitations"] == "lim" and r["overall_score"] == 80
    assert P.segments_missing_maturity(recs) == ["category 7 (Name)"]


def test_segment_missing_other_cell_is_an_error():
    h = P.SEGMENTS["headers"]
    broken = ["1", *SEG]
    broken[3] = ""                                    # analytical ability empty
    assert P.parse_candidate_segments(rows(h, [broken]), SRC)[0] == []


def _eco(*blocks):
    out, n = [], 0
    for letter, title in blocks:
        n += 1
        out.append((n, (None, f"SECTION {letter} — {title}")))
        n += 1
        out.append((n, (None, *P.ECOSYSTEM["sections"][letter])))
    return out, n


def test_ecosystem_sections_and_skill_scores():
    out, n = [], 0
    for letter in "ABCDE":
        n += 1
        out.append((n, (None, f"SECTION {letter} — T")))
        n += 1
        out.append((n, (None, *P.ECOSYSTEM["sections"][letter])))
        n += 1
        width = len(P.ECOSYSTEM["sections"][letter])
        vals = ["x"] + (["7/10"] * (width - 1) if letter == "C" else ["y"] * (width - 1))
        out.append((n, (None, *vals)))
        n += 1
        out.append((n, (None,)))
    recs, errs = P.parse_ecosystem(out, SRC)
    assert errs == [] and {r["section"] for r in recs} == set("ABCDE")
    c = next(r for r in recs if r["section"] == "C")
    assert c["data"]["_scores"]["Research"] == 7


def test_ecosystem_bad_score_rejected_and_missing_section_reported():
    out, n = _eco(("C", "T"))
    out.append((n + 1, (None, "Aspirant", *["7/10"] * 8, "11/10")))
    recs, errs = P.parse_ecosystem(out, SRC)
    assert recs == [] and any("7/10" in e for e in errs)


@pytest.mark.skipif(not os.path.exists(r"C:\Users\dell\Downloads\UPSC_Master_Database_v2.xlsx"), reason="workbook not on this machine")
def test_real_workbook_row_counts():
    from app.scripts.import_reference_sheets import SOURCE, read_sheets
    parsed = {}
    sheets = read_sheets(r"C:\Users\dell\Downloads\UPSC_Master_Database_v2.xlsx")
    for name, parser, model in P.SHEETS:
        recs, errs = parser(sheets[name], SOURCE)
        assert errs == [], errs
        parsed[model] = len(recs)
    assert parsed == {"UpscSkillFramework": 35, "SalaryBenchmark": 29, "IndustryAnalysis": 20,
                      "CandidateSegment": 9, "UpscEcosystemEntry": 59}
