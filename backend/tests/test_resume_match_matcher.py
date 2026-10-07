"""Matcher tests with a fake embedder and judge (no model download, no network)."""
import asyncio
import hashlib
import re
from datetime import date

from app.modules.resume_match.extraction import signals_from_text
from app.modules.resume_match.engine import analyze
from app.modules.resume_match.matcher import JudgeVerdict, canon, match_requirements
from app.modules.resume_match.profile_parser import verify_profile
from app.modules.resume_match.redact import redact_resume_text
from app.modules.resume_match.schemas import (
    CandidateProfile, JobRequirements, ProfileEducation, ProfileRole, ProfileSkill, Requirement,
)

TODAY = date(2026, 9, 30)

# Tiny concept space so related words land close together without a real model.
_CONCEPTS = {"sql": 0, "postgresql": 0, "mysql": 0, "tableau": 1, "looker": 1, "python": 2, "leadership": 3,
             "led": 3, "team": 3}


def fake_embed(texts):
    out = []
    for t in texts:
        v = [0.0] * 72
        hit = False
        for w in re.findall(r"[a-z]+", t.lower()):
            if w in _CONCEPTS:
                v[_CONCEPTS[w]] += 1.0
                hit = True
        if not hit:  # unrelated text gets its own orthogonal-ish direction
            v[8 + int(hashlib.md5(t.encode()).hexdigest(), 16) % 64] = 1.0
        out.append(v)
    return out


async def no_judge(items):
    return []


def run(coro):
    return asyncio.run(coro)


def profile():
    return CandidateProfile(
        roles=[ProfileRole(title="Data Analyst", company="Acme", start="2023-01", end="present",
                           bullets=["Built Python ETL pipelines loading PostgreSQL", "Led a team of 4 analysts"])],
        skills=[
            ProfileSkill(name="Python", evidence=["Built Python ETL pipelines loading PostgreSQL"], last_used_year=2026),
            ProfileSkill(name="PostgreSQL", evidence=["Built Python ETL pipelines loading PostgreSQL"], last_used_year=2026),
            ProfileSkill(name="Excel"),
            ProfileSkill(name="Java", evidence=["Wrote Java services"], last_used_year=2015),
        ],
        education=[ProfileEducation(degree_level="bachelor", field="Computer Science")],
        certifications=["AWS Certified Cloud Practitioner"],
    )


def match(reqs, judge=no_judge, prof=None):
    job = JobRequirements(requirements=reqs)
    return run(match_requirements(job, prof or profile(), fake_embed, judge, TODAY))


def test_alias_canonicalisation():
    assert canon("JS") == canon("JavaScript") == "javascript"
    assert canon("Postgres") == "postgresql"


def test_exact_with_recent_evidence_full_credit():
    r = match([Requirement(name="Python", type="hard_skill")])[0]
    assert r.credit == 1.0 and r.method == "exact" and "Python ETL" in r.evidence


def test_listed_only_and_stale_get_partial_credit():
    excel, java = match([Requirement(name="Excel", type="hard_skill"), Requirement(name="Java", type="hard_skill")])
    assert excel.credit == 0.4 and "not shown" in excel.reason
    assert java.credit == 0.4 and "5 years" in java.reason


def test_skill_found_in_bullet_even_if_not_listed():
    r = match([Requirement(name="ETL", type="hard_skill")])[0]
    assert r.credit == 1.0 and r.method == "exact"


def test_equivalent_skill_via_embedding():
    r = match([Requirement(name="SQL", type="hard_skill")])[0]
    assert r.credit == 0.7 and r.method == "embedding" and "PostgreSQL" in r.reason


def test_unrelated_requirement_is_missing_without_calling_judge():
    calls = []

    async def judge(items):
        calls.append(items)
        return []
    r = match([Requirement(name="Kubernetes", type="hard_skill")], judge)[0]
    assert r.credit == 0.0 and r.method == "none" and calls == []


def test_judge_met_requires_verifiable_quote():
    # "Tableau" ~ "Looker" (same concept) but not listed -> goes to the judge via bullet similarity
    prof = profile()
    prof.roles[0].bullets.append("Built Looker dashboards for finance")

    async def honest(items):
        return [JudgeVerdict(index=items[0].index, verdict="partial", quote="Built Looker dashboards for finance",
                             reason="Looker is comparable to Tableau")]

    async def liar(items):
        return [JudgeVerdict(index=items[0].index, verdict="met", quote="Ran Tableau at scale", reason="x")]
    ok = match([Requirement(name="Tableau", type="hard_skill")], honest, prof)[0]
    bad = match([Requirement(name="Tableau", type="hard_skill")], liar, prof)[0]
    assert ok.credit == 0.7 and ok.method == "llm"
    assert bad.credit == 0.4  # fabricated quote is downgraded


