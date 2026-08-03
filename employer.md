Enterprise ATS Architecture Document
Disha Recruitment Platform — Employer Side Redesign
Part 1 — Analysis of Current Implementation
What We Have Today
The platform has a strong foundation. The database schema is well-normalized, the RBAC system is database-backed (not hardcoded), department scoping exists on EmployerProfile.department_id, and the ATS pipeline (notes, ratings, interviews, offer letters, email logs) is fully modeled.

What works well:

Role → RolePermission → Permission(resource, action) RBAC is enterprise-grade
Department scoping via EmployerProfile.department_id (NULL = company-wide, non-null = dept-only) is architecturally correct
Application status history with actor attribution is production-ready
Vector-based job matching with pgvector is sophisticated
Audit logs with JSON diffs exist
What is broken architecturally:

Problem	Where
EmployerDashboardPage lists every job in the company	employer/pages/EmployerDashboardPage
No dedicated Jobs module page — job management is inside the dashboard	Frontend routing
No dedicated Applicants module — applicants live inside Pipeline which is per-job	Frontend routing
DepartmentsPage exists but has no department workspace — clicking a department has no isolated view	employer/pages/DepartmentsPage
DepartmentDetailPage exists as a new file but not yet integrated	employer/pages/DepartmentDetailPage
Employer sidebar navigation has 12+ items at the same level with no grouping	LayoutEmployer
No "Employer Owner" vs "Recruiter" navigation distinction — both see same sidebar	LayoutEmployer
Company team management (CompanyTeamPage) is buried under company settings, not its own module	Frontend routing
Analytics, Calendar, Talent Pool are top-level items but are not contextually grouped	Sidebar
The employer can navigate to all departments even if they are a dept-scoped recruiter	No frontend route guard
Job creation is not associated with a department at the UI level	JobForm
No clear hiring workflow — no concept of job lifecycle stages in the UI	Missing
No recruiter onboarding flow after accepting an invite	Missing
No pending approvals or notification center on employer dashboard	EmployerDashboardPage
Part 2 — How Enterprise ATS Platforms Solve These Problems
Greenhouse
Company hierarchy: Account → Departments → Jobs → Applications → Candidates
Scorecards: Every interviewer submits a structured scorecard per candidate per job
Job ownership: Every job has one primary recruiter + one hiring manager
Dashboard: Shows pending scorecards, upcoming interviews, jobs needing attention — NOT a list of all jobs
Department workspace: Each department has its own filtered job board and candidate pool
Permissions: Granular — can see salary, can approve offers, can manage job posts, can only view
Lever
Pipeline stages are per-job and customizable: Applied → Recruiter Screen → Hiring Manager Review → Technical Interview → Offer
Opportunities (candidates) are first-class: A candidate is not tied to one application — they can be in multiple pipelines
Inbox model: Recruiters have a personal inbox of tasks — "Review feedback", "Schedule interview", "Send offer"
Archive reasons: Every rejection has a reason code for reporting
Ashby (modern benchmark)
Headcount planning: Jobs are linked to headcount plans approved by finance
Structured hiring: Every job has defined interview stages with scorecard templates before posting
Analytics-first: Time-to-hire, source effectiveness, offer acceptance rate on every dashboard
Role-based navigation: What you see in the sidebar depends on your role — recruiters see their pipeline, hiring managers see approvals
Workday
Org hierarchy: Company → Business Unit → Department → Team → Position
Position-based hiring: You hire for a "Position" that exists in the org chart, not an ad-hoc job
Approval chains: Job posts, offers, and headcount all require multi-level approval
LinkedIn Talent Hub
Source tracking: Where did each candidate come from (LinkedIn, referral, direct, job board)
Collaborative hiring: Multiple team members can view and comment on a candidate without owning the pipeline
InMail integration: Outreach is tracked inside the platform
SmartRecruiters
Marketplace model: External job boards, assessments, background checks integrated as plugins
Hiring team: Every job has a hiring team (recruiter, coordinator, hiring manager, interviewer pool)
Offer approvals: Offer letters go through an approval chain before being sent
Key enterprise patterns we must adopt:
Sidebar navigation is role-aware — a recruiter sees a different sidebar than an employer owner
Dashboard = intelligence layer, not a list — KPIs, pending tasks, notifications
Jobs is a first-class module with its own page, filters, lifecycle, and bulk actions
Applicants is a first-class module separate from the per-job pipeline view
Departments have workspaces — entering a department filters everything
Every job has a hiring team — not just an employer_id
Pipeline stages are configurable per job or per department
Recruiters have a personal task inbox — not just company-level notifications
Navigation groups — Jobs, People, Reports, Settings as top-level categories
Part 3 — Proposed Architecture
3.1 — Core Entity Hierarchy
Company
├── Departments (Engineering, HR, Marketing, Finance, Sales)
│   ├── Department Head (EmployerProfile with dept role)
│   ├── Team Members (Recruiters, Hiring Managers, Interviewers)
│   ├── Jobs (scoped to department)
│   │   ├── Hiring Team (owner, recruiter, coordinator)
│   │   ├── Pipeline Stages (customizable per job)
│   │   └── Applications
│   │       ├── Candidate Notes (threaded)
│   │       ├── Candidate Ratings (per reviewer)
│   │       ├── Interview Feedback (scorecards)
│   │       └── Offer Letter (with approval chain)
│   └── Department Analytics
└── Company-Level (owner + HR admin view)
    ├── All Department Summaries
    ├── Company-Wide Analytics
    ├── Team Management
    └── Billing / Subscription
