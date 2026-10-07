"""Razorpay recurring billing: payments ledger, webhook event log, aspirant
subscriptions + feature usage counters, and plan_type/billing_interval/
razorpay_plan_id columns on subscription_plans (now shared by employer and
aspirant plans). Seeds the aspirant free/premium plans and annual employer
variants.

Revision ID: t1p2a3y4m5n6
Revises: r7s8t9u0v1w2
Create Date: 2026-09-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 't1p2a3y4m5n6'
down_revision: Union[str, None] = 'r7s8t9u0v1w2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# name, plan_type, billing_interval, price (paise), max_active_jobs, max_recruiter_seats, resume_access, candidate_search_limit
NEW_PLANS = [
    ("standard_annual", "employer", "annual", 1999000, 5, 5, True, 100),
    ("premium_annual", "employer", "annual", 4999000, 20, 15, True, 500),
    ("aspirant_free", "aspirant", "monthly", 0, None, None, False, None),
    ("aspirant_premium_monthly", "aspirant", "monthly", 29900, None, None, False, None),
    ("aspirant_premium_annual", "aspirant", "annual", 299000, None, None, False, None),
]


def upgrade() -> None:
    op.add_column("subscription_plans", sa.Column("plan_type", sa.String(20), nullable=False, server_default="employer"))
    op.add_column("subscription_plans", sa.Column("billing_interval", sa.String(20), nullable=False, server_default="monthly"))
    op.add_column("subscription_plans", sa.Column("razorpay_plan_id", sa.String(64), nullable=True))

    op.add_column("company_subscriptions", sa.Column("razorpay_customer_id", sa.String(64), nullable=True))
    op.add_column("company_subscriptions", sa.Column("razorpay_subscription_id", sa.String(64), nullable=True))
    op.create_index("ix_company_subscriptions_razorpay_subscription_id", "company_subscriptions", ["razorpay_subscription_id"])

    op.create_table(
        "aspirant_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("subscription_plans.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("razorpay_customer_id", sa.String(64), nullable=True),
        sa.Column("razorpay_subscription_id", sa.String(64), nullable=True),
        sa.Column("current_period_start", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_aspirant_subscriptions_user_id", "aspirant_subscriptions", ["user_id"])
    op.create_index("ix_aspirant_subscriptions_razorpay_subscription_id", "aspirant_subscriptions", ["razorpay_subscription_id"])

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("subscription_plans.id"), nullable=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("status", sa.String(20), nullable=False, server_default="created"),
        sa.Column("razorpay_payment_id", sa.String(64), nullable=True),
        sa.Column("razorpay_subscription_id", sa.String(64), nullable=True),
        sa.Column("razorpay_signature", sa.String(256), nullable=True),
        sa.Column("method", sa.String(30), nullable=True),
        sa.Column("invoice_number", sa.String(40), nullable=True, unique=True),
        sa.Column("raw_payload", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_payments_user_id", "payments", ["user_id"])
    op.create_index("ix_payments_company_id", "payments", ["company_id"])
    op.create_index("ix_payments_razorpay_payment_id", "payments", ["razorpay_payment_id"])
    op.create_index("ix_payments_razorpay_subscription_id", "payments", ["razorpay_subscription_id"])

    op.create_table(
        "razorpay_webhook_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("razorpay_event_id", sa.String(64), nullable=False, unique=True),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_razorpay_webhook_events_razorpay_event_id", "razorpay_webhook_events", ["razorpay_event_id"])

    op.create_table(
        "feature_usage",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feature_key", sa.String(30), nullable=False),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_feature_usage_user_id", "feature_usage", ["user_id"])
    op.create_unique_constraint("uq_feature_usage_user_feature", "feature_usage", ["user_id", "feature_key"])

    # Existing employer plans are all monthly — tag them explicitly.
    op.execute("UPDATE subscription_plans SET plan_type = 'employer', billing_interval = 'monthly'")

    # Repricing: standard/premium were seeded at launch-guess prices (l6f7g8h9i1j2)
    # before real market benchmarking. Align them with the agreed self-serve
    # pricing (Standard ₹1999/mo, Premium ₹4999/mo) that the new annual variants
    # above are derived from (10x monthly = ~2 months free).
    op.execute("UPDATE subscription_plans SET price_monthly = 199900 WHERE name = 'standard' AND plan_type = 'employer'")
    op.execute("UPDATE subscription_plans SET price_monthly = 499900 WHERE name = 'premium' AND plan_type = 'employer'")

    for name, plan_type, interval, price, max_jobs, max_seats, resume_access, search_limit in NEW_PLANS:
        op.execute(
            sa.text(
                """
                INSERT INTO subscription_plans
                    (id, name, plan_type, billing_interval, price_monthly, max_active_jobs, max_recruiter_seats, resume_access, candidate_search_limit, is_active)
                VALUES
                    (gen_random_uuid(), :name, :plan_type, :interval, :price, :max_jobs, :max_seats, :resume_access, :search_limit, true)
                ON CONFLICT (name) DO NOTHING
                """
            ).bindparams(name=name, plan_type=plan_type, interval=interval, price=price, max_jobs=max_jobs,
                          max_seats=max_seats, resume_access=resume_access, search_limit=search_limit)
        )

    # Every existing aspirant starts on the free plan (mirrors the employer free-plan seed above).
    op.execute("""
        INSERT INTO aspirant_subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end)
        SELECT gen_random_uuid(), u.id, p.id, 'active', now(), now() + interval '100 years'
        FROM users u
        JOIN roles r ON r.id = u.role_id AND r.name = 'aspirant'
        CROSS JOIN (SELECT id FROM subscription_plans WHERE name = 'aspirant_free') p
        WHERE NOT EXISTS (SELECT 1 FROM aspirant_subscriptions a WHERE a.user_id = u.id)
    """)


def downgrade() -> None:
    op.execute("UPDATE subscription_plans SET price_monthly = 499900 WHERE name = 'standard' AND plan_type = 'employer'")
    op.execute("UPDATE subscription_plans SET price_monthly = 1499900 WHERE name = 'premium' AND plan_type = 'employer'")
    op.drop_table("feature_usage")
    op.drop_table("razorpay_webhook_events")
    op.drop_table("payments")
    op.drop_index("ix_aspirant_subscriptions_razorpay_subscription_id", table_name="aspirant_subscriptions")
    op.drop_index("ix_aspirant_subscriptions_user_id", table_name="aspirant_subscriptions")
    op.drop_table("aspirant_subscriptions")
    op.drop_index("ix_company_subscriptions_razorpay_subscription_id", table_name="company_subscriptions")
    op.drop_column("company_subscriptions", "razorpay_subscription_id")
    op.drop_column("company_subscriptions", "razorpay_customer_id")
    op.drop_column("subscription_plans", "razorpay_plan_id")
    op.drop_column("subscription_plans", "billing_interval")
    op.drop_column("subscription_plans", "plan_type")
