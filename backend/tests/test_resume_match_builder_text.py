from app.modules.resume_match.builder_text import resume_to_text
from app.modules.resume_match.extraction import signals_from_text

SECTIONS = [
    {"section_type": "skills", "content": {"technical": ["Python", "SQL"], "soft": ["Communication"], "tools": []}},
    {"section_type": "experience", "content": {"items": [{
        "title": "Data Analyst", "company": "Acme", "start_date": "Jan 2023", "end_date": "Present",
        "bullets": ["Built Python ETL pipelines", "- Cut report time by 60%"]}]}},
    {"section_type": "education", "content": {"items": [{"degree": "B.Tech", "field": "CS", "institution": "IIT", "year": "2021"}]}},
    {"section_type": "summary", "content": {"text": "Analyst with 3 years experience.", "contact": {"email": "a@b.com"}}},
    {"section_type": "certifications", "content": {"items": ["AWS Cloud Practitioner"]}},
]


def test_sections_render_in_standard_order_with_standard_headings():
    text = resume_to_text(SECTIONS)
    order = [text.index(h) for h in ("Summary", "Experience", "Education", "Skills", "Certifications")]
    assert order == sorted(order)
    assert "Data Analyst, Acme (Jan 2023 - Present)" in text
    assert "- Built Python ETL pipelines" in text and "- Cut report time by 60%" in text
    assert "Technical: Python, SQL" in text and "Tools" not in text  # empty groups skipped


def test_builder_resume_is_ats_clean():
    s = signals_from_text(resume_to_text(SECTIONS), tables=0, images=0)
    assert {"experience", "education", "skills"} <= set(s.sections_found)


def test_empty_and_unknown_content_do_not_crash():
    assert resume_to_text([]) == ""
    assert resume_to_text([{"section_type": "experience", "content": {"items": "garbage"}},
                           {"section_type": "custom", "content": None}]) == ""
