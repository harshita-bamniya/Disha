import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    ServiceUnavailableException,
)
from app.core.rbac import get_current_user
from app.database import get_db
from app.models.user import User
from app.modules.payments import service
from app.modules.payments.schemas import (
    AspirantSubscriptionResponse,
    AspirantUsageResponse,
    CheckoutRequest,
    CheckoutResponse,
    PaymentHistoryEntry,
    PlanEntry,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
)
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_errors = (BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException)


def _status_for(e: Exception) -> int:
    return getattr(e, "status_code", 400)


router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/plans", response_model=list[PlanEntry])
def list_plans(
    plan_type: str = Query(..., pattern="^(employer|aspirant)$"),
    db: Session = Depends(get_db),
):
    return service.list_plans(plan_type, db)


@router.post("/checkout", response_model=CheckoutResponse)
def checkout(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return service.create_checkout(current_user, body.plan_id, db)
    except _errors as e:
        raise HTTPException(status_code=_status_for(e), detail=e.detail)


@router.post("/verify", response_model=VerifyPaymentResponse)
def verify(
    body: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        service.verify_checkout_signature(
            body.razorpay_payment_id, body.razorpay_subscription_id, body.razorpay_signature, db,
        )
    except _errors as e:
        raise HTTPException(status_code=_status_for(e), detail=e.detail)
    return VerifyPaymentResponse(status="authorized")


@router.post("/cancel", status_code=204)
def cancel(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        service.cancel_subscription(current_user, db)
    except _errors as e:
        raise HTTPException(status_code=_status_for(e), detail=e.detail)


@router.get("/history", response_model=list[PaymentHistoryEntry])
def history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return service.list_payment_history(current_user, db)
    except _errors as e:
        raise HTTPException(status_code=_status_for(e), detail=e.detail)


@router.get("/aspirant/subscription", response_model=AspirantSubscriptionResponse)
def aspirant_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return service.get_aspirant_subscription(current_user, db)
    except _errors as e:
        raise HTTPException(status_code=_status_for(e), detail=e.detail)


@router.get("/aspirant/usage", response_model=AspirantUsageResponse)
def aspirant_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_aspirant_usage(current_user, db)


# ── Webhook (no auth — Razorpay signs the raw body instead) ──────────────────

webhook_router = APIRouter(prefix="/payments/webhook", tags=["Payments"])


@webhook_router.post("/razorpay", status_code=200, include_in_schema=False)
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    try:
        service.handle_webhook(raw_body, signature, db)
    except _errors as e:
        raise HTTPException(status_code=_status_for(e), detail=e.detail)
    except Exception:
        logger.exception("Failed to process Razorpay webhook")
        raise HTTPException(status_code=400, detail="Webhook processing failed.")
    return {"status": "ok"}
