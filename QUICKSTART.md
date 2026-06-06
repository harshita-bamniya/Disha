# DISHA AI — Quickstart Guide

> How to run the platform locally and verify everything is working.

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Docker Desktop | Latest | https://www.docker.com/products/docker-desktop |
| Node.js | 20+ | https://nodejs.org |
| Git | Any | https://git-scm.com |

---

## Step 1 — Start Docker Desktop

Open Docker Desktop from your Start menu. Wait until the whale icon in the system tray stops animating (takes ~30–60 seconds).

---

## Step 2 — Start All Services

Open a terminal in the project root (`E:\GalaxyWeblinks\Disha`) and run:

```bash
docker compose up -d
```

This starts 5 containers:
- `disha_postgres` — PostgreSQL 16 with pgvector
- `disha_redis` — Redis 7
- `disha_backend` — FastAPI (Python 3.12)
- `disha_worker` — Celery async worker
- `disha_frontend` — Vite + React dev server

Verify all containers are running:

```bash
docker compose ps
```

Expected output:
```
NAME             STATUS
disha_backend    Up
disha_frontend   Up
disha_postgres   Up (healthy)
disha_redis      Up (healthy)
disha_worker     Up
```

---

## Step 3 — Open the Apps

| What | URL | Notes |
|------|-----|-------|
| Frontend (React app) | http://localhost:5173 | Main app |
| API Swagger Docs | http://localhost:8000/docs | Interactive API explorer |
| API Health Check | http://localhost:8000/health | Should return `{"status":"ok"}` |

---

## Step 4 — Test the Auth Flow (Module 01)

### Option A — Use the Frontend (Recommended)

1. Open **http://localhost:5173**
2. Click **Get Started**
3. On the Register page:
   - Enter any 10-digit Indian mobile number (e.g. `9876543210`)
   - Enter a password (min 8 chars)
   - Select language (Hindi or English)
   - Click **Create account**
4. The OTP verify page opens. Since `ENVIRONMENT=local`, the OTP appears on screen in an amber box. Click it to auto-fill.
5. Click **Verify OTP** → redirects to Login page with a success message
6. Log in with the same phone + password → lands on dashboard placeholder

### Option B — Use Swagger UI (API Testing)

Open **http://localhost:8000/docs** and test each endpoint:

#### 1. Register
```
POST /api/auth/register
Body: {"phone": "9123456789", "password": "Test@1234", "preferred_language": "hi"}
```
Response includes `dev_otp` (visible only in local environment):
```json
{
  "message": "Account created. Please verify your phone number with the OTP sent.",
  "dev_otp": "847291"
}
```

#### 2. Verify Phone
```
POST /api/auth/verify-phone
Body: {"phone": "9123456789", "otp": "847291"}
```

#### 3. Login
```
POST /api/auth/login
Body: {"phone": "9123456789", "password": "Test@1234"}
```
Response includes `access_token` and `refresh_token`.

#### 4. Authenticated Request — Get Current User
Click **Authorize** in Swagger UI (top right), enter `Bearer <your_access_token>`, then:
```
GET /api/auth/me
```

### Option C — Use curl

```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"9000000001","password":"Test@1234","preferred_language":"hi"}'

# Verify (use dev_otp from register response)
curl -X POST http://localhost:8000/api/auth/verify-phone \
  -H "Content-Type: application/json" \
  -d '{"phone":"9000000001","otp":"<DEV_OTP_HERE>"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"9000000001","password":"Test@1234"}'

# Get current user (replace TOKEN)
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN_HERE>"
```

---

## Understanding the .env File

The `.env` file has values that look like `change_me_in_production`. In **local dev this is fine** — it's the actual password being used (just a confusingly named one).

**What you actually need filled in for each module:**

| Variable | Needed When | How to Get |
|----------|------------|------------|
| `POSTGRES_*` | Always | Already set, don't change |
| `REDIS_PASSWORD` | Always | Already set, don't change |
| `JWT_SECRET_KEY` | Always | Any string in local dev |
| `JWT_REFRESH_SECRET_KEY` | Always | Any string in local dev |
| `ANTHROPIC_API_KEY` | Module 03+ (AI features) | console.anthropic.com |
| `OPENAI_API_KEY` | Module 03+ (embeddings) | platform.openai.com |
| `MSG91_API_KEY` | Before staging deploy | msg91.com |

> **Warning:** If you change `POSTGRES_PASSWORD` in `.env` after the container has been created, the login will fail because Postgres stores credentials at first boot. Either keep the existing value or run `make reset-db` (destroys all local data) and re-run migrations.

---

## Common Commands

```bash
# Start everything
docker compose up -d

# Stop everything
docker compose down

# View live logs (all services)
docker compose logs -f

# View only backend logs
docker compose logs -f backend

# Open a bash shell inside the backend
docker compose exec backend bash

# Open psql (database shell)
docker compose exec postgres psql -U disha -d disha_db

# Run database migrations
docker compose exec backend alembic upgrade head

# Create a new migration (after changing models)
docker compose exec backend alembic revision --autogenerate -m "your_migration_name"

# Full reset — WARNING: destroys all local data
docker compose down -v && docker compose up -d
# After reset, run: docker compose exec backend alembic upgrade head
# Then re-seed roles (see docs/MODULE_01_AUTH.md)
```

---

## Checking Database Directly

```bash
# Open postgres shell
docker compose exec postgres psql -U disha -d disha_db

# Useful queries inside psql:
\dt                          -- list all tables
SELECT name FROM roles;      -- see seeded roles
SELECT phone, phone_verified, created_at FROM users;  -- see registered users
SELECT user_id, expires_at FROM refresh_tokens;       -- see active sessions
\q                           -- quit
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `docker compose up` fails | Make sure Docker Desktop is running |
| Backend returns 500 error | Check `docker compose logs backend` |
| Frontend shows blank page | Check `docker compose logs frontend` |
| `alembic upgrade head` fails | Check `DATABASE_URL` env var in backend container |
| OTP not showing on screen | Make sure `ENVIRONMENT=local` is in `.env` |
| `role 'aspirant' not seeded` | Run the role seed SQL in `docs/MODULE_01_AUTH.md` |
| Can't connect to postgres | Don't change `POSTGRES_PASSWORD` after first boot |
