# AI Interviewer (Employer): commercial model

Status: proposal, 2026-10-10. **Every cost number is an estimate from list prices and code-derived call counts, not a measured cost.** Tags: `[Code]`, `[Research]`, `[Decision]`, `[Assumption]`.
FX assumption `[Assumption]`: 1 USD = Rs 88 (check at time of use).

## 1. What exists today

`[Code]` There is no billing, entitlement or metering for employer AI interviews (Audit B3). Employer plans live in `subscription_plans` (Docker DB, read-only SELECT 2026-10-10; `price_monthly` is stored in paise):

| Plan | Price | Active jobs | Recruiter seats | Candidate search | `features` |
|---|---|---|---|---|---|
| free | Rs 0 | 1 | 1 | 10 | NULL |
| standard | Rs 1,999/mo (Rs 19,990/yr) | 5 | 5 | 100 | NULL |
| premium | Rs 4,999/mo (Rs 49,990/yr) | 20 | 15 | 500 | NULL |
| enterprise | Rs 0 (quote) | unlimited | unlimited | unlimited | NULL |

Razorpay ids are empty on these rows, so payment wiring for employer plans should be verified before launch. The practice product separately meters aspirants (`FREE_TIER_LIMIT`=3 practice interviews, `mock_interview` credits; Audit §6(8)); verified interviews charge nothing.

## 2. Cost per completed interview (estimate)

### 2.1 Call counts `[Code]` (derived from the current design, ~9 answers; Audit §5)

Today: 2 setup LLM calls, up to ~9 follow-up decisions, 18-27 scoring calls, 1-2 report calls, ~9 STT calls, up to 80 TTS calls. **Proposed design** reduces setup to zero per candidate (questions are pre-generated once per template), keeps follow-up decisions, and uses per answer: 1 extraction + 2 scoring + a share of 1 summary.

### 2.2 Unit prices `[Research §9]` (list, fetched 2026-10-10; re-verify)

- Groq Whisper large-v3-turbo $0.04/hr; large-v3 $0.111/hr. Deepgram Nova-3 batch about $0.0043/min.
- Gemini 2.5 Flash $0.30 in / $2.50 out per 1M tokens; 2.5 Flash-Lite $0.10 / $0.40. Gemini TTS preview about $10 per 1M audio-out tokens.
- Groq LLM per-token prices **not retrieved**; OpenAI official pricing page returned 403. Treat Groq LLM cost as unknown until read from the live page.
- Realtime voice agents: $0.05-$0.16/min on listed tiers (about $1-3 per 20 min, third-party estimates for OpenAI).

### 2.3 Scenarios (per completed 15-minute interview, ~7 answers)

| Component | Low (cheap models, text) | Base (Flash-class, audio answers) | High (premium models, retries, TTS, re-score) |
|---|---|---|---|
| STT (15 min audio) | 0 | $0.01-0.07 | $0.07 |
| LLM extraction + 2 scoring passes + summary (≈25-40k tokens in, 6-10k out) | $0.004 | $0.02-0.04 | $0.15-0.25 |
| Follow-up decisions (~7 short calls) | $0.002 | $0.005 | $0.02 |
| TTS (cached, per template) | 0 | ~0 amortised | $0.05 if not cached |
| Retries / failed calls / re-scoring overhead (+20-50%) | $0.002 | $0.01 | $0.10 |
| **LLM+speech subtotal** | **~$0.01 (Rs 1)** | **~$0.05-0.15 (Rs 4-13)** | **~$0.40-0.50 (Rs 35-45)** |
| Storage (audio 30 d, transcripts) | ~0 | <$0.005 | $0.01 |
| Email/notifications, compute, DB | <$0.01 | <$0.01 | $0.02 |
| Support & monitoring allowance `[Assumption]` | Rs 2 | Rs 5 | Rs 10 |
| **All-in unit cost** | **~Rs 4** | **~Rs 10-20** | **~Rs 50-60** |

A live realtime voice interview (Phase C) is a different product: roughly **Rs 90-260 per 20 minutes** on provider cost alone (`$1-3`), so it must be priced separately.

Failed sessions: cost is incurred on partial runs that never get charged. Budget `[Assumption]` 10-15% of started interviews as non-billable overhead; measure in the pilot from `model_runs`/`ai_usage_ledger`.

## 3. Competitor pricing, only where public `[Research §2, §4]`

| Vendor | Documented model | Notes |
|---|---|---|
| myInterview | about $0.50/min per interview (third-party estimate; verify) | per-minute |
| Ribbon | bundles; overage about $2-4 per interview | per-interview |
| CodeSignal / HackerRank | seat/subscription with credits or attempts, about $20 overage per attempt | assessments, not interviews |
| Spark Hire | tiered subscription (public page not verified) | |
| HireVue, Paradox, Alex, Skillate, Vervoe | quote-based or unverified | HireVue estimates of $5-30+ per interview are third-party and unverified |

Conclusion: the market is not price-transparent; the public datapoints are in the range of tens of rupees to a few hundred rupees per interview. Our estimated unit cost (Rs 10-20 base) leaves large headroom; the binding constraints are trust and quality, not margin.

