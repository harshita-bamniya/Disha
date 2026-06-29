# Module 05 — Enterprise Admin Panel & Employer Portal (ATS/SaaS)

Design doc for transforming the Admin Panel and Employer Portal into a
production-grade ATS/SaaS platform. **Job Seeker side is out of scope and
untouched.**

Grounded against current code: `backend/app/models/user.py`,
`backend/app/models/mvp3.py`, `frontend/src/modules/admin`,
`frontend/src/modules/employer`. Existing assets reused, not replaced:
`Role`/`Permission`/`RolePermission`, `EmployerProfile` approval workflow,
`JobPosting`, `Application` + `ApplicationStatusHistory`, `AuditLog`,
`PlatformSetting`, `FeatureFlag`.

Delivered as 6 phases, each independently shippable:

| Phase | Scope |
|---|---|
| 1 | RBAC expansion — sub-admin roles, permission matrix, recruiter roles |
| 2 | Employer KYC verification workflow |
| 3 | ATS Kanban candidate pipeline |
| 4 | Company profile + recruiter team management |
| 5 | Audit log UI + Analytics dashboards (admin + employer) |
| 6 | Subscription management |

---

## 1. Database Schema Changes

### 1.1 New tables — Phase 1 (RBAC)

```python
# Seed data only, no new table — Role/Permission/RolePermission already support this.
# Seed roles (is_system=True, cannot be deleted):
#   super_admin, admin, moderator, verification_officer, finance_manager,
#   support_executive, employer_owner, hr_manager, recruiter, interviewer, aspirant
```

```python
class LoginHistory(Base):
    __tablename__ = "login_history"
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ip_address = Column(INET, nullable=True)
    user_agent = Column(Text, nullable=True)
    device_label = Column(String(150), nullable=True)   # parsed from UA: "Chrome on Windows"
    success = Column(Boolean, nullable=False, default=True)
    failure_reason = Column(String(100), nullable=True)  # "bad_password" | "account_locked" | ...
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class DeviceSession(Base):
    """One row per active refresh-token-backed session, surfaced as 'Device Sessions'."""
    __tablename__ = "device_sessions"
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token_id = Column(UUID, ForeignKey("refresh_tokens.id", ondelete="CASCADE"), nullable=False, unique=True)
    device_label = Column(String(150), nullable=True)
    ip_address = Column(INET, nullable=True)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)   # force-logout sets this
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TwoFactorCredential(Base):
    __tablename__ = "two_factor_credentials"
    user_id = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    secret_encrypted = Column(Text, nullable=False)     # TOTP secret, encrypted at rest
    is_enabled = Column(Boolean, nullable=False, default=False)
    backup_codes_hash = Column(JSONB, nullable=True)    # list[str] hashed
    enabled_at = Column(DateTime(timezone=True), nullable=True)
```

`User.is_active` is reused for activate/suspend. Add:
```python
# users table additions
status = Column(String(20), nullable=False, default="active")  # active|suspended|banned
status_reason = Column(Text, nullable=True)
status_changed_by = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
status_changed_at = Column(DateTime(timezone=True), nullable=True)
failed_login_attempts = Column(Integer, nullable=False, default=0)
```
(`is_active` becomes a derived/computed convenience: `status == "active"`.)

### 1.2 New tables — Phase 2 (Employer KYC)

