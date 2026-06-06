# Module 02 — Onboarding & Psychological Assessment

**Phase:** MVP  
**Status:** ✅ Complete  
**Built on:** 2026-05-15

---

## What This Module Does

Module 02 is the data foundation every other DISHA module depends on. It captures a complete picture of the user's background, mindset, and goals across 7 guided steps:

- **Step 1 — Personal info** — Name, date of birth, gender, city, state
- **Step 2 — Education** — Highest qualification, degree, field, institution, graduation year
- **Step 3 — UPSC journey** — Exam type, years preparing, attempts, highest stage cleared, optional subject
- **Step 4 — Work experience** — Whether they've worked before, domain, years, last designation
- **Step 5 — Skills** — Up to 10 UPSC-relevant skills from a fixed list of 21
- **Step 6 — Career preferences** — Preferred sectors, locations, relocation openness, salary range
- **Step 7 — Psychological assessment** — Burnout level, confidence, financial pressure, risk tolerance, motivation type, identity attachment, support system
- **Groq AI insight** — After step 7, DISHA generates a personalised 2–3 sentence welcome message using the Groq API
- **KRS auto-trigger** — After step 7, the KRS score (Knowledge × Readiness × Skill) is computed and stored automatically

---

## Why These Decisions Were Made

| Decision | Reason |
|----------|--------|
| **7 steps instead of one long form** | Completion rates are higher when progress is visible. Each step is focused and feels achievable. |
| **Psychological assessment as the final step** | The psychological state data transforms the KRS R-score from a generic formula into a personalised readiness measure. It must come last so all context is available when Groq generates the insight. |
| **Option labels map to numeric scores, not stored as-is** | `burnout_level: "exhausted"` is human-readable; the KRS engine needs `burnout_score: 70`. The mapping is done in the service, not the model. |
| **`is_completed` only set on step 7** | All 6 earlier steps set `current_step` to advance the wizard but leave `is_completed=False`. The `OnboardingGate` in React uses this to block access to the dashboard. |
| **Groq called synchronously before DB commit** | The insight is stored with the assessment record. If Groq fails (timeout, rate limit), the service logs a warning and returns `disha_insight=null` — onboarding still completes. |
| **KRS triggered automatically at end of step 7** | Users should see their score on first dashboard load without any extra action. Failure is non-fatal (logged, not raised). |
| **`setQueryData` not `invalidateQueries` in the frontend** | `invalidateQueries` marks the cache stale and fires a background refetch, but navigation happens immediately with the stale `is_completed=false` value — causing `OnboardingGate` to redirect back to step 1. `setQueryData` updates the cache synchronously before navigation. |
| **Psychology step handles its own navigation** | Step 7 needs to show the InsightCard before navigating to the dashboard. The generic `useStepMutation` hook skips navigation for `nextStep === 'done'` steps so the component can control the flow. |
| **Raw SQL for the psychological assessments migration** | SQLAlchemy fires `_on_table_create` events for `sa.Enum` columns even when `create_type=False`, causing `DuplicateObject` errors if the enum already exists. Writing the `CREATE TABLE` as raw `op.execute(sa.text(...))` bypasses SQLAlchemy's type machinery entirely. |

---

## Files Created / Modified

### Backend

```
backend/
├── app/
│   ├── config.py                        ← Added groq_api_key field
│   ├── models/
│   │   └── user.py                      ← Added 4 enum types, PsychologicalAssessment model,
│   │                                        psychological_assessment relationship on User
│   └── modules/
│       └── onboarding/
│           ├── schemas.py               ← All 7 step request schemas + StepSavedResponse
│           ├── service.py               ← All 8 service functions + _call_groq_insight()
│           └── router.py                ← All 8 endpoints
│
├── alembic/
│   └── versions/
│       └── i8d9e0f1g2h3_add_psychological_assessments.py  ← New migration
│
└── .env                                 ← Added GROQ_API_KEY
```

### Frontend

