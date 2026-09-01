"""Add skill_taxonomy — the growing, validated skill list backing autocomplete
and custom-skill validation on Step 5 and the Profile page's Skills section.

Seeded with the curated 30-item onboarding taxonomy plus every skill already
used in an active job posting or career track (already real, human-entered
data). Grows afterward via onboarding/skill_validation.py, which only adds a
new row once ESCO or the platform's own LLM confirms a typed skill is real.

Revision ID: y2z3a4b5c6d7
Revises: x0y1z2a3b4c5
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "y2z3a4b5c6d7"
down_revision = "x0y1z2a3b4c5"
branch_labels = None
depends_on = None

_CURATED_SKILLS = [
    "Analytical Reasoning", "Research & Analysis", "Data Interpretation",
    "Data Analysis", "Policy Research", "Report Writing", "Essay Writing",
    "Public Speaking", "Communication", "Leadership", "Management",
    "Project Management", "Strategic Planning", "Economics",
    "Public Administration", "Polity & Governance", "Ethics & Integrity",
    "International Relations", "Law & Legal Knowledge", "Stakeholder Engagement",
    "English Proficiency", "Hindi Proficiency", "Computer Skills",
    "Science & Technology", "Current Affairs", "History", "Geography",
    "Environment", "Teaching & Training", "Budget & Finance",
]


def upgrade() -> None:
    op.create_table(
        "skill_taxonomy",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="curated"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_skill_taxonomy_name", "skill_taxonomy", ["name"])
    # Case-insensitive uniqueness — the real dedup guarantee, not the column itself.
    op.execute(sa.text(
        "CREATE UNIQUE INDEX ix_skill_taxonomy_name_lower ON skill_taxonomy (lower(name))"
    ))

    conn = op.get_bind()

    seen: set[str] = set()
    rows = []
    for name in _CURATED_SKILLS:
        if name.lower() not in seen:
            seen.add(name.lower())
            rows.append({"name": name, "source": "curated"})

    for (skills,) in conn.execute(sa.text(
        "SELECT required_skills FROM job_postings WHERE required_skills IS NOT NULL"
    )).fetchall():
        for s in (skills or []):
            if isinstance(s, str) and s.strip() and s.strip().lower() not in seen:
                seen.add(s.strip().lower())
                rows.append({"name": s.strip(), "source": "platform"})

    for (skills,) in conn.execute(sa.text(
        "SELECT required_skills FROM career_tracks WHERE required_skills IS NOT NULL"
    )).fetchall():
        for s in (skills or []):
            if isinstance(s, str) and s.strip() and s.strip().lower() not in seen:
                seen.add(s.strip().lower())
                rows.append({"name": s.strip(), "source": "platform"})

    if rows:
        conn.execute(
            sa.text("INSERT INTO skill_taxonomy (name, source) VALUES (:name, :source)"),
            rows,
        )


def downgrade() -> None:
    op.drop_table("skill_taxonomy")
