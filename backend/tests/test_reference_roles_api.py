"""Reference-roles API: filters, search, detail, skill-fit, and that no apply action exists."""
import uuid

import pytest

from app.core.rbac import get_current_aspirant
from app.main import app
from app.models.market_role import MarketRole
from app.models.reference_data import UpscSkillFramework
from app.models.user import AspirantProfile, Role, User

TAG = "ZZRefTest"


def _role(db, company, role, industry="Consulting", ctype="MNC", locs=("Mumbai",), entry=(6, 9), skills=("Policy Analysis",),
          cats=("Cleared Mains",), pref=()):
    r = MarketRole(
        source="test", company_name=f"{TAG} {company}", industry=industry, company_type=ctype, job_role=role,
        hiring_locations_list=list(locs), website_url="https://example.com", required_skills=list(skills),
        preferred_skills=list(pref), suitable_candidate_categories=list(cats), entry_salary_text=f"{entry[0]}–{entry[1]} LPA",
        entry_salary_min=entry[0], entry_salary_max=entry[1], candidate_fit_score=80, full_description="d",
        responsibilities_list=["Do things"], transferable_upsc_skills=["Report Writing"],
    )
    db.add(r)
    db.flush()
    return r


@pytest.fixture
def aspirant(db):
    role = db.query(Role).filter(Role.name == "aspirant").first()
    assert role is not None
    user = User(email=f"asp-{uuid.uuid4().hex[:8]}@example.com", role_id=role.id, email_verified=True, is_active=True)
    db.add(user)
    db.flush()
    app.dependency_overrides[get_current_aspirant] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_aspirant, None)


@pytest.fixture
def roles(db):
    return {
        "a": _role(db, "Alpha", "Policy Analyst", industry="Think Tank", ctype="Non-Profit", locs=("Delhi", "Pune"), entry=(4, 6),
                   skills=("Policy Analysis", "Report Writing"), cats=("Cleared Mains", "Reached Interview")),
        "b": _role(db, "Beta", "Compliance Analyst", industry="FinTech", ctype="Indian Startup", locs=("Mumbai",), entry=(6, 9),
                   skills=("Regulatory Compliance", "Excel"), cats=("Commerce Graduate",)),
        "c": _role(db, "Gamma", "Strategy Associate", industry="Consulting", ctype="MNC", locs=("Mumbai", "Delhi"), entry=(8, 13),
                   skills=("Strategy", "Excel"), cats=("Cleared Mains",), pref=("SQL",)),
    }


def names(res):
    return sorted(i["company_name"].removeprefix(TAG + " ") for i in res.json()["items"])


def get(client, **params):
    params.setdefault("q", TAG)
    return client.get("/api/reference-roles", params=params)


def test_list_filters(client, aspirant, roles):
    assert names(get(client)) == ["Alpha", "Beta", "Gamma"]
    assert names(get(client, industry="FinTech")) == ["Beta"]
    assert names(get(client, company_type="MNC")) == ["Gamma"]
    assert names(get(client, location="Delhi")) == ["Alpha", "Gamma"]
    assert names(get(client, category="Commerce Graduate")) == ["Beta"]
    assert names(get(client, skill="excel")) == ["Beta", "Gamma"]
    assert names(get(client, skill="sql")) == ["Gamma"]            # preferred skills count too


def test_salary_band_overlaps_entry_range(client, aspirant, roles):
    assert names(get(client, salary_min=10)) == ["Gamma"]          # only Gamma's entry range reaches 10
    assert names(get(client, salary_max=5)) == ["Alpha"]
    assert names(get(client, salary_min=7, salary_max=8)) == ["Beta", "Gamma"]


def test_search_and_combined_filters_and_empty(client, aspirant, roles):
    assert names(get(client, q=f"{TAG} Alpha")) == ["Alpha"]
    assert names(get(client, industry="Consulting", location="Pune")) == []
    r = get(client, q="nothing matches this xyzzy")
    assert r.status_code == 200 and r.json()["items"] == [] and r.json()["total"] == 0


def test_sort_and_pagination(client, aspirant, roles):
    res = get(client, sort="salary", page_size=2).json()
    assert [i["company_name"].removeprefix(TAG + " ") for i in res["items"]] == ["Gamma", "Beta"] and res["total"] == 3
    assert [i["company_name"].removeprefix(TAG + " ") for i in get(client, sort="salary", page_size=2, page=2).json()["items"]] == ["Alpha"]


def test_bad_params_are_rejected(client, aspirant, roles):
    assert get(client, sort="random").status_code == 422
    assert get(client, page_size=500).status_code == 422
    assert get(client, salary_min=-1).status_code == 422


def test_every_card_says_it_is_a_reference_and_has_no_apply(client, aspirant, roles):
    for item in get(client).json()["items"]:
        assert item["is_reference"] is True and "not an open vacancy" in item["reference_notice"]
        assert not any("apply" in k.lower() for k in item)
    d = client.get(f"/api/reference-roles/{roles['a'].id}").json()
    assert d["is_reference"] is True and "not an open vacancy" in d["reference_notice"]
    assert not any("apply" in k.lower() for k in d)


def test_detail_not_found_and_bad_id(client, aspirant, roles):
    assert client.get(f"/api/reference-roles/{uuid.uuid4()}").status_code == 404
    assert client.get("/api/reference-roles/not-a-uuid").status_code == 404


def test_filters_endpoint(client, aspirant, roles):
    f = client.get("/api/reference-roles/filters").json()
    assert {"value": "FinTech"}.items() <= next(i for i in f["industries"] if i["value"] == "FinTech").items()
    assert any(i["value"] == "Delhi" for i in f["locations"]) and f["total"] >= 3


def test_requires_an_aspirant(client, roles):
    assert client.get("/api/reference-roles").status_code in (401, 403)


def test_skill_fit_uses_profile_skills_only(client, db, aspirant, roles):
    r = client.get(f"/api/reference-roles/{roles['a'].id}/skill-fit").json()
    assert r["needs_profile_skills"] is True                       # no profile yet: asks for skills, never guesses
    db.add(AspirantProfile(user_id=aspirant.id, skills=["Policy Analysis", "Cooking"]))
    db.flush()
    r = client.get(f"/api/reference-roles/{roles['a'].id}/skill-fit").json()
    by = {x["skill"]: x["status"] for x in r["required"]}
    assert by == {"Policy Analysis": "have", "Report Writing": "gap"}
    assert r["summary"] == {"required_total": 2, "have": 1, "related": 0, "gap": 1} and r["based_on"] == "your profile skills"


def test_skill_fit_related_comes_from_a_framework_row(client, db, aspirant, roles):
    db.add(UpscSkillFramework(
        source="test", skill_category="HARD SKILL", upsc_activity="Essay Writing Practice", skill_developed="Thesis construction",
        skill_developed_list=[], corporate_translation="Report Writing; Business Communication", corporate_translation_list=[],
        relevant_job_roles="x", relevant_job_roles_list=[], skill_depth=9))
    db.add(AspirantProfile(user_id=aspirant.id, skills=["Essay Writing"]))
    db.flush()
    r = client.get(f"/api/reference-roles/{roles['a'].id}/skill-fit").json()
    rep = next(x for x in r["required"] if x["skill"] == "Report Writing")
    assert rep["status"] == "related" and rep["via"] == "Essay Writing" and "UPSC '" in rep["reason"]   # the real framework rows are in the test DB too