```
frontend/src/
├── types/
│   └── index.ts                         ← Added 7 psychological assessment types +
│                                            disha_insight to StepSavedResponse
├── api/
│   └── onboarding.ts                    ← Added PsychologyPayload + savePsychology()
├── layouts/
│   └── OnboardingLayout.tsx             ← Updated step count from 6 to 7 (added 'Mindset')
├── modules/onboarding/
│   ├── hooks/
│   │   └── useOnboarding.ts             ← Fixed stale-cache redirect bug; added psychology mutation
│   └── pages/
│       ├── Step6Preferences.tsx         ← Changed submit button from "Complete profile 🎉" to "Continue →"
│       └── Step7Psychology.tsx          ← NEW — psychological assessment + InsightCard
└── App.tsx                              ← Added Step7Psychology import + /app/onboarding/step/7 route
```

---

## Database Tables

### `aspirant_profiles` (extended)

The existing `aspirant_profiles` table from the initial setup gains these columns used by the onboarding wizard. The `current_step` and `is_completed` columns track wizard progress.

| Column | Type | Notes |
|--------|------|-------|
| current_step | INTEGER | 1–7, incremented on each step save |
| is_completed | BOOLEAN | Set to true only after step 7 |
| full_name | VARCHAR | Step 1 |
| date_of_birth | DATE | Step 1 |
| gender | ENUM | Step 1 |
| city / state | VARCHAR | Step 1 |
| highest_qualification | ENUM | Step 2 |
| degree / field_of_study / institution | VARCHAR | Step 2 |
| graduation_year | INTEGER | Step 2 |
| upsc_exam | ENUM | Step 3 |
| years_preparing / upsc_attempts | INTEGER | Step 3 |
| highest_stage_cleared | ENUM | Step 3 |
| optional_subject | VARCHAR NULL | Step 3 |
| has_work_experience | BOOLEAN | Step 4 |
| work_experience_years / domain / last_designation | mixed | Step 4, nullable if no work experience |
| skills | JSONB (string array) | Step 5, max 10 items |
| preferred_sectors | JSONB (string array) | Step 6 |
| preferred_locations | JSONB (string array) | Step 6 |
| open_to_relocation | BOOLEAN | Step 6 |
| expected_salary_min / max | INTEGER | Step 6, in LPA |

### `psychological_assessments` (new)

One row per user. Upserted on each step 7 submission.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | `gen_random_uuid()` |
| user_id | UUID FK → users | UNIQUE, CASCADE DELETE, indexed |
| burnout_score | INTEGER | 15 / 40 / 70 / 90 mapped from burnout_level |
| confidence_index | INTEGER | 85 / 65 / 40 / 20 mapped from confidence_level |
| financial_pressure_score | INTEGER | 10 / 35 / 65 / 90 mapped from financial_pressure |
| risk_tolerance | ENUM | `low`, `medium`, `high` |
| motivation_type | ENUM | `intrinsic`, `extrinsic`, `mixed` |
| identity_attachment | ENUM | `low`, `medium`, `high` |
| support_system | ENUM | `strong`, `moderate`, `weak` |
| disha_insight | TEXT NULL | Groq-generated personalised message |
| created_at / updated_at | TIMESTAMPTZ | Auto-managed |

**Score mapping for numeric fields:**

| User selects | burnout_score | confidence_index | financial_pressure_score |
|---|---|---|---|
| fresh / very_confident / no_rush | 15 | 85 | 10 |
| somewhat_tired / reasonably_confident / some_pressure | 40 | 65 | 35 |
| exhausted / somewhat_unsure / significant_pressure | 70 | 40 | 65 |
| burnt_out / very_anxious / urgent | 90 | 20 | 90 |

---

## API Endpoints

Base URL: `http://localhost:8000/api`  
All endpoints require `Authorization: Bearer <access_token>` and the user must have a verified phone.

### GET `/onboarding/status`
Returns the user's current wizard position. Called by `OnboardingGate` on every protected route to decide whether to allow access to the dashboard.

**Success (200):**
```json
{
  "current_step": 4,
  "is_completed": false,
  "profile": null
}
```

---

### PUT `/onboarding/personal`
Saves step 1 data. Sets `current_step = 2` if not already past it.

**Request:**
```json
{
  "full_name": "Arjun Sharma",
  "date_of_birth": "1996-08-22",
  "gender": "male",
  "city": "Allahabad",
  "state": "Uttar Pradesh"
}
```

**Success (200):**
```json
{ "message": "Personal info saved", "current_step": 2, "is_completed": false }
```

---

