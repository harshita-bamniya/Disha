"""Add Phase 3: employer matching, prompt templates, platform settings, feature flags, user_events ORM, oauth_providers

Revision ID: q2s3t4u5v6w7
Revises: p1r0d_add_performance_indexes
Create Date: 2026-06-07

Changes:
- applications + application_status_history (Module 09 full matching)
- prompt_templates (versioned AI prompts — no-code updates)
- platform_settings (runtime config)
- feature_flags (rollout control)
- user_events (replaces raw SQL in analytics)
- oauth_providers (reserved for Google/LinkedIn login)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'q2s3t4u5v6w7'
down_revision = 'p1r0d_add_performance_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── applications ─────────────────────────────────────────────────────────
    op.create_table(
        'applications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('aspirant_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('job_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('job_postings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('match_score', sa.Integer(), nullable=True),
        sa.Column('cover_note', sa.Text(), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='applied'),
        sa.Column('employer_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(),
                  onupdate=sa.func.now()),
        sa.UniqueConstraint('aspirant_id', 'job_id', name='uq_application_aspirant_job'),
        sa.CheckConstraint(
            "status IN ('applied','under_review','shortlisted','rejected','hired','withdrawn')",
            name='ck_application_status'
        ),
    )
    op.create_index('ix_applications_aspirant_id', 'applications', ['aspirant_id'])
    op.create_index('ix_applications_job_id', 'applications', ['job_id'])
    op.create_index('ix_applications_status', 'applications', ['status'])

    # ── application_status_history ────────────────────────────────────────────
    op.create_table(
        'application_status_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('application_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('applications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('from_status', sa.String(30), nullable=True),
        sa.Column('to_status', sa.String(30), nullable=False),
        sa.Column('changed_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "to_status IN ('applied','under_review','shortlisted','rejected','hired','withdrawn')",
            name='ck_hist_to_status'
        ),
    )
    op.create_index('ix_app_hist_application_id', 'application_status_history', ['application_id'])

    # ── prompt_templates ──────────────────────────────────────────────────────
    op.create_table(
        'prompt_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('use_case', sa.String(100), nullable=False),
        sa.Column('prompt_type', sa.String(20), nullable=False, server_default='system'),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('model_hint', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("prompt_type IN ('system','user','assistant')", name='ck_prompt_type'),
    )
    op.create_index('ix_prompt_templates_use_case', 'prompt_templates', ['use_case'])
    op.create_index('ix_prompt_templates_use_case_active', 'prompt_templates', ['use_case', 'is_active'])

    # ── platform_settings ─────────────────────────────────────────────────────
    op.create_table(
        'platform_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('key', sa.String(100), unique=True, nullable=False),
        sa.Column('value', postgresql.JSONB(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(),
                  onupdate=sa.func.now()),
    )
    op.create_index('ix_platform_settings_key', 'platform_settings', ['key'])

    # ── feature_flags ─────────────────────────────────────────────────────────
    op.create_table(
        'feature_flags',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('flag_name', sa.String(100), unique=True, nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('rollout_pct', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('target_roles', postgresql.JSONB(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(),
                  onupdate=sa.func.now()),
        sa.CheckConstraint('rollout_pct BETWEEN 0 AND 100', name='ck_flag_rollout_pct'),
    )
    op.create_index('ix_feature_flags_flag_name', 'feature_flags', ['flag_name'])

    # ── user_events — skip if already exists (may be a partitioned table) ──────
    # The DB may have user_events as a range-partitioned table created outside
    # Alembic.  The ORM operates on it transparently either way — skip creation
    # only when the relation already exists to keep this migration idempotent.
    from sqlalchemy import inspect as sa_inspect
    bind = op.get_bind()
    if 'user_events' not in sa_inspect(bind).get_table_names():
        op.create_table(
            'user_events',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('session_id', sa.String(64), nullable=True),
            sa.Column('event_name', sa.String(100), nullable=False),
            sa.Column('event_data', postgresql.JSONB(), nullable=True, server_default='{}'),
            sa.Column('page_url', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index('ix_user_events_user_id', 'user_events', ['user_id'])
        op.create_index('ix_user_events_event_name', 'user_events', ['event_name'])
        op.create_index('ix_user_events_created_at', 'user_events', ['created_at'])

    # ── oauth_providers ───────────────────────────────────────────────────────
    op.create_table(
        'oauth_providers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider', sa.String(30), nullable=False),
        sa.Column('provider_uid', sa.String(255), nullable=False),
        sa.Column('access_token_hint', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(),
                  onupdate=sa.func.now()),
        sa.UniqueConstraint('provider', 'provider_uid', name='uq_oauth_provider_uid'),
        sa.CheckConstraint("provider IN ('google','linkedin')", name='ck_oauth_provider'),
    )
    op.create_index('ix_oauth_providers_user_id', 'oauth_providers', ['user_id'])

    # ── Seed initial platform settings ────────────────────────────────────────
    op.execute("""
        INSERT INTO platform_settings (id, key, value, description)
        VALUES
          (gen_random_uuid(), 'max_applications_per_user', '10'::jsonb,
           'Maximum number of active job applications per aspirant'),
          (gen_random_uuid(), 'maintenance_mode', 'false'::jsonb,
           'When true, API returns 503 for non-admin requests'),
          (gen_random_uuid(), 'employer_matching_enabled', 'true'::jsonb,
           'Feature gate for Phase 3 employer matching module')
        ON CONFLICT (key) DO NOTHING
    """)

    # ── Seed initial feature flags ────────────────────────────────────────────
    op.execute("""
        INSERT INTO feature_flags (id, flag_name, is_enabled, rollout_pct, description)
        VALUES
          (gen_random_uuid(), 'employer_matching', true, 100,
           'Phase 3: Full employer–aspirant matching and application flow'),
          (gen_random_uuid(), 'adaptive_learning', false, 0,
           'Phase 3: Skill-gap driven adaptive learning path sequencing'),
          (gen_random_uuid(), 'voice_interview', false, 0,
           'Phase 3: Voice-based mock interview capability'),
          (gen_random_uuid(), 'community_features', false, 0,
           'Phase 3: Peer community and discussion boards')
        ON CONFLICT (flag_name) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table('oauth_providers')
    op.drop_table('user_events')
    op.drop_table('feature_flags')
    op.drop_table('platform_settings')
    op.drop_table('prompt_templates')
    op.drop_table('application_status_history')
    op.drop_table('applications')
