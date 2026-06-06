# Module 01 — Identity & Auth

**Phase:** MVP  
**Status:** ✅ Complete  
**Built on:** 2026-05-12

---

## What This Module Does

Module 01 is the foundation every other module depends on. It handles:

- **Registration** — Phone + password signup for UPSC aspirants
- **Phone verification** — OTP-based confirmation (dev OTP shown on screen locally)
- **Login** — Returns a short-lived JWT access token + long-lived refresh token
- **Token rotation** — Refresh tokens rotate on every use, old ones are revoked
- **Logout** — Revokes the refresh token server-side
- **RBAC** — Role-based access control (`aspirant`, `admin`, `super_admin`)
- **Audit logging** — Every auth event is logged with IP + user-agent

---

## Why These Decisions Were Made

| Decision | Reason |
|----------|--------|
| **Phone-first, not email** | Tier 2/3 India users rely on phone. Email habits are inconsistent. Phone + OTP is the natural UX. |
| **15-min access token** | Short TTL minimizes blast radius if a token is stolen. Silent refresh on the frontend means users never feel it expire. |
| **Refresh token stored as SHA-256 hash** | Never store raw secrets in the database. If the DB is compromised, the attacker gets only a hash. |
| **Refresh token family detection** | If a revoked token is used again, it signals token theft — all tokens for that user are immediately invalidated. |
| **Soft deletes** | Users may return. Compliance requires data retention. We never hard-delete a user. |
| **Dev OTP in API response** | No SMS infra needed during development. `ENVIRONMENT=local` exposes the OTP directly. In production, the field is always null. |
| **Roles seeded in DB, not hardcoded** | Roles can evolve without code changes. A future employer role can be added without touching RBAC logic. |
| **`bcrypt==4.0.1` pinned** | passlib 1.7.4 is incompatible with bcrypt 4.1+. Pinned to 4.0.1 until passlib releases a fix. |

---

## Files Created

### Backend

```
backend/
├── app/
│   ├── models/
│   │   └── user.py              ← All 7 database models
│   ├── core/
│   │   ├── security.py          ← JWT, bcrypt, OTP utilities
│   │   ├── exceptions.py        ← Custom HTTP exception classes
│   │   └── rbac.py              ← FastAPI dependency injection for auth
│   └── modules/
│       └── auth/
│           ├── __init__.py
│           ├── schemas.py       ← Pydantic request + response models
│           ├── service.py       ← All business logic (register, login, OTP, tokens)
│           └── router.py        ← FastAPI route handlers (7 endpoints)
│
├── alembic/
│   ├── env.py                   ← Reads DATABASE_URL from environment
│   ├── script.py.mako           ← Migration file template
│   └── versions/
│       └── 0da7a0ba4100_initial_auth_tables.py  ← Auto-generated migration
└── alembic.ini                  ← Alembic config
```

### Frontend

```
frontend/src/
├── layouts/
│   └── AuthLayout.tsx           ← Centered card layout with DISHA branding
├── components/ui/
│   ├── Button.tsx               ← Reusable button (5 variants, loading state)
│   ├── Input.tsx                ← Labeled input with error + hint states
│   └── OtpInput.tsx             ← 6-box OTP with paste + keyboard navigation
├── api/
│   └── auth.ts                  ← Typed API functions for all auth endpoints
├── stores/
│   ├── authStore.ts             ← Zustand store (user, tokens, persist to localStorage)
│   └── uiStore.ts               ← Zustand store (language preference)
└── modules/auth/
    ├── hooks/
    │   └── useAuth.ts           ← TanStack Query mutations (register, login, etc.)
    └── pages/
        ├── RegisterPage.tsx     ← Phone + password + language selector
        ├── LoginPage.tsx        ← Phone + password login
        └── VerifyOtpPage.tsx    ← 6-digit OTP + countdown resend
```

---

## Database Tables

All tables use UUIDs as primary keys and `TIMESTAMPTZ` for dates.

### `roles`
Seeded with 3 records. Never user-created.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | VARCHAR(50) UNIQUE | `aspirant`, `admin`, `super_admin` |
| description | TEXT | |
| created_at | TIMESTAMPTZ | |

