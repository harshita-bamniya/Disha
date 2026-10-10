# Admin dashboard: research and plan

Date: 2026-10-10 (revised after review the same day). Scope: the home page of the admin panel (`/admin/dashboard`). **Status: phases 1 and 2 built 2026-10-10** (needs-attention queues, funnels, important events, daily-activity recording, period + compare, marketplace health tiles, supply/demand by sector, jobs with no applications). Phases 3 and 4 are not started.

Decisions already made by the product owner: verification review target 3 days; support first-response target 24 hours; no job review/approval step for now; track active users; revenue visible to super admin only (plus the finance manager role, see section 5).

## 1. The problem with today's page

What is on screen now ([AdminDashboard.tsx](../../frontend/src/modules/admin/pages/AdminDashboard.tsx)):

| Today | Why it does not help an admin |
|---|---|
| Navy banner: total aspirants, employers, job postings, avg KRS | All-time totals with no period and no comparison. They only ever go up, so they cannot tell you anything is wrong. Avg KRS is not something anyone acts on. |
| 4 stat cards (onboarding done, applications, hired, approved employers) | Same problem: totals, no trend. |
| 4 bar "sparklines" (users, employers, jobs, applications) | No axis, no values, no comparison. With a few rows of data they are nearly empty. |
| "Conversion funnel" | **Wrong.** "Applied to a job" is the number of *applications* capped by the number of aspirants, not the number of *people who applied*. One person with 5 applications counts 5 times. Every step is also divided by total aspirants, not the previous step. |
| "Admin access" grid and "Quick actions" | Duplicate the sidebar. They show a count only to fill the card. |
| "Recent activity" (signups, applications, jobs posted) | A feed of routine events. No one can act on "someone signed up". |
| "Pending employers" number | Counts employers who are not approved and have a verified phone. The KYC queue counts verification requests with status `requested`. **Two different definitions of "pending", so the dashboard and the queue can disagree.** |

What is missing entirely: anything that needs a person (queues, overdue items), anything about the money, anything about how healthy the matching between jobs and candidates is, and anything about the AI features.

**Design goal.** An admin opens this page and within 10 seconds knows (1) is anything waiting on me or broken, (2) is the marketplace healthy, (3) is the business working. Everything else lives one click away in Analytics and the list pages.

## 2. What the research says

Sources are listed at the end. Figures from vendor blogs are marked as such.

**How dashboards should be built**
- A dashboard has one purpose: communicate critical information on a single screen that can be understood almost immediately (Nielsen Norman Group). It is not for deep exploration.
- The most important item goes top-left (F-pattern reading). Keep the top to about 3 to 5 KPI cards and the whole page to roughly 5 to 9 primary metrics, each tied to a decision. A metric included "just in case" should be removed.
- Show exceptions, not everything. A team that was swamped by alerts fixed it by surfacing only exceptions and critical KPIs.
- Every number needs context: the period, a comparison, and ideally a target or threshold. A bare count tells you little (a support-metrics guide makes this point: 240 open tickets means different things depending on age and incoming volume).
- Charts: use bars and lines (length and position are read most accurately), sort bars by value, do not rely on colour alone, and avoid pie/donut, gauges, treemaps and 3D charts (Nielsen Norman Group).
- Deeper detail sits behind a click (progressive disclosure). Operational views (act today) are separate from analytical views (understand over time).

**What marketplace and job-board dashboards track**
- The core of a two-sided marketplace dashboard is liquidity: how reliably and quickly the two sides get matched. Metrics named across sources: fill rate, time to match / time to first response, supply-to-demand balance, repeat rate, supply retention.
- Aggregates hide dead segments. One guide's example: 100 applicants per marketing job and zero per engineering job. Always be able to see balance by category.
- Track each side separately; one "health score" hides a collapsing side.
- A job-board KPI guide (vendor blog, benchmarks are rules of thumb, not research) suggests: job freshness, active employers, repeat posting rate, signup-to-first-post time, applications per posting, time to first application, and "fill rate" defined as the share of postings reaching a minimum number of applications. It warns that raw pageviews, impressions and real-time visitor counts are vanity metrics.
- Admin-side patterns for job platforms (open-source examples and plugin docs): a verification queue with approve/reject, required rejection reasons and an audit log; queue depth, time waiting and decisions made as queue-health metrics.

