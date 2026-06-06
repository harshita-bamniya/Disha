"""add_job_postings

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-13 03:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS job_postings (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            employer_id     UUID NOT NULL REFERENCES employer_profiles(id) ON DELETE CASCADE,
            title           VARCHAR(200) NOT NULL,
            description     TEXT NOT NULL,
            sector          VARCHAR(100) NOT NULL,
            required_skills JSONB NOT NULL,
            min_k_score     INTEGER NOT NULL DEFAULT 0,
            salary_range    VARCHAR(50),
            growth_outlook  VARCHAR(20),
            example_roles   JSONB,
            location        VARCHAR(150),
            is_active       BOOLEAN NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_job_postings_employer_id ON job_postings (employer_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_job_postings_is_active   ON job_postings (is_active);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS job_postings;")