**Seed SQL:**
```sql
INSERT INTO roles (id, name, description) VALUES
  (gen_random_uuid(), 'aspirant', 'UPSC aspirant transitioning to private sector'),
  (gen_random_uuid(), 'admin', 'Platform administrator'),
  (gen_random_uuid(), 'super_admin', 'Super administrator with full access')
ON CONFLICT (name) DO NOTHING;
```

### `users`
Core user record. Kept lean — all profile data lives in `user_profiles` (Module 02).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| phone | VARCHAR(15) UNIQUE NOT NULL | Primary identifier, indexed |
| email | VARCHAR(255) UNIQUE | Optional |
| password_hash | TEXT NOT NULL | bcrypt hash |
| phone_verified | BOOLEAN | Must be true before login is useful |
| email_verified | BOOLEAN | |
| preferred_language | ENUM('en','hi') | Default `hi` |
| role_id | UUID FK → roles | |
| is_active | BOOLEAN | Soft disable without deletion |
| last_login_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ NULL | Null = not deleted (soft delete) |

### `refresh_tokens`
One row per active session. Token reuse detection is built in.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | Indexed |
| token_hash | TEXT UNIQUE | SHA-256 of raw token, never raw |
| expires_at | TIMESTAMPTZ | Indexed, 30 days from issue |
| revoked_at | TIMESTAMPTZ NULL | Set on logout or rotation |
| issued_ip | INET | |
| user_agent | TEXT | |
| created_at | TIMESTAMPTZ | |

### `otp_verifications`
One row per OTP sent. `used_at` prevents replay attacks.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| target | VARCHAR(255) | Phone number, indexed |
| otp_hash | TEXT | SHA-256 of 6-digit OTP |
| purpose | ENUM | `register`, `login`, `reset`, `verify` |
| expires_at | TIMESTAMPTZ | 10 minutes from creation |
| used_at | TIMESTAMPTZ NULL | Set when OTP is consumed |
| created_at | TIMESTAMPTZ | |

### `audit_logs`
Append-only. Never updated or deleted.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK NULL | Null for pre-auth events |
| action | VARCHAR(100) | e.g. `user_registered`, `user_login` |
| resource | VARCHAR(100) | e.g. `user`, `auth` |
| resource_id | UUID NULL | |
| ip_address | INET | |
| user_agent | TEXT | |
| log_metadata | JSONB | Extra context |
| created_at | TIMESTAMPTZ | Indexed |

### `permissions` + `role_permissions`
Permission table is scaffolded but not populated yet. Will be used in Module 10 (Admin) to restrict specific admin actions.

---

## API Endpoints

Base URL: `http://localhost:8000/api`

### POST `/auth/register`
Creates a new aspirant account. Sends OTP to phone (returns OTP in `dev_otp` when `ENVIRONMENT=local`).

**Request:**
```json
{
  "phone": "9876543210",
  "password": "Disha@2024",
  "preferred_language": "hi"
}
```

**Success (201):**
```json
{
  "message": "Account created. Please verify your phone number with the OTP sent.",
  "dev_otp": "473921"
}
```

**Errors:**
- `409` — Phone already registered
- `422` — Invalid phone number or password too short

---

### POST `/auth/verify-phone`
Verifies the OTP. Sets `phone_verified = true` on the user.

**Request:**
```json
{
  "phone": "9876543210",
  "otp": "473921"
}
```

**Success (200):**
```json
{
  "message": "Phone number verified successfully.",
  "dev_otp": null
}
```

**Errors:**
- `400` — OTP expired (10 min TTL)
- `400` — Invalid OTP
- `401` — No account found for this phone

---

### POST `/auth/send-otp`
Resends an OTP. Used on the verify page after countdown expires.

**Request:**
```json
{
  "phone": "9876543210",
  "purpose": "register"
}
```

---

### POST `/auth/login`
Returns a JWT access + refresh token pair.

**Request:**
```json
{
  "phone": "9876543210",
  "password": "Disha@2024"
}
```

