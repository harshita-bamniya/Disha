# Subscription model: questions for the Product Manager

Prepared 2026-10-10 for the product manager. Goal: decide **how many subscription plans we keep, what each plan contains, what each costs, and what happens at the limits**, so engineering can build plan gating, metering and billing once instead of three times.

**How to use this document.** Every question has (a) what the product does today, (b) a recommended default, and (c) an `Answer:` line. If you agree with the default, write "Agree". Items marked **BLOCKER** stop engineering work on plan limits.
Numbers in the "recommended" lines are starting points to react to, not validated prices. Where I say "today" it was verified in the code or the database on 2026-10-10.

---

## 1. What exists today

### 1.1 Employer plans (database table `subscription_plans`, prices stored in paise)

| Plan | Price | Active jobs | Recruiter seats | Resume access | Candidate search limit | Features JSON |
|---|---|---|---|---|---|---|
| `free` | Rs 0 | 1 | 1 | no | 10 | empty |
| `standard` (monthly) | Rs 1,999 / mo | 5 | 5 | yes | 100 | empty |
| `standard_annual` | Rs 19,990 / yr | 5 | 5 | yes | 100 | empty |
| `premium` (monthly) | Rs 4,999 / mo | 20 | 15 | yes | 500 | empty |
| `premium_annual` | Rs 49,990 / yr | 20 | 15 | yes | 500 | empty |
| `enterprise` | Rs 0 (custom) | unlimited | unlimited | yes | unlimited | empty |

### 1.2 Aspirant (candidate) plans

| Plan | Price | Notes |
|---|---|---|
| `aspirant_free` | Rs 0 | 3 uses of each premium feature (`FREE_TIER_LIMIT`): AI counsellor chat, roadmap, resume builder, practice mock interview |
| `aspirant_premium_monthly` | Rs 299 / mo | unlocks the four gated features |
| `aspirant_premium_annual` | Rs 2,990 / yr | same |

### 1.3 What is actually enforced in code today
- **Enforced:** active job count (`max_active_jobs`), recruiter seats (`max_recruiter_seats`), subscription must be "active" to use the dashboard, aspirant free-tier counters.
- **Shown but, as far as I could find, not enforced:** `resume_access` and `candidate_search_limit` (no code path checks them outside display).
- **Not present at all:** any limit, meter or price for **AI interviews**, department limits, storage, number of applicants, data-export, support level, SLA.
- **Payments:** Razorpay is integrated for plan checkout, but the `razorpay_plan_id` column is **empty on every plan** and the Razorpay keys are blank in the dev config, so paid checkout has not been proven end to end for employers. Needs a live test.

---

## 2. Questions

### A. Business model and customers

**A1. Who is the paying customer in the first 12 months?** (small employers hiring a few roles, mid-size HR teams, large enterprises, staffing agencies, institutes/NGOs/think-tanks?)
Recommended: small and mid-size employers hiring in policy, research, public affairs, CSR, ed-tech; enterprise only by quote.
Answer:

**A2. Which revenue streams do we want?** Options: employer subscriptions, pay-per-use AI interviews, candidate subscriptions (aspirant premium), job-posting fees, featured listings, placement fees, data/API access.
Recommended: employer subscription (core) + metered AI interviews (add-on usage) + aspirant premium (existing). No placement fees until pilot data exists.
Answer:

**A3. Is the aspirant (candidate) side a revenue line or a supply-side growth tool?** This decides whether we keep charging candidates Rs 299/mo.
Answer:

**A4. Which countries do we sell in during year one?** (India only, or also other countries.) This changes tax, invoicing, currency and the legal workload.
Recommended: India only, INR, GST invoices.
Answer:

### B. How many employer plans, and what is in each (BLOCKER)

**B1. How many employer tiers do we want?** Today: Free, Standard, Premium, Enterprise (4) plus annual variants.
Recommended: keep **4 tiers** (Free, Standard, Premium, Enterprise) with monthly and annual billing (annual = about 2 months free). Fewer tiers make the AI interview quota easier to explain.
Answer:

**B2. Fill in the plan matrix.** The proposed starting values are below. For each cell, confirm or change. Cells marked `?` have no value today and need a decision.

| | Free | Standard | Premium | Enterprise |
|---|---|---|---|---|
| Monthly price | Rs 0 | Rs 1,999 | Rs 4,999 | custom |
| Annual price | n/a | Rs 19,990 | Rs 49,990 | custom |
| Active jobs | 1 | 5 | 20 | unlimited |
| Recruiter seats | 1 | 5 | 15 | custom |
| Departments | `?` (1) | `?` (3) | `?` (10) | unlimited |
| Applicants per job per month | `?` (50) | `?` (500) | `?` (unlimited) | unlimited |
| Resume access | no | yes | yes | yes |
| Candidate search / talent pool views per month | 10 | 100 | 500 | custom |
| **AI interviews included per month** | `?` (5, text only) | `?` (25) | `?` (100) | `?` (contract) |
| AI interview overage price per extra interview | not available | `?` (Rs 49) | `?` (Rs 39) | contract |
| AI interview modes | text | text + audio answers | text + audio answers | + live voice later |
| Employer-approved question sets / templates | 1 | 5 | unlimited | unlimited |
| Auto-invite candidates after applying | no | no | yes | yes |
| Bulk invitations | no | up to 25 at once | up to 200 | unlimited |
| Team/department-scoped access | no | yes | yes | yes |
| Data retention of candidate results | 180 days | 180 days | 365 days (configurable) | custom |
| CSV/PDF export of scorecards | no | yes | yes | yes |
| ATS / API / webhook integration | no | no | `?` (webhook) | yes |
| Support | email | email | priority email + chat | dedicated manager, SLA |
| SSO / audit log export | no | no | no | yes |

