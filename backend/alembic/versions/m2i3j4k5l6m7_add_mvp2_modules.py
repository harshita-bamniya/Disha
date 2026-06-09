"""Add MVP2 modules: Learning, Resume, Interview, Counsellor, Analytics

Revision ID: m2i3j4k5l6m7
Revises: l1h2i3j4k5l6
Create Date: 2026-06-06 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector

revision = 'm2i3j4k5l6m7'
down_revision = 'l1h2i3j4k5l6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── Learning System (Module 05) ─────────────────────────────────────────

    op.create_table(
        "learning_paths",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("career_track_id", UUID(as_uuid=True), sa.ForeignKey("career_tracks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("estimated_hours", sa.Integer, default=0),
        sa.Column("difficulty", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("sort_order", sa.Integer, default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("difficulty IN ('beginner','intermediate','advanced')", name="ck_path_difficulty"),
    )

    op.create_table(
        "path_modules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("learning_path_id", UUID(as_uuid=True), sa.ForeignKey("learning_paths.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, default=0),
        sa.Column("skill_focus", sa.String(150), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_path_modules_path", "path_modules", ["learning_path_id"])

    op.create_table(
        "lessons",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("module_id", UUID(as_uuid=True), sa.ForeignKey("path_modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content_type", sa.String(30), nullable=True),
        sa.Column("content_url", sa.Text, nullable=True),
        sa.Column("content_body", sa.Text, nullable=True),
        sa.Column("duration_minutes", sa.Integer, default=5),
        sa.Column("sort_order", sa.Integer, nullable=False, default=0),
        sa.Column("language", sa.String(10), default="en"),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "content_type IN ('article','video','exercise','case_study','quiz')",
            name="ck_lesson_content_type"
        ),
    )
    op.create_index("idx_lessons_module", "lessons", ["module_id"])

    op.create_table(
        "user_learning_enrollments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("learning_path_id", UUID(as_uuid=True), sa.ForeignKey("learning_paths.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), default="enrolled", nullable=False),
        sa.Column("enrolled_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "learning_path_id", name="uq_enrollment_user_path"),
        sa.CheckConstraint("status IN ('enrolled','in_progress','completed','paused')", name="ck_enrollment_status"),
    )
    op.create_index("idx_enrollments_user", "user_learning_enrollments", ["user_id"])

    op.create_table(
        "lesson_completions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lesson_id", UUID(as_uuid=True), sa.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("time_spent_sec", sa.Integer, default=0),
        sa.Column("score", sa.Integer, nullable=True),
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_completion_user_lesson"),
    )
    op.create_index("idx_completions_user", "lesson_completions", ["user_id"])

    op.create_table(
        "user_streaks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("current_streak", sa.Integer, default=0, nullable=False),
        sa.Column("longest_streak", sa.Integer, default=0, nullable=False),
        sa.Column("last_activity", sa.Date, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ─── Resume Builder (Module 06) ───────────────────────────────────────────

    op.create_table(
        "resume_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("template_type", sa.String(30), nullable=True),
        sa.Column("thumbnail_url", sa.Text, nullable=True),
        sa.Column("html_template", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "template_type IN ('ats_clean','modern','hybrid','executive')",
            name="ck_template_type"
        ),
    )

    op.create_table(
        "resumes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("template_id", UUID(as_uuid=True), sa.ForeignKey("resume_templates.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(200), nullable=False, default="My Resume"),
        sa.Column("career_track_id", UUID(as_uuid=True), sa.ForeignKey("career_tracks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_primary", sa.Boolean, default=False, nullable=False),
        sa.Column("ats_score", sa.Integer, nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("ats_score IS NULL OR (ats_score BETWEEN 0 AND 100)", name="ck_ats_score_range"),
    )
    op.create_index("idx_resumes_user", "resumes", ["user_id"])

    op.create_table(
        "resume_sections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("resume_id", UUID(as_uuid=True), sa.ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(100), nullable=True),
        sa.Column("content", JSONB, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("sort_order", sa.Integer, default=0),
        sa.Column("ai_improved", sa.Boolean, default=False, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "section_type IN ('summary','experience','education','skills','achievements','projects','certifications','languages')",
            name="ck_section_type"
        ),
    )
    op.create_index("idx_resume_sections_resume", "resume_sections", ["resume_id"])

    op.create_table(
        "resume_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("resume_id", UUID(as_uuid=True), sa.ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_num", sa.Integer, nullable=False),
        sa.Column("content", JSONB, nullable=False),
        sa.Column("ai_generated", sa.Boolean, default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("resume_id", "version_num", name="uq_resume_version"),
    )
    op.create_index("idx_resume_versions_resume", "resume_versions", ["resume_id", "version_num"])

    # ─── Mock Interview Engine (Module 07) ───────────────────────────────────

    op.create_table(
        "question_banks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("career_track_id", UUID(as_uuid=True), sa.ForeignKey("career_tracks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("question_text", sa.Text, nullable=False),
        sa.Column("question_type", sa.String(30), nullable=True),
        sa.Column("difficulty", sa.String(10), nullable=True),
        sa.Column("expected_answer_guide", sa.Text, nullable=True),
        sa.Column("language", sa.String(10), default="en"),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "question_type IN ('behavioral','situational','technical','hr','case')",
            name="ck_question_type"
        ),
        sa.CheckConstraint("difficulty IN ('easy','medium','hard')", name="ck_question_difficulty"),
    )
    op.create_index("idx_questions_track", "question_banks", ["career_track_id"])

    op.create_table(
        "interview_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("career_track_id", UUID(as_uuid=True), sa.ForeignKey("career_tracks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("session_type", sa.String(20), default="practice", nullable=False),
        sa.Column("status", sa.String(20), default="scheduled", nullable=False),
        sa.Column("total_questions", sa.Integer, default=5),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("session_type IN ('practice','timed','full_mock')", name="ck_session_type"),
        sa.CheckConstraint("status IN ('scheduled','in_progress','completed','abandoned')", name="ck_session_status"),
    )
    op.create_index("idx_sessions_user", "interview_sessions", ["user_id"])

    op.create_table(
        "session_responses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", UUID(as_uuid=True), sa.ForeignKey("question_banks.id"), nullable=False),
        sa.Column("response_text", sa.Text, nullable=False),
        sa.Column("response_time_sec", sa.Integer, default=0),
        sa.Column("sequence_num", sa.Integer, nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_responses_session", "session_responses", ["session_id"])

    op.create_table(
        "interview_feedback",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("response_id", UUID(as_uuid=True), sa.ForeignKey("session_responses.id", ondelete="CASCADE"), nullable=True),
        sa.Column("clarity_score", sa.Integer, nullable=True),
        sa.Column("conciseness_score", sa.Integer, nullable=True),
        sa.Column("impact_score", sa.Integer, nullable=True),
        sa.Column("relevance_score", sa.Integer, nullable=True),
        sa.Column("star_adherence", sa.Integer, nullable=True),
        sa.Column("overall_score", sa.Integer, nullable=True),
        sa.Column("strengths", JSONB, server_default=sa.text("'[]'")),
        sa.Column("improvements", JSONB, server_default=sa.text("'[]'")),
        sa.Column("rewritten_answer", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_feedback_session", "interview_feedback", ["session_id"])

    # ─── AI Counsellor (Module 08) ────────────────────────────────────────────

    op.create_table(
        "conversations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=True),
        sa.Column("context_type", sa.String(30), default="general", nullable=False),
        sa.Column("status", sa.String(20), default="active", nullable=False),
        sa.Column("message_count", sa.Integer, default=0, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "context_type IN ('career','emotional','learning','resume','general')",
            name="ck_conv_context_type"
        ),
        sa.CheckConstraint("status IN ('active','archived')", name="ck_conv_status"),
    )
    op.create_index("idx_conversations_user", "conversations", ["user_id"])

    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("conversation_id", UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("content_hi", sa.Text, nullable=True),
        sa.Column("token_count", sa.Integer, nullable=True),
        sa.Column("model_used", sa.String(100), nullable=True),
        sa.Column("safety_flagged", sa.Boolean, default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('user','assistant','system')", name="ck_message_role"),
    )
    op.create_index("idx_messages_conv", "messages", ["conversation_id", "created_at"])

    op.create_table(
        "counsellor_memory",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("memory_type", sa.String(30), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("importance", sa.String(20), default="medium", nullable=False),
        sa.Column("source_conv_id", UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "memory_type IN ('fact','preference','concern','milestone','goal')",
            name="ck_memory_type"
        ),
        sa.CheckConstraint("importance IN ('low','medium','high','critical')", name="ck_memory_importance"),
    )
    op.create_index("idx_memory_user", "counsellor_memory", ["user_id", "is_active"])

    op.create_table(
        "counsellor_memory_embeddings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("memory_id", UUID(as_uuid=True), sa.ForeignKey("counsellor_memory.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("embedding", Vector(384), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # HNSW index created separately via raw SQL (op.execute)
    op.execute(
        "CREATE INDEX idx_memory_emb_hnsw ON counsellor_memory_embeddings "
        "USING hnsw (embedding vector_cosine_ops)"
    )

    op.create_table(
        "safety_flags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("message_id", UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("flag_type", sa.String(30), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("triggered_by", sa.String(200), nullable=True),
        sa.Column("action_taken", sa.String(50), default="logged", nullable=False),
        sa.Column("reviewed_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_safety_flags_user", "safety_flags", ["user_id"])

    # ─── Analytics (Module 11) ────────────────────────────────────────────────
    # user_events is partitioned — create parent table then first partitions

    op.execute("""
        CREATE TABLE user_events (
            id          UUID DEFAULT gen_random_uuid(),
            user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
            session_id  VARCHAR(64),
            event_name  VARCHAR(100) NOT NULL,
            event_data  JSONB DEFAULT '{}',
            page_url    TEXT,
            created_at  TIMESTAMPTZ DEFAULT NOW()
        ) PARTITION BY RANGE (created_at)
    """)
    op.execute("""
        CREATE TABLE user_events_2026_06 PARTITION OF user_events
        FOR VALUES FROM ('2026-06-01') TO ('2026-07-01')
    """)
    op.execute("""
        CREATE TABLE user_events_2026_07 PARTITION OF user_events
        FOR VALUES FROM ('2026-07-01') TO ('2026-08-01')
    """)
    op.execute("""
        CREATE TABLE user_events_2026_08 PARTITION OF user_events
        FOR VALUES FROM ('2026-08-01') TO ('2026-09-01')
    """)
    op.execute("CREATE INDEX idx_events_user_date ON user_events(user_id, created_at)")
    op.execute("CREATE INDEX idx_events_name_date ON user_events(event_name, created_at)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS user_events CASCADE")
    op.drop_table("safety_flags")
    op.drop_table("counsellor_memory_embeddings")
    op.drop_table("counsellor_memory")
    op.drop_table("messages")
    op.drop_table("conversations")
    op.drop_table("interview_feedback")
    op.drop_table("session_responses")
    op.drop_table("interview_sessions")
    op.drop_table("question_banks")
    op.drop_table("resume_versions")
    op.drop_table("resume_sections")
    op.drop_table("resumes")
    op.drop_table("resume_templates")
    op.drop_table("user_streaks")
    op.drop_table("lesson_completions")
    op.drop_table("user_learning_enrollments")
    op.drop_table("lessons")
    op.drop_table("path_modules")
    op.drop_table("learning_paths")
