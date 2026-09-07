from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.rbac import get_current_aspirant
from app.database import get_db
from app.models.user import User
from app.modules.counsellor import orchestrator, service
from app.modules.counsellor.schemas import (
    ArchiveConversationResponse,
    ConversationDetail,
    ConversationSummary,
    CreateConversationRequest,
    SendMessageRequest,
)

router = APIRouter(prefix="/counsellor", tags=["AI Counsellor"])


@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.list_conversations(user.id, db)


@router.post("/conversations", response_model=ConversationSummary, status_code=201)
def create_conversation(
    body: CreateConversationRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.create_conversation(body, user.id, db)


@router.post("/career-coaching", response_model=ConversationSummary, status_code=201)
def start_career_coaching(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """One-click start a career coaching conversation."""
    return service.start_career_coaching(user.id, db)


@router.get("/conversations/{conv_id}", response_model=ConversationDetail)
def get_conversation(
    conv_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.get_conversation_detail(conv_id, user.id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


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

    try:
        conv = service.get_conversation_for_message(conv_id, user.id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

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


@router.delete("/conversations/{conv_id}", status_code=204)
def delete_conversation(
    conv_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Hard-delete a conversation and all its messages."""
    try:
        service.delete_conversation(conv_id, user.id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/conversations/{conv_id}/archive", response_model=ArchiveConversationResponse)
def archive_conversation(
    conv_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.archive_conversation(conv_id, user.id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/prep-checklist/{job_id}")
def get_prep_checklist(
    job_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """
    Return a prep checklist for a given job showing what the user has done
    and what's still outstanding.
    """
    return service.get_prep_checklist(job_id, user, db)


@router.get("/nudge")
def get_nudge(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """
    Return a proactive nudge message if the user has been inactive for 5+ days,
    or hasn't done a mock interview / skill session in a while. Returns null
    when no nudge is warranted.
    """
    return service.get_nudge(user, db)


@router.get("/memories")
def list_memories(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Return all active memories BeginablAI has stored about this user."""
    return service.list_memories(user.id, db)


@router.delete("/memories/{memory_id}", status_code=204)
def delete_memory(
    memory_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Soft-delete a memory (user forgets it)."""
    try:
        service.delete_memory(memory_id, user.id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
