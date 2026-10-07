"""Interview: session language and the optional "media" consent.

interview_sessions.language is the language the interview is conducted in
(en / hi / hinglish). The consent check constraint gains "media": the
candidate's opt-in to keeping their answer audio for a limited time.

Revision ID: b7c8d9e0f1a2
Revises: a6b7c8d9e0f1
Create Date: 2026-10-02
"""
import sqlalchemy as sa
from alembic import op

revision = "b7c8d9e0f1a2"
down_revision = "a6b7c8d9e0f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "interview_sessions",
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
    )
    op.drop_constraint("ck_interview_consent_kind", "interview_consents", type_="check")
    op.create_check_constraint(
        "ck_interview_consent_kind", "interview_consents",
        "kind IN ('ai_processing','own_effort','improve_product','media')",
    )


def downgrade() -> None:
    op.execute("DELETE FROM interview_consents WHERE kind = 'media'")
    op.drop_constraint("ck_interview_consent_kind", "interview_consents", type_="check")
    op.create_check_constraint(
        "ck_interview_consent_kind", "interview_consents",
        "kind IN ('ai_processing','own_effort','improve_product')",
    )
    op.drop_column("interview_sessions", "language")
