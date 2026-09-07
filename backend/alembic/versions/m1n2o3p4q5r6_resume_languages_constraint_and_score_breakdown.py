"""Add languages to resume_sections CHECK constraint; add score_breakdown and target_job_description to resumes.

Revision ID: m1n2o3p4q5r6
Revises: l7m8n9o0p1q2, a3b4c5d6e7f8, b2c3d4e5f6g7
Create Date: 2026-07-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "m1n2o3p4q5r6"
down_revision = ("l7m8n9o0p1q2", "a3b4c5d6e7f8", "b2c3d4e5f6g7")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Drop the old CHECK constraint that excluded 'languages'
    op.drop_constraint("ck_section_type", "resume_sections", type_="check")

    # 2. Re-create the constraint with 'languages' included
    op.create_check_constraint(
        "ck_section_type",
        "resume_sections",
        "section_type IN ('summary','experience','education','skills','achievements','projects','certifications','languages')",
    )

    # 3. Add score_breakdown JSONB column to resumes
    op.add_column(
        "resumes",
        sa.Column("score_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    # 4. Add target_job_description Text column to resumes
    op.add_column(
        "resumes",
        sa.Column("target_job_description", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("resumes", "target_job_description")
    op.drop_column("resumes", "score_breakdown")

    op.drop_constraint("ck_section_type", "resume_sections", type_="check")
    op.create_check_constraint(
        "ck_section_type",
        "resume_sections",
        "section_type IN ('summary','experience','education','skills','achievements','projects','certifications')",
    )
