"""Remove unused psychological-assessment fields, add one-time learning setup.

Audit finding (2026-08-25): financial_pressure_score, risk_tolerance,
motivation_type, and identity_attachment were collected during registration
(Step 7) but traced to no real effect anywhere in the product beyond a soft,
never-gated R-score contribution and a one-time welcome-message sentence.
support_system had the same profile plus a diffuse contribution to the
profile-embedding text. burnout_score and confidence_index DO have a real,
traced effect (they directly cap job-plan module hours and set tone in
jobs/plan_generator.py) — those two survive, but move out of registration
into a one-time "learning setup" step asked right before a user's first
roadmap/plan generation, alongside three genuinely missing inputs the
roadmap-input audit identified: weekly study hours (pacing is currently a
hardcoded STUDY_HOURS_PER_DAY=2 constant), an optional target completion
date, and per-skill proficiency (the skill-gap check is currently binary).

disha_insight moves from psychological_assessments to aspirant_profiles
since it's now generated at Step 6 (registration) completion, before any
PsychologicalAssessment row exists.

Revision ID: x0y1z2a3b4c5
Revises: v9w0x1y2z3a4
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "x0y1z2a3b4c5"
down_revision = "v9w0x1y2z3a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── aspirant_profiles: add disha_insight + one-time learning setup fields ──
    op.add_column("aspirant_profiles", sa.Column("disha_insight", sa.Text(), nullable=True))
    op.add_column("aspirant_profiles", sa.Column("weekly_study_hours", sa.Integer(), nullable=True))
    op.add_column("aspirant_profiles", sa.Column("target_completion_date", sa.Date(), nullable=True))
    op.add_column("aspirant_profiles", sa.Column("skill_proficiency", JSONB(), nullable=True))

    # Carry forward any existing welcome messages before dropping their source column
    op.execute(sa.text("""
        UPDATE aspirant_profiles ap
        SET disha_insight = pa.disha_insight
        FROM psychological_assessments pa
        WHERE pa.user_id = ap.user_id AND pa.disha_insight IS NOT NULL
    """))

    # ── psychological_assessments: drop the 5 fields with no traced effect ────
    op.drop_column("psychological_assessments", "disha_insight")
    op.drop_column("psychological_assessments", "financial_pressure_score")
    op.drop_column("psychological_assessments", "risk_tolerance")
    op.drop_column("psychological_assessments", "motivation_type")
    op.drop_column("psychological_assessments", "identity_attachment")
    op.drop_column("psychological_assessments", "support_system")

    op.execute(sa.text("DROP TYPE IF EXISTS risk_tolerance_enum"))
    op.execute(sa.text("DROP TYPE IF EXISTS motivation_type_enum"))
    op.execute(sa.text("DROP TYPE IF EXISTS identity_attachment_enum"))
    op.execute(sa.text("DROP TYPE IF EXISTS support_system_enum"))


def downgrade() -> None:
    # NOTE: lossy — financial_pressure/risk_tolerance/motivation_type/
    # identity_attachment/support_system values are not recoverable. Columns
    # are recreated nullable rather than NOT NULL for that reason.
    op.execute(sa.text("CREATE TYPE risk_tolerance_enum AS ENUM ('low', 'medium', 'high')"))
    op.execute(sa.text("CREATE TYPE motivation_type_enum AS ENUM ('intrinsic', 'extrinsic', 'mixed')"))
    op.execute(sa.text("CREATE TYPE identity_attachment_enum AS ENUM ('low', 'medium', 'high')"))
    op.execute(sa.text("CREATE TYPE support_system_enum AS ENUM ('strong', 'moderate', 'weak')"))

    op.add_column("psychological_assessments", sa.Column("support_system", sa.Enum("strong", "moderate", "weak", name="support_system_enum"), nullable=True))
    op.add_column("psychological_assessments", sa.Column("identity_attachment", sa.Enum("low", "medium", "high", name="identity_attachment_enum"), nullable=True))
    op.add_column("psychological_assessments", sa.Column("motivation_type", sa.Enum("intrinsic", "extrinsic", "mixed", name="motivation_type_enum"), nullable=True))
    op.add_column("psychological_assessments", sa.Column("risk_tolerance", sa.Enum("low", "medium", "high", name="risk_tolerance_enum"), nullable=True))
    op.add_column("psychological_assessments", sa.Column("financial_pressure_score", sa.Integer(), nullable=True))
    op.add_column("psychological_assessments", sa.Column("disha_insight", sa.Text(), nullable=True))

    op.execute(sa.text("""
        UPDATE psychological_assessments pa
        SET disha_insight = ap.disha_insight
        FROM aspirant_profiles ap
        WHERE ap.user_id = pa.user_id AND ap.disha_insight IS NOT NULL
    """))

    op.drop_column("aspirant_profiles", "skill_proficiency")
    op.drop_column("aspirant_profiles", "target_completion_date")
    op.drop_column("aspirant_profiles", "weekly_study_hours")
    op.drop_column("aspirant_profiles", "disha_insight")
