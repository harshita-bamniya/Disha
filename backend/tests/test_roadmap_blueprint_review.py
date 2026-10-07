"""Admin review of role blueprints: a note is required, approval records who and when, edits reset it."""
import uuid

import pytest

from app.core.rbac import require_admin
from app.main import app
from app.models.role_blueprint import RoleBlueprint
from app.models.user import User


@pytest.fixture
def admin(db):
    u = User(email=f"adm-{uuid.uuid4().hex[:6]}@example.com", email_verified=True, is_active=True)
    app.dependency_overrides[require_admin] = lambda: u
    yield u
    app.dependency_overrides.pop(require_admin, None)


def _bp(db, valid=True):
    if valid:
        real = db.query(RoleBlueprint).filter(RoleBlueprint.is_current.is_(True)).first()
        if real is None:
            pytest.skip("needs one stored blueprint whose graph already passes validation")
        g = real.graph
    else:
        g = {"phases": [], "skills": []}
    bp = RoleBlueprint(slug=f"zz-{uuid.uuid4().hex[:6]}", title="ZZ Test Role", version=1, review_status="draft", is_current=True,
                       graph=g, sources={"roles_total": 12, "postings_total": 1}, embedding=None)
    db.add(bp)
    db.flush()
    return bp


def test_approve_needs_a_note(client, db, admin):
    bp = _bp(db)
    r = client.post(f"/api/admin/roadmap-blueprints/{bp.id}/review", json={"decision": "approve"})
    assert r.status_code == 422 and "note" in r.json()["detail"].lower()
    assert client.post(f"/api/admin/roadmap-blueprints/{bp.id}/review", json={"decision": "needs_changes", "notes": "x"}).status_code == 422


def test_approve_records_reviewer_and_note(client, db, admin):
    bp = _bp(db)
    r = client.post(f"/api/admin/roadmap-blueprints/{bp.id}/review", json={"decision": "approve", "notes": "Checked statutes and proof tasks."})
    assert r.status_code == 200 and r.json()["review_status"] == "reviewed" and r.json()["reviewed_by"] == admin.email
    detail = client.get(f"/api/admin/roadmap-blueprints/{bp.id}").json()
    assert detail["review_notes"] == "Checked statutes and proof tasks." and "grounding" in detail


def test_invalid_graph_cannot_be_approved(client, db, admin):
    bp = _bp(db, valid=False)
    r = client.post(f"/api/admin/roadmap-blueprints/{bp.id}/review", json={"decision": "approve", "notes": "Looks fine to me."})
    assert r.status_code == 422


def test_retire_does_not_need_a_note(client, db, admin):
    bp = _bp(db)
    r = client.post(f"/api/admin/roadmap-blueprints/{bp.id}/review", json={"decision": "retire"})
    assert r.status_code == 200 and r.json()["is_current"] is False
