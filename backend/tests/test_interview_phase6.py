"""Phase 6 Verified Interview: compliance filter, two-pass scoring, fit bands,
and the consent / one-attempt / share-grant rules. Pure unit tests (no
database, no network).
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from app.models.interview import InterviewConsent, InterviewSession
from app.models.interview_verified import (
    EmployerDecision,
    InterviewAppeal,
    InterviewInvitation,
    InterviewTemplate,
    ShareGrant,
)
from app.modules.interview import compliance, scoring
from app.modules.interview.service import verified
from app.modules.interview.verified_schemas import (
    AppealIn,
    DecisionIn,
    IntegrityEventsIn,
    InviteIn,
    TemplateIn,
)

UID = "3f2b8c1e-1111-4a2b-9c3d-123456789abc"
UID2 = "11111111-2222-3333-4444-555555555555"
NOW = datetime.now(timezone.utc)
EMPLOYER = SimpleNamespace(id="emp1")
CANDIDATE = SimpleNamespace(id="cand1")


def run(coro):
    return asyncio.run(coro)


# ── compliance filter ─────────────────────────────────────────────────────────

class TestCompliance:
    @pytest.mark.parametrize("question", [
        "Are you married?", "How old are you?", "What is your date of birth?", "Do you plan to have children soon?",
        "What is your caste?", "Which religion do you follow?", "Are you a male or female candidate?",
        "Do you have any disability?", "What is your mother tongue?", "Are you pregnant?",
        "Which community do you belong to? Your community matters here.", "Is your husband okay with travel?",
        "Tell me about a health condition you have.", "Which state are you from originally?",
        "Do you have a girlfriend or boyfriend?", "Do you take any medication?", "Where were you born?",
        "What is your hometown?", "Do you suffer from any illness?",
        "क्या आप शादीशुदा हैं?", "आपकी जाति क्या है?", "आपकी उम्र कितनी है?",
    ])
    def test_protected_questions_are_blocked(self, question):
        assert compliance.check_question(question), question

    @pytest.mark.parametrize("question", [
        "Walk me through how you would run a materiality assessment.",
        "What is a single point of failure in a reporting process?",
        "How would you handle community engagement around a plant?",
        "Tell me about a time you led a team through a tight deadline.",
        "How do you stay current with changing regulations?",
        "Describe your experience with data analysis in a policy setting.",
        "How would you evaluate a public health policy using state-level data?",
        "Which state schemes have you analysed, and what did you find?",
        "How would you handle a team member under stress or in a health emergency at a site?",
    ])
    def test_job_related_questions_pass(self, question):
        assert compliance.check_question(question) == []

    def test_cleaning_trims_and_drops_blanks(self):
        assert compliance.validate_custom_questions(["  one  ", "", "   ", "two"]) == ["one", "two"]

    def test_at_most_three_questions(self):
        with pytest.raises(ValueError, match="At most 3"):
            compliance.validate_custom_questions(["a1", "b2", "c3", "d4"])

    def test_every_problem_is_reported_at_once_with_a_reason(self):
        with pytest.raises(ValueError) as err:
            compliance.validate_custom_questions(["Are you married?", "What is your caste?", "x" * 500])
        message = str(err.value)
        assert "Question 1" in message and "Question 2" in message and "Question 3" in message
        assert "marital status" in message and "caste" in message and "too long" in message


# ── two-pass scoring and bands ────────────────────────────────────────────────

def _scores(overall, **kw):
    base = dict(clarity_score=overall, conciseness_score=overall, impact_score=overall,
                relevance_score=overall, star_adherence=overall, overall_score=overall,
                strengths=["s"], improvements=["i"], rewritten_answer="r", evidence_quote="q")
    base.update(kw)
    return base


class TestReconcilePasses:
    def test_close_passes_are_averaged_without_flagging(self):
        merged, disagreed = scoring.reconcile_passes(_scores(6), _scores(7))
        assert merged["overall_score"] == 7  # 6.5 rounds half up
        assert disagreed is False

    def test_wording_and_quote_come_from_the_first_pass(self):
        merged, _ = scoring.reconcile_passes(_scores(6, evidence_quote="first"), _scores(6, evidence_quote="second"))
        assert merged["evidence_quote"] == "first"

    def test_far_apart_passes_are_flagged_for_a_human(self):
        merged, disagreed = scoring.reconcile_passes(_scores(8), _scores(4))
        assert disagreed is True and merged["overall_score"] == 6

    def test_a_gap_of_exactly_two_is_still_agreement(self):
        assert scoring.reconcile_passes(_scores(7), _scores(5))[1] is False
        assert scoring.reconcile_passes(_scores(7), _scores(4))[1] is True

    def test_a_missing_number_in_the_first_pass_is_filled_from_the_second(self):
        merged, disagreed = scoring.reconcile_passes(_scores(6, impact_score=None), _scores(6, impact_score=8))
        assert merged["impact_score"] == 8 and disagreed is False

    def test_inputs_are_not_mutated(self):
        first = _scores(6)
        scoring.reconcile_passes(first, _scores(9))
        assert first["overall_score"] == 6


class TestFitBand:
    @pytest.mark.parametrize("score,band", [
        (95, "Strong fit"), (80, "Strong fit"), (79.9, "Good fit"), (65, "Good fit"),
        (64.9, "Developing"), (50, "Developing"), (49.9, "Not yet a fit"), (0, "Not yet a fit"),
    ])
    def test_bands(self, score, band):
        assert scoring.fit_band(score, False) == band

    def test_uncertain_scores_are_never_shown_as_a_firm_band(self):
        assert scoring.fit_band(90, True) == "Needs human review"

    def test_no_score_no_band(self):
        assert scoring.fit_band(None, False) is None

    def test_no_band_name_is_discouraging(self):
        for score in (10, 40, 55, 70, 90):
            band = (scoring.fit_band(score, False) or "").lower()
            assert "weak" not in band and "poor" not in band and "fail" not in band

    def test_report_gets_a_band_from_code_scoring(self):
        entries = [dict(skill_assessed="Policy", overall=8, difficulty="medium", is_fallback=False,
                        clarity=8, conciseness=8, relevance=8, impact=8, response="x", judge_disagreement=False)]
        report = scoring.apply_code_scoring(
            {"overall_readiness_score": 80, "hiring_recommendation": "Strong Hire"}, entries,
            [{"skill": "Policy", "weight": 100}],
        )
        assert report["fit_band"] == "Strong fit"

    def test_two_pass_disagreement_makes_the_report_uncertain(self):
        entries = [dict(skill_assessed="Policy", overall=8, difficulty="medium", is_fallback=False,
                        clarity=8, conciseness=8, relevance=8, impact=8, response="x", judge_disagreement=True)]
        report = scoring.apply_code_scoring(
            {"overall_readiness_score": 80, "hiring_recommendation": "Strong Hire"}, entries,
            [{"skill": "Policy", "weight": 100}],
        )
        assert report["fit_band"] == "Needs human review"


# ── request validation ────────────────────────────────────────────────────────

def _template_body(**kw):
    base = dict(title="ESG analyst screen", role="ESG Analyst",
                competencies=[{"skill": "Materiality", "weight": 60}, {"skill": "Reporting", "weight": 40, "must_have": True}])
    base.update(kw)
    return TemplateIn(**base)


class TestRequests:
    def test_valid_template(self):
        body = _template_body(duration_minutes=15, custom_questions=["How do you prioritise?"])
        assert body.duration_minutes == 15

    @pytest.mark.parametrize("bad", [
        dict(duration_minutes=5), dict(duration_minutes=45), dict(competencies=[]),
        dict(competencies=[{"skill": "x", "weight": 10}]), dict(competencies=[{"skill": "Skill", "weight": 0}]),
        dict(job_id="not-a-uuid"), dict(custom_questions=["q"] * 11),
    ])
    def test_bad_templates_are_rejected(self, bad):
        with pytest.raises(ValidationError):
            _template_body(**bad)

    def test_other_models(self):
        assert InviteIn(template_id=UID, application_id=UID2).expires_in_days == 7
        with pytest.raises(ValidationError):
            InviteIn(template_id="x", application_id=UID2)
        with pytest.raises(ValidationError):
            DecisionIn(decision="hire", reason_code="other")
        with pytest.raises(ValidationError):
            AppealIn(reason="too short")
        with pytest.raises(ValidationError):
            IntegrityEventsIn(events=[{"kind": "keystroke", "started_ms": 1}])


# ── helpers ───────────────────────────────────────────────────────────────────

def _chain(first=None, rows=None, scalar=None):
    q = MagicMock()
    for name in ("filter", "join", "order_by", "limit", "with_for_update"):
        getattr(q, name).return_value = q
    q.first.return_value = first
    q.all.return_value = rows or []
    q.scalar.return_value = scalar
    q.update.return_value = 1
    return q


def _db(by_model=None):
    by_model = by_model or {}
    db = MagicMock()
    db.query.side_effect = lambda *args: by_model.get(args[0], _chain())
    return db


def _invitation(**kw):
    base = dict(
        id=UID, template_id="t1", employer_user_id=EMPLOYER.id, candidate_user_id=CANDIDATE.id, application_id="a1",
        status="invited", expires_at=NOW + timedelta(days=5), session_id=None, retry_granted=False,
        started_at=None, completed_at=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


def _template(**kw):
    base = dict(
        id="t1", employer_user_id=EMPLOYER.id, title="ESG screen", role="ESG Analyst", language="en", duration_minutes=15,
        competencies=[{"skill": "Materiality", "weight": 60, "must_have": False}, {"skill": "Reporting", "weight": 40, "must_have": True}],
        custom_questions=["How do you prioritise?"], status="active", job_id=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


# ── plan and statuses ─────────────────────────────────────────────────────────

class TestPlanAndStatus:
    def test_must_have_competencies_weigh_more(self):
        plan = verified.build_plan(_template())
        weights = {c["skill"]: c["weight"] for c in plan["competencies"]}
        assert weights["Materiality"] == 60 and weights["Reporting"] == 40 * verified.MUST_HAVE_WEIGHT_FACTOR
        assert plan["custom_questions"] == ["How do you prioritise?"]

    @pytest.mark.parametrize("minutes,count", [(10, 5), (12, 7), (15, 7), (18, 8), (20, 8)])
    def test_question_count_follows_duration(self, minutes, count):
        assert verified.questions_for_minutes(minutes) == count

    def test_an_unstarted_invitation_expires(self):
        assert verified.effective_status(_invitation(expires_at=NOW - timedelta(minutes=1))) == "expired"
        assert verified.effective_status(_invitation()) == "invited"

    def test_a_started_or_completed_invitation_never_flips_to_expired(self):
        old = NOW - timedelta(days=30)
        assert verified.effective_status(_invitation(status="started", expires_at=old)) == "started"
        assert verified.effective_status(_invitation(status="completed", expires_at=old)) == "completed"

    def test_duplicate_competencies_are_rejected(self):
        body = _template_body(competencies=[{"skill": "Reporting", "weight": 50}, {"skill": "reporting", "weight": 50}])
        with pytest.raises(verified.VerifiedError, match="twice"):
            verified._competencies_from(body)

    def test_bad_custom_questions_surface_as_a_422_with_the_reason(self):
        with pytest.raises(verified.VerifiedError) as err:
            verified._clean_questions(_template_body(custom_questions=["Are you married?"]))
        assert err.value.status == 422 and "marital status" in str(err.value)


# ── inviting ──────────────────────────────────────────────────────────────────

def _invite_env(template=None, existing=None, application=None):
    template = template or _template()
    db = _db({InterviewTemplate: _chain(first=template), InterviewInvitation.id: _chain(first=existing)})
    application = application or SimpleNamespace(id="a1", job_id="j1", aspirant_id=CANDIDATE.id)
    return db, application


class TestInvite:
    def _invite(self, db, application, template=None):
        with patch.object(verified, "_colleague_ids", return_value=[EMPLOYER.id]), \
             patch("app.modules.matching.service.core._get_employer_application", return_value=application), \
             patch("app.modules.inbox.service.create_notification") as notify, \
             patch.object(verified, "_invitation_for_employer_out", return_value={"ok": True}), \
             patch.object(verified, "_employer_name", return_value="Acme"):
            out = verified.invite(EMPLOYER, InviteIn(template_id=UID, application_id=UID2), db)
        return out, notify

    def test_invites_an_applicant_and_notifies_them(self):
        db, application = _invite_env()
        out, notify = self._invite(db, application)
        assert out == {"ok": True}
        invitation = db.add.call_args[0][0]
        assert invitation.candidate_user_id == CANDIDATE.id and invitation.application_id == "a1"
        assert invitation.expires_at > NOW + timedelta(days=6)
        assert notify.call_args.args[2] == "verified_interview_invite"
        assert notify.call_args.args[1] == CANDIDATE.id

    def test_the_same_candidate_cannot_be_invited_twice(self):
        db, application = _invite_env(existing=("x",))
        with pytest.raises(verified.VerifiedError) as err:
            self._invite(db, application)
        assert err.value.status == 409

    def test_a_template_for_another_job_is_refused(self):
        db, application = _invite_env(template=_template(job_id="other-job"))
        with pytest.raises(verified.VerifiedError, match="different job"):
            self._invite(db, application)

    def test_an_archived_template_cannot_be_used(self):
        db, application = _invite_env(template=_template(status="archived"))
        with pytest.raises(verified.VerifiedError, match="archived"):
            self._invite(db, application)

    def test_an_unknown_template_is_a_404(self):
        db = _db({InterviewTemplate: _chain(first=None)})
        with patch.object(verified, "_colleague_ids", return_value=[EMPLOYER.id]):
            with pytest.raises(verified.VerifiedError) as err:
                verified.invite(EMPLOYER, InviteIn(template_id=UID, application_id=UID2), db)
        assert err.value.status == 404


# ── starting: one attempt, explicit consent ──────────────────────────────────

class TestStart:
    CONSENTS = ["ai_processing", "own_effort", "employer_share"]

    def _start(self, inv, consents=None, existing_session=None, template=None):
        template = template or _template()
        db = _db({InterviewInvitation: _chain(first=(inv, template)), InterviewSession: _chain(first=existing_session)})
        detail = SimpleNamespace(id=UID2)
        created = SimpleNamespace(id=UID2, mode="practice")
        db.query.side_effect = lambda *a: (
            _chain(first=(inv, template)) if a[0] is InterviewInvitation
            else _chain(first=existing_session or created)
        )
        create = AsyncMock(return_value=detail)
        with patch("app.modules.interview.service.session_setup.create_session", create), \
             patch("app.modules.interview.service.sessions.record_consents") as record, \
             patch("app.modules.interview.service.sessions.get_session", return_value="RESUMED"):
            out = run(verified.start_invitation(CANDIDATE, UID, consents if consents is not None else self.CONSENTS, db))
        return out, create, record, created

    def test_starts_a_verified_session_from_the_employers_template(self):
        inv = _invitation()
        out, create, record, created = self._start(inv)
        body, _, _, plan = create.await_args.args
        assert body.job_role == "ESG Analyst" and body.session_type == "full_mock" and body.total_questions == 7
        assert plan["custom_questions"] == ["How do you prioritise?"]
        assert created.mode == "verified"
        assert inv.status == "started" and inv.session_id == UID2 and inv.started_at is not None
        record.assert_called_once()

    @pytest.mark.parametrize("consents", [[], ["ai_processing"], ["employer_share"], ["own_effort", "media"]])
    def test_both_required_consents_are_needed(self, consents):
        with pytest.raises(verified.VerifiedError, match="agree to AI processing"):
            self._start(_invitation(), consents)

    def test_an_expired_invitation_cannot_be_started(self):
        with pytest.raises(verified.VerifiedError) as err:
            self._start(_invitation(expires_at=NOW - timedelta(days=1)))
        assert err.value.status == 410

    def test_a_completed_invitation_is_one_attempt_only(self):
        with pytest.raises(verified.VerifiedError, match="one attempt"):
            self._start(_invitation(status="completed"))

    def test_a_declined_invitation_cannot_be_started(self):
        with pytest.raises(verified.VerifiedError, match="declined"):
            self._start(_invitation(status="declined"))

    def test_a_started_invitation_resumes_the_same_attempt(self):
        inv = _invitation(status="started", session_id=UID2)
        out, create, _, _ = self._start(inv, existing_session=SimpleNamespace(id=UID2, status="in_progress"))
        assert out == "RESUMED"
        create.assert_not_called()

    def test_an_ended_attempt_cannot_be_restarted(self):
        inv = _invitation(status="started", session_id=UID2)
        with pytest.raises(verified.VerifiedError, match="ended"):
            self._start(inv, existing_session=SimpleNamespace(id=UID2, status="abandoned"))

    def test_someone_elses_invitation_is_not_found(self):
        db = _db({InterviewInvitation: _chain(first=None)})
        with pytest.raises(verified.VerifiedError) as err:
            run(verified.start_invitation(CANDIDATE, UID, self.CONSENTS, db))
        assert err.value.status == 404

    def test_declining(self):
        inv = _invitation()
        verified.decline_invitation(CANDIDATE, UID, _db({InterviewInvitation: _chain(first=(inv, _template()))}))
        assert inv.status == "declined"
        with pytest.raises(verified.VerifiedError):
            verified.decline_invitation(CANDIDATE, UID, _db({InterviewInvitation: _chain(first=(_invitation(status="started"), _template()))}))


# ── consent becomes a share grant ────────────────────────────────────────────

class TestOnGraded:
    def _graded(self, consented=True, has_grant=False, mode="verified", inv=None):
        session = SimpleNamespace(id=UID2, mode=mode)
        inv = inv or _invitation(status="started", session_id=UID2)
        db = MagicMock()
        by_model = {
            InterviewSession: _chain(first=session),
            InterviewInvitation: _chain(first=inv),
            InterviewConsent.id: _chain(first=("c",) if consented else None),
            ShareGrant.id: _chain(first=("g",) if has_grant else None),
        }
        db.query.side_effect = lambda arg: by_model.get(arg, _chain())
        with patch("app.modules.inbox.service.create_notification") as notify, \
             patch.object(verified, "_candidate_name", return_value="Asha"):
            verified.on_graded(UID2, db)
        return db, inv, notify

    def test_consent_creates_a_time_limited_grant_and_tells_the_employer(self):
        db, inv, notify = self._graded()
        grant = db.add.call_args[0][0]
        assert isinstance(grant, ShareGrant) and grant.employer_user_id == EMPLOYER.id
        assert NOW + timedelta(days=verified.GRANT_DAYS - 1) < grant.expires_at < NOW + timedelta(days=verified.GRANT_DAYS + 1)
        assert inv.status == "completed" and inv.completed_at is not None
        assert notify.call_args.args[2] == "verified_interview_done"

    def test_no_consent_means_no_grant_and_no_employer_notification(self):
        db, inv, notify = self._graded(consented=False)
        db.add.assert_not_called()
        notify.assert_not_called()
        assert inv.status == "completed"

    def test_running_twice_does_not_duplicate_the_grant_or_the_notification(self):
        db, inv, notify = self._graded(has_grant=True, inv=_invitation(status="completed", session_id=UID2, completed_at=NOW))
        db.add.assert_not_called()
        notify.assert_not_called()

    def test_practice_interviews_are_ignored(self):
        db, inv, notify = self._graded(mode="practice")
        db.add.assert_not_called()
        notify.assert_not_called()


# ── the employer's scorecard ──────────────────────────────────────────────────

REPORT = {
    "fit_band": "Good fit", "overall_readiness_score": 71.0, "needs_human_review": False, "review_reasons": [],
    "skill_scores": {"Materiality": 72.0}, "competencies": [{"skill": "Materiality", "weight": 60}],
    "candidate_summary": "Clear thinker.", "strengths": ["a"], "critical_gaps": ["b"],
    # coaching content that must never reach the employer:
    "roadmap": [{"focus": "x"}], "delivery": {"filler_per_100_words": 3}, "readiness_message": "Keep going!",
    "hiring_recommendation": "Hire", "confidence_note": "n", "integrity_notes": [],
}


class TestEmployerResult:
    def _result(self, inv=None, grant="live", decision=None):
        inv = inv or _invitation(status="completed", session_id=UID2, completed_at=NOW)
        session = SimpleNamespace(id=UID2, job_readiness_report=REPORT, job_role="ESG Analyst", language="en")
        grant_obj = SimpleNamespace(expires_at=NOW + timedelta(days=30), view_count=0, last_viewed_at=None) if grant == "live" else None
        db = _db({
            InterviewInvitation: _chain(first=inv), InterviewSession: _chain(first=session),
            InterviewTemplate: _chain(first=_template()), EmployerDecision: _chain(first=decision),
        })
        with patch.object(verified, "_colleague_ids", return_value=[EMPLOYER.id]), \
             patch.object(verified, "_active_grant", return_value=grant_obj), \
             patch.object(verified, "_candidate_name", return_value="Asha"), \
             patch.object(verified, "_feedback_for_employer", return_value=[{"question": "q", "answer": "a"}]), \
             patch.object(verified, "_integrity_out", return_value=[{"observation": "Switched to another tab"}]), \
             patch.object(verified, "_audio_files", return_value=[]):
            out = verified.get_result(EMPLOYER, UID, db)
        return out, grant_obj

    def test_scorecard_with_a_live_grant(self):
        out, grant = self._result()
        assert out["fit_band"] == "Good fit" and out["candidate_name"] == "Asha"
        assert out["answers"] and out["integrity_observations"][0]["observation"] == "Switched to another tab"
        assert grant.view_count == 1 and grant.last_viewed_at is not None

    def test_coaching_content_never_reaches_the_employer(self):
        out, _ = self._result()
        flat = repr(out)
        for forbidden in ("roadmap", "readiness_message", "Keep going", "filler_per_100_words", "hiring_recommendation", "Hire"):
            assert forbidden not in flat, forbidden

    def test_no_live_grant_means_no_result(self):
        with pytest.raises(verified.VerifiedError) as err:
            self._result(grant=None)
        assert err.value.status == 403 and "withdrawn" in str(err.value)

    def test_an_unfinished_interview_has_no_result_yet(self):
        with pytest.raises(verified.VerifiedError) as err:
            self._result(inv=_invitation(status="started", session_id=UID2))
        assert err.value.status == 409

    def test_someone_elses_invitation_is_not_found(self):
        db = _db({InterviewInvitation: _chain(first=None)})
        with patch.object(verified, "_colleague_ids", return_value=[EMPLOYER.id]):
            with pytest.raises(verified.VerifiedError) as err:
                verified.get_result(EMPLOYER, UID, db)
        assert err.value.status == 404


class TestActiveGrant:
    def test_the_query_demands_not_revoked_and_not_expired(self):
        q = _chain(first=None)
        db = _db({ShareGrant: q})
        verified._active_grant(UID2, EMPLOYER.id, db)
        conditions = " ".join(str(c) for c in q.filter.call_args.args)
        assert "revoked_at IS NULL" in conditions and "expires_at >" in conditions
        assert "employer_user_id" in conditions


class TestDecision:
    def _decide(self, grant, existing=None):
        inv = _invitation(status="completed", session_id=UID2)
        db = _db({InterviewInvitation: _chain(first=inv), EmployerDecision: _chain(first=existing)})
        with patch.object(verified, "_colleague_ids", return_value=[EMPLOYER.id]), \
             patch.object(verified, "_active_grant", return_value=grant):
            return db, verified.decide(EMPLOYER, UID, DecisionIn(decision="shortlist", reason_code="strong_evidence", note="Great"), db)

    def test_records_a_human_decision(self):
        db, out = self._decide(SimpleNamespace())
        row = db.add.call_args[0][0]
        assert row.decision == "shortlist" and row.reason_code == "strong_evidence" and out["decision"] == "shortlist"

    def test_changing_a_decision_updates_it(self):
        existing = SimpleNamespace(decision="hold", reason_code="other", note=None)
        db, _ = self._decide(SimpleNamespace(), existing)
        assert existing.decision == "shortlist"
        db.add.assert_not_called()

    def test_no_decision_without_a_live_grant(self):
        with pytest.raises(verified.VerifiedError) as err:
            self._decide(None)
        assert err.value.status == 403


class TestRevoke:
    def test_withdrawing_consent_ends_every_grant_and_the_consent_record(self):
        grants, consents = _chain(), _chain()
        session = SimpleNamespace(id=UID2, mode="verified")
        db = _db({InterviewSession: _chain(first=session), ShareGrant: grants, InterviewConsent: consents})
        assert verified.revoke_share(CANDIDATE, UID2, db) == 1
        assert "revoked_at" in grants.update.call_args.args[0]
        assert "revoked_at" in consents.update.call_args.args[0]

    def test_practice_interviews_have_nothing_to_revoke(self):
        db = _db({InterviewSession: _chain(first=SimpleNamespace(id=UID2, mode="practice"))})
        with pytest.raises(verified.VerifiedError, match="practice"):
            verified.revoke_share(CANDIDATE, UID2, db)


# ── integrity events and appeals ──────────────────────────────────────────────

class TestIntegrity:
    def _events(self, n):
        return IntegrityEventsIn(events=[{"kind": "tab_hidden", "started_ms": i * 1000, "ended_ms": i * 1000 + 500} for i in range(n)]).events

    def test_events_are_stored_up_to_the_cap(self):
        session = SimpleNamespace(id=UID2, mode="verified", status="in_progress")
        db = _db({InterviewSession: _chain(first=session), verified.IntegrityEvent.id: _chain(scalar=0)})
        db.query.side_effect = lambda arg: _chain(first=session) if arg is InterviewSession else _chain(scalar=verified.MAX_INTEGRITY_EVENTS - 2)
        assert verified.record_integrity_events(CANDIDATE, UID2, self._events(5), db) == 2

    def test_only_active_verified_interviews_accept_events(self):
        done = SimpleNamespace(id=UID2, mode="verified", status="completed")
        with pytest.raises(verified.VerifiedError, match="not active"):
            verified.record_integrity_events(CANDIDATE, UID2, self._events(1), _db({InterviewSession: _chain(first=done)}))

    def test_integrity_observations_are_worded_as_observations(self):
        rows = [SimpleNamespace(kind="tab_hidden", started_ms=1000, ended_ms=2000), SimpleNamespace(kind="multiple_faces", started_ms=5000, ended_ms=None)]
        out = verified._integrity_out(UID2, _db({verified.IntegrityEvent: _chain(rows=rows)}))
        assert out[0]["observation"] == "Switched to another tab"
        text = " ".join(o["observation"].lower() for o in out)
        for accusation in ("cheat", "fraud", "dishonest"):
            assert accusation not in text


class TestAppeals:
    def _appeal(self, session, open_exists=False):
        db = _db({InterviewSession: _chain(first=session), InterviewAppeal.id: _chain(first=("a",) if open_exists else None)})
        return db, verified.file_appeal(CANDIDATE, UID2, AppealIn(reason="I believe the second answer was misjudged"), db)

    def test_files_an_open_appeal(self):
        db, out = self._appeal(SimpleNamespace(id=UID2, mode="verified", status="completed", grading_status="done"))
        assert out["status"] == "open" and isinstance(db.add.call_args[0][0], InterviewAppeal)

    def test_cannot_appeal_before_the_result_exists(self):
        with pytest.raises(verified.VerifiedError, match="result is ready"):
            self._appeal(SimpleNamespace(id=UID2, mode="verified", status="completed", grading_status="running"))

    def test_one_open_appeal_at_a_time(self):
        with pytest.raises(verified.VerifiedError) as err:
            self._appeal(SimpleNamespace(id=UID2, mode="verified", status="completed", grading_status="done"), open_exists=True)
        assert err.value.status == 409

    def test_resolving_records_who_and_when(self):
        appeal = SimpleNamespace(status="open", resolution_note=None, resolved_by=None, resolved_at=None)
        admin = SimpleNamespace(id="admin1")
        verified.resolve_appeal(admin, UID, "Reviewed by hand; score stands.", _db({InterviewAppeal: _chain(first=appeal)}))
        assert appeal.status == "resolved" and appeal.resolved_by == "admin1" and appeal.resolved_at is not None

    def test_an_appeal_cannot_be_resolved_twice(self):
        with pytest.raises(verified.VerifiedError) as err:
            verified.resolve_appeal(SimpleNamespace(id="a"), UID, "again", _db({InterviewAppeal: _chain(first=SimpleNamespace(status="resolved"))}))
        assert err.value.status == 409


# ── retry and retention ───────────────────────────────────────────────────────

class TestAllowRetry:
    def test_one_retry_reopens_the_invitation_and_withdraws_the_old_result(self):
        inv = _invitation(status="completed", session_id=UID2, completed_at=NOW, started_at=NOW)
        old = SimpleNamespace(status="in_progress")
        grants = _chain()
        db = _db({InterviewInvitation: _chain(first=inv), ShareGrant: grants, InterviewSession: _chain(first=old)})
        verified.allow_retry(UID, db)
        assert inv.status == "invited" and inv.retry_granted is True and inv.session_id is None
        assert old.status == "abandoned"
        assert "revoked_at" in grants.update.call_args.args[0]

    def test_only_one_retry_per_invitation(self):
        with pytest.raises(verified.VerifiedError) as err:
            verified.allow_retry(UID, _db({InterviewInvitation: _chain(first=_invitation(status="started", retry_granted=True))}))
        assert err.value.status == 409

    def test_an_unstarted_invitation_has_nothing_to_retry(self):
        with pytest.raises(verified.VerifiedError, match="started or completed"):
            verified.allow_retry(UID, _db({InterviewInvitation: _chain(first=_invitation())}))


class TestRetention:
    def test_old_verified_interviews_are_deleted_and_recent_ones_kept(self):
        old = [SimpleNamespace(id="s1"), SimpleNamespace(id="s2")]
        db = _db({InterviewSession: _chain(rows=old)})
        with patch("app.modules.interview.service.sessions.delete_session_row") as delete:
            assert verified.purge_expired(db, 180) == 2
        assert delete.call_count == 2

    def test_the_query_only_targets_verified_interviews_past_the_cutoff(self):
        q = _chain(rows=[])
        verified.purge_expired(_db({InterviewSession: q}), 180)
        conditions = " ".join(str(c) for c in q.filter.call_args.args)
        assert "mode" in conditions and "completed_at <" in conditions


# ── verified grading: the second, independent pass ────────────────────────────

import json  # noqa: E402

from app.modules.interview.service import feedback as feedback_service  # noqa: E402


def _llm_reply(overall, **kw):
    payload = _scores(overall, **kw)
    return SimpleNamespace(content=json.dumps(payload))


class TestVerifiedSecondPass:
    def _pass(self, second_reply=None, error=None):
        stub = AsyncMock(side_effect=error) if error else AsyncMock(return_value=second_reply)
        with patch.object(feedback_service, "tracked_complete", stub):
            out = run(feedback_service._verified_second_pass(object(), "sys", "user", _scores(7)))
        return out, stub

    def test_agreeing_passes_are_merged_with_no_flag(self):
        (merged, note, passes), stub = self._pass(_llm_reply(8))
        assert note is None and merged["overall_score"] == 8  # 7.5 rounds up
        assert passes == {"pass_1": 7, "pass_2": 8}
        assert stub.await_args.args[1] == "answer_score_pass2"      # logged under its own purpose

    def test_disagreeing_passes_carry_a_human_review_note(self):
        (merged, note, passes), _ = self._pass(_llm_reply(3))
        assert "flagged for human review" in note and "7/10 vs 3/10" in note
        assert passes == {"pass_1": 7, "pass_2": 3}

    def test_if_the_second_call_fails_the_first_pass_stands(self):
        (merged, note, passes), _ = self._pass(error=RuntimeError("rate limited"))
        assert merged["overall_score"] == 7 and note is None and passes is None

    def test_if_the_second_reply_is_garbage_the_first_pass_stands(self):
        (merged, note, passes), _ = self._pass(SimpleNamespace(content="not json at all"))
        assert merged["overall_score"] == 7 and passes is None


class TestGradingWiring:
    def test_verified_uses_two_passes_instead_of_persona_judges(self):
        import inspect

        src = inspect.getsource(feedback_service._grade_session)
        assert 'if session.mode == "verified":' in src and "_verified_second_pass" in src
        assert "judge_scores, judge_disagreement_note = pass_scores, pass_note" in src

    def test_finished_grading_hands_over_to_the_verified_flow(self):
        import inspect

        assert "verified.on_graded(session_id, db)" in inspect.getsource(feedback_service.run_grading)