```python
class EmployerVerification(Base):
    __tablename__ = "employer_verifications"
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    employer_id = Column(UUID, ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    # pending -> under_review -> approved | rejected -> (resubmitted -> pending)
    reviewer_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        CheckConstraint("status IN ('pending','under_review','approved','rejected','resubmitted')",
                         name="ck_emp_verif_status"),
    )


class EmployerVerificationDocument(Base):
    __tablename__ = "employer_verification_documents"
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    verification_id = Column(UUID, ForeignKey("employer_verifications.id", ondelete="CASCADE"), nullable=False, index=True)
    doc_type = Column(String(40), nullable=False)  # gst_certificate|pan_card|company_registration|business_email
    file_url = Column(Text, nullable=False)        # object storage key
    status = Column(String(20), nullable=False, default="pending")  # pending|verified|rejected
    notes = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())


class EmployerVerificationEvent(Base):
    """Timeline entries shown on the verification detail page."""
    __tablename__ = "employer_verification_events"
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    verification_id = Column(UUID, ForeignKey("employer_verifications.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    from_status = Column(String(20), nullable=True)
    to_status = Column(String(20), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

Business email verification reuses `OtpVerification` (purpose="verify", target=business email).

### 1.3 New tables — Phase 3 (ATS)

`Application.status` CHECK constraint currently only allows
`applied|under_review|shortlisted|rejected|hired|withdrawn` — extend it to the
full pipeline (migration alters the constraint, no data loss since it's a superset):

```
applied, screening, shortlisted, interview_scheduled, interview_completed,
offer_sent, hired, rejected, withdrawn
```

```python
class CandidateNote(Base):
    __tablename__ = "candidate_notes"
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note = Column(Text, nullable=False)
    is_internal = Column(Boolean, nullable=False, default=True)  # recruiter-only vs visible to team
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CandidateRating(Base):
    __tablename__ = "candidate_ratings"
    application_id = Column(UUID, ForeignKey("applications.id", ondelete="CASCADE"), primary_key=True)
    rater_id = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    rating = Column(Integer, nullable=False)  # 1-5
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (CheckConstraint("rating BETWEEN 1 AND 5", name="ck_rating_range"),)


class InterviewFeedback(Base):
    __tablename__ = "interview_feedback"
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    interviewer_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    recommendation = Column(String(20), nullable=True)  # strong_yes|yes|no|strong_no
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

`ApplicationStatusHistory` (already exists) is the activity-timeline backbone —
reused as-is for the Kanban drag/drop audit trail.

### 1.4 New tables — Phase 4 (Company + Team)

`EmployerProfile` is currently 1 user = 1 company. Introduce a `Company`
table and turn `EmployerProfile` into a membership row (`CompanyMember`),
keeping `EmployerProfile` as the FK target for `JobPosting` to avoid touching
existing job/application code — `EmployerProfile.company_id` is the new
link, `EmployerProfile` rows become per-recruiter rather than per-company.

```python
class Company(Base):
    __tablename__ = "companies"
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    industry = Column(String(100), nullable=False)
    company_size = Column(COMPANY_SIZE_ENUM, nullable=False)
    website = Column(String(500), nullable=True)
    logo_url = Column(Text, nullable=True)
    cover_banner_url = Column(Text, nullable=True)
    headquarters = Column(String(200), nullable=True)
    founded_year = Column(Integer, nullable=True)
    social_links = Column(JSONB, nullable=True)   # {"linkedin": "...", "twitter": "..."}
    description = Column(Text, nullable=True)
    verification_status = Column(String(20), nullable=False, default="unverified", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CompanyInvite(Base):
    __tablename__ = "company_invites"
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    role_id = Column(UUID, ForeignKey("roles.id"), nullable=False)   # hr_manager|recruiter|interviewer
    invited_by = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    token_hash = Column(Text, nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

`EmployerProfile` additions:
```python
company_id = Column(UUID, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
is_owner = Column(Boolean, nullable=False, default=False)  # one owner per company
```
Migration: backfill — for every existing `EmployerProfile`, create a `Company`
row from its `company_name/industry/company_size/website/city/description`,
set `company_id`, `is_owner=True`. Old columns kept on `EmployerProfile` for
backward read compatibility, marked deprecated in the docstring.

### 1.5 New tables — Phase 5 (Audit/Analytics)

`AuditLog` already has everything needed (`action`, `resource`,
`resource_id`, `ip_address`, `user_agent`, `log_metadata`). Add:
```python
# audit_logs additions
previous_value = Column(JSONB, nullable=True)
new_value = Column(JSONB, nullable=True)
```
`UserEvent` (mvp3.py) already covers behavioral analytics — reused for
funnel/trend charts, no new table needed.

### 1.6 New tables — Phase 6 (Subscriptions)

```python
class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)  # free|standard|premium|enterprise
    price_monthly = Column(Integer, nullable=False, default=0)  # in paise/cents
    max_active_jobs = Column(Integer, nullable=True)        # null = unlimited
    max_recruiter_seats = Column(Integer, nullable=True)
    resume_access = Column(Boolean, nullable=False, default=False)
    candidate_search_limit = Column(Integer, nullable=True)  # per month, null = unlimited
    features = Column(JSONB, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)


