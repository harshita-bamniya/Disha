"""Admin dashboard: daily user activity table + the two service-level targets as editable settings.

Revision ID: za0f1a2b3c4d5
Revises: z9e0f1a2b3c4
"""
import json

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "za0f1a2b3c4d5"
down_revision = "z9e0f1a2b3c4"
branch_labels = None
depends_on = None

SETTINGS = (
    ("verification_target_days", 3, "Employer verification requests waiting longer than this many days count as overdue on the admin dashboard."),
    ("ticket_first_response_hours", 24, "Open support tickets with no staff reply after this many hours count as overdue on the admin dashboard."),
)


def upgrade() -> None:
    op.create_table(
        "user_activity_daily",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("activity_date", sa.Date, primary_key=True),
    )
    op.create_index("ix_user_activity_daily_date", "user_activity_daily", ["activity_date"])

    conn = op.get_bind()
    for key, value, description in SETTINGS:
        conn.execute(
            sa.text(
                "INSERT INTO platform_settings (id, key, value, description) "
                "SELECT gen_random_uuid(), :k, CAST(:v AS jsonb), :d "
                "WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = :k)"
            ),
            {"k": key, "v": json.dumps(value), "d": description},
        )


def downgrade() -> None:
    op.execute("DELETE FROM platform_settings WHERE key IN ('verification_target_days', 'ticket_first_response_hours')")
    op.drop_index("ix_user_activity_daily_date", table_name="user_activity_daily")
    op.drop_table("user_activity_daily")
