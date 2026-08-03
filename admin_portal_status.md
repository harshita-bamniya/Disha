# Admin Portal — Implementation Status
**Project:** Disha AI  
**Branch:** `module-07-qa-bug-fixes`  
**Last updated:** 2026-07-10  
**Status:** Phase 1 ✅ · Phase 2 ✅ · Phase 3 ✅ (3.1 ✅ · 3.2 ✅ · 3.3 ✅ · 3.4 N/A · 3.5 ✅ · 3.6 ✅ · 3.7 ✅) · Permission Standardization ✅

---

## Architecture Decision (locked)

Single portal at `/admin`. One `AdminLayout` with a role-filtered sidebar.  
Super Admins see **Operations + Platform** sections. Admins/Moderators/etc. see only the sections their role allows.  
No separate `/platform-admin` portal — enterprise SaaS standard: one portal, filtered nav.

**Platform Admin roles:** `super_admin`, `admin`, `moderator`, `verification_officer`, `finance_manager`, `support_executive`

---

## Route Map (all lazy-loaded)

```
/admin                        → redirects to /admin/dashboard
/admin/dashboard              → AdminDashboard            [all admin roles — role-aware content]
/admin/candidates             → CandidatesPage            [admin, super_admin, moderator, support_executive]
/admin/candidates/:id         → CandidateDetailPage       [admin, super_admin, moderator, support_executive]
/admin/users                  → redirects to /admin/candidates (legacy alias)
/admin/employers              → EmployersPage             [admin, super_admin, verification_officer]
/admin/employers/:id          → EmployerDetailPage        [admin, super_admin, verification_officer]
/admin/kyc                    → KycQueuePage              [admin, super_admin, verification_officer]
/admin/jobs                   → JobsPage                  [admin, super_admin, moderator]
/admin/jobs/:id               → JobDetailPage             [admin, super_admin, moderator]
/admin/applications           → ApplicationsPage          [admin, super_admin]
/admin/career-tracks          → CareerTracksPage          [admin, super_admin, moderator (view)]
/admin/support                → SupportPage               [all admin roles]
/admin/support/:id            → TicketDetailPage          [all admin roles]
/admin/reports                → ReportsPage               [admin, super_admin, finance_manager]
/admin/reports/employers      → EmployerReportsPage       [admin, super_admin, finance_manager]
/admin/reports/jobs           → JobReportsPage            [admin, super_admin]
/admin/reports/candidates     → CandidateReportsPage      [admin, super_admin]
/admin/reports/financial      → FinancialReportsPage      [admin, super_admin, finance_manager]
/admin/sub-admins             → SubAdminsPage             [super_admin only]
/admin/roles                  → RolesPage                 [super_admin only]
/admin/audit-log              → AuditLogPage              [admin, super_admin]
/admin/billing                → BillingPage               [admin, super_admin, finance_manager]
/admin/subscriptions          → SubscriptionsPage         [admin, super_admin, finance_manager]
/admin/notifications          → NotificationsPage         [admin, super_admin]
/admin/analytics              → AnalyticsPage             [admin, super_admin, finance_manager]
/admin/ai-config              → AiConfigPage              [super_admin only]
/admin/integrations           → IntegrationsPage          [super_admin only]
/admin/system                 → SystemMonitoringPage      [super_admin only]
/admin/settings               → PlatformSettingsPage      [super_admin only]
```

---

## Phase 1 — Complete ✅

### Backend

| File | Change |
|------|--------|
| `backend/app/modules/admin/platform_router.py` | Elevated all 8 platform endpoints from `require_role("admin")` → `require_super_admin`. Affected: GET/PUT `/settings`, GET/PUT `/flags`, POST `/prompts/seed`, GET/POST `/prompts`, POST `/embeddings/backfill` |

### Frontend — New Files

