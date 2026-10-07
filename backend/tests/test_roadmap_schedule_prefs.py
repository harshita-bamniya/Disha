"""Learning Setup answers that shape the schedule: session length, study days, practice style, deadline reason."""
from datetime import date

from app.modules.roadmap_engine import personalizer as pz
from app.modules.roadmap_engine import prefs

TODAY = date(2026, 1, 1)
PHASES = [
    {"id": "p1", "name": "Foundations", "gate": {"description": "quiz"}, "module_ids": ["a", "b"]},
    {"id": "p2", "name": "Applied", "gate": {"description": "project"}, "module_ids": ["c"]},
]


def _mod(mid, phase, practice, videos=()):
    res = [{"id": f"{mid}-v{i}", "type": "youtube", "title": f"{mid} video {i}", "duration_minutes": d}
           for i, d in enumerate(videos, 1)]
    return {"id": mid, "phase_id": phase, "practice_hours": practice, "resources": res,
            "proof": {"title": f"proof {mid}"}, "skill": mid}


def _mods():
    return [_mod("a", "p1", 2, [60]), _mod("b", "p1", 2, [60]), _mod("c", "p2", 4, [120])]


# ── practice style ────────────────────────────────────────────────────────────

def test_practice_style_scales_practice_time():
    assert prefs.practice_factor("none", "mixed") == 0
    assert prefs.practice_factor("quizzes", "mixed") == 0.15
    assert prefs.practice_factor("projects", "mixed") == 1.0
    assert prefs.practice_factor("both", "video") == 1.0


def test_hands_on_format_adds_building_time_and_defaults_to_projects():
    assert prefs.practice_factor("projects", "hands_on") == 1.5
    assert prefs.practice_factor(None, "hands_on") == 1.5          # said nothing about practice, prefers hands-on
    assert prefs.practice_factor(None, "mixed") == 1.0
    assert prefs.practice_factor("quizzes", "hands_on") == 0.15   # an explicit quiz choice is not inflated


def test_adjust_practice_keeps_a_minimum_unless_switched_off():
    assert prefs.adjust_practice(6, 4, 0) == (2, 0)
    hours, practice = prefs.adjust_practice(3, 1, 0.15)
    assert practice == 0.5 and hours == 2.5
    assert prefs.adjust_practice(6, 4, 1.5) == (8, 6)


def test_quiz_time_is_capped_at_one_sitting():
    # a module with 11 h of practice would otherwise leave a multi-hour "quiz"
    hours, practice = prefs.adjust_practice(14, 11, prefs.practice_factor("quizzes", "mixed"), prefs.QUIZ_MAX_HOURS)
    assert practice == 1.0 and hours == 4


def test_quiz_style_makes_practice_a_quiz_task_and_none_removes_it():
    quiz = pz.build_schedule(_mods(), PHASES, 10, None, TODAY, practice_type="quiz")
    types = {t["type"] for w in quiz["weeks"] for t in w["tasks"]}
    assert "quiz" in types and "project" not in types
    titles = [t["title"] for w in quiz["weeks"] for t in w["tasks"] if t["type"] == "quiz"]
    assert all(t.startswith("Self-check quiz") for t in titles)

    none = pz.build_schedule(_mods(), PHASES, 10, None, TODAY, practice_type=None)
    types = {t["type"] for w in none["weeks"] for t in w["tasks"]}
    assert types <= {"watch", "read", "gate"}
    assert none["total_hours"] < quiz["total_hours"]


# ── session length ────────────────────────────────────────────────────────────

def test_session_length_reports_sessions_per_task_and_week():
    s = pz.build_schedule(_mods(), PHASES, 4, None, TODAY, session_hours=0.5)
    assert s["session_hours"] == 0.5 and s["sessions_per_week"] == 8
    first = s["weeks"][0]
    assert first["sessions"] == sum(t["sessions"] for t in first["tasks"])
    assert all(t["sessions"] >= 1 for w in s["weeks"] for t in w["tasks"])

    long = pz.build_schedule(_mods(), PHASES, 4, None, TODAY, session_hours=2.0)
    assert long["sessions_per_week"] == 2
    assert long["weeks"][0]["sessions"] < first["sessions"]


def test_no_session_preference_leaves_schedule_unchanged():
    s = pz.build_schedule(_mods(), PHASES, 4, None, TODAY)
    assert s["session_hours"] is None and "sessions" not in s["weeks"][0]


# ── study days ────────────────────────────────────────────────────────────────

def test_tasks_are_assigned_only_to_chosen_study_days():
    s = pz.build_schedule(_mods(), PHASES, 10, None, TODAY, study_days=prefs.study_day_names("weekends"))
    days = {t["day"] for w in s["weeks"] for t in w["tasks"]}
    assert days <= {"Sat", "Sun"} and days
    assert s["study_days"] == ["Sat", "Sun"]

    weekdays = pz.build_schedule(_mods(), PHASES, 10, None, TODAY, study_days=prefs.study_day_names("weekdays"))
    assert {t["day"] for w in weekdays["weeks"] for t in w["tasks"]} <= {"Mon", "Tue", "Wed", "Thu", "Fri"}


def test_tasks_move_through_the_days_in_order():
    s = pz.build_schedule(_mods(), PHASES, 10, None, TODAY, study_days=prefs.study_day_names("weekdays"))
    order = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    idx = [order.index(t["day"]) for t in s["weeks"][0]["tasks"]]
    assert idx == sorted(idx)


def test_too_many_hours_for_too_few_days_is_called_out():
    s = pz.build_schedule(_mods(), PHASES, 20, None, TODAY, study_days=prefs.study_day_names("weekends"))
    assert "10.0 h per day" in s["day_note"]
    ok = pz.build_schedule(_mods(), PHASES, 10, None, TODAY, study_days=prefs.study_day_names("every_day"))
    assert "day_note" not in ok


# ── deadline reason ───────────────────────────────────────────────────────────

def test_interview_deadline_reports_what_fits_before_the_date():
    # a(3h) b(3h) + 1h gate = phase 1; c(6h) + 1h gate = phase 2. 14 h at 5 h/week needs 3 weeks, only 2 are available.
    s = pz.build_schedule(_mods(), PHASES, 5, date(2026, 1, 15), TODAY, deadline_reason="interview")
    assert s["feasible"] is False
    focus = s["focus"]
    assert focus["weeks_available"] == 2
    assert focus["modules_total"] == 3 and focus["modules_covered"] == 2
    assert "Foundations" in focus["phases_covered"] and "Applied" not in focus["phases_covered"]
    note = prefs.deadline_note("interview", focus)
    assert "your interview" in note and f"{focus['modules_covered']} of 3" in note


def test_no_rush_or_no_date_has_no_deadline_focus():
    assert pz.build_schedule(_mods(), PHASES, 5, date(2026, 1, 22), TODAY, deadline_reason="no_rush")["focus"] is None
    assert pz.build_schedule(_mods(), PHASES, 5, None, TODAY, deadline_reason="interview")["focus"] is None
    assert prefs.deadline_note("no_rush", {"modules_covered": 1, "modules_total": 3, "phases_covered": []}) is None


def test_everything_fits_message_when_the_date_is_far_enough():
    s = pz.build_schedule(_mods(), PHASES, 10, date(2026, 6, 1), TODAY, deadline_reason="application")
    assert s["feasible"] is True
    assert "fits before your application deadline" in prefs.deadline_note("application", s["focus"])
