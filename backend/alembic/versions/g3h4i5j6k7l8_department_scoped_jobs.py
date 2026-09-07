"""Department-scoped jobs — Module 06 ATS overhaul.

Three changes wired together to make departments the scoping boundary
for job visibility and candidate pipeline access:

1. company_departments: add description + head_employer_id
   (head = the EmployerProfile leading this department)

2. employer_profiles: add department_id
   NULL  → company-wide access (owner / hr_manager)
   non-NULL → scoped to that department (recruiter / interviewer / hiring_manager)

3. job_postings: add department_id
   Every new job belongs to a department; legacy rows stay NULL and remain
   visible to company-wide users only (backwards-compatible).

Revision ID: g3h4i5j6k7l8
Revises: f4a5b6c7d8e9
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "g3h4i5j6k7l8"
down_revision = "f4a5b6c7d8e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Expand company_departments
    op.add_column("company_departments",
        sa.Column("description", sa.Text(), nullable=True))
    op.add_column("company_departments",
        sa.Column("head_employer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("employer_profiles.id", ondelete="SET NULL"),
                  nullable=True))
    op.create_index("ix_company_departments_head_employer_id",
                    "company_departments", ["head_employer_id"])

    # 2. Add department_id to employer_profiles
    op.add_column("employer_profiles",
        sa.Column("department_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("company_departments.id", ondelete="SET NULL"),
                  nullable=True))
    op.create_index("ix_employer_profiles_department_id",
                    "employer_profiles", ["department_id"])

    # 3. Add department_id to job_postings
    op.add_column("job_postings",
        sa.Column("department_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("company_departments.id", ondelete="SET NULL"),
                  nullable=True))
    op.create_index("ix_job_postings_department_id",
                    "job_postings", ["department_id"])


def downgrade() -> None:
    op.drop_index("ix_job_postings_department_id", table_name="job_postings")
    op.drop_column("job_postings", "department_id")

    op.drop_index("ix_employer_profiles_department_id", table_name="employer_profiles")
    op.drop_column("employer_profiles", "department_id")

    op.drop_index("ix_company_departments_head_employer_id", table_name="company_departments")
    op.drop_column("company_departments", "head_employer_id")
    op.drop_column("company_departments", "description")
