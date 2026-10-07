"""Setup answers that change the plan: language, budget, stage, location."""
from app.modules.roadmap_engine import prefs


def test_language_falls_back_to_english_for_unknown_codes():
    assert prefs.language_for("hi") == "hi"
    assert prefs.language_for("xx") == "en" and prefs.language_for(None) == "en"


def test_paid_hosts_are_detected_by_host_not_by_substring():
    paid = ["https://www.coursera.org/learn/x", "https://in.coursera.org/a", "https://www.linkedin.com/learning/abc", "https://udemy.com/c"]
    free = ["https://www.linkedin.com/in/someone", "https://youtube.com/watch?v=1", "https://meity.gov.in/x", "https://notcoursera.org/", "", None]
    assert all(prefs.is_paid_source(u) for u in paid)
    assert not any(prefs.is_paid_source(u) for u in free)


def test_free_only_hides_paid_resources_and_counts_them():
    res = [{"url": "https://youtube.com/watch?v=1"}, {"url": "https://www.udemy.com/c"}, {"url": "https://meity.gov.in/a"}]
    kept, hidden = prefs.filter_resources(res, "free_only")
    assert [r["url"] for r in kept] == ["https://youtube.com/watch?v=1", "https://meity.gov.in/a"] and hidden == 1
    assert prefs.filter_resources(res, "flexible") == (res, 0) and prefs.filter_resources(res, None) == (res, 0)


def test_budget_and_language_notes_are_honest():
    assert prefs.budget_note("free_only", 2) == "Free-only budget: 2 paid resources hidden."
    assert prefs.budget_note("free_only", 0) is None and prefs.budget_note("flexible", 3) is None
    assert prefs.language_note("en", 5, 5) is None and prefs.language_note("hi", 5, 0) is None
    assert "English videos" in prefs.language_note("hi", 5, 5) and "2 of 5" in prefs.language_note("ta", 5, 2)


def test_stage_sets_video_level():
    assert prefs.video_level("working_in_field", "learn") == "intermediate"
    assert prefs.video_level("new_to_field", "learn") == "beginner" and prefs.video_level(None, "review") == "intermediate"


def test_location_note_counts_matching_roles_only():
    locs = [["Delhi NCR", "Mumbai"], ["Bengaluru"], ["New Delhi"], []]
    n = prefs.location_note(["delhi"], locs)
    assert n == {"preferred": ["Delhi"], "roles_matching": 2, "roles_total": 4}
    assert prefs.location_note([], locs) is None and prefs.location_note(["Pune"], [])  is None
    assert prefs.location_note(["Pune"], locs)["roles_matching"] == 0