3.2 — Role Definitions
Role	Scope	Description
employer_owner	Company-wide	Created company. Full access. Cannot be removed by anyone except themselves.
hr_admin	Company-wide	No billing access. Can manage all departments, all jobs, all recruiters. Can invite users.
department_head	Department	Manages one department. Can create jobs within it, invite recruiters to it, see all candidates for it.
recruiter	Department	Posts jobs, manages candidates in their department. Cannot manage team.
hiring_manager	Job-level	Reviews candidates, approves shortlists, gives feedback. Cannot post jobs.
interviewer	Job-level	Sees interview schedule, submits scorecards. No access to pipeline status or salary.
coordinator	Job-level	Schedules interviews, sends logistics. Read-only on candidate details.
Note: hiring_manager, interviewer, and coordinator are job-level roles assigned per-job via a JobHiringTeam join table. They are not company-level roles.

3.3 — Permission Matrix
Action	employer_owner	hr_admin	department_head	recruiter	hiring_manager	interviewer	coordinator
Create Department	✅	✅	❌	❌	❌	❌	❌
Edit Department	✅	✅	Own dept	❌	❌	❌	❌
Disable Department	✅	❌	❌	❌	❌	❌	❌
Invite Users	✅	✅	Own dept	❌	❌	❌	❌
Remove Users	✅	✅	Own dept	❌	❌	❌	❌
Create Jobs	✅	✅	Own dept	Own dept	❌	❌	❌
Edit Jobs	✅	✅	Own dept	Own dept	❌	❌	❌
Publish Jobs	✅	✅	Own dept	Own dept	❌	❌	❌
Close / Archive Jobs	✅	✅	Own dept	Own dept	❌	❌	❌
Delete Jobs	✅	✅	Own dept	❌	❌	❌	❌
View All Applicants	✅	✅	Own dept	Own dept	Assigned job	❌	Assigned job
Move Pipeline Stage	✅	✅	Own dept	Own dept	❌	❌	❌
Rate Candidates	✅	✅	Own dept	Own dept	Assigned job	Assigned job	❌
Schedule Interviews	✅	✅	Own dept	Own dept	❌	❌	Assigned job
Submit Scorecard	✅	✅	Own dept	Own dept	Assigned job	Assigned job	❌
Send Offer	✅	✅	Own dept	❌	❌	❌	❌
Hire Candidate	✅	✅	Own dept	❌	❌	❌	❌
View Salary	✅	✅	Own dept	Own dept	❌	❌	❌
Manage Billing	✅	❌	❌	❌	❌	❌	❌
View Company Analytics	✅	✅	Own dept	Own dept	❌	❌	❌
Edit Company Profile	✅	✅	❌	❌	❌	❌	❌
Transfer Ownership	✅	❌	❌	❌	❌	❌	❌
Part 4 — Navigation Hierarchy
4.1 — Employer Owner / HR Admin Navigation
Company: ABC Technologies
─────────────────────────────
📊 Dashboard
─────────────────────────────
HIRING
  💼 Jobs
  👥 Applicants
  📅 Interviews
  📦 Offers
