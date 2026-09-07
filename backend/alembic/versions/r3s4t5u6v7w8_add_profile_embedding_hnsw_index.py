"""add HNSW index on krs_scores.profile_embedding

The job_postings.description_embedding HNSW index was added in j9f0g1h2i3j4.
This migration adds the matching index on the user profile side so that
similarity queries on profile vectors are also ANN-accelerated.

Revision ID: r3s4t5u6v7w8
Revises: q2s3t4u5v6w7
Create Date: 2026-06-07 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'r3s4t5u6v7w8'
down_revision = 'q2s3t4u5v6w7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_krs_scores_profile_embedding
        ON krs_scores USING hnsw (profile_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_krs_scores_profile_embedding"))
