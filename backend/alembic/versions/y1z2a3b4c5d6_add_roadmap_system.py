"""add_roadmap_system

Revision ID: y1z2a3b4c5d6
Revises: 101fbcc1db19
Create Date: 2026-06-13 00:00:00.000000

Creates 5 new tables for the 6-stage job-readiness roadmap system:
  - ticket_templates       (Stage 4 work simulations, admin-seeded)
  - user_roadmaps          (generated per user per career track)
  - user_skill_competence  (per-skill mastery scores)
  - stage_gate_evaluations (audit trail of gate checks)
  - ticket_submissions     (Stage 4 user work + AI review)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = 'y1z2a3b4c5d6'
down_revision: Union[str, None] = '101fbcc1db19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── ticket_templates ─────────────────────────────────────────────────────
    op.create_table(
        'ticket_templates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('career_track_id', UUID(as_uuid=True),
                  sa.ForeignKey('career_tracks.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('context', sa.Text, nullable=False),
        sa.Column('deliverable', sa.Text, nullable=False),
        sa.Column('evaluation_rubric', JSONB, nullable=False, server_default='{}'),
        sa.Column('difficulty', sa.String(20), nullable=False, server_default='mid'),
        sa.Column('estimated_hours', sa.Integer, server_default='3'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("difficulty IN ('junior','mid','senior')", name='ck_ticket_difficulty'),
    )
    op.create_index('ix_ticket_templates_career_track_id', 'ticket_templates', ['career_track_id'])

    # ── user_roadmaps ────────────────────────────────────────────────────────
    op.create_table(
        'user_roadmaps',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('career_track_id', UUID(as_uuid=True),
                  sa.ForeignKey('career_tracks.id', ondelete='SET NULL'), nullable=True),
        sa.Column('target_job_ids', JSONB, nullable=False, server_default='[]'),
        sa.Column('current_stage', sa.Integer, nullable=False, server_default='1'),
        sa.Column('stage_config', JSONB, nullable=False, server_default='{}'),
        sa.Column('gap_skills', JSONB, nullable=False, server_default='[]'),
        sa.Column('narrative_score', sa.Integer, nullable=True),
        sa.Column('narrative_text', sa.Text, nullable=True),
        sa.Column('narrative_feedback', JSONB, nullable=True),
        sa.Column('job_readiness_score', sa.Integer, nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('last_recalibrated', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'career_track_id', name='uq_roadmap_user_track'),
        sa.CheckConstraint('current_stage BETWEEN 1 AND 6', name='ck_roadmap_stage'),
        sa.CheckConstraint('job_readiness_score BETWEEN 0 AND 100', name='ck_roadmap_jrs'),
    )
    op.create_index('ix_user_roadmaps_user_id', 'user_roadmaps', ['user_id'])
    op.create_index('ix_user_roadmaps_career_track_id', 'user_roadmaps', ['career_track_id'])

    # ── user_skill_competence ────────────────────────────────────────────────
    op.create_table(
        'user_skill_competence',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('skill_text', sa.String(200), nullable=False),
        sa.Column('quiz_score_avg', sa.Float, nullable=False, server_default='0'),
        sa.Column('exercise_score_avg', sa.Float, nullable=False, server_default='0'),
        sa.Column('attempts', sa.Integer, nullable=False, server_default='0'),
        sa.Column('competence_score', sa.Float, nullable=False, server_default='0'),
        sa.Column('last_assessed', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'skill_text', name='uq_skill_competence_user_skill'),
    )
    op.create_index('ix_user_skill_competence_user_id', 'user_skill_competence', ['user_id'])

    # ── stage_gate_evaluations ───────────────────────────────────────────────
    op.create_table(
        'stage_gate_evaluations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('roadmap_id', UUID(as_uuid=True),
                  sa.ForeignKey('user_roadmaps.id', ondelete='CASCADE'), nullable=False),
        sa.Column('stage_number', sa.Integer, nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('gate_criteria', JSONB, nullable=False, server_default='{}'),
        sa.Column('gate_results', JSONB, nullable=False, server_default='{}'),
        sa.Column('evaluated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('evaluated_by', sa.String(20), nullable=False, server_default='auto'),
        sa.CheckConstraint('stage_number BETWEEN 1 AND 6', name='ck_gate_stage'),
        sa.CheckConstraint("status IN ('pending','passed','failed','waived')", name='ck_gate_status'),
        sa.CheckConstraint("evaluated_by IN ('auto','admin')", name='ck_gate_by'),
    )
    op.create_index('ix_stage_gate_evaluations_roadmap_id', 'stage_gate_evaluations', ['roadmap_id'])

    # ── ticket_submissions ───────────────────────────────────────────────────
    op.create_table(
        'ticket_submissions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('roadmap_id', UUID(as_uuid=True),
                  sa.ForeignKey('user_roadmaps.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ticket_id', UUID(as_uuid=True),
                  sa.ForeignKey('ticket_templates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('submission_text', sa.Text, nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('review_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('ai_review_result', JSONB, nullable=True),
        sa.Column('ai_reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('human_reviewed', sa.Boolean, nullable=False, server_default='false'),
        sa.CheckConstraint(
            "review_status IN ('pending','reviewing','done','failed')",
            name='ck_ticket_review_status',
        ),
    )
    op.create_index('ix_ticket_submissions_roadmap_id', 'ticket_submissions', ['roadmap_id'])
    op.create_index('ix_ticket_submissions_user_id', 'ticket_submissions', ['user_id'])
    op.create_index('ix_ticket_submissions_ticket_id', 'ticket_submissions', ['ticket_id'])


def downgrade() -> None:
    op.drop_table('ticket_submissions')
    op.drop_table('stage_gate_evaluations')
    op.drop_table('user_skill_competence')
    op.drop_table('user_roadmaps')
    op.drop_table('ticket_templates')
