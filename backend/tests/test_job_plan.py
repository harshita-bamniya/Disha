"""Unit tests for the job-specific learning plan module.

Covers the deterministic logic in jobs/plan_generator.py and jobs/plan_router.py
that previously had zero automated coverage — JSON repair, URL fixing, gap-skill
mastery filtering, interaction-history summarization, XP-award guards, the
scraping-pipeline circuit breaker, and the regenerate cooldown. No real Groq
calls, no real network calls, no real Redis — everything here runs in seconds
and is safe for CI.

Run with: pytest tests/test_job_plan.py -v
"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from app.modules.jobs import plan_generator, plan_router


# ─────────────────────────────────────────────────────────────────────────────
# _extract_json / _repair_truncated_json
# ─────────────────────────────────────────────────────────────────────────────

class TestExtractJson:
    def test_plain_json(self):
        assert plan_generator._extract_json('{"a": 1}') == {"a": 1}

    def test_markdown_fenced_json(self):
        raw = '```json\n{"a": 1, "b": [1, 2]}\n```'
        assert plan_generator._extract_json(raw) == {"a": 1, "b": [1, 2]}

    def test_no_json_object_raises(self):
        with pytest.raises(ValueError):
            plan_generator._extract_json("not json at all")

    def test_truncated_mid_generation_is_repaired(self):
        # A `}` exists (closing the nested "b" object) but the outer object and
        # the "d" array are both cut off before the response finished — this is
        # the actual max_tokens-truncation shape, not just a missing final brace.
        raw = '{"a": 1, "b": {"c": 2}, "d": [1, 2'
        assert plan_generator._extract_json(raw) == {"a": 1, "b": {"c": 2}, "d": [1, 2]}


class TestRepairTruncatedJson:
    def test_truncated_mid_array(self):
        repaired = plan_generator._repair_truncated_json('{"a": 1, "b": [1, 2, 3')
        assert repaired == {"a": 1, "b": [1, 2, 3]}

    def test_truncated_mid_string_value_drops_incomplete_field(self):
        repaired = plan_generator._repair_truncated_json('{"a": 1, "title": "Some incomplete tit')
        assert repaired == {"a": 1}

    def test_balanced_but_invalid_json_returns_none(self):
        # Brackets already balance — this isn't a truncation, it's a real
        # syntax error (trailing comma), so the repair should not attempt it.
        assert plan_generator._repair_truncated_json('{"a": 1,}') is None


# ─────────────────────────────────────────────────────────────────────────────
# URL fixing
# ─────────────────────────────────────────────────────────────────────────────

class TestBuildArticleUrl:
    def test_known_source_uses_its_search_template(self):
        url = plan_generator._build_article_url({
            "channel_or_source": "GeeksforGeeks",
            "search_query": "python basics",
        })
        assert url == "https://www.geeksforgeeks.org/search/?q=python+basics"

    def test_unknown_source_falls_back_to_google(self):
        url = plan_generator._build_article_url({
            "channel_or_source": "SomeRandomBlog",
            "search_query": "foo bar",
        })
        assert url == "https://www.google.com/search?q=foo+bar"

    def test_uses_title_when_no_search_query(self):
        url = plan_generator._build_article_url({
            "channel_or_source": "Investopedia",
            "title": "What is inflation",
        })
        assert "investopedia.com" in url
        assert "What+is+inflation" in url


class TestFixYoutubeUrls:
    def test_sets_youtube_and_article_urls(self):
        plan = {
            "modules": [{
                "resources": [
                    {"type": "youtube", "search_query": "sql tutorial"},
                    {"type": "article", "channel_or_source": "HBR", "search_query": "leadership"},
                ]
            }]
        }
        fixed = plan_generator._fix_youtube_urls(plan)
        yt, article = fixed["modules"][0]["resources"]
        assert yt["url"] == "https://www.youtube.com/results?search_query=sql+tutorial"
        assert "hbr.org" in article["url"]


# ─────────────────────────────────────────────────────────────────────────────
# Plan helpers: counts, staleness, quiz-answer redaction
# ─────────────────────────────────────────────────────────────────────────────

def _resource(type_="youtube", **kw):
    return {"type": type_, **kw}


class TestPlanHelpers:
    def test_count_youtube_and_article_resources(self):
        plan = {"modules": [
            {"resources": [_resource("youtube"), _resource("article"), _resource("youtube")]},
            {"resources": [_resource("course")]},
        ]}
        assert plan_generator.count_youtube_resources(plan) == 2
        assert plan_generator.count_article_resources(plan) == 2  # article + course

    def test_is_plan_stale_true_when_youtube_missing_video_options(self):
        plan = {"modules": [{"resources": [_resource("youtube")]}]}
        assert plan_generator.is_plan_stale(plan) is True

    def test_is_plan_stale_false_when_enriched(self):
        plan = {"modules": [{"resources": [_resource("youtube", video_options=[{"video_id": "x"}])]}]}
        assert plan_generator.is_plan_stale(plan) is False

    def test_is_plan_stale_false_for_none(self):
        assert plan_generator.is_plan_stale(None) is False

    def test_redact_quiz_answers_strips_correct_answer_and_explanation(self):
        plan = {"modules": [{"quiz": {"questions": [
            {"id": "q1", "text": "?", "correct_option_id": "a", "explanation": "because"},
        ]}}]}
        redacted = plan_generator.redact_quiz_answers(plan)
        q = redacted["modules"][0]["quiz"]["questions"][0]
        assert "correct_option_id" not in q
        assert "explanation" not in q
        # Original must be untouched — this is used to prepare a response,
        # not to mutate what's stored.
        assert plan["modules"][0]["quiz"]["questions"][0]["correct_option_id"] == "a"

    def test_redact_quiz_answers_none_passthrough(self):
        assert plan_generator.redact_quiz_answers(None) is None


# ─────────────────────────────────────────────────────────────────────────────
# Scraping-pipeline circuit breaker (Phase: production hardening)
# ─────────────────────────────────────────────────────────────────────────────

def _youtube_module(n: int) -> dict:
    return {
        "skill": "SQL",
        "resources": [
            {"id": f"res-{i}", "type": "youtube", "title": f"Video {i}", "search_query": f"sql tutorial {i}"}
            for i in range(n)
        ],
    }


class TestEnrichmentCircuitBreaker:
    @pytest.mark.asyncio
    async def test_stops_calling_after_threshold_consecutive_failures(self):
        """A broken yt-dlp pipeline (network block, markup change) should not
        be retried for every remaining resource in the plan — that's the
        exact outage where inflating latency hurts most."""
        call_count = {"n": 0}

        async def failing_search(query, n=2):
            call_count["n"] += 1
            return []  # yt-dlp found nothing — simulates a broken extractor

        plan = {"modules": [_youtube_module(5)]}
        with patch.object(plan_generator, "search_youtube", side_effect=failing_search):
            await plan_generator.enrich_plan_with_real_videos(plan)

        # Threshold is 3 — the breaker should trip and skip the remaining 2.
        assert call_count["n"] == plan_generator._EnrichmentCircuitBreaker.THRESHOLD

    @pytest.mark.asyncio
    async def test_success_resets_the_failure_count(self):
        results = iter([[], [], {"video_id": "v1", "title": "Real Video", "url": "https://youtube.com/watch?v=v1", "duration_minutes": 10}, [], [], []])

        async def flaky_search(query, n=2):
            r = next(results)
            return [r] if r else []

        plan = {"modules": [_youtube_module(6)]}
        with patch.object(plan_generator, "search_youtube", side_effect=flaky_search):
            await plan_generator.enrich_plan_with_real_videos(plan)

        # One success in the middle should reset the consecutive-failure count,
        # so the breaker shouldn't trip from only 2-then-2 failures either side.
        resolved = [r for r in plan["modules"][0]["resources"] if r.get("video_options")]
        assert len(resolved) == 1

    @pytest.mark.asyncio
    async def test_high_failure_rate_reports_to_sentry(self):
        async def failing_search(query, n=2):
            return []

        plan = {"modules": [_youtube_module(4)]}
        with patch.object(plan_generator, "search_youtube", side_effect=failing_search), \
             patch.object(plan_generator.sentry_sdk, "capture_message") as mock_capture:
            await plan_generator.enrich_plan_with_real_videos(plan)

        assert mock_capture.called
        assert mock_capture.call_args.kwargs.get("level") == "warning"

    @pytest.mark.asyncio
    async def test_low_failure_rate_does_not_report_to_sentry(self):
        async def mostly_ok_search(query, n=2):
            return [{"video_id": "v", "title": "T", "url": "https://youtube.com/watch?v=v", "duration_minutes": 5}]

        plan = {"modules": [_youtube_module(4)]}
        with patch.object(plan_generator, "search_youtube", side_effect=mostly_ok_search), \
             patch.object(plan_generator.sentry_sdk, "capture_message") as mock_capture:
            await plan_generator.enrich_plan_with_real_videos(plan)

        assert not mock_capture.called


# ─────────────────────────────────────────────────────────────────────────────
# plan_router: tokenize / mastered-skill matching / interaction history
# ─────────────────────────────────────────────────────────────────────────────

class TestTokenize:
    def test_splits_on_space_hyphen_slash_comma(self):
        assert plan_router._tokenize("MS-Excel/VBA, Reporting") == {"ms", "excel", "vba", "reporting"}

    def test_lowercases_and_strips(self):
        assert plan_router._tokenize("  Data Analysis  ") == {"data", "analysis"}


class TestIsSkillMastered:
    def test_exact_token_match_is_mastered(self):
        tokens = [plan_router._tokenize("Data Analysis")]
        assert plan_router._is_skill_mastered("Data Analysis", tokens) is True

    def test_no_overlap_is_not_mastered(self):
        tokens = [plan_router._tokenize("Data Analysis")]
        assert plan_router._is_skill_mastered("Leadership", tokens) is False

    def test_partial_overlap_below_threshold_is_not_mastered(self):
        # "stakeholder" overlaps but "management" vs "engagement" doesn't —
        # 1/2 = 0.5, below the 0.6 threshold.
        tokens = [plan_router._tokenize("Stakeholder Engagement")]
        assert plan_router._is_skill_mastered("Stakeholder Management", tokens) is False

    def test_empty_gap_skill_is_never_mastered(self):
        assert plan_router._is_skill_mastered("", [plan_router._tokenize("SQL")]) is False


class TestSummarizeInteractionHistory:
    def test_passed_and_failed_and_rejected_video_all_summarized(self):
        old_modules = [
            {
                "id": "mod-1", "skill": "Stakeholder Engagement",
                "resources": [{"id": "mod-1-res-1", "title": "Intro Video"}],
            },
            {
                "id": "mod-2", "skill": "Data Analysis",
                "resources": [{"id": "mod-2-res-1", "title": "Data Analysis Basics"}],
            },
        ]
        progress = {
            "quiz_mod-1": {"passed": True, "score_pct": 85},
            "quiz_mod-2": {"passed": False, "score_pct": 40},
            "mod-1-res-1": {"video_rating": {"rating": "not_relevant"}},
        }
        text, passed_skills = plan_router._summarize_interaction_history(old_modules, progress)

        assert passed_skills == {"stakeholder engagement"}
        assert "Stakeholder Engagement: quiz passed (85%)" in text
        assert "Data Analysis: quiz failed (40%)" in text
        assert "Data Analysis Basics" in text  # prior resource titles surfaced for a different angle
        assert 'marked "Intro Video" as not relevant' in text

    def test_no_progress_returns_none_and_empty_set(self):
        old_modules = [{"id": "mod-1", "skill": "SQL", "resources": []}]
        text, passed_skills = plan_router._summarize_interaction_history(old_modules, {})
        assert text is None
        assert passed_skills == set()


# ─────────────────────────────────────────────────────────────────────────────
# XP-award guards (first-time-only, not a re-award farm)
# ─────────────────────────────────────────────────────────────────────────────

class TestXpGuards:
    @pytest.mark.parametrize("passed,already_passed,expected", [
        (True, False, True),
        (True, True, False),
        (False, False, False),
        (False, True, False),
    ])
    def test_quiz_xp_awardable(self, passed, already_passed, expected):
        assert plan_router._quiz_xp_awardable(passed, already_passed) is expected

    @pytest.mark.parametrize("done,was_done,expected", [
        (True, False, True),
        (True, True, False),
        (False, False, False),
        (False, True, False),
    ])
    def test_resource_xp_awardable(self, done, was_done, expected):
        assert plan_router._resource_xp_awardable(done, was_done) is expected


# ─────────────────────────────────────────────────────────────────────────────
# Regenerate cooldown (Redis-backed, per user+job, fails open)
# ─────────────────────────────────────────────────────────────────────────────

class FakeRedis:
    """Minimal in-memory stand-in for the two Redis calls the cooldown uses."""

    def __init__(self):
        self.store: dict[str, str] = {}

    def set(self, key, value, nx=False, ex=None):
        if nx and key in self.store:
            return False
        self.store[key] = value
        return True

    def ttl(self, key):
        return 42 if key in self.store else -2


class TestRegenerateCooldown:
    def test_first_call_succeeds_second_is_blocked(self):
        fake = FakeRedis()
        with patch.object(plan_router, "_redis", return_value=fake):
            first = plan_router._check_and_set_regenerate_cooldown("user-1", "job-1")
            second = plan_router._check_and_set_regenerate_cooldown("user-1", "job-1")
        assert first is None
        assert second == 42

    def test_different_job_is_independent(self):
        fake = FakeRedis()
        with patch.object(plan_router, "_redis", return_value=fake):
            plan_router._check_and_set_regenerate_cooldown("user-1", "job-1")
            other_job = plan_router._check_and_set_regenerate_cooldown("user-1", "job-2")
        assert other_job is None

    def test_different_user_is_independent(self):
        fake = FakeRedis()
        with patch.object(plan_router, "_redis", return_value=fake):
            plan_router._check_and_set_regenerate_cooldown("user-1", "job-1")
            other_user = plan_router._check_and_set_regenerate_cooldown("user-2", "job-1")
        assert other_user is None

    def test_redis_unavailable_fails_open(self):
        with patch.object(plan_router, "_redis", side_effect=RuntimeError("connection refused")):
            result = plan_router._check_and_set_regenerate_cooldown("user-1", "job-1")
        # A cache outage must never block plan generation.
        assert result is None