| File | Description |
|------|-------------|
| `frontend/src/modules/admin/layout/AdminLayout.tsx` | Single layout with `<Outlet />`, role-aware sidebar (Operations + Platform groups), collapsible, GlobalSearchBar, PendingAlert |
| `frontend/src/modules/admin/shared/adminUI.tsx` | Shared UI primitives: `Spinner`, `Empty`, `Badge`, `StatCard`, `SectionHeading`, `DetailRow`, `ScoreBar`, `downloadCSV<T>()`, `ExportButton<T>`, `formatPaise()`, `STATUS_COLOR_MAP`, `VERIF_STATUS_COLOR` |
| `frontend/src/modules/admin/pages/AdminDashboard.tsx` | Role-aware dashboard (see Phase 2.2) |
| `frontend/src/modules/admin/pages/UsersPage.tsx` | User list + `UserDetailDrawer` + `UserSecurityPanel` + bulk select |
| `frontend/src/modules/admin/pages/EmployersPage.tsx` | Employer directory, tab filter, bulk select, click-through to detail |
| `frontend/src/modules/admin/pages/EmployerDetailPage.tsx` | Full employer profile page (Phase 2.1) |
| `frontend/src/modules/admin/pages/KycQueuePage.tsx` | KYC queue + SLA tracking + overdue banner |
| `frontend/src/modules/admin/pages/JobsPage.tsx` | Jobs moderation — toggle active/inactive, delete |
| `frontend/src/modules/admin/pages/ApplicationsPage.tsx` | Applications with status filter chips + CSV export |
| `frontend/src/modules/admin/pages/CareerTracksPage.tsx` | Career tracks CRUD + `TrackFormModal` |
| `frontend/src/modules/admin/pages/SubAdminsPage.tsx` | Sub-admin management |
| `frontend/src/modules/admin/pages/RolesPage.tsx` | Roles & permissions matrix editor (`super_admin` row locked) |
| `frontend/src/modules/admin/pages/AuditLogPage.tsx` | Audit log, action filter, pagination, CSV export |
| `frontend/src/modules/admin/pages/BillingPage.tsx` | MRR / ARPA / active subscriptions KPIs, trend chart, plan distribution |
| `frontend/src/modules/admin/pages/SubscriptionsPage.tsx` | Subscription plan editor |
| `frontend/src/modules/admin/pages/PlatformSettingsPage.tsx` | Platform settings + feature flag toggles |

### Orphaned / To Delete

| File | Note |
|------|------|
| `frontend/src/modules/admin/pages/AdminDashboardPage.tsx` | 2,368-line monolith. No longer imported in App.tsx. Safe to delete. |

---

## Phase 2 — Complete ✅

### 2.1 Employer Detail Page

**Route:** `/admin/employers/:id`  
Clicking any employer row in EmployersPage navigates here.

**Backend added:**
- `backend/app/modules/admin/schemas.py` → `EmployerTeamMemberEntry`, `EmployerJobEntry`, `EmployerDetailResponse`
- `backend/app/modules/admin/service.py` → `get_employer_detail()` (team member join via `company_id`, recent jobs, subscription plan name, KYC status)
- `backend/app/modules/admin/router.py` → `GET /admin/employers/{employer_id}` (`require_admin`)

**Frontend added:**
- `frontend/src/api/admin.ts` → `EmployerDetailResponse` interface + `getEmployerDetail()`
- `frontend/src/modules/admin/hooks/useAdmin.ts` → `useAdminEmployerDetail(id)`
- `frontend/src/modules/admin/pages/EmployerDetailPage.tsx` → KPI strip (jobs / applications / team size / plan), company info panel, KYC status with SLA badge, team members table, recent jobs table (latest 10), revoke modal with navigate-back

### 2.2 Role-Aware Dashboard

`AdminDashboard.tsx` shows role-specific content via `useAuthStore(s => s.user?.role)`:

| Role | Dashboard view |
|------|---------------|
| `super_admin` | Full 8-card stat grid + platform quick-links (Revenue / Team / Audit / Settings) + trends + funnel + activity |
| `admin` | Full 8-card stat grid + trends + funnel + activity |
| `moderator` / `support_executive` | Condensed 3-card strip (aspirants / active jobs / applications) + role-filtered quick actions |
| `verification_officer` | KYC focus panel: pending / under-review / overdue counts (live from API, clickable to `/admin/kyc`) |
| `finance_manager` | Revenue shortcut banner → `/admin/billing` |

### 2.3 KYC SLA Tracking

`KycQueuePage.tsx` changes:
- Red alert banner at top when any pending/under_review item exceeds 3-day threshold
- Table columns: Company · Docs · **In Queue** · Status
- `SlaBadge` component: green (<1d) / amber (1–3d) / red (>3d)
- Pending + under_review lists sorted oldest-first by default (overdue items surface first)
- SLA badge also shown inside `VerificationDetailDrawer` header
- Footer shows total count + overdue count

### 2.4 Notification Management Panel

**Deferred.** Requires new DB model (notifications table, targeting, delivery tracking). No backend infrastructure exists. Placeholder for Phase 3 or a dedicated module sprint.

### 2.5 Enhanced User Detail