**What operations queues need**
- Support: open tickets alongside created-vs-resolved, backlog by age, first-response time against a target, tickets about to breach an SLA (not only ones already breached), unassigned count. Live view for daily action, history for staffing.
- Revenue: the bridge (start, new, expansion, churn, end) matters more than the total; failed payments are a separate line from voluntary churn; show money at risk in past-due invoices.
- AI features: cost per feature, error rate per feature and type, p50/p95 latency, and retry cost. All of it requires every call to be tagged with feature and model first.

**What does not carry over**
- No source offers reliable benchmarks for career or exam-prep platforms. Most numbers are from vendor blogs for general SaaS or consumer apps. This plan therefore uses **your own previous period as the comparison** and sets no invented targets.
- Career products are used in bursts (during a job search), so a fixed 30-day retention window can mislabel satisfied users as churned. We use "active in the last 30 days" plus cohort funnels, not a retention curve, until there is enough history.

## 2b. How well does this match real recruiting platforms? (honest assessment)

The question "do recruiting sites really show this on their admin panel?" deserves a direct answer.

**What I could verify**
- Admin panels of off-the-shelf job-board software are *simple*. JobBoard.io's admin opens on real-time revenue, sales and applicant information, with bar graphs of jobs created, employers created and sales over a chosen date range. WP Job Portal's admin reports page has four number boxes (total jobs, companies, resumes, applications) and a graph. SmartJobBoard has "basic reports" on its dashboard with date-range filters on job, resume and employer lists. This is roughly the "count plus date range" page you have now, and it is the part you called basic.
- A task-oriented admin home is a real pattern. Greenhouse's admin homepage (onboarding product) is built around pending hires, new hires and a "My tasks" panel with due dates. Recruiter dashboards in Greenhouse, Lever and Workable focus on open requisitions, pipeline health and pending tasks. These are customer-side (recruiter) dashboards, not platform-operator panels.
- Large platforms moderate in layers: automated detection, human review for borderline cases, user reports, and appeals (LinkedIn's published enforcement summaries; Indeed's published quality policy and appeal route). Their public transparency material counts removed accounts and content; it does not show an operator dashboard.
- Pre-publication job approval exists in some products (WP Job Manager's "Approve" on pending jobs; the i4a association platform's review-before-publish or auto-approve). You decided not to use it for now.

**What I could not verify**
- The internal admin consoles of Naukri, LinkedIn, Indeed, Foundit and similar companies are not public. I found no screenshots or documentation of them, so I cannot claim they show any particular widget.
- Recruiting-specific admin dashboards that combine verification queues, support SLAs, AI usage and revenue do not exist as public references, because most job boards do not have those features.

**So what is this plan?** A deliberate synthesis, not a copy of a known product:

| Part of the plan | Evidence strength | Basis |
|---|---|---|
| Date-ranged counts of jobs, employers, applications, revenue | Strong | Every job-board admin product I found has it. This is the minimum, not the goal |
| "Needs attention" queue as the first thing you see | Moderate | Task-first admin homes (Greenhouse), helpdesk and operations dashboards, Nielsen Norman guidance to surface exceptions |
| Marketplace health (time to first application, applications per job, balance by sector) | Moderate | Marketplace and job-board KPI literature, mostly vendor blogs |
| Cohort funnels, active users | Moderate | Standard product-analytics practice; your platform already has a funnel |
| Verification queue, support SLA, safety review, AI usage | Specific to your product | You run these processes; they need a place to be managed, so they belong on the page that opens first |
| Revenue and past-due view | Strong | Commodity job boards lead with revenue; SaaS billing practice adds failed payments |

If the question is "will this look like Naukri's admin", I cannot know. If the question is "is every widget justified by something your team actually has to do or decide", yes, and anything that is not has been left out.

## 3. Proposed layout

