"""Subscription management: subscription_plans, company_subscriptions,
seeded Free/Standard/Premium/Enterprise plans, every existing company on Free.

Revision ID: l6f7g8h9i1j2
Revises: k5e6f7g8h9i1
Create Date: 2026-06-26

Part of Module 05 — Enterprise Admin Panel & Employer Portal, Phase 6.
Usage counters (active jobs, recruiter seats) are computed live from existing
tables rather than cached — no separate usage table needed at this scale.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'l6f7g8h9i1j2'
down_revision: Union[str, None] = 'k5e6f7g8h9i1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PLANS = [
    # name, price_monthly (paise), max_active_jobs, max_recruiter_seats, resume_access, candidate_search_limit
    ("free", 0, 1, 1, False, 10),
    ("standard", 499900, 5, 5, True, 100),
    ("premium", 1499900, 20, 15, True, 500),
    ("enterprise", 0, None, None, True, None),   # custom pricing, unlimited usage
]


def upgrade() -> None:
    op.create_table(
        "subscription_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), unique=True, nullable=False),
        sa.Column("price_monthly", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_active_jobs", sa.Integer(), nullable=True),
        sa.Column("max_recruiter_seats", sa.Integer(), nullable=True),
        sa.Column("resume_access", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("candidate_search_limit", sa.Integer(), nullable=True),
        sa.Column("features", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )

    op.create_table(
        "company_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("subscription_plans.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("current_period_start", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_company_subscriptions_company_id", "company_subscriptions", ["company_id"])

    for name, price, max_jobs, max_seats, resume_access, search_limit in PLANS:
        op.execute(
            sa.text(
                """
                INSERT INTO subscription_plans
                    (id, name, price_monthly, max_active_jobs, max_recruiter_seats, resume_access, candidate_search_limit, is_active)
                VALUES
                    (gen_random_uuid(), :name, :price, :max_jobs, :max_seats, :resume_access, :search_limit, true)
                ON CONFLICT (name) DO NOTHING
                """
            ).bindparams(name=name, price=price, max_jobs=max_jobs, max_seats=max_seats,
                          resume_access=resume_access, search_limit=search_limit)
        )

    # Every existing company starts on the Free plan, one-year period.
    op.execute("""
        INSERT INTO company_subscriptions (id, company_id, plan_id, status, current_period_start, current_period_end)
        SELECT gen_random_uuid(), c.id, p.id, 'active', now(), now() + interval '1 year'
        FROM companies c
        CROSS JOIN (SELECT id FROM subscription_plans WHERE name = 'free') p
        WHERE NOT EXISTS (SELECT 1 FROM company_subscriptions cs WHERE cs.company_id = c.id)
    """)


def downgrade() -> None:
    op.drop_index("ix_company_subscriptions_company_id", table_name="company_subscriptions")
    op.drop_table("company_subscriptions")
    op.drop_table("subscription_plans")
