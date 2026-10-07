"""Pure-logic tests for the roadmap engine (no DB, network or LLM)."""
from datetime import date

from app.modules.roadmap_engine import personalizer as pz
from app.modules.roadmap_engine.schema import normalise_graph, topo_order, validate_graph
from app.modules.roadmap_engine.video_library import hard_filter, score_candidates


def _mod(mid, phase, practice, videos=()):
    res = [{"id": f"{mid}-v{i}", "type": "youtube", "title": f"{mid} video {i}", "duration_minutes": d} for i, d in enumerate(videos, 1)]
    return {"id": mid, "phase_id": phase, "practice_hours": practice, "resources": res,
            "proof": {"title": f"proof {mid}"}, "skill": mid}


PHASES = [{"id": "p1", "name": "One", "gate": {"description": "quiz"}}]


def test_schedule_fills_weeks_without_waste():
    mods = [_mod("a", "p1", 6, [60, 60]), _mod("b", "p1", 9, [120])]   # 2+6+2+9 = 19h + 1h gate = 20h
    s = pz.build_schedule(mods, PHASES, 10, None, today=date(2026, 1, 1))
    assert s["total_hours"] == 20.0
    assert s["weeks_needed"] == 2                      # ceil(20/10), not inflated by packing gaps
    assert all(w["hours"] <= 10 + 1e-6 for w in s["weeks"])
    assert round(sum(w["hours"] for w in s["weeks"]), 1) == 20.0


def test_long_task_is_split_and_numbered():
    s = pz.build_schedule([_mod("a", "p1", 25)], PHASES, 10, None, today=date(2026, 1, 1))
    parts = [t for w in s["weeks"] for t in w["tasks"] if t["type"] == "project"]
    assert [p["part"] for p in parts] == [1, 2, 3] and parts[0]["parts"] == 3


def test_deadline_feasibility_and_options():
    mods = [_mod("a", "p1", 60)]
    s = pz.build_schedule(mods, PHASES, 5, date(2026, 2, 1), today=date(2026, 1, 1))   # 61h @5h/wk = 13 wks; 5 available
    assert s["feasible"] is False and s["weeks_available"] == 5
    kinds = {o["type"] for o in s["options"]}
    assert kinds == {"extend_date", "raise_hours"}
    assert next(o for o in s["options"] if o["type"] == "raise_hours")["hours_per_week"] == 13   # ceil(61/5)


def test_no_deadline_is_always_feasible():
    s = pz.build_schedule([_mod("a", "p1", 5)], PHASES, None, None)
    assert s["feasible"] and s["weekly_hours"] == pz.DEFAULT_WEEKLY_HOURS


def test_node_hours_never_below_resource_time_and_scaled_by_status():
    learn, _ = pz.node_hours(10, "learn", 120)
    review, _ = pz.node_hours(10, "review", 120)
    assert learn >= 10 * 1.0 - 0.5
    assert review < learn
    hours, practice = pz.node_hours(2, "learn", 240)      # a long video dominates a small base estimate
    assert hours >= 4.0 and practice > 0


def test_known_skill_costs_no_hours():
    assert pz.MULT["known"] == 0.0


def _skill(sid, prereqs=(), phase="p1"):
    return {"id": sid, "name": sid, "phase": phase, "prerequisites": list(prereqs), "base_hours": 5,
            "why_for_role": "x", "search_queries": ["q"], "proof": {"type": "project", "title": "t", "brief": "b", "rubric": []}}


def test_topo_order_puts_prerequisites_first():
    order = [s["id"] for s in topo_order([_skill("c", ["b"]), _skill("b", ["a"]), _skill("a")])]
    assert order.index("a") < order.index("b") < order.index("c")


def test_validator_flags_cycle_forward_prereq_and_missing_proof():
    g = normalise_graph({
        "role_title": "R", "job_ready_definition": ["x"],
        "phases": [{"id": f"phase-{i}", "name": str(i), "gate": {"type": "quiz", "description": "d"}} for i in range(1, 4)],
        "skills": [
            {"id": "a", "name": "A", "phase": "phase-1", "prerequisites": ["b"], "base_hours": 4, "why_for_role": "w", "search_queries": ["q"]},
            {"id": "b", "name": "B", "phase": "phase-2", "prerequisites": [], "base_hours": 4, "why_for_role": "w", "search_queries": ["q"]},
        ],
    })
    errs = " | ".join(validate_graph(g))
    assert "comes after it" in errs and "no proof task" in errs and "Need 8-24 skills" in errs