One page, four zones, in reading order. A single date-range control (7 / 30 / 90 days, with "compare to previous period") sits in the header and applies to zones B to D. Zone A is always live.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Platform overview            [Last 30 days ▾] [vs previous ☑]   Updated 2m ago│
├──────────────────────────────────────────────────────────────────────────────┤
│ A. NEEDS ATTENTION   (only rows that have something in them)                  │
│  ⚠ Employer verifications   7 waiting · oldest 5d · 3 past 3-day target    → │
│  ⚠ Support tickets          4 open · 2 unassigned · 1 urgent · oldest 2d   → │
│  ● Interview appeals        2 open · oldest 1d                             → │
│  ● Safety events            3 unreviewed (1 high)                          → │
│  ⚠ Payments                 2 past-due subscriptions · ₹ 14,998 at risk    → │
│  ✓ Everything else is clear                                                   │
├───────────────────────────────────────┬──────────────────────────────────────┤
│ B. MARKETPLACE HEALTH                 │ Where supply and demand are uneven   │
│ [Live jobs] [Applications] [Median    │  Sector            Jobs   Apps/job   │
│  14   ▲2    312  ▲18%     time to 1st │  ▇▇▇▇▇ Banking      9      41        │
│                           app: 9h]    │  ▇▇▇   Civil svc    4      6         │
│ [Interview rate] [Hires]              │  ▇     PSU          1      0   ←zero │
│  11%  ▼2pt        6  ▲3               │  Live jobs with 0 applications in 7d:3│
├───────────────────────────────────────┴──────────────────────────────────────┤
│ C. GROWTH                                                                     │
│  Aspirants (signup cohort)            │  Employers (signup cohort)           │
│  Signed up 120 → Onboarded 74 (62%)   │  Registered 18 → KYC sent 12 (67%)   │
│  → K-score 61 → Applied 22            │  → Approved 9 → Job posted 7         │
│  Biggest drop: onboarded → K-score    │  Biggest drop: registered → KYC sent │
│  Active aspirants (30d): 210  ▲6%     │  Median signup → first job: 3.2 days │
├──────────────────────────────────────────────────────────────────────────────┤
│ D. BUSINESS & PLATFORM                                                        │
│  Revenue (captured)  MRR   Paying customers   │ AI interviewer (30d)         │
│  ₹ 84,000 ▲12%      ₹ 61k   Employer 6 / Asp 14 │ calls 1,420 · errors 1.8% │
│  Past-due: 2 (₹ 14,998)                        │ p95 latency 3.1s · est. ₹…  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Latest important events  (verified/rejected employer, plan change, failed    │
│  payment, safety event, ticket escalated)                      [Open audit]  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Zone A: Needs attention (the most important zone, top-left)
Purpose: the work that is waiting on a person, ordered by urgency. Rows appear only when there is something in them; if everything is clear, one "all clear" line shows. Each row has a count, the age of the oldest item, how many are past their target, and a link that opens the target page already filtered.

| Row | Definition | Opens |
|---|---|---|
| Employer verifications | `status in (requested, under_review)` (needs a reviewer). `needs_info` is waiting on the employer, so it is shown separately and does not count as staff backlog. Oldest `submitted_at`; past target = older than 3 days (the threshold the current KYC panel already uses) | KYC queue, filtered |
| Support tickets | open and unassigned, high/urgent priority, oldest age, first-response overdue | Tickets, filtered |
| Interview appeals | `interview_appeals.status = open`, oldest age | Appeals |
| Safety events | `interview_safety_events` and counsellor `safety_flags` with no `reviewed_by`; count by severity | Safety list |
| Payments | `company_subscriptions.status = past_due`, failed payments in the period, amount at risk | Billing |
| System | background-job or email-delivery failures (see section 6, only once logged) | System |

Rules: every row says *why* it is shown (a count alone is not enough), colour is never the only signal (icon and text label as well), and rows are role-aware (section 5).

### Zone B: Marketplace health
Five tiles, each with value, change versus the previous period, and a small trend line. Each has a "how this is calculated" tooltip.

