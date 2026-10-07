"""Roadmap inputs and trust rules: no resume data, posting-targeted, facts-only personalisation,
statute corrections, grounding labels, and links that cannot be faked by a catch-all site."""
import asyncio
import re
from pathlib import Path

import httpx

from app.modules.roadmap_engine import facts, personal, targeting
from app.modules.roadmap_engine.blueprint import body_fingerprint, is_soft_404_site

ENGINE_DIR = Path(__file__).resolve().parents[1] / "app" / "modules" / "roadmap_engine"


def run(coro):
    return asyncio.run(coro)


# ── Rule: a roadmap never reads resume data ──────────────────────────────────

def test_roadmap_engine_never_imports_resume_data():
    """The only resume-package import allowed is the posting parser (it reads the JOB, not a candidate)."""
    allowed = "from app.modules.resume_match.jd_parser import"
    offenders = []
    for path in ENGINE_DIR.glob("*.py"):
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith(("import ", "from ")) and re.search(r"resume", stripped, re.I):
                if not stripped.startswith(allowed):
                    offenders.append(f"{path.name}: {stripped}")
    assert offenders == []


def test_build_plan_has_no_resume_parameter():
    import inspect
    from app.modules.roadmap_engine.engine import build_plan
    assert not [p for p in inspect.signature(build_plan).parameters if "resume" in p.lower()]


# ── Statute registry ─────────────────────────────────────────────────────────

def test_stale_rules_name_is_corrected_and_reported():
    plan = {"modules": [{"skill": "DPDP Act 2023 & DPDP Rules 2024 mapping", "id": "m-x", "url": "https://x/dpdp-rules-2024"}]}
    fixed, corrections, _ = facts.apply_statute_checks(plan)
    assert "Rules, 2025" in fixed["modules"][0]["skill"] and "2024" not in fixed["modules"][0]["skill"]
    assert fixed["modules"][0]["url"] == "https://x/dpdp-rules-2024"       # urls and ids untouched
    assert fixed["modules"][0]["id"] == "m-x" and corrections


def test_bare_rules_2024_fixed_only_in_data_protection_context():
    fixed, _, _ = facts.apply_statute_checks({
        "a": "Indian Data Protection Landscape – DPDP Act 2023 & Rules 2024",
        "b": "Companies (Accounts) Rules 2024 for statutory audit",
    })
    assert fixed["a"].endswith("Rules, 2025") and fixed["b"].endswith("Rules 2024 for statutory audit")


def test_known_misstatements_are_flagged_not_rewritten():
    text = {
        "a": "Prepare the annual cybersecurity incident report per CERT-In guidelines",
        "b": "Every new SaaS product launch must be cleared with a DPIA",
        "c": "IT Act 2000 (2023 amendments) and CERT-In",
    }
    _, _, warnings = facts.apply_statute_checks(text)
    joined = " ".join(warnings)
    assert "6 hours" in joined and "Significant Data Fiduciaries" in joined and "no separate 2023 amendment" in joined


def test_correct_statements_raise_no_flags():
    _, corrections, warnings = facts.apply_statute_checks(
        {"a": "Report incidents to CERT-In within 6 hours", "b": "A DPIA applies to Significant Data Fiduciaries"})
    assert corrections == [] and warnings == []


# ── Grounding label and the reviewer's findings ──────────────────────────────

def _skills(matched: list[int], total=12):
    return [{"id": f"s{i}", "name": f"S{i}", "phase": "p1", "prerequisites": [],
             "evidence": {"postings_matched": m, "postings_total": total}} for i, m in enumerate(matched)]


def test_grounding_levels():
    assert targeting.grounding(_skills([3, 2, 4, 1, 0]))["level"] == "grounded"
    assert targeting.grounding(_skills([1, 1, 0, 0, 0]))["level"] == "partial"
    g = targeting.grounding(_skills([0] * 12 + [2, 1]))
    assert g["level"] == "unverified" and g["skills_with_postings"] == 2 and g["skills_total"] == 14
    assert "2 of 14" in targeting.grounding_warning(g)
    assert targeting.grounding_warning({"level": "grounded", "skills_with_postings": 5, "skills_total": 5}) is None


def test_reviewer_weak_flags_match_despite_odd_hyphens():
    mods = [{"skill": "Regulatory Writing – drafting policy briefs"}, {"skill": "DPIA"}]
    n = targeting.flag_modules(mods, ["Regulatory Writing - drafting policy briefs"])
    assert n == 1 and "review_flag" in mods[0] and "review_flag" not in mods[1]


# ── Targeting to the posting ─────────────────────────────────────────────────

def _bp(n=6):
    return [{"id": f"s{i}", "name": f"Skill {i}", "phase": "p2", "prerequisites": []} for i in range(n)]


def test_skills_the_posting_does_not_ask_for_move_to_optional():
    skills = _bp(6)
    serves = {"s0": ["Report writing"], "s1": ["Research"], "s2": ["Legal liaison"], "s3": ["Trackers"], "s4": [], "s5": []}
    core, beyond = targeting.select_core(skills, {"p2": "Core Skills"}, serves)
    assert core == {"s0", "s1", "s2", "s3"} and beyond == {"s4", "s5"}


