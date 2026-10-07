"""Verified Interview: employer templates, invitations, share grants, appeals,
decisions and integrity events.

Also: interview_sessions.mode (practice | verified), the "employer_share"
consent kind, and two notification types.

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
Create Date: 2026-10-02
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "d9e0f1a2b3c4"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None

_OLD_NOTIFICATION_TYPES = (
    "new_application", "interview_scheduled", "candidate_saved",
    "application_status_changed", "job_match_digest", "deadline_reminder",
    "interview_reschedule_requested",
    "offer_accepted", "offer_declined",
    "announcement",
    "interview_outcome_request",
)
_NEW_NOTIFICATION_TYPES = _OLD_NOTIFICATION_TYPES + ("verified_interview_invite", "verified_interview_done")


def _types_sql(types: tuple[str, ...]) -> str:
    return "type IN (" + ", ".join(f"'{t}'" for t in types) + ")"


def _uuid_pk():
    return sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True)


def _fk(name, target, nullable=False, ondelete="CASCADE"):
    return sa.Column(name, postgresql.UUID(as_uuid=True), sa.ForeignKey(target, ondelete=ondelete), nullable=nullable)


def upgrade() -> None:
    # sessions + consent + notifications
    op.add_column("interview_sessions", sa.Column("mode", sa.String(12), nullable=False, server_default="practice"))
    op.create_check_constraint("ck_session_mode", "interview_sessions", "mode IN ('practice','verified')")

    op.drop_constraint("ck_interview_consent_kind", "interview_consents", type_="check")
    op.create_check_constraint(
        "ck_interview_consent_kind", "interview_consents",
        "kind IN ('ai_processing','own_effort','improve_product','media','employer_share')",
    )

    op.drop_constraint("ck_notification_type", "notifications", type_="check")
    op.create_check_constraint("ck_notification_type", "notifications", _types_sql(_NEW_NOTIFICATION_TYPES))

    # employer-defined interviews
    op.create_table(
        "interview_templates",
        _uuid_pk(),
        _fk("employer_user_id", "users.id"),
        _fk("company_id", "companies.id", nullable=True, ondelete="SET NULL"),
        _fk("job_id", "job_postings.id", nullable=True, ondelete="SET NULL"),
        sa.Column("title", sa.String(150), nullable=False),
        sa.Column("role", sa.String(150), nullable=False),
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("competencies", postgresql.JSONB(), nullable=False),
        sa.Column("custom_questions", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(12), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('active','archived')", name="ck_interview_template_status"),
        sa.CheckConstraint("duration_minutes BETWEEN 10 AND 20", name="ck_interview_template_duration"),
    )
    op.create_index("ix_interview_templates_employer_user_id", "interview_templates", ["employer_user_id"])
    op.create_index("ix_interview_templates_company_id", "interview_templates", ["company_id"])

    op.create_table(
        "interview_invitations",
        _uuid_pk(),
        _fk("template_id", "interview_templates.id"),
        _fk("employer_user_id", "users.id"),
        _fk("candidate_user_id", "users.id"),
        _fk("application_id", "applications.id", nullable=True, ondelete="SET NULL"),
        sa.Column("status", sa.String(12), nullable=False, server_default="invited"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        _fk("session_id", "interview_sessions.id", nullable=True, ondelete="SET NULL"),
        sa.Column("retry_granted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("template_id", "candidate_user_id", name="uq_interview_invitation_candidate"),
        sa.CheckConstraint("status IN ('invited','started','completed','declined','expired')", name="ck_interview_invitation_status"),
    )
    for col in ("template_id", "employer_user_id", "candidate_user_id", "status"):
        op.create_index(f"ix_interview_invitations_{col}", "interview_invitations", [col])

    op.create_table(
        "share_grants",
        _uuid_pk(),
        _fk("session_id", "interview_sessions.id"),
        _fk("invitation_id", "interview_invitations.id"),
        _fk("employer_user_id", "users.id"),
        sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_viewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    for col in ("session_id", "invitation_id", "employer_user_id"):
        op.create_index(f"ix_share_grants_{col}", "share_grants", [col])

    op.create_table(
        "interview_appeals",
        _uuid_pk(),
        _fk("session_id", "interview_sessions.id"),
        _fk("user_id", "users.id"),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="open"),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        _fk("resolved_by", "users.id", nullable=True, ondelete="SET NULL"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('open','resolved')", name="ck_interview_appeal_status"),
    )
    for col in ("session_id", "user_id", "status"):
        op.create_index(f"ix_interview_appeals_{col}", "interview_appeals", [col])

    op.create_table(
        "employer_decisions",
        _uuid_pk(),
        _fk("session_id", "interview_sessions.id"),
        _fk("employer_user_id", "users.id"),
        sa.Column("decision", sa.String(12), nullable=False),
        sa.Column("reason_code", sa.String(30), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("session_id", "employer_user_id", name="uq_employer_decision"),
        sa.CheckConstraint("decision IN ('shortlist','hold','decline')", name="ck_employer_decision"),
    )
    op.create_index("ix_employer_decisions_session_id", "employer_decisions", ["session_id"])

    op.create_table(
        "integrity_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        _fk("session_id", "interview_sessions.id"),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("started_ms", sa.Integer(), nullable=False),
        sa.Column("ended_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("kind IN ('tab_hidden','window_blur','face_missing','multiple_faces')", name="ck_integrity_event_kind"),
    )
    op.create_index("ix_integrity_events_session_id", "integrity_events", ["session_id"])


def downgrade() -> None:
    for table in ("integrity_events", "employer_decisions", "interview_appeals", "share_grants",
                  "interview_invitations", "interview_templates"):
        op.drop_table(table)

    op.drop_constraint("ck_notification_type", "notifications", type_="check")
    op.execute("DELETE FROM notifications WHERE type IN ('verified_interview_invite','verified_interview_done')")
    op.create_check_constraint("ck_notification_type", "notifications", _types_sql(_OLD_NOTIFICATION_TYPES))

    op.execute("DELETE FROM interview_consents WHERE kind = 'employer_share'")
    op.drop_constraint("ck_interview_consent_kind", "interview_consents", type_="check")
    op.create_check_constraint(
        "ck_interview_consent_kind", "interview_consents",
        "kind IN ('ai_processing','own_effort','improve_product','media')",
    )

    op.drop_constraint("ck_session_mode", "interview_sessions", type_="check")
    op.drop_column("interview_sessions", "mode")