| Tile | Definition | Why it earns a place |
|---|---|---|
| Live jobs | Published, not expired, as of now. Sub-line: how many are new this period | Supply |
| Applications | Applications created in the period, and per live job (median) | Demand, and whether employers get enough to keep posting |
| Median time to first application | From publish to first application, per job | The clearest early sign that matching works; a rising value is the first warning |
| Interview rate | Share of applications in the period that reached an interview stage (from status history) | Quality of the matches, not just volume |
| Hires | Applications moved to `hired` in the period | The outcome the platform exists for. Small numbers are shown as counts, not rates |

Next to the tiles: **"Where supply and demand are uneven"**, a sorted bar list by sector (jobs, applications per job) plus a count of live jobs with zero applications after 7 days (click to see them). This answers "where should I act", which a single total cannot.

### Zone C: Growth
Two compact closed-cohort funnels, aspirants and employers, for the people who *signed up in the selected period*. This reuses the existing journey funnel (`/admin/analytics/command-center/funnel`, with Wilson confidence intervals), so no new statistics are needed. Show five steps each, the conversion at each step, and **highlight the single biggest drop**. Under each: one number that tells you the engine is healthy.

- Aspirants and employers: **active users**, shown as daily, weekly and monthly active counts (DAU, WAU, MAU) for each side, with a 30-day trend line and the change versus the previous period. "Active" means the person opened the product on that day (see the data note in section 6). Also show the WAU/MAU ratio as a plain stickiness number.
- Employers: median time from registration to first published job.
- Active users appear as a tile row at the top of this zone, because it is the number you asked to track.

A link to the full Analytics page covers drill-down. This zone replaces the broken funnel and the four sparklines.

### Zone D: Business and platform
Visible only to roles that need it (section 5).
- **Revenue:** captured payments in the period, MRR (active subscriptions times plan price, annual plans divided by 12), paying customers by side, and past-due count with money at risk. The full MRR bridge is deferred until there are enough subscriptions for it to mean something.
- **AI interviewer:** calls, error rate, p95 latency, tokens, and an estimated cost (tokens times a rate kept in platform settings; clearly labelled *estimate*). Only the interview engine logs usage today (section 6).

### Latest important events (DROPPED 2026-10-10)
Removed after review: it duplicated the Audit log page and read as noise on a home screen. The audit log stays the place for it. The section below is kept only as a record of the original idea.

Replaces "Recent activity". Only events a person might act on or want to audit: employer approved/rejected (with who), plan changed, payment failed, safety event, ticket escalated. Routine signups and applications are dropped; they are already in the trends. Links to the audit log.

## 4. What to remove, and why

| Remove | Reason |
|---|---|
| All-time total banner and stat cards | Never go down, no context. Totals live on the list pages |
| Avg KRS Score | Not actionable at platform level; belongs in Analytics |
| Axis-less sparklines | Replaced by tiles with value, change and a labelled trend |
| Current funnel | Mathematically wrong (section 1); replaced by the closed-cohort funnel |
| "Admin access" grid and "Quick actions" | Duplicates the sidebar |
| "Recent activity" feed of routine events | Not actionable |
| The `pending_employers` stat | Replaced by the verification queue count so the dashboard and the queue always agree |

## 5. Different admins, different first screen
The page already has role titles. Keep one page and change **order and visibility**, not separate pages.

| Role | First zone | Hidden |
|---|---|---|
| super_admin | A (all rows), then B, C, D including revenue | nothing |
| admin | A (all rows), then B, C, and the AI/platform half of D | revenue (super admin only, as decided) |
| verification_officer | A: verifications only, then: median review time, approval rate, top rejection reasons | revenue, AI |
| support_executive | A: tickets only, then created vs resolved, backlog by age, first-response time | revenue |
| moderator | A: appeals, safety events, then zero-application jobs | revenue |
| finance_manager | D first (revenue, past-due), then payments in A. Included because the role exists for billing; say so if this should be super admin only | verification, support |

The backend must enforce this (return only the zones a role may see); hiding it in the UI is not enough.

## 6. Can we build each widget today?

Checked against the database and code on 2026-10-10.

