"""Phase 3 interview rules: flow policy, code-computed scoring, wording rules,
safety net and the counselling firewall. Pure unit tests (no database).
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.modules.counsellor.interview_tone import interview_tone
from app.modules.interview import policy, scoring
from app.modules.interview.safety import assess_answer

# ── policy ────────────────────────────────────────────────────────────────────


def _decide(llm="follow_up", text=True, **kw):
    base = dict(
        main_remaining=3, followups_used_total=0, followup_cap=2,
        already_probed=False, elapsed_sec=60, hard_limit_sec=900,
    )
    base.update(kw)
    return policy.choose_action(llm, text, **base)


class TestChooseAction:
    def test_allows_a_probe_when_everything_permits(self):
        assert _decide().action == "follow_up"
        assert _decide(llm="challenge").action == "challenge"

    def test_model_suggestion_without_text_is_ignored(self):
        assert _decide(text=False).action == "next_question"

    def test_one_probe_per_question(self):
        d = _decide(already_probed=True)
        assert (d.action, d.reason) == ("next_question", "probe_cap_per_question")

    def test_total_probe_cap(self):
        d = _decide(followups_used_total=2, followup_cap=2)
        assert (d.action, d.reason) == ("next_question", "probe_cap_total")

    def test_no_probe_when_time_is_nearly_up(self):
        d = _decide(elapsed_sec=900 - 10)
        assert (d.action, d.reason) == ("next_question", "low_time")

    def test_hard_time_limit_closes_even_mid_interview(self):
        d = _decide(elapsed_sec=900)
        assert (d.action, d.reason) == ("close", "time_limit")

    def test_closes_when_planned_questions_are_done(self):
        d = _decide(llm="next_question", text=False, main_remaining=0)
        assert (d.action, d.reason) == ("close", "coverage_complete")

    def test_last_question_can_still_be_probed_once(self):
        assert _decide(main_remaining=0).action == "follow_up"

    def test_blocked_probe_on_last_question_closes(self):
        assert _decide(main_remaining=0, already_probed=True).action == "close"

    def test_unknown_elapsed_time_does_not_block(self):
        assert _decide(elapsed_sec=None).action == "follow_up"


class TestBudgets:
    def test_followups_do_not_use_the_question_budget(self):
        responses = [SimpleNamespace(is_followup=f) for f in (False, True, False, True, False)]
        assert policy.main_answered(responses) == 3
        assert policy.followups_used(responses) == 2

    def test_caps_scale_with_session_size(self):
        assert policy.followup_cap_total(5) == 2
        assert policy.followup_cap_total(8) == 4
        assert policy.followup_cap_total(1) == 1
        assert policy.max_responses(8) == 12

    def test_hard_limit_depends_on_session_type(self):
        assert policy.hard_limit_seconds("practice") == 900
        assert policy.hard_limit_seconds("full_mock") == 1800
        assert policy.hard_limit_seconds("unknown") == 900


class TestPickNextQuestion:
    def _q(self, qid, difficulty):
        return SimpleNamespace(id=qid, difficulty=difficulty)

    def test_easy_to_hard_by_default_so_the_candidate_starts_with_a_win(self):
        qs = [self._q("a", "hard"), self._q("b", "easy"), self._q("c", "medium")]
        assert policy.pick_next_question(qs, None).id == "b"
        assert policy.pick_next_question(qs, "gradual easy to hard").id == "b"

    def test_hard_first_ramp_is_respected(self):
        qs = [self._q("a", "hard"), self._q("b", "easy")]
        assert policy.pick_next_question(qs, "hard to easy").id == "a"

    def test_ties_follow_generation_order_not_chance(self):
        qs = [self._q("x", "medium"), self._q("y", "medium")]
        assert policy.pick_next_question(qs, None, ["y", "x"]).id == "y"
        assert policy.pick_next_question(qs, None, ["x", "y"]).id == "x"

    def test_empty_candidates(self):
        assert policy.pick_next_question([], None) is None


# ── scoring ───────────────────────────────────────────────────────────────────

COMPS = [{"skill": "Policy", "weight": 60}, {"skill": "Communication", "weight": 40}]


def _entry(skill, overall, difficulty="medium", **kw):
    base = dict(
        skill_assessed=skill, overall=overall, difficulty=difficulty, is_fallback=False,
        clarity=overall, conciseness=overall, relevance=overall, impact=overall,
        response="a reasonable answer to the question", judge_disagreement=False, is_followup=False,
    )
    base.update(kw)
    return base


class TestSkillAndOverallScores:
    def test_skill_score_is_a_difficulty_weighted_mean(self):
        entries = [_entry("Policy", 8, "hard"), _entry("Policy", 4, "easy")]
        # (8*1.25 + 4*0.8) / 2.05 * 10
        assert scoring.skill_scores(entries, COMPS)["Policy"] == pytest.approx(64.4, abs=0.1)

    def test_fallback_answers_never_count(self):
        entries = [_entry("Policy", 9), _entry("Policy", 0, is_fallback=True)]
        assert scoring.skill_scores(entries, COMPS)["Policy"] == 90.0

    def test_unassessed_competencies_are_omitted_and_weights_renormalised(self):
        skills = scoring.skill_scores([_entry("Policy", 7)], COMPS)
        assert "Communication" not in skills
        assert scoring.weighted_overall(skills, COMPS) == 70.0

    def test_weighted_overall_uses_competency_weights(self):
        skills = {"Policy": 80.0, "Communication": 40.0}
        assert scoring.weighted_overall(skills, COMPS) == 64.0  # (80*60 + 40*40) / 100

    def test_skill_matching_ignores_case_and_spacing(self):
        assert "Policy" in scoring.skill_scores([_entry("  policy ", 6)], COMPS)

    def test_plain_overall_fallback_when_no_skill_matches(self):
        assert scoring.plain_overall([_entry("Other", 6), _entry("Other", 8)]) == 70.0
        assert scoring.plain_overall([]) is None

    def test_communication_score_is_content_only(self):
        entries = [_entry("Policy", 5, clarity=8, conciseness=6)]
        assert scoring.communication_score(entries) == 70.0

    @pytest.mark.parametrize("score,rec", [(95, "Strong Hire"), (80, "Strong Hire"), (79.9, "Hire"),
                                          (66, "Hire"), (65, "Maybe"), (46, "Maybe"), (45, "No Hire")])
    def test_recommendation_thresholds(self, score, rec):
        assert scoring.recommendation_for(score) == rec


class TestApplyCodeScoring:
    def _report(self, **kw):
        base = {
            "overall_readiness_score": 90, "hiring_recommendation": "Strong Hire",
            "hiring_recommendation_reason": "Great.", "strengths": ["s1", "s2", "s3", "s4", "s5"],
            "critical_gaps": ["g1", "g2", "g3", "g4"], "candidate_summary": "ok",
            "readiness_message": "ok", "confidence_score": 77, "consistency_notes": [],
        }
        base.update(kw)
        return base

    def test_headline_numbers_come_from_the_answers_not_the_model(self):
        report = scoring.apply_code_scoring(self._report(), [_entry("Policy", 5), _entry("Communication", 5)], COMPS)
        assert report["overall_readiness_score"] == 50.0
        assert report["llm_overall_readiness_score"] == 90
        assert report["hiring_recommendation"] == "Maybe"
        assert report["skill_scores"] == {"Policy": 50.0, "Communication": 50.0}

    def test_contradicting_explanation_is_replaced(self):
        report = scoring.apply_code_scoring(self._report(), [_entry("Policy", 5)], COMPS)
        assert "Great." not in report["hiring_recommendation_reason"]
        assert "50" in report["hiring_recommendation_reason"]

    def test_agreeing_explanation_is_kept(self):
        report = scoring.apply_code_scoring(
            self._report(overall_readiness_score=55, hiring_recommendation="Maybe", hiring_recommendation_reason="Decent."),
            [_entry("Policy", 5)], COMPS,
        )
        assert report["hiring_recommendation_reason"] == "Decent."
        assert report["needs_human_review"] is False

    def test_big_gap_between_model_and_code_flags_human_review(self):
        report = scoring.apply_code_scoring(self._report(), [_entry("Policy", 5)], COMPS)
        assert report["needs_human_review"] is True
        assert report["review_reasons"]

    def test_judge_disagreement_flags_human_review(self):
        report = scoring.apply_code_scoring(
            self._report(overall_readiness_score=50, hiring_recommendation="Maybe"),
            [_entry("Policy", 5, judge_disagreement=True)], COMPS,
        )
        assert report["needs_human_review"] is True

    def test_many_unscored_answers_flag_human_review(self):
        entries = [_entry("Policy", 5), _entry("Policy", 0, is_fallback=True)]
        report = scoring.apply_code_scoring(self._report(overall_readiness_score=50, hiring_recommendation="Maybe"), entries, COMPS)
        assert report["needs_human_review"] is True

    def test_confidence_is_no_longer_reported(self):
        report = scoring.apply_code_scoring(self._report(), [_entry("Policy", 5)], COMPS)
        assert report["confidence_score"] == 0

    def test_lists_are_capped_at_three(self):
        report = scoring.apply_code_scoring(self._report(), [_entry("Policy", 5)], COMPS)
        assert len(report["strengths"]) == 3 and len(report["critical_gaps"]) == 3

    def test_no_scorable_answers_leaves_the_model_numbers_alone(self):
        report = scoring.apply_code_scoring(self._report(), [_entry("Policy", 0, is_fallback=True)], COMPS)
        assert report["overall_readiness_score"] == 90

    def test_delivery_signals_are_included_but_never_scored(self):
        entries = [_entry("Policy", 5, response="Um, basically I think maybe we could, you know, try it")]
        d = scoring.apply_code_scoring(self._report(), entries, COMPS)["delivery"]
        assert d["filler_per_100_words"] > 0 and d["hedging_per_100_words"] > 0


class TestWording:
    @pytest.mark.parametrize("raw,clean", [
        ("You failed to quantify impact", "You did not yet succeed to quantify impact"),
        ("Weak structure overall", "Developing structure overall"),
        ("a weakness in costing", "a growth area in costing"),
        ("Poor use of data", "Limited use of data"),
        ("no change needed here", "no change needed here"),
    ])
    def test_discouraging_labels_are_reframed(self, raw, clean):
        assert scoring.sanitize_text(raw) == clean

    def test_does_not_mangle_longer_words(self):
        assert scoring.sanitize_text("Weaken the proposal; poorest districts") == "Weaken the proposal; poorest districts"


# ── safety ────────────────────────────────────────────────────────────────────

class TestSafety:
    @pytest.mark.parametrize("text", [
        "I want to kill myself", "honestly I want to die", "I feel like I will commit suicide",
        "I might end my life", "main marna chahta hoon", "mujhe mar jana chahiye? mar jana chahta hoon",
        "मुझे अब जीना नहीं है, मैं खुद को खत्म करना चाहता हूँ", "मैं मर जाऊं तो अच्छा है", "मैं आत्महत्या करने की सोच रहा हूँ",
        "mujhe jeena nahi hai", "main khudkushi karna chahta hoon", "मुझे खुदकुशी के ख्याल आते हैं",
    ])
    def test_first_person_crisis_halts(self, text):
        assert assess_answer(text).level == "crisis"

    @pytest.mark.parametrize("text", [
        "Farmer suicides remain a serious policy concern and a helpline scheme is needed",
        "I never felt those years were wasted and I never give up",
        "किसानों की आत्महत्या एक गंभीर नीतिगत मुद्दा है", "मैं जीने की कला पर शोध करता हूँ", "मैंने बजट घाटे को खत्म करने की योजना बनाई",
        "I want to kill it in this interview", "my manager would kill himself laughing",
        "I managed a 40 crore district budget",
        "The scheme reduced the risk of people being left behind",
        "",
    ])
    def test_ordinary_answers_are_never_flagged(self, text):
        assert assess_answer(text).level == "none"

    @pytest.mark.parametrize("text", [
        "I can't do this anymore", "I feel so hopeless about all of it", "bahut tension hai mujhe",
        "मुझसे नहीं हो पाएगा", "मैं बहुत टेंशन में हूँ",
    ])
    def test_distress_is_a_softer_level(self, text):
        assert assess_answer(text).level == "distress"

    def test_none_input_is_safe(self):
        assert assess_answer(None).level == "none"

    def test_trigger_phrase_is_truncated(self):
        assert len(assess_answer("I want to die").trigger or "") <= 200


# ── counselling firewall ──────────────────────────────────────────────────────

def _db_with_assessment(burnout, confidence):
    db = MagicMock()
    row = SimpleNamespace(burnout_score=burnout, confidence_index=confidence)
    db.query.return_value.filter.return_value.first.return_value = row
    return db


class TestInterviewTone:
    def test_high_burnout_is_gentle(self):
        assert interview_tone("u", _db_with_assessment(75, 70)) == "gentle"

    def test_low_confidence_is_gentle(self):
        assert interview_tone("u", _db_with_assessment(10, 20)) == "gentle"

    def test_healthy_profile_is_standard(self):
        assert interview_tone("u", _db_with_assessment(20, 80)) == "standard"

    def test_missing_assessment_is_standard(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        assert interview_tone("u", db) == "standard"

    def test_any_error_means_standard(self):
        db = MagicMock()
        db.query.side_effect = RuntimeError("boom")
        assert interview_tone("u", db) == "standard"

    def test_only_a_flag_crosses_the_boundary(self):
        assert interview_tone("u", _db_with_assessment(90, 5)) in {"gentle", "standard"}


class TestInterviewPromptsDoNotReadPsychData:
    def test_candidate_context_builder_has_no_psychological_assessment(self):
        import inspect

        from app.modules.interview.service import session_setup

        source = inspect.getsource(session_setup._build_candidate_context)
        code = "\n".join(l for l in source.splitlines() if not l.strip().startswith("#"))
        assert "PsychologicalAssessment" not in code and "burnout" not in code.lower()


# ── safety net through submit_response ────────────────────────────────────────

from datetime import datetime, timedelta, timezone  # noqa: E402

from app.models.interview import InterviewSafetyEvent, InterviewSession, SessionResponse  # noqa: E402
from app.modules.interview.schemas import SubmitResponseRequest  # noqa: E402
from app.modules.interview.service.interaction import submit_response  # noqa: E402


def _chain(first=None, scalar=None):
    q = MagicMock()
    for name in ("filter", "with_for_update", "order_by", "options", "limit"):
        getattr(q, name).return_value = q
    q.first.return_value = first
    q.scalar.return_value = scalar
    q.all.return_value = []
    return q


def _db(session):
    db = MagicMock()
    queries = {InterviewSession: _chain(first=session), SessionResponse: _chain(first=None)}
    db.query.side_effect = lambda arg: queries.get(arg, _chain(scalar=0))
    return db


def _session():
    return SimpleNamespace(
        id="s1", status="in_progress", started_at=datetime.now(timezone.utc) - timedelta(minutes=3),
        total_questions=5, blueprint={"_question_ids": []}, grading_status=None, responses=[],
    )


USER = SimpleNamespace(id="u1")


class TestSubmitSafety:
    def test_crisis_halts_the_interview_and_stores_no_answer(self):
        session, db = _session(), None
        db = _db(session)
        out = submit_response("s1", SubmitResponseRequest(response_text="honestly I want to kill myself"), USER, db)
        assert out["safety_hold"] is True and out["helplines"] and out["message"]
        assert session.status == "abandoned"
        added = [c.args[0] for c in db.add.call_args_list]
        assert len(added) == 1 and isinstance(added[0], InterviewSafetyEvent)
        assert added[0].triggered_by and "kill myself" in added[0].triggered_by
        assert not any(isinstance(a, SessionResponse) for a in added)

    def test_distress_continues_but_marks_the_answer_unscored(self):
        session = _session()
        db = _db(session)
        out = submit_response("s1", SubmitResponseRequest(response_text="I can't do this anymore, sorry"), USER, db)
        assert out["distress"] is True and "safety_hold" not in out
        assert session.status == "in_progress"
        assert session.blueprint["_distress_response_ids"] == [out["response_id"]]

    def test_normal_answer_has_no_safety_fields(self):
        out = submit_response("s1", SubmitResponseRequest(response_text="I led a district programme on nutrition"), USER, _db(_session()))
        assert "safety_hold" not in out and "distress" not in out


# ── get_next_question wiring ──────────────────────────────────────────────────

import asyncio  # noqa: E402
import uuid  # noqa: E402
from unittest.mock import AsyncMock, patch  # noqa: E402

from app.models.interview import QuestionBank  # noqa: E402
from app.modules.interview.service import interaction  # noqa: E402


def _resp(is_followup=False, rid=None):
    return SimpleNamespace(
        id=rid or str(uuid.uuid4()), is_followup=is_followup, question_id=None, question=None,
        dynamic_question_text="Tell me about a budget you managed", dynamic_question_type="behavioral",
        response_text="I managed a district budget", sequence_num=1,
    )


def _next_env(responses, candidates=(), total=2, ramp="easy to hard", qids=()):
    session = SimpleNamespace(
        id="s1", status="in_progress", total_questions=total, session_type="practice", job_role="Policy Analyst",
        started_at=datetime.now(timezone.utc) - timedelta(minutes=2), responses=responses,
        blueprint={"difficulty_ramp": ramp, "_question_ids": list(qids), "question_breakdown": {}},
    )
    current = responses[-1]
    db = MagicMock()
    q_session = _chain(first=session)
    q_resp = _chain(first=current)
    q_bank = _chain()
    q_bank.all.return_value = list(candidates)
    db.query.side_effect = lambda arg: {InterviewSession: q_session, SessionResponse: q_resp, QuestionBank: q_bank}.get(arg, _chain())
    return session, current, db


def _run_next(session, current, db, decision):
    stub = AsyncMock(return_value=decision)
    with patch("app.ai.adaptive_interviewer.decide_next_action", stub), \
         patch.object(interaction.core, "_recent_history", return_value=""):
        out = asyncio.run(interaction.get_next_question("s1", str(current.id), USER, db))
    return out, stub


class TestGetNextQuestion:
    def test_closes_when_planned_questions_are_done_and_no_probe(self):
        responses = [_resp(), _resp(), _resp(is_followup=True)]  # 2 planned answered + 1 probe already used
        session, current, db = _next_env(responses)
        out, stub = _run_next(session, current, db, {"action": "next_question"})
        assert out["session_complete"] is True and out["question"] is None
        stub.assert_not_called()  # already probed -> no LLM spend

    def test_llm_is_not_consulted_when_probe_cap_is_reached(self):
        responses = [_resp(), _resp(is_followup=True), _resp(is_followup=True)]
        session, current, db = _next_env(responses, total=2)  # cap = 1 follow-up for 2 questions
        out, stub = _run_next(session, current, db, {"action": "follow_up", "follow_up_question": "Why?"})
        stub.assert_not_called()
        assert out["action"] == "next_question" or out["session_complete"] is True

    def test_probe_is_asked_when_allowed(self):
        responses = [_resp()]
        session, current, db = _next_env(responses, total=3)
        out, stub = _run_next(session, current, db, {
            "action": "follow_up", "follow_up_question": "How did you verify that number?", "provisional_score": 6,
        })
        stub.assert_called_once()
        assert out["action"] == "follow_up" and out["question"]["text"].startswith("How did you verify")
        assert out["question"]["is_followup"] is True and out["session_complete"] is False

    def test_model_cannot_force_a_second_probe(self):
        responses = [_resp(), _resp(is_followup=True)]
        session, current, db = _next_env(responses, total=4, candidates=[SimpleNamespace(
            id=uuid.uuid4(), question_text="Next one", question_type="hr", difficulty="easy",
            panelist_name=None, panelist_role=None)])
        out, _ = _run_next(session, current, db, {"action": "follow_up", "follow_up_question": "Again?"})
        assert out["action"] == "next_question" and out["question"]["text"] == "Next one"

    def test_next_question_follows_the_difficulty_ramp(self):
        ids = [uuid.uuid4() for _ in range(3)]
        cands = [
            SimpleNamespace(id=ids[0], question_text="hard one", question_type="case", difficulty="hard", panelist_name=None, panelist_role=None),
            SimpleNamespace(id=ids[1], question_text="easy one", question_type="hr", difficulty="easy", panelist_name=None, panelist_role=None),
            SimpleNamespace(id=ids[2], question_text="medium one", question_type="hr", difficulty="medium", panelist_name=None, panelist_role=None),
        ]
        responses = [_resp(is_followup=True)]
        session, current, db = _next_env(responses, candidates=cands, total=5, qids=[str(i) for i in ids])
        out, _ = _run_next(session, current, db, {"action": "next_question"})
        assert out["question"]["text"] == "easy one"

    def test_hard_time_limit_ends_the_interview(self):
        responses = [_resp()]
        session, current, db = _next_env(responses, total=5)
        session.started_at = datetime.now(timezone.utc) - timedelta(minutes=40)
        out, stub = _run_next(session, current, db, {"action": "follow_up", "follow_up_question": "More?"})
        assert out["session_complete"] is True
        stub.assert_not_called()


class TestReportWordingAndNotes:
    def test_comparative_discouraging_words_are_reworded(self):
        from app.modules.interview.scoring import sanitize_text
        out = sanitize_text("Much weaker than it appears; the weakest answer failed to land.")
        for word in ("weaker", "weakest", "failed"):
            assert word not in out.lower()

    def test_repeated_answer_notes_are_capped(self):
        from app.modules.interview.service import core
        transcript = [{"response": "I would collect the data and run a regression to estimate impact."}] * 7
        notes = core._detect_verbatim_repeats(transcript)
        assert len(notes) == core.MAX_REPEAT_NOTES + 1
        assert "more pairs" in notes[-1]
