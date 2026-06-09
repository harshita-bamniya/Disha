"""
Memory system for the DISHA AI Counsellor.

After each assistant response, extract potential memories (facts, preferences, concerns)
and store them with embeddings for semantic retrieval.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.mvp2 import Conversation, CounsellorMemory, CounsellorMemoryEmbedding
from app.models.user import User

logger = logging.getLogger(__name__)

_MEMORY_EXTRACTION_SYSTEM = """You are a memory extraction assistant for a career counselling AI.

Given the latest exchange between a user and DISHA AI (career counsellor), extract any meaningful
long-term facts that should be remembered about the user.

Extract ONLY information that is:
1. Long-term relevant (not just for this conversation)
2. About the user's situation, preferences, concerns, goals, or milestones
3. New information not already known

Return a JSON array (may be empty []):
[
  {
    "memory_type": "fact|preference|concern|milestone|goal",
    "content": "Concise statement about the user in third person",
    "importance": "low|medium|high|critical"
  }
]

Examples of good memories:
- "User expressed concern about financial pressure from family after 4 UPSC attempts"
- "User is interested in Policy Consulting as a career path"
- "User has a fear of corporate culture being too competitive"
- "User cleared UPSC Mains twice — has strong analytical depth"

Do NOT extract:
- Generic pleasantries
- Temporary emotional states
- Questions without answers
- Information already captured in onboarding"""

_MEMORY_EXTRACTION_USER = """User message: {user_message}

Assistant response: {assistant_response}

Extract memories from this exchange."""


async def extract_and_store_memories(
    user_message: str,
    assistant_response: str,
    user: User,
    conversation: Conversation,
    db: Session,
) -> int:
    """Extract memories from the latest exchange and store them. Returns count added."""
    try:
        from app.ai.providers.groq import GroqProvider
        provider = GroqProvider()

        user_prompt = _MEMORY_EXTRACTION_USER.format(
            user_message=user_message[:500],
            assistant_response=assistant_response[:500],
        )
        response = await provider.complete(
            _MEMORY_EXTRACTION_SYSTEM,
            [{"role": "user", "content": user_prompt}],
            max_tokens=400,
        )
        raw = response.content.strip()
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

        memories = json.loads(raw)
        if not isinstance(memories, list):
            return 0

        count = 0
        for mem in memories[:3]:  # Cap at 3 per exchange
            if not isinstance(mem, dict) or "content" not in mem:
                continue

            memory_obj = CounsellorMemory(
                user_id=user.id,
                memory_type=mem.get("memory_type", "fact"),
                content=mem["content"][:500],
                importance=mem.get("importance", "medium"),
                source_conv_id=conversation.id,
                expires_at=datetime.now(timezone.utc) + timedelta(days=90),
            )
            db.add(memory_obj)
            db.flush()

            # Embed the memory
            try:
                from app.modules.recommendations.embedder import embed
                embedding = embed(mem["content"])
                if embedding:
                    db.add(CounsellorMemoryEmbedding(
                        memory_id=memory_obj.id,
                        embedding=embedding,
                    ))
            except Exception as emb_exc:
                logger.warning(f"[COUNSELLOR MEMORY] Embedding failed: {emb_exc}")

            count += 1

        if count:
            db.commit()
        return count

    except Exception as exc:
        logger.warning(f"[COUNSELLOR MEMORY] Extraction failed: {exc}")
        return 0


async def extract_and_store_memories_bg(
    user_message: str,
    assistant_response: str,
    user_id: str,
    conversation_id: str,
) -> int:
    """
    Background-safe version of memory extraction.

    Opens its OWN database session so it can be called via asyncio.create_task()
    without holding onto the request-scoped session (which is already closed by
    the time the background task actually runs).
    """
    from app.database import SessionLocal
    from uuid import UUID

    db = SessionLocal()
    try:
        from app.ai.providers.groq import GroqProvider
        from app.models.mvp2 import CounsellorMemory, CounsellorMemoryEmbedding

        provider = GroqProvider()
        user_prompt = _MEMORY_EXTRACTION_USER.format(
            user_message=user_message[:500],
            assistant_response=assistant_response[:500],
        )
        response = await provider.complete(
            _MEMORY_EXTRACTION_SYSTEM,
            [{"role": "user", "content": user_prompt}],
            max_tokens=400,
        )
        raw = response.content.strip()
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

        memories = json.loads(raw)
        if not isinstance(memories, list):
            return 0

        uid = UUID(user_id)
        conv_id = UUID(conversation_id)
        count = 0
        for mem in memories[:3]:
            if not isinstance(mem, dict) or "content" not in mem:
                continue

            memory_obj = CounsellorMemory(
                user_id=uid,
                memory_type=mem.get("memory_type", "fact"),
                content=mem["content"][:500],
                importance=mem.get("importance", "medium"),
                source_conv_id=conv_id,
                expires_at=datetime.now(timezone.utc) + timedelta(days=90),
            )
            db.add(memory_obj)
            db.flush()

            try:
                from app.modules.recommendations.embedder import embed
                embedding = embed(mem["content"])
                if embedding:
                    db.add(CounsellorMemoryEmbedding(
                        memory_id=memory_obj.id,
                        embedding=embedding,
                    ))
            except Exception as emb_exc:
                logger.warning(f"[COUNSELLOR MEMORY BG] Embedding failed: {emb_exc}")

            count += 1

        if count:
            db.commit()
        return count

    except Exception as exc:
        logger.warning(f"[COUNSELLOR MEMORY BG] Extraction failed: {exc}")
        db.rollback()
        return 0
    finally:
        db.close()


def retrieve_relevant_memories(
    user_id,
    query_embedding: list[float] | None,
    db: Session,
    limit: int = 5,
) -> list[str]:
    """Retrieve the most relevant active memories for the current context."""
    if query_embedding is not None:
        try:
            rows = db.execute(
                """
                SELECT cm.content, cm.importance,
                       1 - (cme.embedding <=> :emb) AS relevance
                FROM counsellor_memory_embeddings cme
                JOIN counsellor_memory cm ON cm.id = cme.memory_id
                WHERE cm.user_id = :uid
                  AND cm.is_active = true
                  AND (cm.expires_at IS NULL OR cm.expires_at > NOW())
                ORDER BY relevance DESC
                LIMIT :lim
                """,
                {"emb": str(query_embedding), "uid": str(user_id), "lim": limit},
            ).fetchall()
            return [row[0] for row in rows]
        except Exception as exc:
            logger.warning(f"[COUNSELLOR MEMORY] Semantic retrieval failed, falling back: {exc}")

    # Fallback: most recent active memories
    memories = (
        db.query(CounsellorMemory)
        .filter(
            CounsellorMemory.user_id == user_id,
            CounsellorMemory.is_active == True,
        )
        .order_by(CounsellorMemory.created_at.desc())
        .limit(limit)
        .all()
    )
    return [m.content for m in memories]
