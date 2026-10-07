from app.modules.resume_match.quality import assess_quality
from app.modules.resume_match.schemas import CandidateProfile, ProfileRole, ProfileSkill

STRONG = CandidateProfile(
    roles=[ProfileRole(title="Analyst", company="Acme", start="2022-01", end="present", bullets=[
        "Built Power BI dashboards tracking 120 indicators used by 35 senior officials each month",
        "Cut manual reporting effort by 70% by automating SQL and Python data pipelines",
        "Presented quarterly findings to 12 programme directors and shaped the 2024 budget",
    ])],
    skills=[ProfileSkill(name="SQL", evidence=["Cut manual reporting effort by 70% by automating SQL and Python data pipelines"])],
)
WEAK = CandidateProfile(
    roles=[ProfileRole(title="Executive", company="ABC", start="2021-01", end="present", bullets=[
        "Worked on various tasks assigned by the manager",
        "Responsible for supporting the team etc.",
    ])],
    skills=[ProfileSkill(name="Excel"), ProfileSkill(name="SQL"), ProfileSkill(name="Python")],
)


def test_strong_resume_scores_high_and_weak_scores_low():
    strong, weak = assess_quality(STRONG), assess_quality(WEAK)
    assert strong.label == "Strong" and strong.score >= 80
    assert weak.label == "Needs work" and weak.score < 40
    assert strong.score - weak.score > 40


def test_weak_resume_reports_the_offending_lines():
    checks = {c.key: c for c in assess_quality(WEAK).checks}
    assert checks["quantified"].score == 0 and "Worked on various tasks assigned by the manager" in checks["quantified"].examples
    assert checks["action_verbs"].score == 0
    assert checks["skills_shown"].score == 0 and "Excel" in checks["skills_shown"].examples
    assert "various" in checks["filler"].detail


def test_no_experience_text_means_no_quality_score():
    assert assess_quality(CandidateProfile(skills=[ProfileSkill(name="Python")])) is None


def test_deterministic():
    assert assess_quality(STRONG) == assess_quality(STRONG)
