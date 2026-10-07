"""Unit tests for the deterministic resume-vs-job scoring core (no DB, no LLM)."""
from datetime import date

from app.modules.resume_match.schemas import (
    AtsSignals, CandidateProfile, JobRequirements, ProfileRole, Requirement, RequirementResult,
)
from app.modules.resume_match.scoring import (
    ats_score, band_for, build_report, experience_score, total_years_experience,
)

TODAY = date(2026, 9, 30)
GOOD_ATS = AtsSignals(char_count=3000, sections_found=["experience", "education", "skills"])


def req(name, typ="hard_skill", imp="must_have", **kw):
    return Requirement(name=name, type=typ, importance=imp, **kw)


def res(r, credit, method="exact", evidence="x"):
    return RequirementResult(requirement=r, credit=credit, verdict="met", method=method, evidence=evidence)


def report(results, job=None, profile=None, ats=GOOD_ATS, role=0.8, industry=None):
    return build_report(job or JobRequirements(), profile or CandidateProfile(), results, ats, role, industry, TODAY)


def test_bands_boundaries():
    assert band_for(80)[0] == "Strong" and band_for(79)[0] == "Good"
    assert band_for(65)[0] == "Good" and band_for(64)[0] == "Fair"
    assert band_for(45)[0] == "Fair" and band_for(44)[0] == "Low"


def test_years_merge_overlapping_roles():
    p = CandidateProfile(roles=[
        ProfileRole(start="2020-01", end="2022-01"),
        ProfileRole(start="2021-01", end="2023-01"),   # overlaps the first by a year
        ProfileRole(start="2024-01", end="2025-01"),
    ])
    assert total_years_experience(p, TODAY) == 4.0  # 2020-01..2023-01 + 2024-01..2025-01


def test_present_role_and_bad_dates():
    p = CandidateProfile(roles=[ProfileRole(start="2024-09", end="present"), ProfileRole(start="oops", end="2020")])
    assert total_years_experience(p, TODAY) == 2.0


def test_experience_score_caps_and_overqualified_penalty():
    job = JobRequirements(min_years_experience=4, max_years_experience=5)
    assert experience_score(2, job) == 0.5
    assert experience_score(6, job) == 1.0
    assert experience_score(11, job) == 0.9
    assert experience_score(3, JobRequirements()) is None


def test_ats_unreadable_is_zero_with_note():
    score, notes = ats_score(AtsSignals(text_extractable=False))
    assert score == 0.0 and notes


def test_ats_penalises_tables_and_columns():
    clean, _ = ats_score(GOOD_ATS)
    bad, notes = ats_score(GOOD_ATS.model_copy(update={"table_count": 2, "multi_column": True}))
    assert clean == 1.0 and bad < clean and len(notes) == 2


def test_perfect_match_is_strong_with_no_fixes():
    r1, r2 = req("Python"), req("SQL")
    rep = report([res(r1, 1.0), res(r2, 1.0)])
    assert rep.score >= 80 and rep.band == "Strong"
    assert rep.fixes == [] and rep.must_haves_met == 2 == rep.must_haves_total


def test_missing_must_have_lowers_score_and_ranks_fix():
    py, sql = req("Python"), req("SQL")
    rep = report([res(py, 1.0), res(sql, 0.0, method="none", evidence="")])
    assert rep.must_haves_met == 1 and rep.must_haves_total == 2
    assert rep.fixes[0].requirement == "SQL" and rep.fixes[0].type == "real_gap"
    assert rep.fixes[0].points_gained > 0


def test_partial_credit_is_counted_separately_from_met():
    rep = report([res(req('Python'), 1.0), res(req('SQL'), 0.7, method='embedding'), res(req('Go'), 0.4), res(req('Rust'), 0.0)])
    assert (rep.must_haves_met, rep.must_haves_partial, rep.must_haves_total) == (1, 2, 4)


def test_listed_only_skill_gets_add_evidence_fix():
    py = req("Python")
    rep = report([res(py, 0.4, evidence="")])
    assert rep.fixes[0].type == "add_evidence"


def test_related_skill_gets_reword_fix():
    tab = req("Tableau")
    rep = report([res(tab, 0.7, method="embedding", evidence="Looker dashboards")])
    assert rep.fixes[0].type == "reword"


def test_knockout_caps_at_40_and_fix_recovers_points():
    lic = req("Nursing licence", "certification", knockout=True)
    py = req("Python")
    rep = report([res(py, 1.0), res(lic, 0.0, method="none", evidence="")])
    assert rep.score == 40 and rep.capped and rep.cap_reasons
    assert rep.fixes[0].requirement == "Nursing licence"
    assert rep.fixes[0].points_gained >= 40  # removing the cap is the biggest win


def test_experience_under_half_minimum_caps():
    job = JobRequirements(min_years_experience=6)
    p = CandidateProfile(roles=[ProfileRole(start="2024-01", end="2026-01")])  # 2 years
    rep = report([res(req("Python"), 1.0)], job=job, profile=p)
    assert rep.score <= 40 and any("6+" in r for r in rep.cap_reasons)


def test_empty_groups_redistribute_weight():
    rep = report([res(req("Python"), 1.0)], role=None)
    eff = {s.key: s.effective_weight for s in rep.sub_scores}
    assert eff["soft_skills"] == 0 and eff["nice_to_have_skills"] == 0
    assert abs(sum(eff.values()) - 1.0) < 0.01


def test_eligibility_is_confirm_only_and_not_scored():
    wa = req("Valid work authorization", "eligibility", knockout=True)
    rep = report([res(req("Python"), 1.0), res(wa, 0.0, method="none")])
    assert rep.to_confirm == ["Valid work authorization"]
    assert not rep.capped and rep.must_haves_total == 1


def test_deterministic():
    rs = [res(req("Python"), 0.7), res(req("SQL"), 0.4)]
    assert report(rs).model_dump() == report(rs).model_dump()


def test_generic_requirements_count_half_within_their_group():
    # one specific skill met, one generic skill missing vs the reverse: the specific one matters more
    spec_met = report([res(req("SQL"), 1.0), res(Requirement(name="Problem solving", type="hard_skill", specificity="generic"), 0.0)])
    gen_met = report([res(req("SQL"), 0.0), res(Requirement(name="Problem solving", type="hard_skill", specificity="generic"), 1.0)])
    assert spec_met.score > gen_met.score


def test_capped_generic_gets_a_measurable_result_fix():
    r = Requirement(name="Analytical thinking", type="soft_skill", specificity="generic")
    rr = RequirementResult(requirement=r, credit=0.7, verdict="met", method="llm", evidence="Analysed inventory data",
                           generic_capped=True)
    rep = report([rr])
    assert rep.fixes and rep.fixes[0].type == "add_evidence" and "number" in rep.fixes[0].action
