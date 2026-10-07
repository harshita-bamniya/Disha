from app.modules.resume_match.factcheck import violations
from app.modules.resume_match.scoring import ats_checks
from app.modules.resume_match.schemas import AtsSignals

SRC = "Built Python ETL pipelines that load daily sales into PostgreSQL, cutting report time by 60%"


def test_faithful_rewrite_passes():
    assert violations("Engineered Python ETL pipelines loading daily sales into PostgreSQL, cutting report time by 60%", SRC) == []


def test_invented_number_and_tool_are_caught():
    bad = violations("Built Python ETL pipelines on Airflow, cutting report time by 80%", SRC)
    assert "airflow" in bad and "80%" in bad


def test_invented_employer_is_caught():
    assert "google" in violations("Built Python ETL pipelines at Google", SRC)


def test_requirement_term_only_when_allowed():
    text = "Built SQL (PostgreSQL) reporting pipelines with Python"
    assert "sql" in violations(text, SRC)
    assert violations(text, SRC, allowed="SQL") == []


def test_comparable_tool_cannot_be_claimed():
    src = "Created Looker dashboards for the merchandising team used by 40 stakeholders"
    assert "tableau" in violations("Created Tableau dashboards for the merchandising team used by 40 stakeholders", src)


def test_number_formats_and_commas():
    assert violations("Handled 1,200 requests weekly", "Handled 1200 requests weekly") == []
    assert violations("Handled 1,300 requests weekly", "Handled 1200 requests weekly") == ["1300"]


def test_ordinary_capitalised_verbs_and_sentence_starts_are_fine():
    assert violations("Led a team of 4 analysts", "Led a team of 4 analysts") == []
    assert violations("Improved onboarding. Reduced churn", "improved onboarding and reduced churn") == []


def test_ats_checks_panel():
    ok = ats_checks(AtsSignals(char_count=900, sections_found=["experience", "education", "skills"]))
    assert all(c.passed for c in ok)
    bad = ats_checks(AtsSignals(char_count=900, sections_found=["experience"], table_count=1, multi_column=True))
    failed = {c.key for c in bad if not c.passed}
    assert {"heading_education", "heading_skills", "no_tables_images", "single_column"} <= failed
    assert [c.passed for c in ats_checks(AtsSignals(text_extractable=False))] == [False]


def test_embellishment_is_rejected_but_light_rephrasing_passes():
    from app.modules.resume_match.factcheck import too_embellished
    src = "Maintained Excel reports and wrote MySQL queries for inventory analysis"
    assert too_embellished("Analyzed inventory by maintaining Excel reports and writing MySQL queries", src) == []
    padded = "Developed dashboards to provide actionable data insights ensuring accuracy across cross-functional teams"
    assert len(too_embellished(padded, "Created Looker dashboards for the merchandising team")) > 2