| Widget | Source | Status |
|---|---|---|
| Verification queue + age | `employer_verifications` (`status`, `submitted_at`) | Ready. Fix the "pending" mismatch |
| Tickets: open, unassigned, priority, age | `support_tickets` | Ready |
| Ticket first-response time | First non-internal staff reply in `ticket_messages` | Computable. Needs an SLA target setting |
| Appeals, safety events | `interview_appeals`, `interview_safety_events`, `safety_flags` | Ready |
| Past-due and failed payments | `company_subscriptions.status`, `payments.status` | Ready |
| Live jobs, applications, hires, interview rate | `job_postings`, `applications`, `application_status_history` | Ready |
| Applications per job, zero-application jobs, balance by sector | Same tables, `job_postings.sector` | Ready |
| **Time to first application** | Needs a publish timestamp | **Missing:** `job_postings` has no `published_at` (only `created_at`, which is the draft date). Add the column, set it on publish, backfill from `created_at` for already-published jobs |
| Aspirant and employer funnels | Existing `command_center/funnel.py` | Ready |
| **Active users (DAU/WAU/MAU)** | `login_history` is **not** usable: access tokens last 15 minutes but refresh tokens last 30 days, so a daily user creates no new login row for weeks, and `users.last_login_at` only keeps the latest one | **Needs a small new table**, `user_activity_daily (user_id, activity_date)`, written once per user per day when a session is used (on login and on token refresh, which happens every 15 minutes while the app is open). DAU/WAU/MAU are then simple distinct counts. History starts the day it ships; it cannot be back-filled except approximately from existing action tables |
| Revenue, MRR, paying customers | `payments`, `company_subscriptions`, `aspirant_subscriptions`, `subscription_plans` | Ready (approximate MRR) |
| AI interviewer calls, errors, latency, tokens | `model_runs` | Ready for the interview engine only |
| AI cost across all features | Resume match, roadmap, counsellor, companion calls are not logged | **Needs instrumentation:** route those calls through the same tracker. Cost also needs a rate table in settings |
| Email delivery failures | Only announcements record `email_failed_reason`; other email is fire-and-forget | **Needs instrumentation** (a small `email_log`) before it can be a tile |
| Jobs pending approval | No approval step exists; decided not to add one for now | Not built. If this changes, add a row to zone A |
| Traffic, sessions, bounce rate | Not collected | Not recommended: vanity metrics for this product |

## 7. Handling small numbers honestly
The platform is early, so many rates will have small denominators. Reuse the existing rule (`LOW_SAMPLE_N = 30`):
- Below the sample threshold, show the count and "low sample", not a percentage, and no up/down arrow.
- Never show a change versus the previous period unless both periods have enough data.
- Empty states say what unlocks the metric ("needs published jobs with at least 7 days of history"), instead of showing 0%.
- All periods are India time (the existing `resolve_range` helper).

## 8. How it should be built

**Backend**
- `GET /admin/dashboard/attention`: zone A only; cheap, polled every 60 seconds.
- `GET /admin/dashboard/overview?days=30&compare=true`: zones B to D in one response, filtered by the caller's permissions, cached about 60 seconds in Redis.
- All counts are grouped aggregate queries over indexed columns; no per-row loops. Each metric is a small function with one test.
- New settings (in `platform_settings`): verification target days, ticket first-response target hours, AI cost rate per million tokens.
- Migrations: `job_postings.published_at`, and `user_activity_daily (user_id, activity_date)` with a unique key on both columns (an upsert on login and on token refresh keeps it to one row per user per day).

**Frontend**
- One component per zone, each with its own loading skeleton and its own error state, so one failing query never blanks the page.
- Date range and compare toggle live in the URL so a view can be shared and survives refresh.
- Every number links to a page that shows the same count when filtered (the dashboard count must equal the list count).
- Charts: bars and lines only, accessible labels, nothing coded by colour alone.

## 9. Delivery phases

| Phase | Contents | Needs |
|---|---|---|
| 1 | Page restructure; zone A; remove the noise; fix the "pending" mismatch and the wrong funnel | No migration. Highest value |
| 2 | Date range + compare; zone B (except time to first application); zone C funnels; **`user_activity_daily` table starts recording** (so active-user history begins as early as possible) | Reuses the existing funnel; one small migration |
| 3 | Active-user tiles (once there is some history); `published_at` migration; time to first application; zone D revenue (super admin) | One migration |
| 4 | AI tracking across features; email log; role-based ordering; settings for targets | Instrumentation work |