def test_prerequisites_of_required_skills_are_always_kept():
    skills = _bp(6)
    skills[0]["prerequisites"] = ["s5"]          # required s0 needs s5 first
    serves = {"s0": ["A"], "s1": ["B"], "s2": ["C"], "s3": ["D"], "s4": [], "s5": []}
    core, beyond = targeting.select_core(skills, {"p2": "Core Skills"}, serves)
    assert "s5" in core and beyond == {"s4"}


def test_job_search_phase_is_always_kept():
    skills = _bp(6)
    skills[5]["phase"] = "p5"
    serves = {"s0": ["A"], "s1": ["B"], "s2": ["C"], "s3": ["D"], "s4": [], "s5": []}
    core, _ = targeting.select_core(skills, {"p2": "Core Skills", "p5": "Job Search"}, serves)
    assert "s5" in core


def test_too_few_matches_means_keep_everything_rather_than_trust_a_bad_mapping():
    skills = _bp(6)
    core, beyond = targeting.select_core(skills, {"p2": "Core"}, {"s0": ["A"], **{f"s{i}": [] for i in range(1, 6)}})
    assert core == {f"s{i}" for i in range(6)} and beyond == set()


def test_unknown_items_in_the_ai_answer_are_ignored():
    skills = _bp(2)
    targets = ["Report writing", "Research"]
    out = targeting.parse_target_answer({"modules": {"s0": ["report  WRITING", "Invented thing"], "s1": ["nope"]}},
                                        skills, targets)
    assert out == {"s0": ["Report writing"], "s1": []}


# ── Personal lines come from facts only ──────────────────────────────────────

def test_personal_lines_never_claim_experience():
    why = "Policy briefs are the main deliverable to senior management."
    lines = [
        personal.module_line("learn", None, why),
        personal.module_line("partial", "Essay Writing", why),
        personal.module_line("review", "Public Administration", why),
    ]
    for ln in lines:
        assert not re.search(r"\b(your|you have)\b[^.]*\b(experience|worked|years|speaking|background)\b", ln, re.I)
    assert "Essay Writing" in lines[1] and "Public Administration" in lines[2] and "New for you" in lines[0]


def test_summary_uses_only_profile_skills_and_plan_facts():
    mods = [{"skill": "DPIA", "status": "learn"}, {"skill": "Writing", "status": "partial"}]
    s = personal.summary([("Report writing", "from your Essay Writing")], mods, 3)
    assert "Report writing (from your Essay Writing)" in s and "DPIA" in s and "3 further skills" in s
    assert "None of your listed skills" in personal.summary([], mods, 0)


def test_summary_is_readable_and_not_repetitive():
    s = personal.summary(
        [("Critical Thinking", "from your Analytical Thinking"), ("Analytical Thinking", "from your Analytical Thinking"),
         ("Research", "from your Current Affairs"), ("Ethics & Integrity", "from your Ethics")], [], 0)
    assert s.count("Analytical Thinking") == 1            # one entry per profile skill, no repeat
    assert "Critical Thinking (from your Analytical Thinking)" in s and "Research (from your Current Affairs)" in s


# ── Links: a catch-all site must not make an invented URL look real ──────────

def _client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_site_that_answers_200_to_any_path_is_detected():
    shell = "<html><body>app shell {}</body></html>"
    client = _client(lambda req: httpx.Response(200, text=shell))
    cache: dict = {}
    fp = body_fingerprint(shell)
    assert run(is_soft_404_site(client, "https://catchall.example/invented-page", fp, cache)) is True


def test_normal_site_that_404s_unknown_paths_is_trusted():
    def handler(req):
        return httpx.Response(200, text="<html>real</html>") if req.url.path == "/real" else httpx.Response(404)
    client = _client(handler)
    assert run(is_soft_404_site(client, "https://normal.example/real", body_fingerprint("<html>real</html>"), {})) is False


def test_fingerprint_ignores_whitespace_only_differences():
    assert body_fingerprint("<p>a   b</p>\n") == body_fingerprint("<p>a b</p> ")


def test_job_search_dependencies_do_not_pull_the_whole_blueprint_back():
    # mock interview (job search) -> capstone -> every other skill, as in a real blueprint
    skills = _bp(7)
    skills[6]["phase"] = "p5"; skills[6]["prerequisites"] = ["s5"]      # interview needs the capstone
    skills[5]["prerequisites"] = ["s4"]                                 # capstone needs a non-posting skill
    serves = {"s0": ["A"], "s1": ["B"], "s2": ["C"], "s3": ["D"], "s4": [], "s5": [], "s6": []}
    core, beyond = targeting.select_core(skills, {"p2": "Core Skills", "p5": "Job Search"}, serves)
    assert core == {"s0", "s1", "s2", "s3", "s6"} and beyond == {"s4", "s5"}