def _vid(vid, title, dur_s, views=50000, likes=2500, subs=200000, age_iso="2025-06-01T00:00:00Z"):
    return {"video_id": vid, "title": title, "description": "", "channel": "Ch " + vid, "channel_subscribers": subs,
            "duration_seconds": dur_s, "views": views, "likes": likes, "comments": 300, "published_at": age_iso,
            "captions": True, "audio_language": "en", "thumbnail_url": None}


SKILL = {"name": "SQL joins", "concept_type": "concept", "shelf_life_years": 10, "base_hours": 6, "vetted_channels": []}


def test_hard_filter_drops_shorts_tiny_and_low_view_videos():
    cands = [
        _vid("ok", "SQL joins explained for beginners", 1500),
        _vid("short", "SQL joins in 30 seconds #shorts", 30),
        _vid("tiny", "SQL joins quick tip", 120),
        _vid("obscure", "SQL joins explained for beginners", 1500, views=200),
    ]
    kept = [c["video_id"] for c in hard_filter(cands, SKILL, "sql joins tutorial", "en")]
    assert kept == ["ok"]


def test_score_ranks_engaged_authoritative_video_higher_and_handles_missing_signals():
    good = _vid("good", "SQL joins explained inner left right", 1800, views=900000, likes=45000, subs=2_000_000)
    weak = _vid("weak", "SQL joins explained inner left right", 1800, views=1500, likes=5, subs=900)
    ranked = score_candidates([weak, good], SKILL, "sql joins tutorial", "en")
    assert ranked[0]["video_id"] == "good" and ranked[0]["score"] > ranked[1]["score"]
    # yt-dlp style record: no likes/subscribers/date/captions — must still score without crashing
    bare = _vid("bare", "SQL joins explained inner left right", 1800, likes=None, subs=None, age_iso=None)
    bare.update(comments=None, captions=None, audio_language=None)
    out = score_candidates([bare], SKILL, "sql joins tutorial", "en")
    assert 0 <= out[0]["score"] <= 100 and out[0]["components"]["recency"] is None


def test_blueprint_match_is_computed_from_named_duties_not_the_judges_opinion():
    from app.modules.roadmap_engine.blueprint import accept_match
    skills = ["Policy Brief Writing", "Stakeholder Interviews", "Power BI Dashboards", "Impact Evaluation", "Legislative Mapping"]

    def duty(skill, covered=True):
        return {"duty": "x", "covered": covered, "skill": skill}

    # 5/5 duties covered by real blueprint skills -> accepted
    assert accept_match({"duties": [duty(s) for s in skills]}, skills) is True
    # 4/5 = 80% is the floor
    assert accept_match({"duties": [duty(s) for s in skills[:4]] + [duty(None, False)]}, skills) is True
    # 3/5 = 60% -> rejected (the Strategy Consultant vs Policy Research case)
    assert accept_match({"duties": [duty(s) for s in skills[:3]] + [duty(None, False)] * 2}, skills) is False
    # judge claims "covered" but names a skill the blueprint does not have -> does not count
    assert accept_match({"duties": [duty("Market Sizing") for _ in range(5)]}, skills) is False
    # skill names are matched case-insensitively
    assert accept_match({"duties": [duty(s.upper()) for s in skills]}, skills) is True
    # too few duties to judge, malformed, or empty -> rejected
    assert accept_match({"duties": [duty(skills[0])] * 3}, skills) is False
    assert accept_match({"duties": "all of them"}, skills) is False
    assert accept_match({"same_role": True, "coverage_pct": 95}, skills) is False     # old self-reported shape is ignored
    assert accept_match({}, skills) is False


def test_dead_or_unauthorised_model_is_skipped_not_fatal():
    import httpx
    from app.modules.roadmap_engine import llm

    def status_error(code):
        req = httpx.Request("POST", "https://x")
        return httpx.HTTPStatusError("e", request=req, response=httpx.Response(code, request=req))

    assert llm._should_fail_over(status_error(404)) and llm._should_fail_over(status_error(403))
    assert llm._should_fail_over(status_error(503)) and llm._should_fail_over(status_error(413))
    assert not llm._should_fail_over(status_error(400))       # our own bad request must surface, not be masked


# ── provider failover (roadmap_engine.llm) ────────────────────────────────────

class _Msg:
    def __init__(self, content):
        self.content = content


