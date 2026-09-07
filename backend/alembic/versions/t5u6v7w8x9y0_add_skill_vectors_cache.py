"""Add skill_vectors cache table for semantic skill gap computation

Revision ID: t5u6v7w8x9y0
Revises: s4t5u6v7w8x9
Create Date: 2026-06-09

Changes:
- skill_vectors table: caches 384-dim embeddings keyed by normalised skill text
  Shared across all users and jobs — each unique skill string is embedded once.
- HNSW index on skill_vectors.embedding for fast ANN lookups
"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision = 't5u6v7w8x9y0'
down_revision = 's4t5u6v7w8x9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'skill_vectors',
        sa.Column('skill_text', sa.String(200), primary_key=True),
        sa.Column('embedding', Vector(384), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index(
        'ix_skill_vectors_embedding',
        'skill_vectors',
        ['embedding'],
        postgresql_using='hnsw',
        postgresql_with={'m': 16, 'ef_construction': 64},
        postgresql_ops={'embedding': 'vector_cosine_ops'},
    )


def downgrade() -> None:
    op.drop_index('ix_skill_vectors_embedding', table_name='skill_vectors')
    op.drop_table('skill_vectors')
