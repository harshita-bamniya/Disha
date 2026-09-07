"""Unit tests for the KRS scoring engine.

Run with: pytest tests/test_krs_scoring.py -v
"""
import pytest
from unittest.mock import MagicMock

from app.modules.krs import scoring, matching
from app.modules.recommendations.ranker import _skill_overlap_pct


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_profile(**kwargs):
    p = MagicMock()
    p.highest_stage_cleared = kwargs.get("highest_stage_cleared", "none")
    p.years_preparing = kwargs.get("years_preparing", 0)
    p.upsc_exam = kwargs.get("upsc_exam", "cse")
    p.highest_qualification = kwargs.get("highest_qualification", "graduate")
    p.has_work_experience = kwargs.get("has_work_experience", False)
    p.work_experience_years = kwargs.get("work_experience_years", 0)
    p.skills = kwargs.get("skills", [])
    return p


def make_psych(confidence: int, burnout: int):
    p = MagicMock()
    p.confidence_index = confidence
    p.burnout_score = burnout
    return p


def make_track(required_skills: list, min_k_score: int = 0):
    t = MagicMock()
    t.required_skills = required_skills
    t.min_k_score = min_k_score
    return t


# ── K-score tests ─────────────────────────────────────────────────────────────

class TestKScore:
    def test_fresh_aspirant_low_score(self):
        profile = make_profile(highest_stage_cleared="none", years_preparing=0)
        score = scoring.compute_k_score(profile)
        assert score < 30

    def test_prelims_cleared_moderate(self):
        profile = make_profile(highest_stage_cleared="prelims", years_preparing=2)
        score = scoring.compute_k_score(profile)
        assert 30 <= score <= 60

    def test_mains_cleared_high(self):
        profile = make_profile(highest_stage_cleared="mains", years_preparing=4)
        score = scoring.compute_k_score(profile)
        assert score >= 50

    def test_interview_cleared_highest(self):
        profile = make_profile(highest_stage_cleared="interview", years_preparing=6)
        score = scoring.compute_k_score(profile)
        assert score >= 70

    def test_score_bounded_0_to_100(self):
        profile = make_profile(highest_stage_cleared="interview", years_preparing=10)
        score = scoring.compute_k_score(profile)
        assert 0 <= score <= 100

    def test_state_pcs_lower_than_cse(self):
        cse_profile = make_profile(upsc_exam="cse", highest_stage_cleared="prelims", years_preparing=2)
        pcs_profile = make_profile(upsc_exam="state_pcs", highest_stage_cleared="prelims", years_preparing=2)
        assert scoring.compute_k_score(cse_profile) >= scoring.compute_k_score(pcs_profile)


# ── R-score tests ─────────────────────────────────────────────────────────────

class TestRScore:
    def test_no_experience_low_score(self):
        profile = make_profile(
            highest_qualification="graduate",
            has_work_experience=False,
            skills=[]
        )
        score = scoring.compute_r_score(profile)
        assert score < 50

    def test_experienced_postgrad_high_score(self):
        profile = make_profile(
            highest_qualification="post_graduate",
            has_work_experience=True,
            work_experience_years=5,
            skills=["Analytical Reasoning", "Research & Analysis", "Leadership",
                    "Communication", "Project Management", "Economics", "Data Analysis"]
        )
        score = scoring.compute_r_score(profile)
        assert score >= 70

    def test_psychology_boosts_score(self):
        profile = make_profile(
            highest_qualification="graduate",
            has_work_experience=False,
            skills=["Communication", "Leadership"]
        )
        psych_good = make_psych(confidence=90, burnout=10)
        psych_bad = make_psych(confidence=20, burnout=80)

        score_good = scoring.compute_r_score(profile, psych_good)
        score_bad = scoring.compute_r_score(profile, psych_bad)
        assert score_good > score_bad

    def test_score_bounded(self):
        profile = make_profile(
            highest_qualification="doctorate",
            has_work_experience=True,
            work_experience_years=10,
            skills=[f"Skill {i}" for i in range(15)]
        )
        score = scoring.compute_r_score(profile)
        assert 0 <= score <= 100


# ── S-score tests ─────────────────────────────────────────────────────────────

