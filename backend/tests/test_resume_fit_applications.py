"""Resume fit on applications: employer-safe snapshot, auto-shortlist rules."""
from types import SimpleNamespace

from app.modules.applications import service as app_service
from app.modules.resume_match.application_fit import employer_view
from app.modules.resume_match.schemas import (
    AtsSignals, CandidateProfile, JobRequirements, ProfileRole, ProfileSkill, Requirement, RequirementResult,
)
from app.modules.resume_match.scoring import build_report


def _report():
    py = Requirement(name="Python", type="hard_skill")
    kn = Requirement(name="Kubernetes", type="hard_skill")
    wa = Requirement(name="Work authorization", type="eligibility")
    results = [
        RequirementResult(requirement=py, credit=1.0, verdict="met", method="exact", evidence="Built Python ETL pipelines"),
        RequirementResult(requirement=kn, credit=0.0, verdict="missing", method="none"),
        RequirementResult(requirement=wa, credit=0.0, verdict="missing", method="rule"),
    ]
    profile = CandidateProfile(roles=[ProfileRole(title="Analyst", start="2023-01", end="present",
                                                  bullets=["Built Python ETL pipelines"])],
                               skills=[ProfileSkill(name="Python", evidence=["Built Python ETL pipelines"])])
    return build_report(JobRequirements(requirements=[py, kn, wa]), profile, results,
                        AtsSignals(char_count=900, sections_found=["experience", "education", "skills"]), 0.8, None)


def test_employer_view_has_score_and_evidence_but_no_coaching():
    v = employer_view(_report())
    assert isinstance(v["score"], int) and v["band"] in {"Strong", "Good", "Fair", "Low"}
    assert v["must_haves_total"] == 2 and v["must_haves_met"] == 1
    py = next(r for r in v["requirements"] if r["name"] == "Python")
    assert py["label"] == "Met" and py["evidence"] == "Built Python ETL pipelines"
    assert next(r for r in v["requirements"] if r["name"] == "Kubernetes")["label"] == "Not found"
    assert next(r for r in v["requirements"] if r["name"] == "Work authorization")["label"] == "Confirm with candidate"
    # candidate-only material must never reach employers
    for forbidden in ("fixes", "ats_notes", "ats_checks", "changes"):
        assert forbidden not in v
    assert "points_gained" not in str(v)


def _app(score, status="applied"):
    return SimpleNamespace(id="a1", status=status, match_score=score)


def _job(threshold):
    return SimpleNamespace(auto_shortlist_threshold=threshold)


def _form(resume_config="required"):
    return SimpleNamespace(settings_json={"resume_config": resume_config})


class _Db:
    def __init__(self):
        self.added = []

    def add(self, row):
        self.added.append(row)


def test_auto_shortlist_uses_the_resume_fit_score():
    db = _Db()
    a = _app(82)
    assert app_service._auto_shortlist(a, _job(75), _form(), db) is True
    assert a.status == "shortlisted" and "resume fit 82" in db.added[0].note


def test_no_auto_shortlist_when_score_below_threshold_missing_or_resume_not_required():
    db = _Db()
    assert app_service._auto_shortlist(_app(60), _job(75), _form(), db) is False
    assert app_service._auto_shortlist(_app(None), _job(75), _form(), db) is False   # not scored yet / no resume
    assert app_service._auto_shortlist(_app(90), _job(75), _form("optional"), db) is False
    assert app_service._auto_shortlist(_app(90), _job(None), _form(), db) is False
    assert app_service._auto_shortlist(_app(90, status="rejected"), _job(75), _form(), db) is False
    assert app_service._auto_shortlist(_app(90), _job(75), None, db) is False
    assert db.added == []