# ── The learner's own ratings ────────────────────────────────────────────────

from app.modules.roadmap_engine import ratings as rt  # noqa: E402

REQS = ["Report Writing", "Research", "Indian administrative and constitutional law"]


def test_ratings_are_cleaned_to_the_postings_own_skills_and_the_0_to_3_scale():
    out = rt.clean_ratings({"report  writing": 3, "Research": "2", "Invented skill": 3, "Research ": 9,
                            "Indian administrative and constitutional law": -1}, REQS)
    assert out == {"Report Writing": 3, "Research": 2}
    assert rt.clean_ratings("garbage", REQS) == {} and rt.clean_ratings(None, REQS) == {}


def _mod_status(n=4):
    skills = [{"id": f"s{i}", "name": f"S{i}"} for i in range(n)]
    return skills, {s["id"]: {"status": "learn", "matched": None} for s in skills}


def test_confident_ratings_shorten_modules_that_only_serve_those_skills():
    skills, status = _mod_status()
    serves = {"s0": ["Report Writing"], "s1": ["Report Writing", "Research"], "s2": ["Research"], "s3": []}
    changed = rt.apply_to_status(skills, status, serves, {"Report Writing": 3, "Research": 2})
    assert status["s0"]["status"] == "review" and status["s0"]["source"] == "self_rating" and status["s0"]["rating"] == 3
    assert status["s1"]["status"] == "partial"        # one of its two skills is only rated 2
    assert status["s2"]["status"] == "partial" and status["s3"]["status"] == "learn" and changed == 3


def test_ratings_never_downgrade_and_low_ratings_change_nothing():
    skills, status = _mod_status(2)
    status["s0"]["status"] = "review"
    assert rt.apply_to_status(skills, status, {"s0": ["Research"], "s1": ["Research"]}, {"Research": 1}) == 0
    assert status["s0"]["status"] == "review" and status["s1"]["status"] == "learn"
    assert rt.apply_to_status(skills, status, {"s0": ["Research"]}, {"Research": 2}) == 0   # partial < review


def test_own_rating_overrides_a_profile_based_guess():
    profile = [("Research", "Current Affairs"), ("Report Writing", "Essay Writing")]
    out = rt.strengths(profile, REQS, {"Research": 0, "Indian administrative and constitutional law": 3})
    assert ("Research", "from your Current Affairs") not in out          # they say they have never done research
    assert ("Report Writing", "from your Essay Writing") in out           # unrated: profile guess stands
    assert ("Indian administrative and constitutional law", "you rated yourself 3/3") in out


def test_lines_and_summary_state_the_rating_not_an_invented_claim():
    ln = personal.module_line("review", "Report Writing", "Briefs matter.", "self_rating", 3)
    assert ln.startswith("You rated yourself 3/3 on Report Writing") and "refresher" in ln
    s = personal.summary([("Report Writing", "you rated yourself 3/3")], [], 0)
    assert "Report Writing (you rated yourself 3/3)" in s


# ── tighter posting targeting ────────────────────────────────────────────────

def _mods(*rows):
    return [{"id": i, "name": n, "phase": "p1", "prerequisites": pre} for i, n, pre in rows]


def test_generic_item_does_not_pull_in_a_technical_module():
    skills = _mods(("rw", "Report Writing", []), ("inc", "Annual cybersecurity incident report", []))
    serves = {"rw": ["Report Writing"], "inc": ["Report Writing"]}
    kept = targeting.drop_loose_mappings(skills, serves)
    assert kept["rw"] == ["Report Writing"] and kept["inc"] == []


def test_specific_item_keeps_its_module():
    skills = _mods(("dpdp", "DPDP Act compliance practice", []))
    assert targeting.drop_loose_mappings(skills, {"dpdp": ["Ensure compliance with the DPDP Act"]})["dpdp"]


def test_prerequisites_are_pulled_one_level_only():
    skills = _mods(("a", "Alpha tool", []), ("b", "Beta tool", ["a"]), ("c", "Gamma tool", ["b"]), ("d", "Delta tool", ["c"]), ("e", "Other", []))
    core, beyond = targeting.select_core(skills, {"p1": "Core"}, {"d": ["Needs Delta"], "e": ["Needs Other"], "a": ["x y"], "b": ["z w"]})
    assert "c" in core and "b" in core and "a" in core        # d needs c (one level); b and a are asked for directly
    skills2 = _mods(("a", "Alpha tool", []), ("b", "Beta tool", ["a"]), ("c", "Gamma tool", ["b"]), ("d", "Delta tool", ["c"]),
                  ("e", "Epsilon tool", []), ("f", "Zeta tool", []), ("g", "Eta tool", []))
    core2, _ = targeting.select_core(skills2, {"p1": "Core"}, {"d": ["Needs Delta"], "e": ["Needs Epsilon"], "f": ["Needs Zeta"], "g": ["Needs Eta"]})
    assert "c" in core2 and "b" not in core2 and "a" not in core2
