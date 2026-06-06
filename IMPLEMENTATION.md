# DISHA AI — Implementation Tracker

> Living document. Updated after every module milestone.
> Philosophy: "Your preparation was never wasted. It made you rare."

---

## Platform Status

| Phase | Status | Target |
|-------|--------|--------|
| Phase 1 — MVP | 🟡 In Progress | Month 3 |
| Phase 2 — Beta | ⬜ Not Started | Month 6 |
| Phase 3 — Scale | ⬜ Not Started | Month 12 |

---

## Module Completion

| # | Module | Status | Phase | Notes |
|---|--------|--------|-------|-------|
| 01 | Identity & Auth | 🟡 In Progress | MVP | JWT + OTP + RBAC |
| 02 | Onboarding & Assessment | ⬜ Not Started | MVP | |
| 03 | Intelligence Engine (KRS) | ⬜ Not Started | MVP | |
| 04 | Career Mapping | ⬜ Not Started | MVP | |
| 05 | Learning System | ⬜ Not Started | Beta | |
| 06 | Resume Builder | ⬜ Not Started | Beta | |
| 07 | Mock Interview | ⬜ Not Started | Beta | |
| 08 | AI Counsellor (DISHA Bot) | ⬜ Not Started | Beta | |
| 09 | Employer Matching | ⬜ Not Started | Scale | |
| 10 | Admin Dashboard | ⬜ Not Started | MVP (basic) | |
| 11 | Analytics Engine | ⬜ Not Started | Beta | |

---

## MODULE 01 — Identity & Auth

**Goal:** Secure, stateless identity layer. Phone-first registration, OTP verification, JWT with refresh rotation, RBAC.

### Backend Checklist

#### Models (`app/models/user.py`)
- [x] `roles` table
- [x] `permissions` table
- [x] `role_permissions` table
- [x] `users` table
- [x] `refresh_tokens` table
- [x] `otp_verifications` table
- [x] `audit_logs` table

#### Core Layer
- [x] `app/core/security.py` — JWT create/verify, bcrypt hashing
- [x] `app/core/exceptions.py` — Custom HTTP exceptions
- [x] `app/core/rbac.py` — `get_current_user`, `require_role` dependencies

#### Auth Module (`app/modules/auth/`)
- [x] `schemas.py` — Pydantic request/response models
- [x] `service.py` — Business logic (register, login, otp, tokens)
- [x] `router.py` — FastAPI route handlers
- [x] `dependencies.py` — FastAPI dependencies

#### Database
- [x] `alembic.ini` + `alembic/env.py` configured
- [x] Initial migration generated and applied
- [x] Roles seeded: `aspirant`, `admin`, `super_admin`

#### API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public | Register with phone + password |
| POST | `/api/auth/verify-phone` | Public | Verify phone OTP |
| POST | `/api/auth/send-otp` | Public | Resend OTP |
| POST | `/api/auth/login` | Public | Login → token pair |
| POST | `/api/auth/refresh` | Public | Rotate refresh token |
| POST | `/api/auth/logout` | Bearer | Revoke refresh token |
| GET | `/api/auth/me` | Bearer | Get current user |

### Frontend Checklist

#### Layouts & Shared Components
- [x] `src/layouts/AuthLayout.tsx`
- [x] `src/components/ui/Button.tsx`
- [x] `src/components/ui/Input.tsx`
- [x] `src/components/ui/PhoneInput.tsx`
- [x] `src/components/ui/OtpInput.tsx`

#### Auth API Layer
- [x] `src/api/auth.ts`

#### Pages (`src/modules/auth/pages/`)
- [x] `RegisterPage.tsx` — phone + password + language select
- [x] `LoginPage.tsx` — phone + password
- [x] `VerifyOtpPage.tsx` — 6-digit OTP + resend

#### Hooks
- [x] `src/modules/auth/hooks/useAuth.ts`

#### Routing
- [x] `App.tsx` updated with auth routes + protected routes

---

## MODULE 02 — Onboarding & Assessment *(Planned)*

**Goal:** Multi-step conversational wizard capturing UPSC background + psychological state.

### Planned Tables
- `user_profiles`
- `upsc_backgrounds`
- `onboarding_sessions`
- `psychological_assessments`

### Planned Endpoints
- `POST /api/onboarding/start`
- `PUT /api/onboarding/step/:stepNumber`
- `GET /api/onboarding/session`
- `POST /api/onboarding/complete`

---

## MODULE 03 — Intelligence Engine *(Planned)*

**Goal:** AI skill extraction from UPSC background → KRS scoring → skill embeddings.

### Planned Tables
- `skill_categories`, `skills`
- `skill_extractions`, `user_skills`
- `krs_scores`, `krs_components`
- `user_skill_embeddings` (pgvector)

---

## MODULE 04 — Career Mapping *(Planned)*

**Goal:** Vector similarity match between user skill profile and career track requirements.

### Planned Tables
- `career_tracks`, `career_track_embeddings`
- `career_skill_requirements`
- `career_recommendations`, `user_career_selections`

---

## Infrastructure

### Docker Services
| Service | Image | Port | Status |
|---------|-------|------|--------|
| postgres | pgvector/pgvector:pg16 | 5432 | ✅ Healthy |
| redis | redis:7-alpine | 6379 | ✅ Healthy |
| backend | disha-backend (Python 3.12) | 8000 | ✅ Running |
| worker | disha-worker (Celery) | — | ✅ Running |
| frontend | disha-frontend (Node 20) | 5173 | ✅ Running |

### Tech Stack Locked
- **Backend:** FastAPI 0.115, SQLAlchemy 2.0, Alembic, pgvector 0.3
- **Frontend:** React 18, Vite 6, TypeScript, Tailwind v4, Zustand, TanStack Query
- **Auth:** python-jose (JWT HS256), passlib (bcrypt), 15min access / 30day refresh
- **AI (planned):** claude-sonnet-4-6 (primary), OpenAI ada-002 (embeddings)

---

## Design Tokens
```
Primary:    #2D6A4F  (Forest Green)
Secondary:  #F2A65A  (Warm Amber)
Accent:     #1B4965  (Deep Blue)
Surface:    #FAFAF8  (Warm White)
Danger:     #C84B31
```

---

## Dev Commands
```bash
make up              # start all containers
make down            # stop all
make logs-backend    # backend logs
make shell-backend   # bash into backend
make migrate         # alembic upgrade head
make migration name="add_xyz"  # new migration
make health          # curl /health
```

---

*Last updated: Module 01 implementation complete*