─────────────────────────────
ORGANIZATION
  🏢 Departments
  👤 Team
  🎯 Talent Pool
─────────────────────────────
INSIGHTS
  📈 Reports & Analytics
  📆 Calendar
─────────────────────────────
COMPANY
  ⚙️  Company Settings
  💳 Billing
─────────────────────────────
4.2 — Department Head Navigation
Department: Engineering
─────────────────────────────
📊 Dashboard
─────────────────────────────
HIRING
  💼 Jobs
  👥 Applicants
  📅 Interviews
  📦 Offers
─────────────────────────────
TEAM
  👤 My Team
  🎯 Talent Pool
─────────────────────────────
INSIGHTS
  📈 Analytics
  📆 Calendar
─────────────────────────────
Note: Department Head sees only their department's data. No "Company Settings", no "Billing", no other departments.

4.3 — Recruiter Navigation
Department: Engineering
─────────────────────────────
📊 My Dashboard
─────────────────────────────
HIRING
  💼 My Jobs
  👥 My Applicants
  📅 Interviews
─────────────────────────────
TOOLS
  🎯 Talent Pool
  📆 Calendar
─────────────────────────────
4.4 — Hiring Manager Navigation
─────────────────────────────
📋 My Approvals
👥 My Candidates
📅 My Interviews
─────────────────────────────
Hiring Managers have a minimal view — only jobs they are assigned to, candidates in those jobs, and their interview schedule.

4.5 — Interviewer Navigation
─────────────────────────────
📅 My Schedule
📝 Scorecards
─────────────────────────────
4.6 — Department Workspace Internal Navigation
When navigating into a department (from the Departments module), the internal view has:

Engineering Department
─────────────────────────────
📊 Overview
💼 Jobs (12 active)
👥 Applicants (348)
📅 Interviews (8 this week)
📦 Offers (3 pending)
📈 Analytics
👤 Team (11 members)
─────────────────────────────
Part 5 — End-to-End Workflows
5.1 — Employer Owner Workflow (Initial Setup)
1. Register Company
   ↓
2. Verify Email + OTP
   ↓
3. Company Setup Wizard
   • Company name, industry, size
   • Logo, banner
   • Website, social links
   • Contact details
   ↓
4. KYC Verification (optional, required for paid features)
   ↓
5. Create Departments
   • Engineering, HR, Marketing, Finance…
   • Unique name per company (enforced at DB level)
   ↓
6. Invite Department Heads / HR Admins
   • Email invite with role assignment
   • Invite links expire in 7 days
   ↓
7. Department Heads invite their Recruiters
   ↓
8. Recruiters create Jobs within their Department
   ↓
9. Owner monitors via Company Dashboard (KPIs, summaries)
5.2 — Recruiter Workflow (Post-Invite)
1. Receive invite email
   ↓
2. Click invite link → Set password
   ↓
3. Land on Department Dashboard (pre-scoped to their department)
   ↓
4. Create a Job
   • Select department (pre-filled, locked to their dept)
   • Fill job details, required skills
   • AI assists with description + skill extraction
   • Save as Draft
   ↓
5. Add Hiring Team to Job
   • Assign Hiring Manager
   • Assign Interviewers
   • Assign Coordinator (optional)
   ↓
