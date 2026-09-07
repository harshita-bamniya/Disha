"""Add Google OAuth support — google_id column, make phone and password_hash nullable.

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-06-14
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = 'c4d5e6f7a8b9'
down_revision = 'b3c4d5e6f7a8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add google_id column
    op.add_column('users', sa.Column('google_id', sa.String(255), nullable=True))
    op.create_index('ix_users_google_id', 'users', ['google_id'], unique=True)

    # Allow phone and password_hash to be null (Google users have neither)
    op.alter_column('users', 'phone', existing_type=sa.String(15), nullable=True)
    op.alter_column('users', 'password_hash', existing_type=sa.Text(), nullable=True)


def downgrade() -> None:
    op.drop_index('ix_users_google_id', table_name='users')
    op.drop_column('users', 'google_id')

    # Restore NOT NULL — only safe if no Google-only rows exist
    op.alter_column('users', 'phone', existing_type=sa.String(15), nullable=False)
    op.alter_column('users', 'password_hash', existing_type=sa.Text(), nullable=False)
