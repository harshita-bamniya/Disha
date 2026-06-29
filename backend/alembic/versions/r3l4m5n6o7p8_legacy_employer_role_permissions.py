"""Fix: grant the legacy 'employer' role the same permission set as
'employer_owner' — every existing real employer account is still on this
older role name, and it had ZERO company-side permissions granted across
migrations f1a2b3c4d5e7 and q2k3l4m5n6o7, which would have locked every
current employer out of job/team/subscription management.

Revision ID: r3l4m5n6o7p8
Revises: q2k3l4m5n6o7
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa

revision = "r3l4m5n6o7p8"
down_revision = "q2k3l4m5n6o7"
branch_labels = None
depends_on = None

GRANTS = [
    ("jobs", "view"), ("jobs", "approve"), ("jobs", "create"), ("jobs", "edit"),
    ("jobs", "publish"), ("jobs", "delete"),
    ("candidates", "view"), ("candidates", "shortlist"), ("candidates", "reject"),
    ("candidates", "message"), ("candidates", "interview"),
    ("companies", "view"), ("companies", "edit"),
    ("team", "invite"), ("team", "remove"), ("team", "transfer_ownership"),
    ("subscriptions", "view"), ("subscriptions", "manage"),
]


def upgrade() -> None:
    for resource, action in GRANTS:
        op.execute(
            sa.text(
                """
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id FROM roles r, permissions p
                WHERE r.name = 'employer' AND p.resource = :resource AND p.action = :action
                ON CONFLICT DO NOTHING
                """
            ).bindparams(resource=resource, action=action)
        )


def downgrade() -> None:
    for resource, action in GRANTS:
        op.execute(
            sa.text(
                """
                DELETE FROM role_permissions
                WHERE role_id IN (SELECT id FROM roles WHERE name = 'employer')
                  AND permission_id IN (
                      SELECT id FROM permissions WHERE resource = :resource AND action = :action
                  )
                """
            ).bindparams(resource=resource, action=action)
        )