6. Publish Job
   → Appears in aspirant job listing
   ↓
7. Applicants start arriving → Pipeline view activates
   ↓
8. Review applicants
   • Match score (K/R/S)
   • Screen → Shortlist → Schedule Interview → Offer → Hire
   ↓
9. Schedule interview
   • Assign interviewer(s)
   • Set meeting link / calendar slot
   • Candidate receives notification
   ↓
10. Interviewer submits scorecard
    → Recruiter sees recommendation
    ↓
11. Recruiter sends Offer Letter
    → Needs dept_head / hr_admin approval if configured
    ↓
12. Candidate accepts/declines
    → Job status updated
5.3 — Department Head Workflow
1. Receive invite as department_head
   ↓
2. Set up department profile (optional description, headcount target)
   ↓
3. Invite recruiters to the department
   ↓
4. Review department dashboard
   • Active jobs, open positions
   • Candidates in pipeline
   • Interview schedule
   • Offer status
   ↓
5. Approve offers before they are sent (if approval chain is on)
   ↓
6. View department analytics
   • Time-to-hire per role
   • Source breakdown
   • Recruiter performance
5.4 — Hiring Manager Workflow
1. Recruiter adds hiring manager to a specific job
   ↓
2. Hiring Manager receives email notification
   ↓
3. Logs in → sees "My Approvals" dashboard
   • Jobs they are assigned to
   • Candidates flagged for their review
   ↓
4. Reviews shortlisted candidates
   • Can see application, scores, recruiter notes
   • Cannot see salary range (unless permission granted)
   ↓
5. Approves or rejects shortlist
   ↓
6. Participates in structured interviews
   → Submits scorecard post-interview
   ↓
7. Makes final hire recommendation
5.5 — Candidate Workflow
1. Register as Aspirant
   ↓
2. Complete 7-step onboarding profile
   ↓
3. KRS score computed
   ↓
4. Browse jobs (AI-ranked by match score)
   ↓
5. Apply to job
   • Match score stored on Application at submission time
   • Receives confirmation notification
   ↓
6. Track application status in My Applications
   • Status updates arrive as notifications
   ↓
7. Receives interview invite
   • Sees time slot, meeting link
   • Can request reschedule
   ↓
8. Attends interview
   ↓
9. Receives offer letter (if selected)
   • Can accept or decline
   • E-signature captured
   ↓
10. Profile locked on hire (prevents re-applying to same company)
5.6 — Department Creation Flow
Employer Owner clicks "New Department"
↓
Enter Department Name
→ VALIDATION: Check uniqueness within company (DB constraint + API check)
→ If duplicate: show error "Engineering already exists"
↓
Enter optional description
↓
Select Department Head (from existing team OR invite new)
↓
Department created
↓
Department Head receives email notification
↓
Department appears in Departments module
→ Owner can view, edit, disable (soft-delete)
→ Disabling department hides it from job creation
→ Jobs in disabled dept remain but cannot receive new applications
Part 6 — Job Lifecycle
                    DRAFT
                      │
               (Fill job details)
                      │
                  PUBLISHED ──────────────────→ (Aspirants see job)
                      │                                │
               (Applications arrive)            (Apply)
                      │
                  ┌───┴──────────────────────────────────────┐
                  │            PIPELINE STAGES               │
                  │                                          │
                  │  Applied → Under Review → Screening →   │
                  │  Shortlisted → Interview Scheduled →     │
                  │  Interview Complete → Offer Sent →       │
                  │  Hired / Rejected / Withdrawn            │
                  └──────────────────────────────────────────┘
                      │
           (Position filled OR manually closed)
                      │
                   CLOSED
                      │
           (After 90 days or manual action)
                      │
                  ARCHIVED
Job Lifecycle Rules:

A job can be reopened from CLOSED back to PUBLISHED
A job cannot be deleted if it has applications (can only archive)
A draft job is invisible to aspirants
Closing a job sends rejection notifications to all non-hired candidates (configurable)
Archiving removes from active list but preserves all records
Part 7 — Applicant Lifecycle
APPLIED
  ↓ (Recruiter reviews)