**Success (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "v2.local.xyz...",
  "token_type": "bearer",
  "user": {
    "id": "a0edb439-...",
    "phone": "9876543210",
    "email": null,
    "role": "aspirant",
    "preferred_language": "hi",
    "phone_verified": true,
    "email_verified": false
  }
}
```

**Errors:**
- `401` — Wrong phone or password

---

### POST `/auth/refresh`
Rotates the refresh token. Old token is revoked. Returns a new token pair.

**Request:**
```json
{
  "refresh_token": "raw_refresh_token_value"
}
```

**Security note:** If a revoked refresh token is used, ALL tokens for that user are wiped (theft detection).

---

### POST `/auth/logout`
Revokes the refresh token server-side.

**Request:**
```json
{
  "refresh_token": "raw_refresh_token_value"
}
```

---

### GET `/auth/me`
Returns the current authenticated user.

**Headers:** `Authorization: Bearer <access_token>`

**Success (200):**
```json
{
  "id": "a0edb439-...",
  "phone": "9876543210",
  "role": "aspirant",
  "phone_verified": true,
  ...
}
```

---

## How Auth Works End-to-End

```
1. REGISTER
   Client → POST /auth/register { phone, password }
   Server → creates User + OtpVerification + AuditLog
   Server → returns dev_otp (local) or sends SMS (production)

2. VERIFY
   Client → POST /auth/verify-phone { phone, otp }
   Server → checks OTP hash + expiry → sets phone_verified=true

3. LOGIN
   Client → POST /auth/login { phone, password }
   Server → verifies bcrypt hash → creates RefreshToken in DB
   Server → returns access_token (JWT, 15 min) + raw refresh_token (30 days)
   Client → stores both in Zustand (persisted to localStorage)

4. API CALLS
   Client → GET /api/... with Authorization: Bearer <access_token>
   Server middleware → decodes JWT → checks expiry → loads User from DB

5. SILENT REFRESH (automatic in frontend)
   When any API call returns 401:
   Client → POST /auth/refresh { refresh_token }
   Server → looks up token by SHA-256 hash → revokes old → issues new pair
   Client → retries original request with new access_token

6. LOGOUT
   Client → POST /auth/logout { refresh_token }
   Server → sets revoked_at on the DB record
   Client → clears Zustand store (both tokens removed from localStorage)
```

---

## Frontend Flow

```
/ (landing)
  ↓ "Get Started"
/auth/register
  ↓ submit phone + password
/auth/verify   ← dev_otp shown in amber box (click to auto-fill)
  ↓ submit OTP
/auth/login    ← success banner "Phone verified!"
  ↓ submit phone + password
/app/dashboard ← protected, Zustand auth state persisted
```

**Protected route logic (`App.tsx`):**
- `ProtectedRoute` — redirects to `/auth/login` if not authenticated
- `GuestRoute` — redirects to `/app/dashboard` if already authenticated (prevents going back to login)

---

## Running Migrations (Reference)

```bash
# Apply all pending migrations
docker compose exec backend alembic upgrade head

# Roll back one migration
docker compose exec backend alembic downgrade -1

# Check current migration state
docker compose exec backend alembic current

# Auto-generate after model changes
docker compose exec backend alembic revision --autogenerate -m "describe_change"
```

---

## Re-seeding Roles (if you reset the database)

```bash
docker compose exec postgres psql -U disha -d disha_db -c "
INSERT INTO roles (id, name, description) VALUES
  (gen_random_uuid(), 'aspirant', 'UPSC aspirant transitioning to private sector'),
  (gen_random_uuid(), 'admin', 'Platform administrator'),
  (gen_random_uuid(), 'super_admin', 'Super administrator with full access')
ON CONFLICT (name) DO NOTHING;
"
```

---

## How to Use RBAC in Future Modules

The core security layer provides reusable FastAPI dependencies:

```python
from app.core.rbac import get_current_user, get_current_verified_user, require_admin

# Any authenticated user
@router.get("/profile")
def get_profile(user: User = Depends(get_current_user)):
    ...

# Authenticated + phone verified
@router.post("/onboarding/start")
def start_onboarding(user: User = Depends(get_current_verified_user)):
    ...

# Admin only
@router.get("/admin/users")
def list_users(user: User = Depends(require_admin)):
    ...
```

---

## What Module 02 Will Add

Module 02 (Onboarding) will:
- Create `user_profiles`, `upsc_backgrounds`, `onboarding_sessions`, `psychological_assessments` tables
- Use `get_current_verified_user` dependency (phone must be verified to start onboarding)
- Store the multi-step wizard responses
- Feed data into Module 03 (Intelligence Engine / KRS Scoring)