class CompanySubscription(Base):
    __tablename__ = "company_subscriptions"
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(UUID, ForeignKey("subscription_plans.id"), nullable=False)
    status = Column(String(20), nullable=False, default="active")  # active|past_due|canceled
    current_period_start = Column(DateTime(timezone=True), nullable=False)
    current_period_end = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SubscriptionUsage(Base):
    """Rolling counters checked against plan limits."""
    __tablename__ = "subscription_usage"
    company_id = Column(UUID, ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True)
    period_start = Column(DateTime(timezone=True), primary_key=True)
    active_jobs_count = Column(Integer, nullable=False, default=0)
    recruiter_seats_used = Column(Integer, nullable=False, default=0)
    candidate_searches_used = Column(Integer, nullable=False, default=0)
```

---

## 2. RBAC Architecture & Permission Matrix

### Roles (seeded into `roles`, `is_system=True`)

**Platform side:** `super_admin`, `admin`, `moderator`, `verification_officer`,
`finance_manager`, `support_executive`

**Company side:** `employer_owner` (renamed conceptually from today's single
"employer"), `hr_manager`, `recruiter`, `interviewer`

### Permission model

`Permission.resource` + `Permission.action` already supports this exactly.
Seed permissions as `(resource, action)` pairs:

| Resource | Actions |
|---|---|
| users | view, create, edit, delete, suspend, export |
| employers | view, approve, reject, suspend, delete |
| jobs | view, approve, delete, feature |
| analytics | view, export |
| finance | view_revenue, manage_refunds, generate_reports |
| companies | view, edit, verify |
| candidates | view, shortlist, reject, message |
| team | invite, remove, transfer_ownership |
| audit_logs | view |
| subscriptions | view, manage |

### Permission matrix (platform roles)

| Permission | super_admin | admin | moderator | verification_officer | finance_manager | support_executive |
|---|---|---|---|---|---|---|
| users.view/export | ✓ | ✓ | ✓ | – | – | ✓ |
| users.suspend/delete | ✓ | ✓ | ✓ (suspend only) | – | – | – |
| employers.approve/reject | ✓ | ✓ | – | ✓ | – | – |
| employers.suspend/delete | ✓ | ✓ | – | – | – | – |
| jobs.approve/delete/feature | ✓ | ✓ | ✓ | – | – | – |
| analytics.view/export | ✓ | ✓ | – | – | ✓ (revenue only) | – |
| finance.* | ✓ | – | – | – | ✓ | – |
| audit_logs.view | ✓ | ✓ | – | – | – | – |
| subscriptions.manage | ✓ | – | – | – | ✓ | – |
| sub-admin creation | ✓ | – | – | – | – | – |

### Permission matrix (company roles)

| Permission | owner | hr_manager | recruiter | interviewer |
|---|---|---|---|---|
| jobs.create/edit/publish | ✓ | ✓ | ✓ (own) | – |
| candidates.view/shortlist/reject | ✓ | ✓ | ✓ | view only |
| candidates.message | ✓ | ✓ | ✓ | – |
| team.invite/remove | ✓ | ✓ | – | – |
| team.transfer_ownership | ✓ | – | – | – |
| company_profile.edit | ✓ | ✓ | – | – |
| subscription.manage | ✓ | – | – | – |
| interview_feedback.submit | ✓ | ✓ | ✓ | ✓ |

UI visibility and API restrictions both derive from the same `RolePermission`
join — `require_permission("jobs", "approve")` FastAPI dependency,
mirrored in frontend by a `usePermission("jobs:approve")` hook gating
buttons/routes. No separate UI-only rule set — single source of truth.

---

## 3. API Endpoints (new/changed)

All under existing `app/modules/admin` and a new `app/modules/employer`
(promoted from the implicit usage today) plus a new `app/modules/companies`,
`app/modules/ats`, `app/modules/billing`.

```
# Phase 1 — RBAC / Admin user mgmt
GET    /admin/users                      ?status=&q=&page=
GET    /admin/users/{id}
PATCH  /admin/users/{id}/status          {status, reason}
GET    /admin/users/{id}/login-history
GET    /admin/users/{id}/sessions
POST   /admin/users/{id}/sessions/{session_id}/revoke
GET    /admin/sub-admins
POST   /admin/sub-admins                {email, role_id}
PATCH  /admin/sub-admins/{id}/role
DELETE /admin/sub-admins/{id}
GET    /admin/roles                      # roles + permission matrix
PATCH  /admin/roles/{id}/permissions
POST   /auth/2fa/enroll
POST   /auth/2fa/verify
POST   /auth/2fa/disable

