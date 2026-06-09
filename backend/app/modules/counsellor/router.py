from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.rbac import get_current_aspirant
from app.database import get_db
from app.models.mvp2 import Conversation, Message
from app.models.user import User
from app.modules.counsellor import orchestrator
from app.modules.counsellor.schemas import (
    ArchiveConversationResponse, ConversationDetail, ConversationSummary,
    CreateConversationRequest, MessageOut, SendMessageRequest,
)

router = APIRouter(prefix="/counsellor", tags=["AI Counsellor"])


@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    convs = (
        db.query(Conversation)
        .filter(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(20)
        .all()
    )
    return [
        ConversationSummary(
            id=str(c.id),
            title=c.title,
            context_type=c.context_type,
            status=c.status,
            message_count=c.message_count,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in convs
    ]


@router.post("/conversations", response_model=ConversationSummary, status_code=201)
def create_conversation(
    body: CreateConversationRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    conv = Conversation(
        user_id=user.id,
        context_type=body.context_type,
        status="active",
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ConversationSummary(
        id=str(conv.id),
        title=conv.title,
        context_type=conv.context_type,
        status=conv.status,
        message_count=conv.message_count,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.get("/conversations/{conv_id}", response_model=ConversationDetail)
def get_conversation(
    conv_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
        .all()
    )

    return ConversationDetail(
        id=str(conv.id),
        title=conv.title,
        context_type=conv.context_type,
        status=conv.status,
        message_count=conv.message_count,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[
            MessageOut(
                id=str(m.id),
                role=m.role,
                content=m.content,
                safety_flagged=m.safety_flagged,
                created_at=m.created_at,
            )
            for m in messages
        ],
    )


@router.post("/conversations/{conv_id}/messages")
async def send_message(
    conv_id: str,
    body: SendMessageRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Send a message and receive a streamed response via Server-Sent Events."""
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=422, detail="Message content cannot be empty.")

    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if conv.status == "archived":
        raise HTTPException(status_code=400, detail="Cannot send messages to an archived conversation.")

    async def event_stream():
        async for chunk in orchestrator.handle_message(conv, body.content.strip(), user, db):
            # SSE format: each chunk is a data event
            safe_chunk = chunk.replace("\n", "\\n")
            yield f"data: {safe_chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.put("/conversations/{conv_id}/archive", response_model=ArchiveConversationResponse)
def archive_conversation(
    conv_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    conv.status = "archived"
    db.commit()
    return ArchiveConversationResponse(conversation_id=conv_id, status="archived")
