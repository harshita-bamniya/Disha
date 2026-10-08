"""Seed the career_tracks permissions the admin router requires.

admin/router.py guards /admin/career-tracks with require_permission("career_tracks", view|write|delete),
but no earlier migration ever inserted them, so every admin and super_admin got a 403 on the Career Tracks
and Roadmap Blueprints pages.

Revision ID: t2c3a4r5e6e7
Revises: s1v2e3r4i5f6
Create Date: 2026-10-08
"""
import sqlalchemy as sa
from alembic import op

revision = "t2c3a4r5e6e7"
down_revision = "s1v2e3r4i5f6"
branch_labels = None
depends_on = None

PERMISSIONS = [
    ("career_tracks", "view", "View career tracks"),
    ("career_tracks", "write", "Create and edit career tracks"),
    ("career_tracks", "delete", "Delete career tracks"),
]
ROLE_PERMISSIONS = {
    "super_admin": ["view", "write", "delete"],
    "admin": ["view", "write"],
}


def upgrade() -> None:
    for resource, action, description in PERMISSIONS:
        op.execute(sa.text(
            "INSERT INTO permissions (id, resource, action, description) "
            "VALUES (gen_random_uuid(), :resource, :action, :description) "
            "ON CONFLICT (resource, action) DO NOTHING"
        ).bindparams(resource=resource, action=action, description=description))
    for role_name, actions in ROLE_PERMISSIONS.items():
        for action in actions:
            op.execute(sa.text(
                "INSERT INTO role_permissions (role_id, permission_id) "
                "SELECT r.id, p.id FROM roles r, permissions p "
                "WHERE r.name = :role_name AND p.resource = 'career_tracks' AND p.action = :action "
                "ON CONFLICT DO NOTHING"
            ).bindparams(role_name=role_name, action=action))


def downgrade() -> None:
    op.execute(sa.text(
        "DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE resource = 'career_tracks')"
    ))
    op.execute(sa.text("DELETE FROM permissions WHERE resource = 'career_tracks'"))