# Phase 2 — Employer verification
GET    /admin/employer-verifications     ?status=
GET    /admin/employer-verifications/{id}
POST   /admin/employer-verifications/{id}/review   {action: approve|reject|under_review, notes}
POST   /employer/verification/documents  (multipart upload)
POST   /employer/verification/submit
POST   /employer/verification/resubmit

# Phase 3 — ATS
GET    /employer/jobs/{job_id}/pipeline           # grouped by stage for Kanban
PATCH  /employer/applications/{id}/stage          {to_status, note}
POST   /employer/applications/{id}/notes
POST   /employer/applications/{id}/rating
POST   /employer/applications/{id}/interview-feedback
GET    /employer/applications/{id}/timeline
POST   /employer/applications/bulk-action         {ids, action}
GET    /employer/candidates/{aspirant_id}          # resume, skills, etc.

# Phase 4 — Company/team
GET    /employer/company
PATCH  /employer/company
GET    /employer/company/team
POST   /employer/company/team/invite              {email, role_id}
DELETE /employer/company/team/{member_id}
POST   /employer/company/team/transfer-ownership   {new_owner_id}
POST   /employer/company/verification              (alias into Phase 2 flow scoped to company)

# Phase 5 — Audit/analytics
GET    /admin/audit-logs                 ?user_id=&action=&from=&to=&page=
GET    /admin/analytics/overview         # totals: users, employers, jobs, revenue, pending verifications
GET    /admin/analytics/trends           ?metric=users|employers|jobs|revenue&granularity=day|week|month
GET    /employer/analytics/jobs/{job_id} # views, applications, conversion
GET    /employer/analytics/funnel
GET    /employer/analytics/recruiter-performance

# Phase 6 — Subscriptions
GET    /admin/subscription-plans
POST   /admin/subscription-plans
GET    /employer/subscription
GET    /employer/subscription/usage
POST   /employer/subscription/upgrade    {plan_id}
```

---

## 4. Employer Verification Workflow

```
[Employer submits docs] --> pending
pending --> under_review        (verification_officer/admin opens for review)
under_review --> approved       (Company.verification_status = "verified",
                                  EmployerVerificationEvent logged,
                                  AuditLog: "employer.verification.approved")
under_review --> rejected       (rejection_reason required,
                                  AuditLog: "employer.verification.rejected")
rejected --> pending (resubmit)  (new EmployerVerificationDocument rows,
                                  status -> "resubmitted" -> "pending")
```

Each transition writes one `EmployerVerificationEvent` row (timeline) +
one `AuditLog` row (cross-cutting audit). Frontend verification detail page
renders the timeline directly from `EmployerVerificationEvent`.

---

## 5. ATS Kanban — Stage Machine

```
applied -> screening -> shortlisted -> interview_scheduled
        -> interview_completed -> offer_sent -> hired
   (any stage) -> rejected
   (applied|screening) -> withdrawn   [aspirant-initiated, read-only to employer]
