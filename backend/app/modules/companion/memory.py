"""
Memory system for "Your Companion".

After each exchange, extract personal facts worth remembering long-term —
goals, milestones, recurring worries, what helps the user, small wins — so
future conversations feel continuous rather than starting from zero.

Reuses the shared `counsellor_memory` table (memory_type already covers
fact/preference/concern/milestone/goal). Companion-sourced memories are
distinguished by their source_conv_id pointing at an 'emotional' conversation.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_MEMORY_EXTRACTION_SYSTEM = """You are a memory extraction assistant for an emotional companion AI
that supports UPSC aspirants and students through their preparation journey.

Given the latest exchange, extract any meaningful long-term facts worth remembering — NOT
career strategy, but the human details of this person's journey:

- Milestones: things they accomplished, completed, or overcame
- Goals and what they're working toward
- Recurring worries, fears, or sources of pressure (e.g. family expectations)
- What helps them — habits, people, routines that support them
- Personal details they shared (attempt number, exam stage, how long they've been preparing)

Return a JSON array (may be empty []):
[
  {
    "memory_type": "fact|preference|concern|milestone|goal",
    "content": "Concise statement about the user in third person",
    "importance": "low|medium|high|critical"
  }
]

Examples of good memories:
- "User completed their daily study target after a difficult week — a milestone for them"
- "User feels pressure from family comparing them to peers who already have jobs"
- "Talking to their sister helps user feel less alone during setbacks"
- "User is on their 3rd UPSC attempt and feeling discouraged about it"

Do NOT extract:
- Generic pleasantries or one-off emotional states with no lasting relevance
- Career/job-search strategy (that belongs to a different system)
- Information that isn't actually new"""

_MEMORY_EXTRACTION_USER = """User message: {user_message}

Companion response: {assistant_response}

Extract memories from this exchange."""

VALID_TYPES = {"fact", "preference", "concern", "milestone", "goal"}


async def extract_and_store_memories_bg(
    user_message: str,
    assistant_response: str,
    user_id: str,
    conversation_id: str,
) -> int:
    """Background-safe extraction — opens its own DB session (request session is closed by then)."""
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        from app.ai.providers.groq import GroqProvider
        from app.models.mvp2 import CounsellorMemory, CounsellorMemoryEmbedding
        from app.models.companion import CompanionMilestone

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
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start < 0 or end <= start:
            return 0
        raw = raw[start:end]

        memories = json.loads(raw)
        if not isinstance(memories, list):
            return 0

        uid = UUID(user_id)
        conv_id = UUID(conversation_id)
        count = 0
        for mem in memories[:3]:
            if not isinstance(mem, dict) or "content" not in mem:
                continue

            raw_type = mem.get("memory_type", "fact")
            safe_type = raw_type if raw_type in VALID_TYPES else "fact"
            content = mem["content"][:500]

            memory_obj = CounsellorMemory(
                user_id=uid,
                memory_type=safe_type,
                content=content,
                importance=mem.get("importance", "medium"),
                source_conv_id=conv_id,
                expires_at=datetime.now(timezone.utc) + timedelta(days=180),
            )
            db.add(memory_obj)
            db.flush()

            if safe_type == "milestone":
                db.add(CompanionMilestone(
                    user_id=uid,
                    title=content[:200],
                    source="ai",
                ))

            try:
                from app.modules.recommendations.embedder import embed
                embedding = embed(content)
                if embedding:
                    db.add(CounsellorMemoryEmbedding(memory_id=memory_obj.id, embedding=embedding))
            except Exception as emb_exc:
                logger.warning(f"[COMPANION MEMORY] Embedding failed: {emb_exc}")

            count += 1

        if count:
            db.commit()
        return count

    except Exception as exc:
        logger.warning(f"[COMPANION MEMORY] Extraction failed: {exc}")
        db.rollback()
        return 0
    finally:
        db.close()


def retrieve_relevant_memories(user_id, db: Session, limit: int = 6) -> list[str]:
    """Most recent active memories for this user (career + companion are shared)."""
    from app.models.mvp2 import CounsellorMemory

    memories = (
        db.query(CounsellorMemory)
        .filter(CounsellorMemory.user_id == user_id, CounsellorMemory.is_active == True)
        .order_by(CounsellorMemory.created_at.desc())
        .limit(limit)
        .all()
    )
    return [m.content for m in memories]
