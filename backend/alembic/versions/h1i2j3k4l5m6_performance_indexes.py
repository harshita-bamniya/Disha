"""Performance indexes: GIN on JSONB columns, partial indexes on soft-deleted rows.

Revision ID: h1i2j3k4l5m6
Revises: g3h4i5j6k7l8
Create Date: 2026-07-05
"""
from alembic import op

revision = "h1i2j3k4l5m6"
down_revision = "g3h4i5j6k7l8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── GIN indexes on JSONB columns ──────────────────────────────────────────
    # Critical for matching queries that filter/search inside JSONB arrays.
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_gin_aspirant_skills ON aspirant_profiles USING GIN (skills)")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_gin_aspirant_preferred_sectors ON aspirant_profiles USING GIN (preferred_sectors)")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_gin_job_required_skills ON job_postings USING GIN (required_skills)")

    # KRS modules JSONB (used when re-computing scores)
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_gin_krs_modules ON krs_scores USING GIN (modules)")

    # ── Partial indexes on soft-deleted rows ──────────────────────────────────
    # Dramatically reduces index size and speeds up all live-data queries.
    # Queries that already filter WHERE deleted_at IS NULL will use these.
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_active ON users (created_at DESC) WHERE deleted_at IS NULL")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_active_phone ON users (phone) WHERE deleted_at IS NULL AND phone IS NOT NULL")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_active_email ON users (email) WHERE deleted_at IS NULL AND email IS NOT NULL")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_job_postings_active ON job_postings (employer_id, created_at DESC) WHERE is_active = TRUE AND status = 'published'")


def downgrade() -> None:
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_gin_aspirant_skills")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_gin_aspirant_preferred_sectors")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_gin_job_required_skills")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_gin_krs_modules")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_users_active")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_users_active_phone")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_users_active_email")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_job_postings_active")