```

Drag-and-drop on the frontend calls `PATCH /employer/applications/{id}/stage`;
backend writes `ApplicationStatusHistory` row, updates `Application.status`,
and fires `AuditLog` with `previous_value`/`new_value` = `{status: ...}`.
Bulk actions (`bulk-action`) iterate the same single-application path inside
one DB transaction.

---

## 6. Frontend Page Structure & Component Hierarchy

```
frontend/src/modules/admin/
  pages/
    AdminDashboardPage.tsx          # split out of current 77KB monolith
    AdminProfilePage.tsx
    UserManagementPage.tsx
    UserDetailPage.tsx
    EmployerManagementPage.tsx
    EmployerVerificationQueuePage.tsx
    EmployerVerificationDetailPage.tsx
    SubAdminManagementPage.tsx
    RolePermissionMatrixPage.tsx
    AuditLogPage.tsx
    AdminAnalyticsPage.tsx
    SubscriptionPlansAdminPage.tsx
  components/
    dashboard/{KpiCard,GrowthChart,TrendChart}.tsx
    users/{UserTable,UserFilters,StatusBadge,SessionList,LoginHistoryTable}.tsx
    employers/{EmployerTable,EmployerCard,VerificationTimeline,DocumentViewer}.tsx
    rbac/{RoleList,PermissionMatrixGrid,SubAdminForm}.tsx
    audit/{AuditLogTable,AuditLogFilters,DiffViewer}.tsx
    profile/{SecuritySection,ActivitySection,TwoFactorSetup,DeviceSessionList}.tsx

frontend/src/modules/employer/
  pages/
    EmployerDashboardPage.tsx        # KPI cards + charts
    CompanyProfilePage.tsx
    TeamManagementPage.tsx
    JobManagementPage.tsx            # list + create/draft/publish/pause/close
    JobDetailPage.tsx                # views/applications/conversion
    CandidatePipelinePage.tsx        # Kanban — extend existing page
    CandidateProfileDrawer.tsx
    VerificationStatusPage.tsx       # submit docs, view timeline
    EmployerAnalyticsPage.tsx
    SubscriptionPage.tsx
  components/
    dashboard/{KpiCard,FunnelChart}.tsx
    pipeline/{KanbanBoard,KanbanColumn,CandidateCard,BulkActionBar,NoteThread,RatingStars}.tsx
    team/{MemberTable,InviteModal,RoleSelect}.tsx
    company/{LogoUploader,CoverBanner,SocialLinksEditor,VerificationBadge}.tsx
    messaging/{TemplateLibrary,ComposeMessageModal}.tsx
```

Routing additions in `App.tsx`: `requirePermission("...")` wraps each admin
sub-route individually (not just one blanket `AdminRoute`), and a new
`CompanyRoute` wraps employer routes checking `CompanyMember` role instead of
the current single `employer_profile.is_approved` check.

---

## 7. Recommended UI/UX Direction

- Admin: dense data-table-first layouts (Retool/Workday style) — KPI strip at
  top, filterable tables below, drawer-based detail views instead of full
  page nav for quick triage (matches verification queue, user mgmt).
- Employer: Greenhouse-style Kanban as the centerpiece of the dashboard,
  not buried in a sub-page — recruiters live in the pipeline view daily.
- Verification badge (✓ Verified) surfaced on company profile and on every
  job posting card so aspirants see it too (read-only addition to existing
  job seeker UI, not a redesign).
- Use the same chart primitives across admin analytics and employer
  analytics (one `<TrendChart>` component, different data sources) to avoid
  duplicated charting code.

---

## Migration Sequencing

1. Phase 1 ships first — pure additive tables + seed data, zero impact on
   existing aspirant/job seeker flows or current employer login.
2. Phase 4's `Company` backfill is the only migration touching existing
   `EmployerProfile` rows — written as additive columns + backfill script,
   old columns kept for one release cycle before deprecation.
3. Each phase's migration is a separate Alembic revision; can ship and be
   reviewed independently of the others.
