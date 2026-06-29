"""Granular company-side role permissions: jobs.create/edit/publish for
employer roles, candidates.interview for scheduling/feedback.

Revision ID: q2k3l4m5n6o7
Revises: p1j2k3l4m5n6
Create Date: 2026-06-28

Part of Module 05 — Employer Dashboard Audit, Phase 10 (Granular Permissions).
Existing seeded permissions (jobs:view/approve/delete, candidates:view/shortlist/
reject/message, team:*, companies:*, subscriptions:*) already differentiate
employer_owner/hr_manager/recruiter/interviewer somewhat — this migration fills
the real gaps: job CRUD had no create/edit/publish permission rows at all
(only view/approve existed, which were originally admin-moderation concepts),
and interview scheduling/feedback had no permission gate whatsoever.
"""
from alembic import op
import sqlalchemy as sa

revision = "q2k3l4m5n6o7"
down_revision = "p1j2k3l4m5n6"
branch_labels = None
depends_on = None

NEW_PERMISSIONS = [
    ("jobs", "create", "Create job postings"),
    ("jobs", "edit", "Edit job postings"),
    ("jobs", "publish", "Publish/pause/close/reopen/archive job postings"),
    ("candidates", "interview", "Schedule interviews and submit interview feedback"),
]

# role_name -> list of (resource, action) to grant, in addition to existing grants
GRANTS = {
    "employer_owner": [
        ("jobs", "create"), ("jobs", "edit"), ("jobs", "publish"), ("jobs", "delete"),
        ("candidates", "interview"),
    ],
    "hr_manager": [
        ("jobs", "create"), ("jobs", "edit"), ("jobs", "publish"), ("jobs", "delete"),
        ("candidates", "interview"),
    ],
    "recruiter": [
        ("jobs", "create"), ("jobs", "edit"),
        ("candidates", "interview"),
    ],
    "interviewer": [
        ("candidates", "interview"),
    ],
}


def upgrade() -> None:
    for resource, action, description in NEW_PERMISSIONS:
        op.execute(
            sa.text(
                "INSERT INTO permissions (id, resource, action, description) "
                "VALUES (gen_random_uuid(), :resource, :action, :description) "
                "ON CONFLICT (resource, action) DO NOTHING"
            ).bindparams(resource=resource, action=action, description=description)
        )

    for role_name, grants in GRANTS.items():
        for resource, action in grants:
            op.execute(
                sa.text(
                    """
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id FROM roles r, permissions p
                    WHERE r.name = :role_name AND p.resource = :resource AND p.action = :action
                    ON CONFLICT DO NOTHING
                    """
                ).bindparams(role_name=role_name, resource=resource, action=action)
            )


def downgrade() -> None:
    for role_name, grants in GRANTS.items():
        for resource, action in grants:
            op.execute(
                sa.text(
                    """
                    DELETE FROM role_permissions
                    WHERE role_id IN (SELECT id FROM roles WHERE name = :role_name)
                      AND permission_id IN (
                          SELECT id FROM permissions WHERE resource = :resource AND action = :action
                      )
                    """
                ).bindparams(role_name=role_name, resource=resource, action=action)
            )

    for resource, action, _ in NEW_PERMISSIONS:
        op.execute(
            sa.text("DELETE FROM permissions WHERE resource = :resource AND action = :action")
            .bindparams(resource=resource, action=action)
        )