### PUT `/onboarding/education`
Saves step 2 data. Sets `current_step = 3`.

**Request:**
```json
{
  "highest_qualification": "post_graduate",
  "degree": "MA",
  "field_of_study": "Political Science",
  "institution": "JNU",
  "graduation_year": 2019
}
```

---

### PUT `/onboarding/upsc-journey`
Saves step 3 data. Sets `current_step = 4`.

**Request:**
```json
{
  "upsc_exam": "cse",
  "years_preparing": 4,
  "upsc_attempts": 3,
  "highest_stage_cleared": "mains",
  "optional_subject": "Public Administration"
}
```

---

### PUT `/onboarding/work-experience`
Saves step 4 data. Sets `current_step = 5`. If `has_work_experience` is false, domain/years/designation are set to null regardless of what is sent.

**Request:**
```json
{
  "has_work_experience": true,
  "work_experience_years": 2,
  "work_experience_domain": "Education & Training",
  "last_designation": "Content Writer"
}
```

---

### PUT `/onboarding/skills`
Saves step 5 data. Sets `current_step = 6`. Accepts 1–10 skills from the allowed set of 21.

**Request:**
```json
{
  "skills": ["Essay Writing", "Polity & Governance", "Research & Analysis", "Leadership"]
}
```

---

### PUT `/onboarding/preferences`
Saves step 6 data. Sets `current_step = 7`. Does **not** complete onboarding.

**Request:**
```json
{
  "preferred_sectors": ["Management Consulting", "Think Tanks & Policy"],
  "preferred_locations": ["Delhi", "Bangalore"],
  "open_to_relocation": true,
  "expected_salary_min": 10,
  "expected_salary_max": 20
}
```

---

### PUT `/onboarding/psychology`
Saves step 7 data. Sets `is_completed = true`. Triggers Groq insight generation and KRS computation.

**Request:**
```json
{
  "burnout_level": "exhausted",
  "confidence_level": "reasonably_confident",
  "financial_pressure": "some_pressure",
  "risk_tolerance": "medium",
  "motivation_type": "mixed",
  "identity_attachment": "medium",
  "support_system": "strong"
}
```

**Success (200):**
```json
{
  "message": "Onboarding complete!",
  "current_step": 7,
  "is_completed": true,
  "disha_insight": "You've carried the weight of four years of preparation with extraordinary discipline — that doesn't disappear when the exam chapter closes. With your Mains experience and your genuine drive for both purpose and impact, the management consulting and policy world has real room for someone like you. Trust that your UPSC preparation didn't just prepare you for a job; it prepared you for a career worth having."
}
```

**Notes:**
- If Groq is unavailable or times out, `disha_insight` is `null` — onboarding still completes
- KRS computation failure is also non-fatal (logged as warning)

---

## Groq API Integration

**Where it's used:** `backend/app/modules/onboarding/service.py` → `_call_groq_insight()` function, called at the start of `save_psychology()`.

**Purpose:** After the user completes all 7 steps, DISHA generates a warm, personalised 2–3 sentence welcome message that acknowledges the specific user's UPSC journey and psychological state. This is shown as the "DISHA says" card on the frontend before the user is taken to the dashboard.

**Model:** `llama-3.1-8b-instant` via `https://api.groq.com/openai/v1/chat/completions`

**Prompt structure:**
```
You are DISHA AI — a compassionate, deeply human career counsellor for UPSC aspirants
transitioning into private sector roles. You understand the psychological weight of this journey.

A user has just completed their onboarding. Write a warm, grounding, personalised 2–3 sentence
welcome message. Be specific to their journey — not generic. No bullet points. Second person only.

UPSC: cse, 3 attempt(s), highest stage: mains, prepared for 4 year(s).
Education: post_graduate in Political Science.
Work: 2 years in Education & Training.
Skills: Essay Writing, Polity & Governance, Research & Analysis.
Interested in: Management Consulting, Think Tanks & Policy.
Psychological state: exhausted burnout, reasonably confident about transition, some financial pressure.
Motivation: mixed. Support system: strong.

Write the message now:
```

**Config:** `GROQ_API_KEY` in `.env` → `settings.groq_api_key` in `app/config.py`. Max tokens: 180. Temperature: 0.75. Timeout: 20 seconds.

