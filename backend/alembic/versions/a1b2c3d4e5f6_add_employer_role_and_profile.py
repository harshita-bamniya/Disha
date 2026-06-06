"""add_employer_role_and_profile

Revision ID: a1b2c3d4e5f6
Revises: 0da7a0ba4100
Create Date: 2026-05-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '0da7a0ba4100'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO roles (id, name, description)
        VALUES (gen_random_uuid(), 'employer', 'Company or recruiter seeking UPSC-background talent')
        ON CONFLICT (name) DO NOTHING;
        """
    )

    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE company_size_enum AS ENUM (
                '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS employer_profiles (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            company_name    VARCHAR(255) NOT NULL,
            industry        VARCHAR(100) NOT NULL,
            company_size    company_size_enum NOT NULL,
            website         VARCHAR(500),
            gst_number      VARCHAR(20),
            contact_person  VARCHAR(150) NOT NULL,
            designation     VARCHAR(100),
            city            VARCHAR(100) NOT NULL,
            description     TEXT,
            is_approved     BOOLEAN NOT NULL DEFAULT FALSE,
            approved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
            approved_at     TIMESTAMPTZ,
            rejection_reason TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )

    op.execute("CREATE INDEX IF NOT EXISTS ix_employer_profiles_user_id ON employer_profiles (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_employer_profiles_company_name ON employer_profiles (company_name);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_employer_profiles_is_approved ON employer_profiles (is_approved);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS employer_profiles;")
    op.execute("DROP TYPE IF EXISTS company_size_enum;")
    op.execute("DELETE FROM roles WHERE name = 'employer';")