UNDER_REVIEW
  ↓ (Passes screening)
SCREENING
  ↓ (Phone/video screen passed)
SHORTLISTED ──→ REJECTED (at any stage)
  ↓
INTERVIEW_SCHEDULED
  ↓ (Interview complete, scorecard submitted)
INTERVIEW_COMPLETED
  ↓ (Offer approved by dept_head/hr_admin)
OFFER_SENT
  ↓
HIRED ←→ DECLINED_OFFER (candidate declines)
Side states (can happen at any point):

WITHDRAWN — candidate withdraws their application
ON_HOLD — recruiter pauses review (coming soon / budget freeze)
Every transition creates an ApplicationStatusHistory record with: from_status, to_status, changed_by, timestamp, note.

Part 8 — Interview Lifecycle
1. Recruiter schedules interview
   → Creates CandidateInterviewFeedback record (status: scheduled)
   → Assigns interviewer(s)
   → Sets meeting_link, scheduled_at
   → Sends calendar invite to candidate + interviewer
   ↓
2. Interview occurs
   ↓
3. Interviewer submits scorecard
   → status: completed
   → recommendation: strong_yes | yes | no | strong_no
   → Structured feedback per section (if template used)
   ↓
4. Recruiter reviews all scorecards
   ↓
5. Decision made → Application moves to OFFER_SENT or REJECTED
   ↓
6. Cancellation path:
   → Either party cancels → status: canceled
   → Candidate can request reschedule → reschedule_requested_at set
   → Recruiter reschedules → new CandidateInterviewFeedback record created
