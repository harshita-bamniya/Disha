"""add_aspirant_profiles

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-13 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE gender_enum AS ENUM ('male','female','other','prefer_not_to_say');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE qualification_enum AS ENUM ('graduate','post_graduate','doctorate','diploma','other');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE upsc_exam_enum AS ENUM ('cse','capf','cds','ies','cms','state_pcs','other');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE upsc_stage_enum AS ENUM ('none','prelims','mains','interview');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS aspirant_profiles (
            id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

            -- Step 1: Personal
            full_name               VARCHAR(150),
            date_of_birth           VARCHAR(10),
            gender                  gender_enum,
            city                    VARCHAR(100),
            state                   VARCHAR(100),

            -- Step 2: Education
            highest_qualification   qualification_enum,
            degree                  VARCHAR(150),
            field_of_study          VARCHAR(150),
            institution             VARCHAR(255),
            graduation_year         INTEGER,

            -- Step 3: UPSC Journey
            upsc_exam               upsc_exam_enum,
            years_preparing         INTEGER,
            upsc_attempts           INTEGER DEFAULT 0,
            highest_stage_cleared   upsc_stage_enum DEFAULT 'none',
            optional_subject        VARCHAR(100),

            -- Step 4: Work Experience
            has_work_experience     BOOLEAN,
            work_experience_years   INTEGER,
            work_experience_domain  VARCHAR(150),
            last_designation        VARCHAR(150),

            -- Step 5: Skills
            skills                  JSONB,

            -- Step 6: Career Preferences
            preferred_sectors       JSONB,
            preferred_locations     JSONB,
            open_to_relocation      BOOLEAN,
            expected_salary_min     INTEGER,
            expected_salary_max     INTEGER,

            -- Tracking
            current_step            INTEGER NOT NULL DEFAULT 1,
            is_completed            BOOLEAN NOT NULL DEFAULT FALSE,

            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_aspirant_profiles_user_id ON aspirant_profiles (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_aspirant_profiles_is_completed ON aspirant_profiles (is_completed);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS aspirant_profiles;")
    op.execute("DROP TYPE IF EXISTS upsc_stage_enum;")
    op.execute("DROP TYPE IF EXISTS upsc_exam_enum;")
    op.execute("DROP TYPE IF EXISTS qualification_enum;")
    op.execute("DROP TYPE IF EXISTS gender_enum;")