`UsersPage.tsx` → `UserSecurityPanel`:
- Added **"Revoke all N sessions"** button (appears when user has > 1 active session). Calls existing `revokeDeviceSession` mutation for each session sequentially.

### 2.6 Bulk Operations

Added to both `UsersPage.tsx` and `EmployersPage.tsx`:
- Select-all checkbox in column header + per-row checkbox (stops row click propagation)
- Floating bulk action bar appears when ≥1 row selected
  - **UsersPage:** Export selected CSV · Clear selection
  - **EmployersPage:** Export selected CSV · Bulk Revoke (only approved employers) · Clear selection
- Uses `downloadCSV()` helper from `adminUI.tsx` directly

---

## Phase 3 — Not Started 🔮

Lower priority — needed for Greenhouse / Lever feature parity.

### 3.1 AI Configuration Panel ✅ (2026-07-08)
**Route:** `/admin/ai-config`

**Backend added (`platform_router.py`):**
- `GET /admin/platform/prompts/{id}` → full content (not truncated)
- `PATCH /admin/platform/prompts/{id}/activate` → toggle is_active; max 2 active per use_case (A/B), returns 409 if already at 2

**Frontend added:**
- `frontend/src/api/admin.ts` → `PromptTemplateEntry`, `PromptTemplateDetail`, `CreatePromptPayload`, `BackfillResult` interfaces; `listPrompts`, `getPrompt`, `createPrompt`, `activatePromptVersion`, `seedPrompts`, `backfillEmbeddings` calls
- `frontend/src/modules/admin/pages/AiConfigPage.tsx` → prompts grouped by use_case (collapsible cards), per-version activate/deactivate toggle, "New version" modal (name, type, model hint, content textarea, notes), "Seed Defaults" button, "Backfill Embeddings" button, inline success/error banner, A/B info pill
- `AdminLayout.tsx` → "AI Config" nav item (Bot icon, Platform group, `super_admin` only)
- `App.tsx` → lazy import + `/admin/ai-config` route

### 3.2 Analytics & Reports Builder ✅ (2026-07-08)
**Route:** `/admin/analytics`

**Backend added:**
- `backend/app/modules/admin/schemas.py` → `TimeSeriesPoint`, `FunnelStage`, `ScoreBin`, `CohortRow`, `AnalyticsPeriod`, `AnalyticsResponse`
- `backend/app/modules/admin/service.py` → `get_analytics(db, from_dt, to_dt)` — user growth (daily), job volume (daily), application funnel (by status), match score distribution (5 bins), cohort table (last 6 months: signups → applied → hired)
- `backend/app/modules/admin/router.py` → `GET /admin/analytics` (`require_permission("analytics", "view")`); accepts `days` (7/30/90/365) or `from_date`+`to_date` ISO params; `analytics:view` permission already seeded for admin, super_admin, finance_manager

**Frontend added:**
- `frontend/src/api/admin.ts` → `TimeSeriesPoint`, `FunnelStage`, `ScoreBin`, `CohortRow`, `AnalyticsResponse` interfaces; `getAnalytics()` call
- `frontend/src/modules/admin/pages/AnalyticsPage.tsx` → date range picker (7d/30d/90d/custom), summary pills (users/jobs/applications/hires), SVG bar charts (user growth, job volume, match score distribution), horizontal funnel bars (application pipeline), cohort retention table with apply-rate + hire-rate columns, per-chart CSV export + full export
- `AdminLayout.tsx` → "Analytics" nav item (Operations group, finance_manager visible)
- `App.tsx` → lazy import + `/admin/analytics` route

### 3.3 Integrations Hub ✅ (2026-07-08)
**Route:** `/admin/integrations`

**Backend added (`platform_router.py`):**
- `GET /admin/platform/integrations` (`require_super_admin`) — live health checks for all 10 integrations. TCP ping (2 s timeout) for Brevo SMTP and ClamAV; real `Redis.ping()` for Redis; key-presence checks for Anthropic, Groq, MSG91, Google OAuth, Google Calendar, reCAPTCHA, Sentry; PostgreSQL reported as connected (request reached the endpoint). Returns `status: connected | not_configured | error`, `detail` string, and `latency_ms` where applicable. Credentials stripped from URLs in detail output. Auto-refreshes every 60 s.

**Frontend added:**
- `frontend/src/api/admin.ts` → `IntegrationEntry`, `IntegrationsResponse` interfaces + `getIntegrations()` call
- `frontend/src/modules/admin/pages/IntegrationsPage.tsx` → summary bar (connected / errors / not-configured counts), integrations grouped by category (Infrastructure → AI → Messaging → Auth → Security → Monitoring), per-card status badge + detail + latency pill, manual Refresh button
- `AdminLayout.tsx` → "Integrations" nav item (Platform group, Plug icon, `super_admin` only)
- `App.tsx` → lazy import + `/admin/integrations` route

