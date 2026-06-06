"""add embeddings

Revision ID: j9f0g1h2i3j4
Revises: i8d9e0f1g2h3
Create Date: 2026-05-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'j9f0g1h2i3j4'
down_revision = 'i8d9e0f1g2h3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension (safe if already exists)
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))

    # Add 384-dim embedding column to job postings (all-MiniLM-L6-v2 output size)
    op.execute(sa.text(
        "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS description_embedding vector(384)"
    ))

    # Add 384-dim profile embedding column to krs_scores
    op.execute(sa.text(
        "ALTER TABLE krs_scores ADD COLUMN IF NOT EXISTS profile_embedding vector(384)"
    ))

    # Optional: HNSW index for fast ANN search (useful at scale)
    op.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_job_postings_embedding
        ON job_postings USING hnsw (description_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_job_postings_embedding"))
    op.execute(sa.text("ALTER TABLE job_postings DROP COLUMN IF EXISTS description_embedding"))
    op.execute(sa.text("ALTER TABLE krs_scores DROP COLUMN IF EXISTS profile_embedding"))
