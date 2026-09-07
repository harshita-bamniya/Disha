"""Backfill target_skills on existing seeded learning paths

Revision ID: u6v7w8x9y0z1
Revises: t5u6v7w8x9y0
Create Date: 2026-06-09

Why this exists:
  learning_paths.target_skills was added in migration s4t5u6v7w8x9.
  Any deployment whose seed ran before that migration has NULL target_skills
  on all 5 default paths. This migration backfills them by name so the
  semantic gap-to-path matching works on every environment without manual SQL.

  Safe to run multiple times — UPDATE ... WHERE name = '...' is idempotent.
"""
import json
from alembic import op
import sqlalchemy as sa

revision = 'u6v7w8x9y0z1'
down_revision = 't5u6v7w8x9y0'
branch_labels = None
depends_on = None

# Map each seeded path name → master-list skills it develops
_TARGET_SKILLS: dict[str, list[str]] = {
    "Breaking into Policy Consulting": [
        "Policy Research", "Analytical Reasoning", "Report Writing",
        "Stakeholder Engagement", "Strategic Planning",
        "Written Communication", "Presentation Skills",
    ],
    "ESG and Sustainability Careers": [
        "Ethics & Integrity", "Research & Analysis", "Stakeholder Engagement",
        "Data Interpretation", "Policy Research", "Report Writing",
        "Project Management",
    ],
    "Corporate Communication Mastery": [
        "Written Communication", "Public Speaking", "Presentation Skills",
        "Report Writing", "Stakeholder Engagement", "English Proficiency",
    ],
    "Data Analysis for Non-Technical Professionals": [
        "Data Analysis", "Data Interpretation", "Research & Analysis",
        "Analytical Reasoning", "MS Office / Excel",
        "Computer Skills", "Problem Solving",
    ],
    "Leadership and Team Management": [
        "Leadership", "Management", "Project Management",
        "Strategic Planning", "Decision Making",
        "Stakeholder Engagement", "Budget & Finance",
    ],
}


def upgrade() -> None:
    conn = op.get_bind()
    for name, skills in _TARGET_SKILLS.items():
        conn.execute(
            sa.text(
                "UPDATE learning_paths SET target_skills = :skills "
                "WHERE name = :name AND target_skills IS NULL"
            ),
            {"skills": json.dumps(skills), "name": name},
        )


def downgrade() -> None:
    # Null out target_skills only for the rows we seeded (leave any custom paths alone)
    conn = op.get_bind()
    for name in _TARGET_SKILLS:
        conn.execute(
            sa.text("UPDATE learning_paths SET target_skills = NULL WHERE name = :name"),
            {"name": name},
        )