def test_judge_failure_fails_the_scan_instead_of_scoring_zero():
    import pytest
    prof = profile()
    prof.roles[0].bullets.append("Built Looker dashboards for finance")

    async def boom(items):
        raise RuntimeError("rate limited")
    with pytest.raises(RuntimeError):
        match([Requirement(name="Tableau", type="hard_skill")], boom, prof)


def test_judge_skipping_an_item_is_retried_then_fails():
    import pytest
    from app.modules.resume_match.matcher import JudgeUnavailable
    prof = profile()
    prof.roles[0].bullets.append("Built Looker dashboards for finance")
    calls = []

    async def silent(items):
        calls.append(len(items))
        return []
    with pytest.raises(JudgeUnavailable):
        match([Requirement(name="Tableau", type="hard_skill")], silent, prof)
    assert calls == [1, 1]  # asked once, then re-asked for the missing item


def test_skills_list_only_evidence_is_capped_even_when_judge_says_met():
    # Requirement and listed skill are similar enough (cos ~0.70) to be ambiguous, so they go to the judge.
    prof = CandidateProfile(skills=[ProfileSkill(name="Statistics")])

    def controlled_embed(texts):
        return [[1.0, 0.0] if t == "Quantitative Aptitude" else [0.7, 0.714] for t in texts]

    seen = []

    async def generous(items):
        seen.append(items[0].evidence)
        return [JudgeVerdict(index=items[0].index, verdict="met", quote="Statistics", reason="lists it")]
    job = JobRequirements(requirements=[Requirement(name="Quantitative Aptitude", type="hard_skill")])
    r = run(match_requirements(job, prof, controlled_embed, generous, TODAY))[0]
    assert seen == [["Skill listed: Statistics"]]          # it really went through the judge
    assert r.credit == 0.4 and "listed as a skill" in r.reason


def test_education_levels():
    b, m, phd_field = match([
        Requirement(name="Bachelor's degree", type="education", min_degree_level="bachelor"),
        Requirement(name="Master's degree", type="education", min_degree_level="master"),
        Requirement(name="PhD", type="education", min_degree_level="doctorate"),
    ])
    assert b.credit == 1.0 and m.credit == 0.5 and phd_field.credit == 0.0


def test_certification_and_eligibility():
    cert, missing, elig = match([
        Requirement(name="AWS Certified Cloud Practitioner", type="certification"),
        Requirement(name="PMP", type="certification"),
        Requirement(name="Work authorization", type="eligibility"),
    ])
    assert cert.credit == 1.0 and missing.credit == 0.0 and elig.method == "rule"


def test_full_pipeline_report():
    job = JobRequirements(
        title="Data Analyst", min_years_experience=2, responsibilities=["Build ETL pipelines"],
        requirements=[Requirement(name="Python", type="hard_skill"), Requirement(name="SQL", type="hard_skill"),
                      Requirement(name="Kubernetes", type="hard_skill", importance="nice_to_have")],
    )
    ats = signals_from_text("Experience\nEducation\nSkills\nme@x.com\nJan 2023 - Present " * 10)
    rep = run(analyze(job, profile(), ats, embed=fake_embed, judge=no_judge, today=TODAY))
    assert rep.must_haves_total == 2 and rep.must_haves_met == 1 and rep.must_haves_partial == 1  # SQL is only equivalent
    assert rep.score > 60 and rep.band in {"Good", "Strong"}
    assert [f.requirement for f in rep.fixes][0] in {"SQL", "Kubernetes"}


def test_verify_profile_drops_fabricated_evidence_and_derives_recency():
    text = "Data Analyst Acme 2019-2021\n- Built dashboards in Tableau for sales\n"
    p = CandidateProfile(
        roles=[ProfileRole(title="Data Analyst", start="2019-01", end="2021-06",
                           bullets=["Built dashboards in Tableau for sales", "Invented a bullet"])],
        skills=[ProfileSkill(name="Tableau", evidence=["Built dashboards in Tableau for sales", "Invented a bullet"],
                             last_used_year=2099)],
    )
    out = verify_profile(p, text, TODAY)
    assert out.roles[0].bullets == ["Built dashboards in Tableau for sales"]
    assert out.skills[0].evidence == ["Built dashboards in Tableau for sales"]
    assert out.skills[0].last_used_year == 2021


