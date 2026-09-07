"""ATS pipeline extras: widen application status to full 9-stage pipeline,
add candidate_notes, candidate_ratings, candidate_interview_feedback.

Revision ID: h3c4d5e6f7g9
Revises: g2b3c4d5e6f8
Create Date: 2026-06-26

Part of Module 05 — Enterprise Admin Panel & Employer Portal, Phase 3.
Status widening is a superset (existing rows: applied/under_review/shortlisted/
rejected/hired/withdrawn all remain valid) — no data migration needed, but
'under_review' is kept as a legacy alias since old rows may already use it.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'h3c4d5e6f7g9'
down_revision: Union[str, None] = 'g2b3c4d5e6f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_STATUSES = (
    "applied", "under_review", "screening", "shortlisted", "interview_scheduled",
    "interview_completed", "offer_sent", "hired", "rejected", "withdrawn",
)
STATUS_LIST_SQL = "(" + ",".join(f"'{s}'" for s in NEW_STATUSES) + ")"


def upgrade() -> None:
    op.drop_constraint("ck_application_status", "applications", type_="check")
    op.create_check_constraint("ck_application_status", "applications", f"status IN {STATUS_LIST_SQL}")

    op.drop_constraint("ck_hist_to_status", "application_status_history", type_="check")
    op.create_check_constraint("ck_hist_to_status", "application_status_history", f"to_status IN {STATUS_LIST_SQL}")

    op.create_table(
        "candidate_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("is_internal", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_candidate_notes_application_id", "candidate_notes", ["application_id"])

    op.create_table(
        "candidate_ratings",
        sa.Column("application_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("rater_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_check_constraint("ck_candidate_rating_range", "candidate_ratings", "rating BETWEEN 1 AND 5")

    op.create_table(
        "candidate_interview_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("interviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recommendation", sa.String(20), nullable=True),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_candidate_interview_feedback_application_id", "candidate_interview_feedback", ["application_id"])
    op.create_check_constraint(
        "ck_candidate_interview_feedback_recommendation", "candidate_interview_feedback",
        "recommendation IS NULL OR recommendation IN ('strong_yes','yes','no','strong_no')",
    )


def downgrade() -> None:
    op.drop_index("ix_candidate_interview_feedback_application_id", table_name="candidate_interview_feedback")
    op.drop_table("candidate_interview_feedback")

    op.drop_table("candidate_ratings")

    op.drop_index("ix_candidate_notes_application_id", table_name="candidate_notes")
    op.drop_table("candidate_notes")

    op.drop_constraint("ck_hist_to_status", "application_status_history", type_="check")
    op.create_check_constraint(
        "ck_hist_to_status", "application_status_history",
        "to_status IN ('applied','under_review','shortlisted','rejected','hired','withdrawn')",
    )

    op.drop_constraint("ck_application_status", "applications", type_="check")
    op.create_check_constraint(
        "ck_application_status", "applications",
        "status IN ('applied','under_review','shortlisted','rejected','hired','withdrawn')",
    )
