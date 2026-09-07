"""Google Calendar OAuth integration.

Routes:
  GET  /api/auth/google/calendar/authorize   → redirect to Google consent screen
  GET  /api/auth/google/calendar/callback    → exchange code, store tokens, redirect to frontend
  GET  /api/employer/calendar/status         → is this user connected?
  DELETE /api/employer/calendar/disconnect   → revoke & delete tokens
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from jose import JWTError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.rbac import require_employer
from app.core.security import decode_access_token
from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["Google Calendar"])

_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
]

# ── helpers ───────────────────────────────────────────────────────────────────

def _flow():
    from google_auth_oauthlib.flow import Flow
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_calendar_client_id,
                "client_secret": settings.google_calendar_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.google_calendar_redirect_uri],
            }
        },
        scopes=_SCOPES,
        redirect_uri=settings.google_calendar_redirect_uri,
    )


def _get_token_row(user_id, db: Session):
    from app.models.integrations import GoogleCalendarToken
    return db.query(GoogleCalendarToken).filter(GoogleCalendarToken.user_id == user_id).first()


def _frontend_url() -> str:
    origins = settings.get_allowed_origins()
    return origins[0] if origins else "http://localhost:5173"


# ── OAuth initiation ──────────────────────────────────────────────────────────

@router.get("/auth/google/calendar/authorize")
def authorize(token: str = Query(...), db: Session = Depends(get_db)):
    """Redirect the employer to Google's OAuth consent screen.

    Accepts the JWT as a query param because this endpoint is navigated to
    directly by the browser and cannot receive an Authorization header.
    """
    if not settings.google_calendar_client_id or not settings.google_calendar_client_secret:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar OAuth is not configured.",
        )
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(
        User.id == user_id, User.is_active == True, User.deleted_at == None
    ).first()
    if not user or user.role_name not in ("employer", "employer_owner", "hr_manager", "recruiter", "interviewer"):
        raise HTTPException(status_code=403, detail="Employer account required")

    flow = _flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=str(user.id),
    )
    return RedirectResponse(auth_url)


# ── OAuth callback ────────────────────────────────────────────────────────────

@router.get("/auth/google/calendar/callback")
def callback(code: str, state: str, db: Session = Depends(get_db)):
    """Google redirects here after the user grants/denies consent.
    Exchanges the code for tokens and stores them, then redirects to the
    employer calendar page in the frontend.
    """
    from app.models.integrations import GoogleCalendarToken

    try:
        flow = _flow()
        flow.fetch_token(code=code)
        creds = flow.credentials
    except Exception as exc:
        logger.error("[GCAL] Token exchange failed: %s", exc)
        return RedirectResponse(f"{_frontend_url()}/app/employer/calendar?gcal=error")

    token_json = creds.to_json()

    row = db.query(GoogleCalendarToken).filter(GoogleCalendarToken.user_id == state).first()
    if row:
        row.token = token_json
    else:
        db.add(GoogleCalendarToken(user_id=state, token=token_json))
    db.commit()

    logger.info("[GCAL] Calendar connected for user %s", state)
    return RedirectResponse(f"{_frontend_url()}/app/employer/calendar?gcal=connected")


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/employer/calendar/status")
def calendar_status(
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    row = _get_token_row(str(current_user.id), db)
    if not row:
        return {"connected": False}
    try:
        data = json.loads(row.token)
        return {
            "connected": True,
            "connected_at": row.connected_at.isoformat(),
            "scopes": data.get("scopes", []),
        }
    except Exception:
        return {"connected": False}


# ── Disconnect ────────────────────────────────────────────────────────────────

@router.delete("/employer/calendar/disconnect", status_code=200)
def disconnect(
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    from app.models.integrations import GoogleCalendarToken

    row = _get_token_row(str(current_user.id), db)
    if not row:
        return {"disconnected": False, "message": "Not connected."}

    # Attempt to revoke with Google (best-effort — don't block on failure)
    try:
        import httpx, json as _json
        data = _json.loads(row.token)
        token = data.get("token") or data.get("access_token")
        if token:
            httpx.post("https://oauth2.googleapis.com/revoke", params={"token": token}, timeout=5)
    except Exception as exc:
        logger.warning("[GCAL] Token revoke request failed (non-fatal): %s", exc)

    db.delete(row)
    db.commit()
    logger.info("[GCAL] Calendar disconnected for user %s", current_user.id)
    return {"disconnected": True}
