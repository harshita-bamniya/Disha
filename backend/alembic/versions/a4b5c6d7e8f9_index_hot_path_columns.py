"""Add indexes on columns that are actually used as filter/sort keys.

applications.created_at is the sort key for admin/employer application lists
(admin/service.py, matching/service.py); application_status_history.changed_by,
candidate_notes.author_id, candidate_interview_feedback.interviewer_id are all
filtered per-recruiter in matching/service.py's get_recruiter_performance.
None of these had an index despite being confirmed hot paths.

Revision ID: a4b5c6d7e8f9
Revises: z3a4b5c6d7e8
Create Date: 2026-09-02
"""
from alembic import op

revision = "a4b5c6d7e8f9"
down_revision = "z3a4b5c6d7e8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_applications_created_at", "applications", ["created_at"])
    op.create_index("ix_application_status_history_changed_by", "application_status_history", ["changed_by"])
    op.create_index("ix_candidate_notes_author_id", "candidate_notes", ["author_id"])
    op.create_index("ix_candidate_interview_feedback_interviewer_id", "candidate_interview_feedback", ["interviewer_id"])


def downgrade() -> None:
    op.drop_index("ix_candidate_interview_feedback_interviewer_id", table_name="candidate_interview_feedback")
    op.drop_index("ix_candidate_notes_author_id", table_name="candidate_notes")
    op.drop_index("ix_application_status_history_changed_by", table_name="application_status_history")
    op.drop_index("ix_applications_created_at", table_name="applications")