class _Fake:
    def __init__(self, name, behaviour):
        self.name, self.behaviour, self.calls = name, behaviour, 0

    async def complete(self, **kwargs):
        self.calls += 1
        if isinstance(self.behaviour, Exception):
            raise self.behaviour
        return _Msg(self.behaviour)


def _patch_llm(monkeypatch, fakes, waits):
    import asyncio as _asyncio
    from app.modules.roadmap_engine import llm

    monkeypatch.setattr(llm, "_providers", lambda effort, tier="cheap": [(f.name, f) for f in fakes])
    monkeypatch.setattr(llm, "_tripped_until", 0.0)

    async def _no_sleep(seconds):
        waits.append(seconds)

    monkeypatch.setattr(llm.asyncio, "sleep", _no_sleep)
    return llm


def test_rate_limited_primary_fails_over_to_second_provider_without_waiting(monkeypatch):
    import asyncio
    from app.ai.providers.groq import RateLimitedError

    waits = []
    groq, gemini = _Fake("groq", RateLimitedError("quota")), _Fake("gemini", "from-gemini")
    llm = _patch_llm(monkeypatch, [groq, gemini], waits)
    out = asyncio.run(llm.complete("sys", "prompt", 100, 0.1))
    assert out.content == "from-gemini" and groq.calls == 1 and gemini.calls == 1
    assert waits == []                      # failover is immediate — no 75 s sleep


def test_non_provider_errors_are_not_masked_by_failover(monkeypatch):
    import asyncio

    waits = []
    groq, gemini = _Fake("groq", ValueError("bad request")), _Fake("gemini", "unused")
    llm = _patch_llm(monkeypatch, [groq, gemini], waits)
    try:
        asyncio.run(llm.complete("sys", "prompt", 100, 0.1))
        raised = False
    except ValueError:
        raised = True
    assert raised and gemini.calls == 0


def test_all_providers_rate_limited_waits_then_trips_breaker(monkeypatch):
    import asyncio
    from app.ai.providers.groq import RateLimitedError

    waits = []
    groq, gemini = _Fake("groq", RateLimitedError("quota")), _Fake("gemini", RateLimitedError("quota"))
    llm = _patch_llm(monkeypatch, [groq, gemini], waits)
    try:
        asyncio.run(llm.complete("sys", "prompt", 100, 0.1))
        raised = False
    except RateLimitedError:
        raised = True
    assert raised and len(waits) == llm.MAX_WAITS
    assert groq.calls == gemini.calls == llm.MAX_WAITS + 1
    assert llm.quota_tripped()

    calls_before = groq.calls + gemini.calls
    try:
        asyncio.run(llm.complete("sys", "prompt", 100, 0.1))
    except RateLimitedError:
        pass
    assert groq.calls + gemini.calls == calls_before      # breaker open: fails fast, no provider hit


def test_strong_tier_uses_strong_gemini_model_and_prefer_overrides_order(monkeypatch):
    """Drafting must not run on the cheap model, and a re-draft can force a specific provider first."""
    from app.modules.roadmap_engine import llm

    class _S:
        gemini_api_key = "x"
        roadmap_llm_primary = "groq"
        gemini_model = "cheap-model"
        gemini_strong_model = "strong-model"
        gemini_strong_fallback_models = "fallback-a, fallback-b ,strong-model"

    monkeypatch.setattr(llm, "get_settings", lambda: _S())
    import app.ai.providers.gemini as gem_mod
    monkeypatch.setattr(gem_mod, "get_settings", lambda: _S())
    import app.ai.providers as prov
    monkeypatch.setattr(prov, "create_provider", lambda reasoning_effort=None: object())

    names = {t: [n for n, _ in llm._providers(None, t)] for t in ("cheap", "strong")}
    assert names["cheap"] == ["groq", "gemini"]                     # cheap tier has no model chain
    # strong tier: each extra Gemini model has its own daily quota; the strong model itself is not repeated
    assert names["strong"] == ["groq", "gemini", "gemini:fallback-a", "gemini:fallback-b"]
    gem_cheap = dict(llm._providers(None, "cheap"))["gemini"]
    gem_strong = dict(llm._providers(None, "strong"))["gemini"]
    assert gem_cheap.model == "cheap-model" and gem_strong.model == "strong-model"

    with llm.prefer("gemini"):
        assert [n for n, _ in llm._providers(None, "strong")] == ["gemini", "gemini:fallback-a", "gemini:fallback-b", "groq"]
    assert [n for n, _ in llm._providers(None, "strong")][0] == "groq"               # override is scoped


