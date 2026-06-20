"""DB model fixes: roles master table enhancements + data type and constraint fixes.

Changes:
- roles: add is_system flag (protects seeded system roles from deletion)
- aspirant_profiles: date_of_birth VARCHAR(10) → DATE
- krs_scores: CHECK constraints (0-100) on k_score, r_score, s_score, composite
- career_matches: CHECK constraints (0-100) on match_score, skill_overlap

Revision ID: z1a2b3c4d5e6_scalable_rbac
Revises: f2a9b1c3d5e7
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa

revision = "z1a2b3c4d5e6_scalable_rbac"
down_revision = "f2a9b1c3d5e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. roles: add is_system flag ──────────────────────────────────────────
    op.add_column(
        "roles",
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
    )
    # Mark the four seeded system roles so they cannot be deleted via admin UI
    op.execute("""
        UPDATE roles SET is_system = true
        WHERE name IN ('aspirant', 'employer', 'admin', 'super_admin')
    """)

    # ── 2. aspirant_profiles.date_of_birth: VARCHAR(10) → DATE ───────────────
    op.execute("""
        ALTER TABLE aspirant_profiles
        ALTER COLUMN date_of_birth TYPE DATE
        USING CASE
            WHEN date_of_birth IS NULL THEN NULL
            ELSE date_of_birth::date
        END
    """)

    # ── 3. krs_scores: CHECK constraints 0-100 ────────────────────────────────
    op.create_check_constraint("ck_krs_k_score",   "krs_scores", "k_score BETWEEN 0 AND 100")
    op.create_check_constraint("ck_krs_r_score",   "krs_scores", "r_score BETWEEN 0 AND 100")
    op.create_check_constraint("ck_krs_s_score",   "krs_scores", "s_score BETWEEN 0 AND 100")
    op.create_check_constraint("ck_krs_composite", "krs_scores", "composite BETWEEN 0 AND 100")

    # ── 4. career_matches: CHECK constraints 0-100 ───────────────────────────
    op.create_check_constraint("ck_career_match_score",   "career_matches", "match_score BETWEEN 0 AND 100")
    op.create_check_constraint("ck_career_skill_overlap", "career_matches", "skill_overlap BETWEEN 0 AND 100")


def downgrade() -> None:
    op.drop_constraint("ck_career_skill_overlap", "career_matches", type_="check")
    op.drop_constraint("ck_career_match_score",   "career_matches", type_="check")

    op.drop_constraint("ck_krs_composite", "krs_scores", type_="check")
    op.drop_constraint("ck_krs_s_score",   "krs_scores", type_="check")
    op.drop_constraint("ck_krs_r_score",   "krs_scores", type_="check")
    op.drop_constraint("ck_krs_k_score",   "krs_scores", type_="check")

    op.execute("""
        ALTER TABLE aspirant_profiles
        ALTER COLUMN date_of_birth TYPE VARCHAR(10)
        USING CASE
            WHEN date_of_birth IS NULL THEN NULL
            ELSE date_of_birth::text
        END
    """)

    op.drop_column("roles", "is_system")