Each phase is shippable alone. Phase 1 alone changes the page from "numbers" to "what to do".

## 10. Decisions
Answered by the product owner on 2026-10-10:
1. Verification review target: **3 days**. Support first-response target: **24 hours**. These go in platform settings so they can be changed without a deploy.
2. Job moderation: **not needed for now**. No "jobs pending review" row.
3. Active users: **yes, track them** (DAU/WAU/MAU for aspirants and employers, via `user_activity_daily`). "Active" = opened the product that day.
4. Revenue: **super admin only**. Plain `admin` does not see revenue. Open point: the `finance_manager` role exists to handle billing, so this plan lets it see revenue too. Remove that if you want strictly super admin.

Still open (small): whether "opened the product" is enough for "active" or you want "did something meaningful" (applied, practised, studied) as a second, stricter line. Starting with the simple definition costs nothing and can be tightened later.

## Sources
- Job-board admin products (what a typical admin dashboard shows): https://jobboard.io/intuitive-admin-panel/ , https://support.jobboard.io/docs/reporting-dashboard , https://docs.wpjobportal.com/index.php/wp-job-portal/overall-reports/ , https://www.smartjobboard.com/blog/new-admin-panel-design/
- Greenhouse admin homepage and report dashboards: https://support.greenhouse.io/hc/en-us/articles/115002166903-Admin-homepage-in-Greenhouse-Onboarding , https://support.greenhouse.io/hc/en-us/articles/4408761575963-Report-dashboards-overview
- Moderation and quality policies: https://news.linkedin.com/2022/december/transparency-report--first-half-of-2022 , https://www.indeed.com/help/employers/articles/204575734
- Nielsen Norman Group, dashboard design (single screen, preattentive features, charts to avoid): https://www.nngroup.com/articles/dashboards-preattentive/
- Dashboard best-practice roundups (F-pattern placement, 3 to 5 top KPIs, tie each metric to a decision, exceptions): https://www.clearpointstrategy.com/blog/kpi-dashboard-best-practices , https://fuselabcreative.com/kpis-and-data-dashboard-design/
- Job board KPI guide (vendor blog): https://cavuno.com/blog/job-board-analytics
- Marketplace liquidity and KPIs: https://www.sharetribe.com/academy/measure-your-success-key-marketplace-metrics/ , https://www.lowcode.agency/blog/marketplace-analytics-kpis-guide , https://a16z.com/the-marketplace-glossary/
- Employer verification queue patterns on job platforms: https://wpjobboard.net/kb/managing-employers-in-admin-panel/ , https://github.com/Oludammy2030/Hivorr/pull/107
- Support dashboard metrics (backlog age, first response, SLA risk): https://www.metabase.com/analytics/support-analytics/ , https://www.apps365.com/blog/helpdesk-dashboard/ , https://www.basedash.com/dashboard-templates/support-dashboard
- Stripe Dashboard home (overview, notifications for unresolved items, date comparison): https://docs.stripe.com/dashboard/basics
- Activation and cohort funnels (AARRR): https://umbrex.com/resources/frameworks/strategy-frameworks/aarrr-pirate-metrics-funnel/ , https://clevertap.com/blog/aarrr-metrics-vs-rarra-framework/
- Subscription revenue and dunning views (vendor material): https://docs.elasticfunnels.io/subscriptions/analytics.md
- LLM cost and latency monitoring (vendor docs): https://docs.helixops.ai/bin/Helix-Common-Services/Dashboards-Reports/BMC-Helix-Dashboards/BHD251/Out-of-the-box-dashboards/BMC-Helix-AIOps-dashboards/LLM-Cost-dashboard/

A note on evidence: the layout and metric choices rest on Nielsen Norman Group guidance and on definitions that several independent sources agree on. Specific numeric benchmarks in vendor blogs were deliberately not used as targets.
