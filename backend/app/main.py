import logging
import uuid

import sentry_sdk
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.modules.auth.router import router as auth_router
from app.modules.onboarding.router import router as onboarding_router
from app.modules.krs.router import router as krs_router
from app.modules.jobs.router import router as jobs_router
from app.modules.admin.router import router as admin_router
from app.modules.careers.router import router as careers_router
from app.modules.resume.router import router as resume_router
from app.modules.interview.router import router as interview_router
from app.modules.counsellor.router import router as counsellor_router
from app.modules.analytics.router import router as analytics_router
from app.modules.matching.router import router as matching_router
from app.modules.admin.platform_router import router as platform_router
from app.modules.roadmap.router import router as roadmap_router
from app.modules.jobs.plan_router import router as job_plan_router
from app.modules.companion.router import router as companion_router

settings = get_settings()
logger = logging.getLogger(__name__)

# ── Sentry ────────────────────────────────────────────────────────────────────
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.2,
        send_default_pii=False,  # Never send raw PII to Sentry
    )

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, storage_uri=settings.redis_url)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="DISHA AI API",
    description="Career relaunch platform for UPSC aspirants",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Security headers middleware ───────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


# ── Request ID middleware ─────────────────────────────────────────────────────
class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


# ── Request size limit middleware ─────────────────────────────────────────────
class LimitRequestSizeMiddleware(BaseHTTPMiddleware):
    MAX_CONTENT_LENGTH = 2 * 1024 * 1024  # 2 MB

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.MAX_CONTENT_LENGTH:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"detail": "Request body too large. Maximum size is 2MB."},
            )
        return await call_next(request)


# ── Register middleware (order matters — outermost first) ─────────────────────
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(LimitRequestSizeMiddleware)
_allowed_origins = set(settings.get_allowed_origins())


class StrictCORSMiddleware(BaseHTTPMiddleware):
    """Only emit CORS headers when the request Origin is in the allowlist."""

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")
        if origin not in _allowed_origins:
            # Unknown origin: serve the response with no CORS headers at all.
            return await call_next(request)

        if request.method == "OPTIONS":
            response = JSONResponse(content="OK", status_code=200)
        else:
            response = await call_next(request)

        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Request-ID"
        response.headers["Vary"] = "Origin"
        return response


app.add_middleware(StrictCORSMiddleware)


# ── Global exception handlers ─────────────────────────────────────────────────
@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        "Database error on %s %s [request_id=%s]: %s",
        request.method, request.url.path, request_id, exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "A database error occurred. Please try again.", "request_id": request_id},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # Don't swallow HTTPExceptions — let FastAPI handle those normally
    from fastapi import HTTPException
    if isinstance(exc, HTTPException):
        raise exc
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        "Unhandled error on %s %s [request_id=%s]: %s",
        request.method, request.url.path, request_id, exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred.", "request_id": request_id},
    )


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api")
app.include_router(onboarding_router, prefix="/api")
app.include_router(krs_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(careers_router, prefix="/api")
app.include_router(resume_router, prefix="/api")
app.include_router(interview_router, prefix="/api")
app.include_router(counsellor_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(matching_router, prefix="/api")
app.include_router(platform_router, prefix="/api")
app.include_router(roadmap_router, prefix="/api")
app.include_router(job_plan_router, prefix="/api")
app.include_router(companion_router, prefix="/api")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "app": settings.app_name, "env": settings.environment}


@app.get("/", include_in_schema=False)
def root():
    return {"message": "DISHA AI API is running"}
