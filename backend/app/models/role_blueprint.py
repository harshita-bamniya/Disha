"""Roadmap engine v2 storage: curated role blueprints and the ranked video library.

A blueprint is the reviewed *skeleton* of a job-ready roadmap for a role family
(skill graph, prerequisites, base hours, proof tasks, verified references). The
LLM never writes a user's roadmap from memory — it personalises one of these.
"""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.database import Base


class RoleBlueprint(Base):
    __tablename__ = "role_blueprints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(120), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    # draft = machine-drafted, usable but flagged; reviewed = human-approved; retired
    review_status = Column(String(20), nullable=False, default="draft")
    is_current = Column(Boolean, nullable=False, default=True)
    # {phases, skills, job_ready_definition, job_search_kit, ...} — see roadmap_engine.schema
    graph = Column(JSONB, nullable=False, default=dict)
    # Provenance: which postings / model produced it, judge verdict, validation errors.
    sources = Column(JSONB, nullable=False, default=dict)
    # Embedding of title + skill names, used to map an arbitrary job to a blueprint.
    embedding = Column(JSONB, nullable=True)
    reviewed_by = Column(String(120), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SkillResource(Base):
    """Cached, ranked YouTube picks for one (skill query, language, level) key.

    Shared across every user, so a skill's search + scoring cost is paid once
    per refresh window, not once per roadmap.
    """
    __tablename__ = "skill_resources"
    __table_args__ = (UniqueConstraint("cache_key", name="uq_skill_resources_cache_key"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cache_key = Column(String(64), nullable=False, index=True)
    skill_name = Column(String(200), nullable=False)
    query = Column(String(300), nullable=False)
    language = Column(String(8), nullable=False, default="en")
    level = Column(String(20), nullable=False, default="beginner")
    # Ranked picks: [{video_id,title,channel,duration_minutes,views,likes,score,components,reason,...}]
    videos = Column(JSONB, nullable=False, default=list)
    source = Column(String(20), nullable=False, default="ytdlp")  # youtube_api | ytdlp
    candidates_seen = Column(Integer, nullable=False, default=0)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