def test_redaction_removes_identity_keeps_dates():
    out = redact_resume_text("Asha Verma\nasha@x.com | +91 98765 43210\nAnalyst, Acme (2019-2023)\nDOB: 01/01/1995")
    assert "Asha" not in out and "asha@x.com" not in out and "98765" not in out
    assert "2019-2023" in out and "DOB" not in out


def test_ats_signals_from_text():
    s = signals_from_text("Experience\nEducation\nSkills\nme@x.com\nJan 2023 - 2024\n01/2022 - 02/2022\n" * 5)
    assert set(s.sections_found) >= {"experience", "education", "skills"}
    assert s.dates_consistent is False  # mixed formats


def test_domain_requirement_uses_candidate_industries():
    prof = profile()
    prof.industries = ["Tableau"]  # fake embedder: same concept as the requirement below
    r = match([Requirement(name="Looker or Tableau", type="domain", importance="nice_to_have")], prof=prof)[0]
    assert r.credit == 1.0 and r.evidence.startswith("Industry:")


def test_generic_trait_capped_without_a_measurable_result():
    plain = profile()   # "Built Python ETL pipelines loading PostgreSQL" (no number) / "Led a team of 4 analysts"
    r = match([Requirement(name="Python", type="hard_skill", specificity="generic")], prof=plain)[0]
    assert r.credit == 0.7 and r.generic_capped and "measurable" in r.reason


def test_generic_trait_keeps_full_credit_when_the_line_has_a_number():
    prof = profile()
    prof.roles[0].bullets.append("Cut reporting time by 60% using Python scripts")
    prof.skills[0].evidence = ["Cut reporting time by 60% using Python scripts"]
    r = match([Requirement(name="Python", type="hard_skill", specificity="generic")], prof=prof)[0]
    assert r.credit == 1.0 and not r.generic_capped


def test_specific_skills_are_never_capped():
    r = match([Requirement(name="Python", type="hard_skill", specificity="specific")])[0]
    assert r.credit == 1.0 and not r.generic_capped


def test_or_requirement_is_met_by_either_alternative():
    prof = profile()  # has Python (evidence) but no Tableau / Excel-like tools
    r = match([Requirement(name="Kubernetes or Python", type="hard_skill")], prof=prof)[0]
    assert r.credit == 1.0 and r.requirement.name == "Kubernetes or Python"


def test_or_requirement_missing_when_neither_alternative_present():
    r = match([Requirement(name="Kubernetes or Terraform", type="hard_skill")])[0]
    assert r.credit == 0.0


def test_or_is_not_split_for_education_or_soft_skills():
    from app.modules.resume_match.matcher import _alternatives
    assert len(_alternatives(Requirement(name="Bachelor's in CS or related field", type="education"))) == 1
    assert len(_alternatives(Requirement(name="Written or verbal communication", type="soft_skill"))) == 1
    assert [a.name for a in _alternatives(Requirement(name="Power BI or Tableau", type="hard_skill"))] == ["Power BI", "Tableau"]


def test_split_either_or_requirements_are_merged_back():
    from app.modules.resume_match.jd_parser import merge_alternatives
    line = "Experience with Power BI or Tableau is essential"
    parsed = JobRequirements(requirements=[
        Requirement(name="Power BI", type="hard_skill", source_line=line),
        Requirement(name="Tableau", type="hard_skill", source_line=line),
        Requirement(name="SQL", type="hard_skill", source_line="Strong SQL"),
    ])
    names = [r.name for r in merge_alternatives(parsed).requirements]
    assert names == ["Power BI or Tableau", "SQL"]


def test_unrelated_requirements_are_not_merged():
    from app.modules.resume_match.jd_parser import merge_alternatives
    parsed = JobRequirements(requirements=[
        Requirement(name="Power BI", type="hard_skill", source_line="Power BI dashboards"),
        Requirement(name="Tableau", type="hard_skill", source_line="Tableau reporting"),
    ])
    assert len(merge_alternatives(parsed).requirements) == 2
