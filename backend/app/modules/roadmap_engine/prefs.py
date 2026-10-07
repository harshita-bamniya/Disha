"""How the learner's setup answers change the plan (all pure, tested).

  language  -> the language videos are searched and ranked in (English is the fallback, and the plan says so)
  budget    -> free_only hides resources that sit behind a paywall
  stage     -> the level videos are pitched at
  location  -> the profile's preferred cities, counted against the reference roles that grounded the blueprint
"""
from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "bn": "Bengali", "mr": "Marathi",
                  "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam", "pa": "Punjabi"}
DEFAULT_LANGUAGE = "en"

# Hosts whose learning content is normally behind a paid plan or certificate fee. Official/government sources,
# YouTube and open-access sites are not listed, so they are never hidden by a free-only budget.
PAID_HOSTS = (
    "coursera.org", "udemy.com", "pluralsight.com", "skillshare.com", "linkedin.com/learning", "masterclass.com",
    "datacamp.com", "codecademy.com", "edx.org", "upgrad.com", "simplilearn.com", "great-learning.com", "greatlearning.in",
    "udacity.com", "oreilly.com", "domestika.org", "brilliant.org",
)


def language_for(preferred: str | None) -> str:
    return preferred if preferred in LANGUAGE_NAMES else DEFAULT_LANGUAGE


def is_paid_source(url: str | None) -> bool:
    if not url:
        return False
    parsed = urlparse(url if "//" in url else "//" + url)
    host = (parsed.hostname or "").lower().removeprefix("www.")
    path = (parsed.path or "").lower()
    for entry in PAID_HOSTS:
        paid_host, _, prefix = entry.partition("/")
        if (host == paid_host or host.endswith("." + paid_host)) and path.lstrip("/").startswith(prefix):
            return True
    return False


def filter_resources(resources: list[dict[str, Any]], budget: str | None) -> tuple[list[dict[str, Any]], int]:
    """Under a free-only budget, drop resources behind a paywall. Returns (kept, how many were hidden)."""
    if budget != "free_only":
        return resources, 0
    kept = [r for r in resources if not is_paid_source(r.get("url"))]
    return kept, len(resources) - len(kept)


def video_level(stage: str | None, status: str) -> str:
    """Level the videos are pitched at: someone already working in the field skips beginner explainers."""
    if stage == "working_in_field":
        return "intermediate"
    return "intermediate" if status == "review" else "beginner"


def language_note(language: str, modules_total: int, modules_fallback: int) -> str | None:
    """Honest note when the preferred language could not be honoured for some modules."""
    if language == DEFAULT_LANGUAGE or modules_fallback == 0:
        return None
    name = LANGUAGE_NAMES.get(language, language)
    if modules_fallback >= modules_total:
        return f"No {name} videos were found for these topics, so the plan uses English videos."
    return f"No {name} videos were found for {modules_fallback} of {modules_total} modules; those use English videos."


def budget_note(budget: str | None, hidden: int) -> str | None:
    if budget != "free_only" or hidden == 0:
        return None
    return f"Free-only budget: {hidden} paid resource{'s' if hidden != 1 else ''} hidden."


def location_note(preferred: list[str] | None, roles_locations: list[list[str]]) -> dict[str, Any] | None:
    """Of the reference roles behind this blueprint, how many list one of the learner's preferred places."""
    wants = [w.strip().lower() for w in (preferred or []) if isinstance(w, str) and w.strip()]
    if not wants or not roles_locations:
        return None
    def hit(locs: list[str]) -> bool:
        return any(w in l.lower() or l.lower() in w for l in locs for w in wants)
    n = sum(1 for locs in roles_locations if hit(locs))
    return {"preferred": [w.title() for w in wants][:3], "roles_matching": n, "roles_total": len(roles_locations)}


# ── Schedule preferences (Learning Setup: session length, study days, practice style, deadline reason) ──────

SESSION_HOURS = {"short": 0.5, "medium": 1.0, "long": 2.0}
SESSION_LABEL = {"short": "30 min", "medium": "1 h", "long": "2 h+"}
STUDY_DAYS = {
    "weekdays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "weekends": ["Sat", "Sun"],
    "every_day": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
}


def session_hours(length: str | None) -> float | None:
    return SESSION_HOURS.get(length or "")


def study_day_names(choice: str | None) -> list[str]:
    return STUDY_DAYS.get(choice or "", STUDY_DAYS["every_day"])


def effective_practice_style(style: str | None, fmt: str | None) -> str:
    """What the learner asked for; someone who prefers hands-on learning and said nothing gets projects."""
    if style in ("quizzes", "projects", "both", "none"):
        return style
    return "projects" if fmt == "hands_on" else "both"


def practice_factor(style: str | None, fmt: str | None) -> float:
    """Multiplier on a module's practice time. Hands-on learners get more building time."""
    eff = effective_practice_style(style, fmt)
    base = {"projects": 1.0, "both": 1.0, "quizzes": 0.15, "none": 0.0}[eff]
    return base * 1.5 if fmt == "hands_on" and eff in ("projects", "both") else base


def practice_task_type(style: str | None, fmt: str | None) -> str | None:
    """Type of the per-module practice task: a quiz, a project, or none at all."""
    eff = effective_practice_style(style, fmt)
    return None if eff == "none" else ("quiz" if eff == "quizzes" else "project")


QUIZ_MAX_HOURS = 1.0   # a self-check quiz is a sitting, not a project


def adjust_practice(hours: float, practice: float, factor: float, max_practice: float | None = None) -> tuple[float, float]:
    """(total_hours, practice_hours) after scaling practice time by `factor`, in half-hour steps."""
    new_practice = round(practice * factor * 2) / 2
    if factor > 0 and new_practice < 0.5:
        new_practice = 0.5
    if max_practice is not None:
        new_practice = min(new_practice, max_practice)
    return round((hours - practice + new_practice) * 2) / 2, new_practice


def deadline_note(reason: str | None, focus: dict[str, Any] | None) -> str | None:
    """Plain sentence about what the learner can finish by their date, for an interview/application deadline."""
    if not focus or reason not in ("interview", "application"):
        return None
    what = "your interview" if reason == "interview" else "your application deadline"
    if focus["modules_covered"] >= focus["modules_total"]:
        return f"Everything in this plan fits before {what}."
    if focus["modules_covered"] == 0:
        return f"Your date for {what} is too close to finish even the first module at this weekly pace."
    phases = ", ".join(focus["phases_covered"]) or "the first phase"
    return (f"By {what} you can finish {focus['modules_covered']} of {focus['modules_total']} modules"
            f" ({phases}). The rest are worth doing after.")