Part 9 — User Invitation & Onboarding Flow
Employer Owner / HR Admin / Department Head
→ Clicks "Invite Team Member"
→ Enters: Email, Role, Department (if applicable)
→ System creates CompanyInvite record (status: pending, expires: +7 days)
→ System sends invite email with unique token link
Invitee receives email
→ Clicks link
→ If new user: Set password page (email pre-filled)
→ If existing user: Accept invite confirmation
→ EmployerProfile created: { user_id, company_id, role, department_id }
→ Redirected to their role-specific dashboard
If invite expires:
→ Re-invite button appears on Team Management page
→ New token generated, old one invalidated
If invitee already has an EmployerProfile at another company:
→ Show warning: "You already belong to [Company X]. Accepting this invite will add a new company context."
→ Multi-company profiles supported (future)
Part 10 — Database Relationship Diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPANY LAYER                                        │
│                                                                               │
│  Company (id, name, industry, size, logo, verification_status)               │
│       │                                                                       │
│       ├─── CompanyDepartment (id, company_id, name, head_employer_id,        │
│       │         description, is_active)                                       │
│       │         UNIQUE(company_id, name)                                      │
│       │                                                                       │
│       └─── CompanyOffice (id, company_id, city, state, is_hq)               │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER LAYER                                          │
│                                                                               │
│  User (id, email, phone, password_hash, role_id, is_active, status)         │
│       │                                                                       │
│       ├─── AspirantProfile (user_id, full_name, qualification, ...)          │
│       │                                                                       │
│       └─── EmployerProfile (id, user_id, company_id, department_id,         │
│                 is_owner, role [company-level role])                          │
│                                                                               │
│  Role (id, name) ──→ RolePermission ──→ Permission(resource, action)        │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                            JOBS LAYER                                         │
│                                                                               │
│  JobPosting (id, employer_id, company_id, department_id,                     │
│              title, description, status, is_active,                           │
│              salary_min, salary_max, job_type, employment_type,              │
│              expires_at, description_embedding)                               │
│       │                                                                       │
│       ├─── JobHiringTeam [NEW] (id, job_id, employer_profile_id,            │
│       │         role: recruiter|hiring_manager|interviewer|coordinator)       │
│       │                                                                       │
│       ├─── JobPipelineStage [NEW] (id, job_id, name, order, color)          │
│       │         (default stages created from company template on job create)  │
│       │                                                                       │
│       └─── Application (id, aspirant_id, job_id, match_score,               │
│                 status, cover_note, employer_note, pipeline_stage_id)        │
│                    │                                                          │
│                    ├─── ApplicationStatusHistory (from, to, by, note, at)   │
│                    ├─── CandidateNote (author_id, text, is_internal)         │
│                    ├─── CandidateRating (rater_id, score 1-5)               │
│                    ├─── CandidateInterviewFeedback (interviewer_id,          │
│                    │         scheduled_at, status, recommendation, scorecard) │
│                    ├─── OfferLetter (role_title, ctc, start_date, status)   │
│                    └─── CandidateEmailLog (sender, recipient, subject, body) │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPANY INVITE LAYER                                  │
│                                                                               │
│  CompanyInvite (id, company_id, inviter_id, email, role_id,                  │
│                 department_id, token, status, expires_at)                    │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
New tables needed:
• JobHiringTeam — maps hiring managers / interviewers to specific jobs
• JobPipelineStage — per-job customizable pipeline stages
• CompanyPipelineTemplate — default stage sets per company/department
Part 11 — Dashboard Layouts
11.1 — Employer Owner Dashboard
┌─────────────────────────────────────────────────────────────────────────────┐
│  ABC Technologies                    [🔔 3]  [❓ Help]  [Avatar ▾]          │
├──────────┬──────────────────────────────────────────────────────────────────┤
│ SIDEBAR  │  DASHBOARD                                                         │
│          │                                                                    │
│ Dashboard│  Good morning, Priya.    [+ New Job]  [Invite Team Member]        │
│ Jobs     │  ────────────────────────────────────────────────────────────     │
│ Applic.  │  COMPANY KPIs (this month)                                         │
│ Intervws │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ Offers   │  │ 48       │ │ 1,247    │ │ 12       │ │ 18 days  │             │
│          │  │ Active   │ │ Total    │ │ Offers   │ │ Avg Time │             │
│ Depts    │  │ Jobs     │ │ Applic.  │ │ Sent     │ │ to Hire  │             │
│ Team     │  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│ Talent   │                                                                    │
│ Pool     │  DEPARTMENT SUMMARIES              PENDING ACTIONS                │
│          │  ┌────────────────────────┐        ┌───────────────────────────┐  │
│ Reports  │  │ Engineering  12 jobs   │        │ ⚡ 3 offers need approval │  │
│ Calendar │  │ HR            4 jobs   │        │ 📅 8 interviews this week │  │
│          │  │ Marketing     6 jobs   │        │ 📋 5 scorecards pending   │  │
│ Settings │  │ Finance       2 jobs   │        │ 👤 2 invite requests      │  │
│ Billing  │  │ [View All Departments] │        └───────────────────────────┘  │
│          │  └────────────────────────┘                                        │
│          │                                                                    │
│          │  RECENT ACTIVITY                   HIRING FUNNEL (last 30 days)   │
│          │  • Recruiter A moved John D. to    Applied      1,247             │
│          │    Interview stage — 2h ago        Reviewed       843 ▓▓▓▓▓▓▓     │
│          │  • New application: React Dev      Shortlisted    234 ▓▓▓         │
│          │    job — 3h ago                    Interviewed    112 ▓▓           │
│          │  • Offer accepted by Meena S.      Offered         18 ▓           │
│          │    — yesterday                     Hired           14 ▓           │
│          │                                                                    │
└──────────┴────────────────────────────────────────────────────────────────────┘
11.2 — Recruiter Dashboard
┌─────────────────────────────────────────────────────────────────────────────┐
│  Engineering Dept • ABC Technologies         [🔔]  [Avatar ▾]               │
├──────────┬──────────────────────────────────────────────────────────────────┤
│ SIDEBAR  │  MY DASHBOARD                                                      │
│          │                                                                    │
│ My Dash  │  Good morning, Rohan.                        [+ New Job]          │
│ Jobs     │  ────────────────────────────────────────────────────────────     │
│ Applic.  │  MY STATS                                                          │
│ Intervws │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│          │  │ 6        │ │ 124      │ │ 3        │ │ 2        │             │
│ Talent   │  │ My Active│ │ My       │ │ This     │ │ Scorecards             │
│ Pool     │  │ Jobs     │ │ Applicants│ │ Week's   │ │ Pending  │             │
│ Calendar │  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│          │                                                                    │
│          │  MY JOBS — QUICK VIEW                TODAY'S SCHEDULE             │
│          │  ┌────────────────────────────┐      ┌──────────────────────────┐ │
│          │  │ Sr. React Dev  32 applic.  │      │ 10:00 Interview - John D │ │
│          │  │ Backend Eng    18 applic.  │      │ 14:00 Interview - Priya M│ │
│          │  │ DevOps Lead     8 applic.  │      │ 16:30 Team Sync          │ │
│          │  │ [View All My Jobs →]       │      └──────────────────────────┘ │
│          │  └────────────────────────────┘                                    │
│          │                                                                    │
│          │  NEEDS YOUR ATTENTION                                              │
│          │  • 14 new applications in Sr. React Dev (since yesterday)         │
│          │  • Scorecard due: Backend Eng — Amit K. interviewed 2 days ago   │
│          │  • Offer expires in 2 days — Meena S.                            │
│          │                                                                    │
└──────────┴────────────────────────────────────────────────────────────────────┘
11.3 — Department Workspace
┌─────────────────────────────────────────────────────────────────────────────┐
│  Engineering Dept                         [Edit Dept]  [Invite Member]       │
├──────────┬──────────────────────────────────────────────────────────────────┤
│ Overview │  ENGINEERING OVERVIEW                                              │
│ Jobs     │                                                                    │
│ Applic.  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ Intervws │  │ 12       │ │ 348      │ │ 11       │ │ 21 days  │             │
│ Offers   │  │ Active   │ │ Open     │ │ Team     │ │ Avg TTH  │             │
│ Analytics│  │ Jobs     │ │ Positions│ │ Members  │  └──────────┘             │
│ Team     │  └──────────┘ └──────────┘ └──────────┘                           │
│          │                                                                    │
│          │  ACTIVE JOBS                              TEAM                    │
│          │  Sr. React Developer    32 applic.        • Rekha S. (Head)       │
│          │  Backend Engineer       18 applic.        • Rohan M. (Recruiter)  │
│          │  DevOps Lead             8 applic.        • Ankit P. (Recruiter)  │
│          │  QA Automation Eng      12 applic.        • 8 more members...     │
│          │  [+ New Job in Dept]                      [Manage Team →]         │
│          │                                                                    │
│          │  PIPELINE STATUS                                                   │
│          │  Applied  348  ▓▓▓▓▓▓▓▓▓                                          │
│          │  Review   212  ▓▓▓▓▓                                               │
│          │  Screen    87  ▓▓                                                  │
│          │  Short.    43  ▓                                                   │
│          │  Offer      6  ▏                                                   │
│          │                                                                    │
└──────────┴────────────────────────────────────────────────────────────────────┘
Part 12 — Module Relationships
Companies Module
    ↓ creates
