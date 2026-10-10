"""employee referral program: program, referrers, referrals, rewards, audit events

Revision ID: z8d9e0f1a2b3
Revises: z7c8d9e0f1a2
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "z8d9e0f1a2b3"
down_revision = "z7c8d9e0f1a2"
branch_labels = None
depends_on = None

UUID = postgresql.UUID(as_uuid=True)
_now = sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "referral_programs",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("company_id", UUID, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("is_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("default_bonus_amount", sa.Integer, nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("hold_days", sa.Integer, nullable=False, server_default="90"),
        sa.Column("terms", sa.Text),
        sa.Column("updated_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_now),
        sa.CheckConstraint("default_bonus_amount >= 0", name="ck_referral_program_bonus_nonneg"),
        sa.CheckConstraint("hold_days >= 0 AND hold_days <= 730", name="ck_referral_program_hold_range"),
    )

    op.create_table(
        "referral_job_configs",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("job_id", UUID, sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("company_id", UUID, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_open", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("bonus_amount", sa.Integer),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_now),
        sa.CheckConstraint("bonus_amount IS NULL OR bonus_amount >= 0", name="ck_referral_job_bonus_nonneg"),
    )
    op.create_index("ix_referral_job_configs_company_id", "referral_job_configs", ["company_id"])

    op.create_table(
        "referrers",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("company_id", UUID, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employer_profile_id", UUID, sa.ForeignKey("employer_profiles.id", ondelete="SET NULL")),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("code", sa.String(16), nullable=False),
        sa.Column("token_hash", sa.String(64)),
        sa.Column("status", sa.String(10), nullable=False, server_default="active"),
        sa.Column("invited_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("last_sent_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now),
        sa.UniqueConstraint("company_id", "email", name="uq_referrer_company_email"),
        sa.CheckConstraint("status IN ('active', 'disabled')", name="ck_referrer_status"),
    )
    op.create_index("ix_referrers_company_id", "referrers", ["company_id"])
    op.create_index("ix_referrers_employer_profile_id", "referrers", ["employer_profile_id"])
    op.create_index("ix_referrers_code", "referrers", ["code"], unique=True)
    op.create_index("ix_referrers_token_hash", "referrers", ["token_hash"], unique=True)

    op.create_table(
        "referrals",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("company_id", UUID, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", UUID, sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("referrer_id", UUID, sa.ForeignKey("referrers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("application_id", UUID, sa.ForeignKey("applications.id", ondelete="SET NULL"), unique=True),
        sa.Column("candidate_user_id", UUID, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("candidate_name", sa.String(150)),
        sa.Column("candidate_email", sa.String(255)),
        sa.Column("source", sa.String(12), nullable=False, server_default="link"),
        sa.Column("status", sa.String(12), nullable=False, server_default="invited"),
        sa.Column("note", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_now),
        sa.CheckConstraint("status IN ('invited', 'applied', 'in_process', 'hired', 'rejected', 'withdrawn')", name="ck_referral_status"),
        sa.CheckConstraint("source IN ('link', 'nomination')", name="ck_referral_source"),
    )
    for col in ("company_id", "job_id", "referrer_id", "candidate_user_id", "candidate_email", "status", "created_at"):
        op.create_index(f"ix_referrals_{col}", "referrals", [col])

    op.create_table(
        "referral_rewards",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("referral_id", UUID, sa.ForeignKey("referrals.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("company_id", UUID, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("referrer_id", UUID, sa.ForeignKey("referrers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("status", sa.String(10), nullable=False, server_default="pending"),
        sa.Column("hired_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("eligible_on", sa.Date, nullable=False),
        sa.Column("decided_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        sa.Column("payment_reference", sa.String(120)),
        sa.Column("note", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now),
        sa.CheckConstraint("status IN ('pending', 'eligible', 'approved', 'paid', 'rejected', 'cancelled')", name="ck_referral_reward_status"),
        sa.CheckConstraint("amount > 0", name="ck_referral_reward_amount_pos"),
    )
    for col in ("company_id", "referrer_id", "status"):
        op.create_index(f"ix_referral_rewards_{col}", "referral_rewards", [col])

    op.create_table(
        "referral_events",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("referral_id", UUID, sa.ForeignKey("referrals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event", sa.String(40), nullable=False),
        sa.Column("from_value", sa.String(40)),
        sa.Column("to_value", sa.String(40)),
        sa.Column("actor_user_id", UUID, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("note", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now),
    )
    op.create_index("ix_referral_events_referral_id", "referral_events", ["referral_id"])


def downgrade() -> None:
    for t in ("referral_events", "referral_rewards", "referrals", "referrers", "referral_job_configs", "referral_programs"):
        op.drop_table(t)
