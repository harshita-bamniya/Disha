"""Add 'system_design' to question_banks.question_type CHECK constraint.

Audit finding (2026-08-24): the blueprint-generation prompt (_BLUEPRINT_SYSTEM)
and the per-question generation prompt (_QUESTIONS_SYSTEM) both explicitly ask
the LLM for a "system_design" question_type, and blueprints for technical
roles routinely plan for one — but question_banks' own CHECK constraint never
allowed it, so interview/service.py's normalization step
(_generate_dynamic_questions) silently relabeled every such question
"behavioral" before persisting it. That corrupted skill/type-breakdown data
and, since the Phase 7 panel-simulation deterministic panelist mapping keys
off question_type, misrouted every system-design question to Priya Nair
(Hiring Manager) instead of Arjun Mehta (Technical Lead) — directly
contradicting the panel introduction's own claim about who covers what.

Revision ID: v9w0x1y2z3a4
Revises: u8v9w0x1y2z3
Create Date: 2026-08-24
"""
from alembic import op

revision = "v9w0x1y2z3a4"
down_revision = "u8v9w0x1y2z3"
branch_labels = None
depends_on = None

OLD_CONSTRAINT = "question_type IN ('behavioral','situational','technical','hr','case')"
NEW_CONSTRAINT = "question_type IN ('behavioral','situational','technical','hr','case','system_design')"


def upgrade() -> None:
    op.drop_constraint("ck_question_type", "question_banks", type_="check")
    op.create_check_constraint("ck_question_type", "question_banks", NEW_CONSTRAINT)


def downgrade() -> None:
    op.drop_constraint("ck_question_type", "question_banks", type_="check")
    op.create_check_constraint("ck_question_type", "question_banks", OLD_CONSTRAINT)
