"""Seed the missing hiring_manager role.

TeamInviteRequest.role_name (app/modules/companies/schemas.py) has always
accepted "hiring_manager" as a valid invite role, and job_hiring_team already
uses "hiring_manager" as a per-job assignment tag — but no such row ever
existed in the `roles` table itself. Inviting anyone as a hiring manager has
always 400'd with "Role 'hiring_manager' not seeded in database."
(app/modules/companies/service.py::invite_team_member).

Permissions mirror what the frontend already assumes a hiring manager can do
(EmployerSidebar's isHiringManager nav branch: review candidates, see their
own pipeline/interviews; CompanyTeamPage's ROLE_PERMISSIONS entry: "View
candidates", "Update stages", "Add notes & ratings", "Submit interview
feedback") — a notch above interviewer (view-only) but without recruiter's
job-posting rights.

Revision ID: y5z6a7b8c9d0
Revises: x1y2z3a4b5c6
Create Date: 2026-09-19
"""
from alembic import op
import sqlalchemy as sa

revision = "y5z6a7b8c9d0"
down_revision = "x1y2z3a4b5c6"
branch_labels = None
depends_on = None

ROLE_NAME = "hiring_manager"
ROLE_DESCRIPTION = "Reviews candidates, updates pipeline stages, and submits interview feedback for their assigned jobs"

# (resource, action) — subset of already-seeded permissions (companies/schemas.py
# TeamInviteRequest pattern already allowed this role name; these are the
# permission rows f1a2b3c4d5e7/q2k3l4m5n6o7 already created for other roles).
GRANTS = [
    ("candidates", "view"),
    ("candidates", "shortlist"),
    ("candidates", "reject"),
    ("candidates", "message"),
    ("candidates", "interview"),
]


def upgrade() -> None:
    op.execute(
        sa.text(
            "INSERT INTO roles (id, name, description, is_system) "
            "VALUES (gen_random_uuid(), :name, :description, true) "
            "ON CONFLICT (name) DO NOTHING"
        ).bindparams(name=ROLE_NAME, description=ROLE_DESCRIPTION)
    )

    for resource, action in GRANTS:
        op.execute(
            sa.text(
                """
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id FROM roles r, permissions p
                WHERE r.name = :role_name AND p.resource = :resource AND p.action = :action
                ON CONFLICT DO NOTHING
                """
            ).bindparams(role_name=ROLE_NAME, resource=resource, action=action)
        )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE name = :name)"
        ).bindparams(name=ROLE_NAME)
    )
    op.execute(sa.text("DELETE FROM roles WHERE name = :name").bindparams(name=ROLE_NAME))