Departments Module
    ↓ owns
Jobs Module ←→ Team Module (hiring team per job)
    ↓ receives
Applications Module
    ↓ flows through
Pipeline Module (status transitions)
    ↓ triggers
Interviews Module (scheduling + scorecards)
    ↓ outcomes feed into
Offers Module (approval + e-sign)
    ↓ completed by
Analytics Module (funnel, TTH, source)
Cross-cutting:
• Team Module ← User Invites ← Auth Module
• Notifications → All modules (status changes, interview invites, offer updates)
• Calendar ← Interviews Module (scheduling)
• Talent Pool ← Applications Module (save candidate)
• Audit Logs ← All write operations
Part 13 — What Needs to Change (Gap Analysis)
Database Changes Required
Change	Priority	Reason
Add JobHiringTeam table	High	Per-job hiring manager / interviewer assignment
Add JobPipelineStage table	High	Customizable pipeline per job
Add CompanyPipelineTemplate table	Medium	Default stage templates per company
Add company_id FK to JobPosting	High	Currently only employer_id; company-level queries are expensive
Rename hr_manager role to hr_admin	Medium	Naming consistency with matrix above
Add coordinator role	Low	Currently unsupported job-level role
Add job_id to CandidateInterviewFeedback	Medium	Currently tied only to application_id, needs direct job query
Add pipeline_stage_id FK to Application	High	Link to custom stages instead of status enum only
Backend Changes Required
Change	Priority
Employer dashboard endpoint: return KPIs + dept summaries, NOT job list	High
Add /employer/departments/{id}/overview endpoint	High
Add /employer/jobs/{id}/hiring-team CRUD endpoints	High
Add /employer/jobs/{id}/pipeline-stages CRUD endpoints	Medium
Scope all candidate queries through hiring team membership (not just dept)	High
Department uniqueness validation: return 409 with clear message if duplicate	Already exists via DB constraint — need API error surfacing
Add company_id to job queries for owner/hr_admin level access	Medium
Frontend Changes Required
Change	Priority
EmployerDashboardPage — remove job list, add KPI cards + dept summaries + pending actions + activity feed	High
Create standalone /employer/jobs page with search, filter, bulk actions	High
Create standalone /employer/applicants page (all applicants, cross-job view)	High
DepartmentsPage — clicking a dept navigates to /employer/departments/:id workspace	High
DepartmentDetailPage — implement full workspace with internal nav (Overview, Jobs, Applicants, Interviews, Team)	High
Sidebar — make role-aware (owner sees full nav, recruiter sees scoped nav)	High
Job creation form — department field pre-filled and locked for dept-scoped recruiters	Medium
Add Hiring Team section to Job detail/edit page	High
Create /employer/interviews page (all scheduled interviews, filter by job/dept/date)	Medium
Create /employer/offers page (all offers, filter by status)	Medium
Add "Pending Actions" widget to dashboard	High
Add "Recent Activity" feed to dashboard	Medium
Route guards: recruiters cannot navigate to other departments	Medium
Part 14 — Implementation Order (After Approval)
We will implement in this sequence, module by module, so nothing breaks between phases:

