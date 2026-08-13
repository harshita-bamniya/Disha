"""Enforce NOT NULL on users.role_id — every code path already assigns it.

Revision ID: p2q3r4s5t6u7
Revises: o1p2q3r4s5t6
Create Date: 2026-08-13
"""
from alembic import op
import sqlalchemy as sa

revision = "p2q3r4s5t6u7"
down_revision = "o1p2q3r4s5t6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Safety check: abort if any NULLs exist so the migration never silently
    # corrupts data. In practice none should exist — every registration path
    # (register_user, register_employer, google_login) assigns role_id.
    op.execute("""
        DO $$
        DECLARE
            null_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO null_count FROM users WHERE role_id IS NULL;
            IF null_count > 0 THEN
                RAISE EXCEPTION
                    'Cannot enforce NOT NULL on users.role_id: % row(s) have NULL role_id. '
                    'Inspect and assign a role before running this migration.',
                    null_count;
            END IF;
        END;
        $$;
    """)

    op.alter_column(
        "users",
        "role_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "role_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
    )