## 4. Pricing models compared

| Model | Pros | Cons | Fit |
|---|---|---|---|
| Pay per completed interview | Simplest, aligns cost and revenue, no waste | Lumpy revenue; employers fear runaway bills | Good as overage |
| Credit packs (prepaid) | Cash up front, no surprise bill, small employers can start at a few thousand rupees | Expiry disputes | Good add-on |
| Subscription tiers with included interviews | Predictable revenue, fits existing plan table | Unused quota resentment | **Primary** |
| Seat bundles | Matches the recruiter-seat model already in plans | Weak link to AI cost | Keep as is |
| Enterprise contract with usage cap | Needed for big employers (SSO, DPA, SLA) | Sales cycle | For `enterprise` |

## 5. Recommendation `[Decision]`

Keep the existing employer plans and add an **included-interviews allowance plus overage**, counted per *completed and scored* interview:

| Plan | Included completed AI interviews / month | Overage | Notes |
|---|---|---|---|
| free | 5 per month, text-only, max 1 active screen | not available (upgrade prompt) | Lets a small employer try the real product on real applicants; hard cap |
| standard (Rs 1,999) | 25 | Rs 49 each, bought as 25-packs (Rs 1,225) | |
| premium (Rs 4,999) | 100 | Rs 39 each, 100-packs (Rs 3,900) | auto-invite, bulk, CSV export |
| enterprise | contract (e.g. 1,000+/month) | negotiated | SSO, DPA, retention controls, audit export |

`[Assumption]` the numbers above are starting points. They imply a gross margin of about 60-80% on included volume at Base cost (Rs 10-20 vs an effective Rs 20-50 per interview) and above 70% on overage (Rs 39-49 vs Rs 10-20). Test willingness to pay with 5-10 pilot employers before fixing prices; the live-voice option, when it exists, is priced at roughly Rs 300-400 per interview or a higher tier.

Billing rules:
- **Charge only when scoring completes.** System-caused failures, `scoring_delayed` past 24 h, and the free technical-failure retake are not charged (the ledger writes a refund row).
- **Reservation:** inviting reserves one unit; expired, cancelled or declined invitations release it. A candidate who starts but abandons does not consume a unit unless an evaluation was produced.
- **Soft warning at 80% of the allowance, hard stop at 100%** unless overage or a pack is enabled; employers with auto-top-up set a monthly spend ceiling.
- **Free-tier abuse safeguards:** one free plan per verified company (existing KYC/verification flow, `employer_verification`), daily invite cap, template-generation cap.

## 6. Metering and entitlements (design)

- Populate `subscription_plans.features.ai_interviews` (see Architecture §3.1); resolve entitlements in one `get_entitlements(company)` helper that also honours subscription status (`require_active_employer_subscription` exists but is unused here, Audit B3).
- `ai_usage_ledger` is the single source of truth: `reserve`, `consume`, `refund`, `adjust` rows with an idempotency key; `company_ai_quota` holds the current period balance with row-level locking.
- Every LLM/STT/TTS call already writes `model_runs`; join to `ai_usage_ledger` by session to compute real cost per interview, per company, per prompt version.
- Admin cost dashboard: spend vs revenue per company, and an alert when a company's cost exceeds N% of its plan revenue or any day exceeds the global cap.
- Overage and invoices: use existing Razorpay integration for packs and subscriptions (verify it works for employers, since `razorpay_plan_id` is empty on the employer plans); GST invoicing handled by the existing payments module `[Assumption]`.

## 7. Safeguards against unexpected AI cost

Per-interview token budget with automatic abort-and-flag; per-company daily cap; global daily spend cap with a kill switch; template generation and preview rate limits; cached TTS; model routing (cheaper model for extraction if the golden set allows); circuit breakers so retries do not loop; alert on cost per interview exceeding 3x the rolling median.

## 8. Value metrics shown to employers

- **Recruiter time saved** = completed interviews x average recruiter first-round time (employer-configurable, default 20 minutes) minus review time (measured by scorecard dwell); presented as an estimate with its assumptions.
- Completion rate, median completion time, time-to-shortlist, share of candidates reaching "recommended" per job.
- **Recruiter agreement rate** with AI recommendation (decisions matching category) and **override rate**, which is also our quality signal.
- Cost per completed interview in the employer's own terms (included vs overage) and per shortlisted candidate.
- Screening-quality indicator from calibration: only shown when a role family has passed validation; never a single "accuracy" number.

## 9. Risks and open items

1. Prices above are unvalidated. Willingness to pay must be tested.
2. Provider prices change (Research §9 notes upcoming rate changes on 1 Jan 2027); keep a config-driven price table and re-run the unit-economics query monthly from the ledger.
3. Legal/compliance work (counsel, DPA, any bias audit) is a fixed cost not included in unit cost.
4. If employers demand live voice or ATS connectors, the cost base and the price point change materially.
5. Free-tier LLM keys must not process real candidate data (Research §9); budget for paid-tier keys from the pilot onward.