def test_missing_search_queries_are_derived_not_fatal():
    g = normalise_graph({
        "phases": [{"id": "phase-1", "name": "P", "gate": {"type": "quiz", "description": "d"}}],
        "skills": [
            {"id": "mock-interview", "name": "Mock Interview Practice", "phase": "phase-1", "base_hours": 4, "why_for_role": "w"},
            {"id": "sql", "name": "SQL joins", "core_topic": "SQL", "phase": "phase-1", "base_hours": 4, "why_for_role": "w"},
        ],
    })
    by_id = {s["id"]: s for s in g["skills"]}
    assert by_id["mock-interview"]["search_queries"] == ["Mock Interview Practice tutorial for beginners"]
    assert by_id["sql"]["search_queries"] == ["SQL tutorial for beginners"]          # prefers the short core_topic
    assert not any("search_queries" in e for e in validate_graph(g))


def test_timeouts_and_dropped_connections_fail_over():
    import httpx
    from app.modules.roadmap_engine import llm
    assert llm._should_fail_over(httpx.ReadTimeout(""))              # empty-message timeout aborted drafts before
    assert llm._should_fail_over(httpx.RemoteProtocolError("Server disconnected without sending a response."))
    assert llm._should_fail_over(httpx.ConnectError("x"))
    assert not llm._should_fail_over(ValueError("our own bug"))


def test_judge_cannot_inflate_coverage_by_dropping_duties():
    from app.modules.roadmap_engine.blueprint import accept_match
    skills = ["A", "B", "C", "D", "E", "F"]
    covered_four = {"duties": [{"duty": "x", "covered": True, "skill": s} for s in skills[:4]]}     # judge only returned 4 duties
    assert accept_match(covered_four, skills) is True                                                # no fixed list: 4/4
    assert accept_match(covered_four, skills, expected_duties=6) is False                            # fixed list of 6: 4/6 = 67%
    five_of_six = {"duties": [{"duty": "x", "covered": True, "skill": s} for s in skills[:5]] + [{"duty": "y", "covered": False, "skill": None}]}
    assert accept_match(five_of_six, skills, expected_duties=6) is True                              # 5/6 = 83% >= 80%


def test_targeted_repair_fills_empty_phases_and_missing_text_without_losing_work():
    from app.modules.roadmap_engine.schema import apply_repair, validate_graph_skeleton

    def sk(i, phase, why="needed"):
        return {"id": i, "name": f"Skill {i}", "phase": phase, "prerequisites": [], "base_hours": 5, "why_for_role": why,
                "search_queries": ["q"], "proof": {"type": "project", "title": f"proof {i}", "brief": "b", "rubric": ["r"]}}

    phases = [{"id": f"phase-{n}", "name": f"P{n}", "goal": "g", "gate": {"type": "quiz", "description": "d", "pass_criteria": ["c"]}} for n in range(1, 5)]
    # 8 skills spread over phases 1-2 only, one missing its "why"
    skills = [sk(f"s{i}", "phase-1" if i < 4 else "phase-2", why="" if i == 2 else "needed") for i in range(8)]
    graph = normalise_graph({"phases": phases, "skills": skills, "job_ready_definition": ["x"]})
    graph["skills"][0]["references"] = [{"title": "kept", "url": "https://x.gov.in"}]
    before = validate_graph_skeleton(graph)
    assert any("Phase 'P3' has no skills" in e for e in before) and any("no why_for_role" in e for e in before)

    patch = {
        "add_skills": [sk("capstone", "phase-3"), sk("interview-prep", "phase-4"), sk("s0", "phase-4")],   # last one duplicates an id
        "fix_skills": {"s2": {"why_for_role": "Real day-to-day need"}, "ghost": {"why_for_role": "ignored"}},
    }
    fixed = apply_repair(graph, patch)
    assert validate_graph_skeleton(fixed) == []
    by_id = {s["id"]: s for s in fixed["skills"]}
    assert by_id["s2"]["why_for_role"] == "Real day-to-day need"
    assert "ghost" not in by_id and len(fixed["skills"]) == 10                       # duplicate id not added twice
    assert by_id["s0"]["references"] and by_id["s0"]["proof"]["title"] == "proof s0"   # earlier work preserved
    # a garbage patch is ignored rather than trusted
    assert [s["id"] for s in apply_repair(graph, "not a dict")["skills"]] == [s["id"] for s in graph["skills"]]