### 3.4 GDPR & Data Tooling — ❌ Not applicable
India-only platform — GDPR does not apply. Dropped from roadmap.

### 3.5 System Monitoring Panel ✅ (2026-07-08)
**Route:** `/admin/system`

**Backend added (`platform_router.py`):**
- `GET /admin/platform/system` (`require_super_admin`) — live stats from four sources:
  - **DB pool**: `engine.pool` introspection — size, checked_in, checked_out, overflow, max_size; warns at ≥80% utilisation
  - **Celery queues**: Redis `LLEN` on `celery`, `high_priority`, `low_priority`, `embeddings`; lists all beat schedule task names
  - **Redis**: `redis.info()` — version, used_memory_mb, connected_clients, uptime_days
  - **Process**: uptime (module-level `_PROCESS_START`), RSS memory (psutil → /proc/self/status fallback), git SHA (subprocess), environment, debug flag; Sentry configured status

**Frontend added:**
- `frontend/src/api/admin.ts` → `DbPoolStats`, `QueueDepth`, `RedisInfo`, `ProcessInfo`, `SystemStatusResponse` interfaces + `getSystemStatus()` call
- `frontend/src/modules/admin/pages/SystemMonitoringPage.tsx` → 4 cards (DB Pool with utilisation bar, Celery with per-queue depth badges + beat schedule list, Redis info, API Process + Sentry), warn borders at thresholds (pool ≥80%, queue >50), manual Refresh + auto-refresh every 30 s
- `AdminLayout.tsx` → "System" nav item (MonitorDot icon, Platform group, `super_admin` only)
- `App.tsx` → lazy import + `/admin/system` route

### 3.6 Custom Role Builder ✅ (2026-07-08)
`RolesPage.tsx`:
- "Create role" button → name, description, permission checkboxes grouped by resource
- Clone an existing role as starting point
- Backend: `POST /admin/roles` with `require_super_admin`
- **Privilege escalation guard implemented** in `service.py:create_role` — actor's own permission IDs are fetched and any requested ID not in that set raises `ForbiddenException`

### 3.7 Notification Management Panel ✅ (2026-07-08)
**Route:** `/admin/notifications`
- `AdminAnnouncement` DB model in `mvp3.py` + migration `j0k1l2m3n4o5_admin_announcements.py`
- Backend: full CRUD (`GET/POST /admin/announcements`, `PATCH/{id}`, `POST/{id}/publish`, `DELETE/{id}`)
- Frontend: `NotificationsPage.tsx` — create/edit/delete announcements, type/target/channel selectors, scheduled_at, publish button, delivery stats (`sent_count`)
- **Nav:** Operations group, Bell icon, `roles: ['admin', 'super_admin']`

---

## Backend — Permission Standardization ✅ (2026-07-10)

All admin endpoints now use fine-grained `require_permission(resource, action)` instead of coarse role checks.

| Endpoint | Guard |
|----------|-------|
| `POST /admin/employers/{id}/revoke` | `require_permission("companies", "verify")` |
| `GET /admin/career-tracks` | `require_permission("career_tracks", "view")` |
| `POST /admin/career-tracks` | `require_permission("career_tracks", "write")` |
| `PUT /admin/career-tracks/{id}` | `require_permission("career_tracks", "write")` |
| `DELETE /admin/career-tracks/{id}` | `require_permission("career_tracks", "delete")` |
| `GET /admin/audit-logs` | `require_permission("audit_logs", "view")` *(was already done)* |
| `GET /analytics/admin/*` (5 endpoints) | `require_permission("analytics", "view")` |

`career_tracks` permissions (`view`, `write`, `delete`) seeded to `super_admin`, `admin`, and `view`-only to `moderator` via direct SQL insert (alembic not used).

---

## Build Health

| Check | Status |
|-------|--------|
| `tsc --noEmit` | ✅ Zero errors (verified 2026-07-08) |
| `npm run build` (dist) | ✅ Passes (1 pre-existing TS5101 deprecation warning for `baseUrl` in `tsconfig.app.json` — unrelated) |
| Backend `platform_router.py` | ✅ All endpoints use `require_super_admin` |
| Backend `router.py` — employer detail | ✅ `GET /admin/employers/{employer_id}` added |