class TestSScore:
    def test_no_skills_zero(self):
        profile = make_profile(skills=[])
        assert scoring.compute_s_score(profile) == 0

    def test_high_demand_skills_higher_score(self):
        # Without a DB, compute_s_score falls back to breadth-only scoring.
        # More skills = higher breadth score.
        more_skills = make_profile(skills=["Analytical Reasoning", "Research & Analysis", "Data Analysis", "Leadership", "Communication", "Economics", "Ethics & Integrity"])
        fewer_skills = make_profile(skills=["History"])
        assert scoring.compute_s_score(more_skills) > scoring.compute_s_score(fewer_skills)

    def test_unknown_skill_gets_default_weight(self):
        profile = make_profile(skills=["Some Random Skill"])
        score = scoring.compute_s_score(profile)
        assert 0 <= score <= 100

    def test_score_bounded(self):
        # Use many skills to exercise the boundary
        many_skills = [f"Skill {i}" for i in range(20)]
        profile = make_profile(skills=many_skills)
        score = scoring.compute_s_score(profile)
        assert 0 <= score <= 100


# ── Composite tests ───────────────────────────────────────────────────────────

class TestComposite:
    def test_weighted_average(self):
        result = scoring.compute_composite(k=80, r=60, s=40)
        # 80*0.40 + 60*0.35 + 40*0.25 = 32 + 21 + 10 = 63
        assert result == 63

    def test_all_100(self):
        assert scoring.compute_composite(100, 100, 100) == 100

    def test_all_zero(self):
        assert scoring.compute_composite(0, 0, 0) == 0

    def test_compute_all_returns_all_scores(self):
        profile = make_profile(
            highest_stage_cleared="mains",
            years_preparing=3,
            highest_qualification="graduate",
            skills=["Communication", "Leadership"]
        )
        result = scoring.compute_all(profile)
        assert set(result.keys()) == {"k_score", "r_score", "s_score", "composite"}
        for v in result.values():
            assert 0 <= v <= 100


# ── Matching tests ────────────────────────────────────────────────────────────

class TestMatching:
    def test_full_overlap(self):
        user_skills = {"Python", "Data Analysis", "Communication"}
        required = ["Python", "Data Analysis", "Communication"]
        assert _skill_overlap_pct(user_skills, required) == 100

    def test_zero_overlap(self):
        user_skills = {"Python", "JavaScript"}
        required = ["Leadership", "Economics"]
        assert _skill_overlap_pct(user_skills, required) == 0

    def test_partial_overlap(self):
        user_skills = {"Python", "Communication"}
        required = ["Python", "Communication", "Leadership"]
        # 2/3 matched = 67%
        assert _skill_overlap_pct(user_skills, required) == 67

    def test_case_insensitive_match(self):
        user_skills = {"PYTHON", "data analysis"}
        required = ["python", "Data Analysis"]
        assert _skill_overlap_pct(user_skills, required) == 100

    def test_empty_required_returns_100(self):
        user_skills = {"anything"}
        assert _skill_overlap_pct(user_skills, []) == 100

    def test_krs_fit_above_threshold_full_credit(self):
        fit = matching._krs_fit(k_score=80, min_k=60)
        assert fit >= 80

    def test_krs_fit_below_threshold_partial(self):
        fit = matching._krs_fit(k_score=30, min_k=60)
        assert fit < 80

    def test_krs_fit_zero_threshold_always_100(self):
        assert matching._krs_fit(k_score=0, min_k=0) == 100

    def test_rank_tracks_returns_top_n(self):
        profile = make_profile(skills=["Leadership", "Communication"])
        tracks = [make_track(["Leadership", "Communication"]), make_track(["Python", "SQL"])]
        results = matching.rank_tracks(profile, tracks, k_score=60, top_n=1)
        assert len(results) == 1

    def test_rank_tracks_sorted_descending(self):
        profile = make_profile(skills=["Leadership", "Communication"])
        t1 = make_track(["Leadership", "Communication"])
        t2 = make_track(["Python", "SQL"])
        results = matching.rank_tracks(profile, [t2, t1], k_score=60, top_n=2)
        assert results[0][1] >= results[1][1]  # First has higher match score
