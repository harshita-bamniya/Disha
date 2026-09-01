from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.careers.router import router as careers_router
from app.modules.jobs.router import router as jobs_router
from app.modules.krs.router import router as krs_router
from app.modules.onboarding.router import router as onboarding_router

settings = get_settings()

app = FastAPI(
    title="DISHA AI API",
    description="Career relaunch platform for UPSC aspirants",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api")
app.include_router(onboarding_router, prefix="/api")
app.include_router(krs_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(careers_router, prefix="/api")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "app": settings.app_name, "env": settings.environment}


@app.get("/", include_in_schema=False)
def root():
    return {"message": "DISHA AI API is running"}
