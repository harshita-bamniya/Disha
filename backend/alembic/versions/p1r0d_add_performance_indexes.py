"""Add performance indexes for production queries.

Revision ID: p1r0d_add_performance_indexes
Revises: n3j4k5l6m7n8
Create Date: 2026-06-07
"""
from alembic import op

revision = "p1r0d_add_performance_indexes"
down_revision = "n3j4k5l6m7n8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Job postings ──────────────────────────────────────────────────────────
    # Most common query: active jobs filtered by sector
    op.create_index(
        "idx_job_postings_sector_active",
        "job_postings",
        ["sector", "is_active"],
    )
    # Expiry filter — find expired jobs for cleanup
    op.create_index(
        "idx_job_postings_expires_at",
        "job_postings",
        ["expires_at"],
        postgresql_where="expires_at IS NOT NULL",
    )
    # Employer dashboard: jobs by employer ordered by creation time
    op.create_index(
        "idx_job_postings_employer_created",
        "job_postings",
        ["employer_id", "created_at"],
    )

    # ── Aspirant profiles ─────────────────────────────────────────────────────
    # Admin queries filter by onboarding step
    op.create_index(
        "idx_aspirant_profiles_step",
        "aspirant_profiles",
        ["current_step", "is_completed"],
    )

    # ── Career matches ────────────────────────────────────────────────────────
    # Dashboard loads top-N matches per user ordered by score
    op.create_index(
        "idx_career_matches_user_score",
        "career_matches",
        ["user_id", "match_score"],
    )

    # ── OTP verifications ─────────────────────────────────────────────────────
    # Auth flow: find active OTPs by user + purpose
    op.create_index(
        "idx_otp_verifications_user_purpose",
        "otp_verifications",
        ["user_id", "purpose", "used_at"],
    )

    # ── Refresh tokens ────────────────────────────────────────────────────────
    # Token rotation: lookup by hash (already unique but needs fast lookup)
    op.create_index(
        "idx_refresh_tokens_user_valid",
        "refresh_tokens",
        ["user_id", "revoked_at", "expires_at"],
    )

    # ── Counsellor conversations ──────────────────────────────────────────────
    # List conversations for user ordered by last activity
    op.create_index(
        "idx_conversations_user_updated",
        "conversations",
        ["user_id", "updated_at"],
    )
    # Message history for a conversation ordered by time
    op.create_index(
        "idx_messages_conversation_created",
        "messages",
        ["conversation_id", "created_at"],
    )

    # ── Counsellor memory ─────────────────────────────────────────────────────
    # Active memory retrieval per user
    op.create_index(
        "idx_counsellor_memory_user_active",
        "counsellor_memory",
        ["user_id", "is_active", "created_at"],
    )

    # ── Interview sessions ────────────────────────────────────────────────────
    # Session list per user
    op.create_index(
        "idx_interview_sessions_user_created",
        "interview_sessions",
        ["user_id", "created_at"],
    )
    # Responses for a session (feedback queries)
    op.create_index(
        "idx_session_responses_session",
        "session_responses",
        ["session_id", "sequence_num"],
    )

    # ── Learning ──────────────────────────────────────────────────────────────
    op.create_index(
        "idx_user_learning_enrollments_user",
        "user_learning_enrollments",
        ["user_id", "status"],
    )

    # ── Audit log ─────────────────────────────────────────────────────────────
    op.create_index(
        "idx_audit_logs_user_created",
        "audit_logs",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_job_postings_sector_active", "job_postings")
    op.drop_index("idx_job_postings_expires_at", "job_postings")
    op.drop_index("idx_job_postings_employer_created", "job_postings")
    op.drop_index("idx_aspirant_profiles_step", "aspirant_profiles")
    op.drop_index("idx_career_matches_user_score", "career_matches")
    op.drop_index("idx_otp_verifications_user_purpose", "otp_verifications")
    op.drop_index("idx_refresh_tokens_user_valid", "refresh_tokens")
    op.drop_index("idx_conversations_user_updated", "conversations")
    op.drop_index("idx_messages_conversation_created", "messages")
    op.drop_index("idx_counsellor_memory_user_active", "counsellor_memory")
    op.drop_index("idx_interview_sessions_user_created", "interview_sessions")
    op.drop_index("idx_session_responses_session", "session_responses")
    op.drop_index("idx_user_learning_enrollments_user", "user_learning_enrollments")
    op.drop_index("idx_audit_logs_user_created", "audit_logs")