Answer (changes to the table):

**B3. Should AI interviews be a separate paid add-on rather than bundled in plans?**
Options: (1) bundled allowance + overage (recommended), (2) separate "AI Interviewer" subscription on top of any plan, (3) pure pay-per-interview with no allowance.
Answer:

**B4. Should the Free plan include any AI interviews?** A small allowance (about 5 per month, text-only, 1 active screen) lets a small employer try the real product, but each interview costs us money (see the AI document, cost section).
Recommended: yes, 5 per month, hard cap, one free account per verified company.
Answer:

### C. AI interview pricing mechanics (BLOCKER)

**C1. What counts as one billable "AI interview"?**
Recommended: one candidate's interview that was **completed and scored**. Not charged: invitations that expired/declined, system failures, the free technical-failure retake, employer test runs.
Answer:

**C2. Do unused interviews roll over to next month?**
Recommended: no rollover for included allowance; purchased packs are valid 12 months.
Answer:

**C3. What happens when an employer reaches the limit?**
Options: (a) block new invitations with an upgrade prompt, (b) allow automatic overage billing up to a monthly ceiling the employer sets, (c) allow buying a prepaid pack.
Recommended: block at 100% unless the employer has enabled overage or bought a pack; warn at 80%.
Answer:

**C4. Overage and pack prices.** Proposed Rs 49 per extra interview on Standard, Rs 39 on Premium; packs of 25 and 100.
Estimated cost to us is about Rs 10-20 per interview on cheap models (not measured; see the AI document), so these keep a healthy margin. Confirm or change.
Answer:

**C5. Do we reserve (hold) an interview credit at invitation time or only consume it on completion?**
Recommended: reserve at invitation (so the employer cannot over-invite), release on expiry/decline/cancel, consume on scoring.
Answer:

### D. Free plan and abuse protection

**D1. How do we stop one company from creating many free accounts?** (company verification/KYC, GST/CIN check, domain email, phone, manual review.)
Recommended: require verified company (existing KYC flow) before any free AI interviews are available.
Answer:

**D2. Trial.** Do paid plans get a free trial (e.g. 14 days) or a money-back guarantee?
Answer:

### E. Billing operations

**E1. Billing intervals:** monthly and annual only, or also quarterly?
Answer:

**E2. Upgrades and downgrades:** pro-rated immediately, or at the next billing date? What happens to jobs/seats/AI interview allowance above the new plan's limit after a downgrade? (Recommended: keep existing data readable, block creating new items above the limit, 30-day grace.)
Answer:

**E3. Failed payment and cancellation:** grace period before access is restricted (recommended 7 days), and what is restricted (new jobs and new AI invitations yes, viewing existing results no).
Answer:

**E4. Refund policy** (monthly, annual, unused AI interviews).
Answer:

**E5. Taxes and invoices:** GST rate and GSTIN on invoices, invoice emails, credit notes. Who handles this (existing payments module, accountant)?
Answer:

**E6. Payment methods:** cards, UPI, netbanking, invoice/bank transfer for enterprise? Razorpay only?
Answer:

**E7. Company details needed at checkout** (billing name, address, GSTIN).
Answer:

### F. Limits and how strictly we enforce them

**F1. For each limit (jobs, seats, departments, applicants, AI interviews, searches): hard block, soft warning, or overage?** Recommended: jobs, seats, departments, AI interviews = hard block with upgrade prompt; searches = hard block; applicants = soft warning.
Answer:

**F2. Who can see usage and billing?** Owner only, or also HR managers? (Recommended: owner and admins see billing; department heads see their own usage.)
Answer:

**F3. Should AI-interview usage be shared across the company or limited per department?**
Answer:

### G. Enterprise

**G1. What does Enterprise include and who sells it?** (Custom contract, SSO, data processing agreement, SLA, audit export, custom retention, dedicated support, higher limits.) Is there a minimum annual commitment?
Answer:

**G2. Do we allow white-labelling or custom branding of the candidate interview page?**
Answer:

### H. Aspirant plans

**H1. Keep Rs 299/mo and Rs 2,990/yr?** Do we keep the "3 free uses" per feature?
Answer:

**H2. Can an employer's AI interview use candidate practice data?** (Recommended: no. Employer interviews must be independent of practice history.)
Answer:

**H3. Do candidates ever pay for employer-requested interviews?** (Recommended: never.)
Answer:

### I. Legal and policy

**I1. Who writes the subscription terms, refund policy and the AI-interview terms of use?** Needs a lawyer before launch.
Answer:

**I2. Is there a contractual commitment about AI accuracy or fairness?** (Recommended: no accuracy guarantees; documented limitations and human decision-making only.)
Answer:

---

## 3. Suggested decision order
1. B1-B2 (tiers and matrix), 2. C1-C4 (AI pricing), 3. D1, 4. E2-E3, 5. everything else.
Once B2, C1, C3 and C4 are answered, engineering can build plan gating, usage metering and checkout in about 2-3 weeks (estimate).
