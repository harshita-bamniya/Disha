"""add psychological assessments

Revision ID: i8d9e0f1g2h3
Revises: h7c8d9e0f1g2
Create Date: 2026-05-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'i8d9e0f1g2h3'
down_revision = 'h7c8d9e0f1g2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enums with DO-block idiom (safe on re-run)
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE risk_tolerance_enum AS ENUM ('low', 'medium', 'high');
        EXCEPTION WHEN duplicate_object THEN null; END $$
    """))
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE motivation_type_enum AS ENUM ('intrinsic', 'extrinsic', 'mixed');
        EXCEPTION WHEN duplicate_object THEN null; END $$
    """))
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE identity_attachment_enum AS ENUM ('low', 'medium', 'high');
        EXCEPTION WHEN duplicate_object THEN null; END $$
    """))
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE support_system_enum AS ENUM ('strong', 'moderate', 'weak');
        EXCEPTION WHEN duplicate_object THEN null; END $$
    """))

    # Use raw SQL for the table so SQLAlchemy doesn't auto-try to create enum types
    op.execute(sa.text("""
        CREATE TABLE psychological_assessments (
            id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            burnout_score           INTEGER NOT NULL,
            confidence_index        INTEGER NOT NULL,
            financial_pressure_score INTEGER NOT NULL,
            risk_tolerance          risk_tolerance_enum NOT NULL,
            motivation_type         motivation_type_enum NOT NULL,
            identity_attachment     identity_attachment_enum NOT NULL,
            support_system          support_system_enum NOT NULL,
            disha_insight           TEXT,
            created_at              TIMESTAMPTZ DEFAULT now(),
            updated_at              TIMESTAMPTZ DEFAULT now()
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX ix_psychological_assessments_user_id ON psychological_assessments (user_id)"
    ))


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS psychological_assessments"))
    op.execute(sa.text("DROP TYPE IF EXISTS risk_tolerance_enum"))
    op.execute(sa.text("DROP TYPE IF EXISTS motivation_type_enum"))
    op.execute(sa.text("DROP TYPE IF EXISTS identity_attachment_enum"))
    op.execute(sa.text("DROP TYPE IF EXISTS support_system_enum"))