Phase A — Dashboard Cleanup (no new features, just restructure)

Redesign EmployerDashboardPage — remove job list, add KPIs + pending actions
Create /employer/jobs as a dedicated module page
Update sidebar to remove job list from dashboard link
Phase B — Department Workspaces
4. Implement DepartmentDetailPage with internal nav
5. Wire DepartmentsPage → DepartmentDetailPage navigation
6. Scope all dept-internal views to filter by dept automatically
7. Add department duplicate validation UI feedback

Phase C — Hiring Team
8. Add JobHiringTeam DB migration + API endpoints
9. Add Hiring Team section to Job create/edit flow
10. Scope candidate pipeline access to hiring team members

Phase D — Navigation & Role-Aware Sidebar
11. Rebuild sidebar to be role-driven
12. Add route guards for dept-scoped users

Phase E — Applicants Module
13. Create standalone /employer/applicants cross-job view
14. Create /employer/interviews module page
15. Create /employer/offers module page

Phase F — Pipeline Stages
16. Add JobPipelineStage + CompanyPipelineTemplate tables
17. Replace hard-coded status enum with per-job stages in UI

This document covers all 17 deliverables requested. The architecture is fully documented, the gaps are clearly identified, and the implementation is sequenced so each phase delivers visible value without breaking the existing system.

Ready to begin implementation whenever you approve the plan. I recommend starting with Phase A (Dashboard Cleanup) as it has the highest visibility impact with no database changes required.