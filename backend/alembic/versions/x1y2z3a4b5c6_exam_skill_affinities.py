"""Add exam_skill_affinities — a small, DB-editable table of low-confidence
transferable-skill priors per UPSC exam, used to give job-match ranking a
small capped nudge toward exam-aligned skills (see app/modules/krs/matching.py
and app/modules/krs/exam_affinity.py). Never merged into an aspirant's actual
skills_you_have/skills_to_develop — those stay based only on self-reported
skills.

Revision ID: x1y2z3a4b5c6
Revises: w1x2y3z4a5b6
Create Date: 2026-09-18
"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "x1y2z3a4b5c6"
down_revision = "w1x2y3z4a5b6"
branch_labels = None
depends_on = None


_DEFAULT_AFFINITIES = {
    "cse":       ["Policy Analysis", "Public Administration", "Stakeholder Engagement", "Report Writing", "Governance"],
    "state_pcs": ["Public Administration", "Regional Governance", "Policy Analysis", "Stakeholder Engagement"],
    "capf":      ["Risk Assessment", "Crisis Management", "Team Leadership", "Operations Management", "Compliance & Governance"],
    "cds":       ["Team Leadership", "Operations Management", "Crisis Management", "Logistics Planning", "Discipline & Execution"],
    "ies":       ["Project Management", "Technical Problem Solving", "Infrastructure Planning", "Quality Assurance"],
    "cms":       ["Healthcare Administration", "Patient Care Coordination", "Public Health", "Clinical Judgment"],
    "other":     [],
}


def upgrade() -> None:
    table = op.create_table(
        "exam_skill_affinities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("exam", sa.String(20), nullable=False, unique=True, index=True),
        sa.Column("implied_skills", JSONB, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.bulk_insert(table, [
        {"id": uuid.uuid4(), "exam": exam, "implied_skills": skills, "is_active": True}
        for exam, skills in _DEFAULT_AFFINITIES.items()
    ])


def downgrade() -> None:
    op.drop_table("exam_skill_affinities")
