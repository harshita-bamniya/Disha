"""DB audit fixes: rename mock_interview_feedback, drop oauth_providers, fix pipeline template FK,
drop email_template_id, add is_active trigger, fix verif default, add performance indexes.

Revision ID: o1p2q3r4s5t6
Revises: n1o2p3q4r5s6
Create Date: 2026-08-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "o1p2q3r4s5t6"
down_revision = "n1o2p3q4r5s6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Fix employer_verifications server_default (model default already fixed) ─
    op.alter_column(
        "employer_verifications",
        "status",
        server_default="requested",
    )

    # ── 2. Rename interview_feedback → mock_interview_feedback ────────────────────
    op.rename_table("interview_feedback", "mock_interview_feedback")

    # ── 3. Drop dead oauth_providers table ────────────────────────────────────────
    op.drop_table("oauth_providers")

    # ── 4. Drop dead email_template_id column from ats_knockout_rules ────────────
    op.drop_column("ats_knockout_rules", "email_template_id")

    # ── 5. Fix company_pipeline_templates FK: employer_profiles → companies ───────
    # Step A: drop the old FK constraint
    op.drop_constraint(
        "company_pipeline_templates_company_id_fkey",
        "company_pipeline_templates",
        type_="foreignkey",
    )
    # Step B: data migration — remap employer_profile id → company id
    op.execute("""
        UPDATE company_pipeline_templates cpt
        SET company_id = ep.company_id
        FROM employer_profiles ep
        WHERE cpt.company_id = ep.id
          AND ep.company_id IS NOT NULL
    """)
    # Delete any rows that couldn't be remapped (employer had no company yet)
    op.execute("""
        DELETE FROM company_pipeline_templates cpt
        WHERE NOT EXISTS (
            SELECT 1 FROM companies c WHERE c.id = cpt.company_id
        )
    """)
    # Step C: add new FK to companies
    op.create_foreign_key(
        "company_pipeline_templates_company_id_fkey",
        "company_pipeline_templates",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # ── 6. Add PostgreSQL trigger to keep job_postings.is_active in sync ──────────
    op.execute("""
        CREATE OR REPLACE FUNCTION sync_job_is_active()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.is_active := (NEW.status = 'published');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        DROP TRIGGER IF EXISTS trg_sync_job_is_active ON job_postings;
        CREATE TRIGGER trg_sync_job_is_active
        BEFORE UPDATE OF status ON job_postings
        FOR EACH ROW
        EXECUTE FUNCTION sync_job_is_active();
    """)
    # Backfill existing rows
    op.execute("""
        UPDATE job_postings SET is_active = (status = 'published')
        WHERE is_active != (status = 'published');
    """)

    # ── 7. Performance indexes ────────────────────────────────────────────────────
    # applications — employer pipeline view and aspirant dashboard
    op.execute("CREATE INDEX IF NOT EXISTS ix_applications_job_status ON applications (job_id, status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_applications_aspirant_status ON applications (aspirant_id, status)")

    # application_status_history — ordered timeline per application
    op.execute("CREATE INDEX IF NOT EXISTS ix_app_status_hist_app_created ON application_status_history (application_id, created_at DESC)")

    # job_postings — aspirant discovery by sector + active
    op.execute("CREATE INDEX IF NOT EXISTS ix_job_postings_sector_active ON job_postings (sector, is_active, min_k_score)")

    # counsellor_memory — fetch active memories by type for context window
    op.execute("CREATE INDEX IF NOT EXISTS ix_counsellor_memory_user_type ON counsellor_memory (user_id, memory_type, is_active)")

    # audit_logs — admin filtered by action
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_action_created ON audit_logs (action, created_at DESC)")

    # xp_transactions — XP breakdown by event type
    op.execute("CREATE INDEX IF NOT EXISTS ix_xp_transactions_user_event ON xp_transactions (user_id, event_type)")

    # company_departments — list departments per company
    op.execute("CREATE INDEX IF NOT EXISTS ix_company_departments_company ON company_departments (company_id)")


def downgrade() -> None:
    # Drop performance indexes
    op.execute("DROP INDEX IF EXISTS ix_applications_job_status")
    op.execute("DROP INDEX IF EXISTS ix_applications_aspirant_status")
    op.execute("DROP INDEX IF EXISTS ix_app_status_hist_app_created")
    op.execute("DROP INDEX IF EXISTS ix_job_postings_sector_active")
    op.execute("DROP INDEX IF EXISTS ix_counsellor_memory_user_type")
    op.execute("DROP INDEX IF EXISTS ix_audit_logs_action_created")
    op.execute("DROP INDEX IF EXISTS ix_xp_transactions_user_event")
    op.execute("DROP INDEX IF EXISTS ix_company_departments_company")

    # Drop trigger
    op.execute("DROP TRIGGER IF EXISTS trg_sync_job_is_active ON job_postings")
    op.execute("DROP FUNCTION IF EXISTS sync_job_is_active()")

    # Revert pipeline template FK (back to employer_profiles)
    op.drop_constraint(
        "company_pipeline_templates_company_id_fkey",
        "company_pipeline_templates",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "company_pipeline_templates_company_id_fkey",
        "company_pipeline_templates",
        "employer_profiles",
        ["company_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Restore email_template_id column
    op.add_column(
        "ats_knockout_rules",
        sa.Column("email_template_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Recreate oauth_providers table
    op.create_table(
        "oauth_providers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("provider_uid", sa.String(255), nullable=False),
        sa.Column("access_token_hint", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_uid", name="uq_oauth_provider_uid"),
        sa.CheckConstraint("provider IN ('google','linkedin')", name="ck_oauth_provider"),
    )

    # Rename mock_interview_feedback back
    op.rename_table("mock_interview_feedback", "interview_feedback")

    # Revert employer_verifications server_default
    op.alter_column("employer_verifications", "status", server_default="pending")