**Failure handling:** Any exception (network error, timeout, invalid key, rate limit) is caught, logged as a warning, and returns an empty string. The frontend shows the InsightCard only when `disha_insight` is non-null.

---

## KRS Score Impact

Module 02 extends the KRS R-score (Readiness) with psychological data.

**Without psychological assessment** (steps 1–6 only):
```
R-score = (years_preparing × 5 + attempts × 10 + stage_bonus + work_bonus) / 95
```

**With psychological assessment** (after step 7):
```
psych_bonus = (confidence_index × 0.6 + (100 - burnout_score) × 0.4) × 0.30
R-score = (base_r + psych_bonus) / 125
```

A user who is very confident (`confidence_index=85`) and not burnt out (`burnout_score=15`) gains up to 30 additional R-points. The ceiling is raised from 95 to 125 to preserve the 0–100 output range.

**Module 02 also provides:**
- `K-score` input: `skills` array → up to 75 points via skill weights defined in KRS module
- `S-score` input: `preferred_sectors`, `work_experience_domain` → sector alignment score

---

## Frontend Flow

```
/auth/login (or /auth/verify)
  ↓ authenticated
/app/onboarding/step/1  ← Personal info
  ↓
/app/onboarding/step/2  ← Education
  ↓
/app/onboarding/step/3  ← UPSC journey
  ↓
/app/onboarding/step/4  ← Work experience
  ↓
/app/onboarding/step/5  ← Skills
  ↓
/app/onboarding/step/6  ← Career preferences
  ↓
/app/onboarding/step/7  ← Mindset & readiness
  ↓ (API returns disha_insight)
[InsightCard shown] "DISHA says…"
  ↓ user clicks "Go to my dashboard"
/app/dashboard
```

**Gate logic (`App.tsx`):**
- `OnboardingGate` wraps `/app/dashboard`
- Calls `useOnboardingStatus()` — GET `/onboarding/status`
- If `is_completed=false` → redirects to `/app/onboarding/step/<current_step>`
- If `is_completed=true` → renders dashboard

**Cache fix (`useOnboarding.ts`):**  
After each step mutation succeeds, `queryClient.setQueryData()` updates the onboarding status cache synchronously with `{ current_step, is_completed }` from the API response. This prevents the race condition where `OnboardingGate` reads stale `is_completed=false` data during a background refetch and redirects back to step 1.

---

## Psychological Assessment Questions (Step 7)

| Question | Field | Options |
|----------|-------|---------|
| How drained do you feel from your UPSC journey? | `burnout_level` | fresh, somewhat_tired, exhausted, burnt_out |
| How confident are you about transitioning to private sector? | `confidence_level` | very_confident, reasonably_confident, somewhat_unsure, very_anxious |
| How much financial pressure are you under? | `financial_pressure` | no_rush, some_pressure, significant_pressure, urgent |
| How do you feel about taking risks for career growth? | `risk_tolerance` | low, medium, high |
| What motivates you more? | `motivation_type` | intrinsic, extrinsic, mixed |
| How attached are you to your identity as a 'UPSC aspirant'? | `identity_attachment` | low, medium, high |
| How strong is your support system? | `support_system` | strong, moderate, weak |

---

## Running Migrations

```bash
# Apply the psychological assessments migration
docker compose exec backend alembic upgrade head

# Check current state
docker compose exec backend alembic current

# Roll back if needed
docker compose exec backend alembic downgrade -1
```

---

## Environment Variables Added

```env
# .env
GROQ_API_KEY=gsk_...your_key_here...
```

After adding a new env var, containers must be **recreated** (not just restarted) to pick it up:

```bash
docker compose up -d --force-recreate backend
```

---

## Testing the Full Flow (curl)

```bash
# 1. Get a token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","password":"Disha@2024"}' | jq -r '.access_token')

# 2. Step 7 — psychological assessment
curl -s -X PUT http://localhost:8000/api/onboarding/psychology \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "burnout_level": "somewhat_tired",
    "confidence_level": "reasonably_confident",
    "financial_pressure": "some_pressure",
    "risk_tolerance": "medium",
    "motivation_type": "mixed",
    "identity_attachment": "medium",
    "support_system": "strong"
  }' | jq .

# Expected: is_completed=true, disha_insight contains a personalised message
```
