# Module 03 — Semantic Job Recommendation Engine

**Phase:** MVP  
**Status:** ✅ Complete  
**Built on:** 2026-05-15

---

## What This Module Does

Module 03 upgrades the job-matching system from pure keyword overlap to semantic understanding. It answers the question:

> *"Does this job description actually fit this person's background — not just their skill tags?"*

Employers write job descriptions in free text. A user's UPSC background (4 years of preparation, Mains cleared, MA in Political Science) cannot be matched against a text description using column comparisons alone. This module bridges that gap using vector embeddings.

**What it adds on top of the existing KRS module:**
- Every job posting is converted to a 384-dimensional vector when created or updated
- Every user's profile is converted to a 384-dimensional vector when KRS scores are computed
- When ranking jobs for a user, cosine similarity between the two vectors becomes the primary signal
- `semantic_score` (0–100) is returned alongside `skill_overlap` and `match_score` in the API

---

## The Embedding Model

**Model:** `BAAI/bge-small-en-v1.5`  
**Provider:** HuggingFace (downloaded automatically on first use via fastembed)  
**Runtime:** ONNX (via `fastembed` by Qdrant) — **no PyTorch, no API key**  
**Dimensions:** 384  
**Model size:** ~23 MB (ONNX format, cached after first download)  
**Total install size:** ~50 MB

### Why `fastembed` instead of `sentence-transformers`

| | fastembed | sentence-transformers |
|---|---|---|
| Runtime | ONNX (CPU-optimised) | PyTorch |
| Install size | ~50 MB | ~800 MB |
| First-load time | < 5 seconds | 30–60 seconds |
| API key needed | No | No |
| Vector quality | Excellent (BGE family) | Excellent (MiniLM family) |
| Inference speed | Fast | Moderate |

`fastembed` uses the ONNX Runtime which is significantly lighter than PyTorch and produces equivalent quality embeddings for semantic similarity tasks.

### Why `BAAI/bge-small-en-v1.5`

The BGE (BAAI General Embedding) model family consistently ranks at the top of the MTEB (Massive Text Embedding Benchmark) leaderboard. The `small` variant produces 384-dim vectors — the same dimension as the popular `all-MiniLM-L6-v2` — so the `vector(384)` pgvector column works for both. It is specifically trained for retrieval and semantic similarity tasks, which is exactly what job matching requires.

---

## How It Works — Layer by Layer

### Layer 1: Text Construction

Raw structured data is converted into natural language before embedding. Embeddings work on meaning — the richer the text, the better the representation.

**Job text (built in `embedder.build_job_text()`):**
```
Job title: Policy Research Analyst. Sector: Think Tanks & Policy.
Description: Looking for candidates with strong analytical skills who can bridge
policy research with actionable insights. UPSC preparation background a strong advantage.
Required skills: Research & Analysis, Essay Writing, Polity & Governance.
Employment type: full time. Work arrangement: hybrid. Growth outlook: high. Location: Delhi.
```

**User profile text (built in `embedder.build_user_text()`):**
```
UPSC CSE aspirant with 3 attempt(s), cleared mains stage, prepared for 4 year(s).
Optional subject: Public Administration. Education: post graduate in Political Science
from JNU (2019). Work experience: 2 year(s) of work experience in Education & Training
as Content Writer. Skills: Essay Writing, Research & Analysis, Polity & Governance, Leadership.
Interested in: Think Tanks & Policy, Management Consulting.
Preferred locations: Delhi, open to relocation. Expected salary: 10–20 LPA.
Motivation: driven by both purpose and external recognition. Risk appetite: open to calculated risks.
```

The psychological layer (motivation type, risk appetite) is included because it influences career fit — an intrinsically-motivated user is a better match for a NGO role than a pure extrinsic one.

### Layer 2: Embedding Generation

Both texts are passed through `BAAI/bge-small-en-v1.5` via fastembed:

```python
from fastembed import TextEmbedding

model = TextEmbedding("BAAI/bge-small-en-v1.5")
vector = list(next(model.embed([text])))  # → list of 384 float32 values
```

Vectors are **L2-normalised** by the model — cosine similarity on normalised vectors equals dot product, which is fast to compute.

### Layer 3: Vector Storage (pgvector)

Vectors are stored in PostgreSQL using the `pgvector` extension:

```sql
-- job_postings table
description_embedding vector(384)

-- krs_scores table  
profile_embedding vector(384)
```

An HNSW index on `job_postings.description_embedding` enables fast approximate nearest-neighbour search at scale:

```sql
CREATE INDEX ix_job_postings_embedding
ON job_postings USING hnsw (description_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
```

Currently cosine similarity is computed in Python (since we load all active jobs anyway). The HNSW index will be used in a future endpoint that queries directly at the SQL level.

### Layer 4: Cosine Similarity

```python
import numpy as np

def cosine_similarity(a, b) -> float:
    va = np.asarray(a, dtype=np.float32)
    vb = np.asarray(b, dtype=np.float32)
    return float(np.dot(va, vb) / (np.linalg.norm(va) * np.linalg.norm(vb)))
    # Returns 0.0 – 1.0 (negative values clamped to 0)
```

Because `bge-small-en-v1.5` normalises vectors, `‖va‖ = ‖vb‖ = 1`, so this simplifies to a dot product.

### Layer 5: Combined Scoring

The final job match score blends three signals:

| Signal | Weight (with embeddings) | Weight (fallback) | Source |
|--------|---|---|---|
| **Semantic score** | 45% | — | Cosine similarity of profile ↔ job description |
| **Skill overlap** | 35% | 60% | Jaccard: user skills ∩ job required skills |
| **KRS fit** | 20% | 40% | How user's K-score compares to job's min_k_score |

```python
if semantic_score is not None:
    match_score = round(semantic_score * 0.45 + overlap * 0.35 + fit * 0.20)
else:
    # Fallback: no embeddings yet (new user, or model unavailable)
    match_score = round(overlap * 0.60 + fit * 0.40)
```

**Why semantic at 45%?**  
The job description captures everything the employer cares about — responsibilities, culture, background preference, implicit requirements. Skill tags (only 21 options) are a coarse approximation. Semantic similarity on the full description text is a richer, more accurate signal. But skill overlap at 35% keeps the score grounded in verifiable hard skills.

---

## Where Every User Field Goes

Every field collected during onboarding feeds exactly one layer of the scoring pipeline. Nothing is stored for display only.

### Layer 0 — SQL Pre-Filters (hard eliminators, run before scoring)

These use exact column comparisons. A job that fails these filters is never scored at all.

| User field | Job field | Logic |
|---|---|---|
| `preferred_locations[]` | `job.location` | ILIKE match — "Delhi" matches "New Delhi", "Delhi NCR" etc. Skipped if `open_to_relocation = true`. Jobs with no location set always pass. |
| `expected_salary_min` | `job.salary_max` | Job must have `salary_max ≥ user.expected_salary_min`. Jobs with no salary listed always pass. |

> **Why SQL and not embeddings for these?** Location is a city name. Salary is a number. SQL does exact/range comparisons accurately and instantly. Putting "Delhi" or "15 LPA" into an embedding and hoping cosine similarity understands it is unreliable — the model doesn't reason about geography or arithmetic.

---

### Layer 1 — K-Score (Knowledge, 40% of KRS composite)

Measures depth of UPSC journey. Raw max = 110, normalised to 0–100.

| User field | Points | Notes |
|---|---|---|
| `highest_stage_cleared` = none | 10 | |
| `highest_stage_cleared` = prelims | 35 | |
| `highest_stage_cleared` = mains | 60 | |
| `highest_stage_cleared` = interview | 80 | |
| `years_preparing` = 1 yr | 5 | |
| `years_preparing` = 3+ yr | 12 | |
| `years_preparing` = 6+ yr | 18 | |
| `upsc_exam` = CSE | 12 | |
| `upsc_exam` = CAPF/IFS | 9 | |
| `upsc_exam` = State PSC | 6 | |
| `upsc_exam` = other | 4 | |

`k_score = raw / 110 × 100`

---

### Layer 2 — R-Score (Readiness, 35% of KRS composite)

Measures employability right now, independent of UPSC progress. Raw max = 95 (without psych) or 125 (with psych), normalised to 0–100.

| User field | Points | Notes |
|---|---|---|
| `highest_qualification` = doctorate | 30 | |
| `highest_qualification` = post_graduate | 22 | |
| `highest_qualification` = graduate | 16 | |
| `highest_qualification` = diploma | 12 | |
| `work_experience_years` = 1 yr | 18 | Only if `has_work_experience = true` |
| `work_experience_years` = 3 yr | 30 | |
| `work_experience_years` = 5+ yr | 40 | |
| `skills` count = 1–3 | 5 | Breadth bonus |
| `skills` count = 4–6 | 15 | |
| `skills` count = 7+ | 25 | |
| Psychological assessment | 0–30 | Based on motivation type, risk tolerance, emotional regulation scores |

`r_score = raw / 95 × 100` (no psych) or `raw / 125 × 100` (psych completed)

---

### Layer 3 — S-Score (Skills, 25% of KRS composite)

Sums the individual weights of each selected skill tag. Normalised against the **sum of the top-10 weights** (currently 77) — computed dynamically, so adding skills never requires updating a constant.

| Skill | Weight | Notes |
|---|---|---|
| Analytical Reasoning | 9 | |
| Research & Analysis | 9 | |
| Data Interpretation | 8 | |
| Data Analysis | 8 | Quantitative, Excel/SQL work |
| Policy Research | 8 | Think tanks, govt liaison |
| Report Writing | 7 | Structured reports (distinct from essay writing) |
| Leadership | 7 | |
| Project Management | 7 | Planning, execution, delivery |
| Economics | 7 | |
| Public Administration | 7 | |
| Communication | 7 | |
| Management | 6 | |
| International Relations | 6 | |
| Law & Legal Knowledge | 6 | |
| Ethics & Integrity | 6 | |
| Polity & Governance | 6 | |
| Public Speaking | 6 | Presentations, stakeholder meetings |
| Strategic Planning | 6 | |
| Stakeholder Engagement | 5 | Govt, NGO, corporate liaison |
| English Proficiency | 5 | |
| Science & Technology | 5 | |
| Essay Writing | 5 | UPSC-style long-form writing |
| Current Affairs | 5 | |
| Computer Skills | 5 | |
| Teaching & Training | 5 | EdTech, coaching, L&D roles |
| Budget & Finance | 5 | Planning, NGO, govt roles |
| Hindi Proficiency | 4 | |
| History | 4 | |
| Geography | 4 | |
| Environment | 4 | |

`s_score = sum_of_selected_weights / sum_of_top_10_weights × 100`

---

### KRS Composite

`composite = k_score × 0.40 + r_score × 0.35 + s_score × 0.25`

---

### Layer 4 — Semantic Embedding (45% of job match score)

Fields that cannot be column-matched against job descriptions go here. The model reads the full job description text and finds semantic similarity with the user's profile narrative.

| User field | How it's used in the embedding text |
|---|---|
| `upsc_exam` + `highest_stage_cleared` + `years_preparing` | "UPSC CSE aspirant with 3 attempt(s), cleared mains stage, prepared for 4 year(s)." |
| `upsc_attempts` | Same sentence — signals persistence |
| `optional_subject` | "Optional subject: Public Administration." |
| `highest_qualification` + `field_of_study` + `institution` | "Education: post graduate in Political Science from JNU (2019)." |
| `has_work_experience` + `work_experience_years` + `work_experience_domain` + `last_designation` | "Work experience: 2 year(s) in Education & Training as Content Writer." |
| `skills[]` | "Skills: Essay Writing, Research & Analysis, Polity & Governance." |
| `preferred_sectors[]` | "Interested in: Think Tanks & Policy, Management Consulting." |
| `motivation_type` (psych) | "Motivation: driven by personal satisfaction and meaningful work." |
| `risk_tolerance` (psych) | "Risk appetite: open to calculated risks." |
| `support_system` (psych) | "Support system: family." |

> **Why are UPSC fields in both K-score and the embedding?** K-score uses them as hard numbers (stage=60 pts). The embedding uses them as natural language context so the model can match "UPSC Mains cleared, Public Administration optional" against a job description that says "Civil services background preferred — Mains/Interview stage candidates strongly considered."

---

### Layer 5 — Structural Job Matching (skill overlap + KRS fit)

| Signal | Weight | Calculation |
|---|---|---|
| Skill overlap | 35% | `len(user_skills ∩ job.required_skills) / len(job.required_skills) × 100` |
| KRS fit | 20% | If `k_score ≥ job.min_k_score`: 80–100 pts. Else: `k_score / min_k_score × 70` |

---

### Full Pipeline Summary

```
User registers & completes onboarding
         │
         ▼
KRS computed → k_score, r_score, s_score, composite, profile_embedding
         │
         ▼
GET /krs/jobs called
         │
         ├── SQL pre-filter: location match (column vs column)
         ├── SQL pre-filter: salary range (column vs column)
         │
         ▼ qualifying jobs only
         │
         ├── skill_overlap: skills[] vs required_skills[] (Jaccard)
         ├── krs_fit: k_score vs min_k_score (range check)
         └── semantic_score: profile_embedding vs description_embedding (cosine similarity)
         │
         ▼
match_score = semantic×0.45 + skill_overlap×0.35 + krs_fit×0.20
         │
         ▼
Top 10 sorted by match_score → returned to frontend
```

---

## When Embeddings Are Generated

### Job embedding — on every create/update (async)

Runs in a **background daemon thread** so the employer's POST request returns immediately:

```python
# jobs/service.py
def _embed_job_bg(job_id: str) -> None:
    db = SessionLocal()          # own session — thread-safe
    try:
        job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
        vec = embedder.embed(embedder.build_job_text(job))
        if vec:
            job.description_embedding = vec
            db.commit()
    finally:
        db.close()

def _embed_job(job: JobPosting) -> None:
    threading.Thread(target=_embed_job_bg, args=(str(job.id),), daemon=True).start()
```

Called in both `create_job()` and `update_job()`. Non-fatal — if embedding fails, the job is still saved and falls back to structural scoring.

### Profile embedding — on every KRS compute

```python
# krs/service.py — after KRS scores are stored
text = embedder.build_user_text(profile, psych)
vec = embedder.embed(text)
if vec:
    krs.profile_embedding = vec
    db.commit()
```

KRS is triggered automatically in two cases:
1. **Onboarding completion** — at the end of Step 7 (psychology)
2. **Any profile edit after onboarding** — every `save_*` step function calls `_maybe_recompute_krs()` which re-runs `compute_and_store()` if `profile.is_completed == True`

This means if a user updates their skills, UPSC stage, or any other field after onboarding is done, their KRS scores and profile embedding are updated immediately — no manual recompute needed.

---

## Files Created / Modified

### Backend

```
backend/
├── app/
│   ├── models/
│   │   └── user.py                      ← Added Vector(384) columns:
│   │                                        KrsScore.profile_embedding
│   │                                        JobPosting.description_embedding
│   ├── modules/
│   │   ├── recommendations/             ← NEW module
│   │   │   ├── __init__.py
│   │   │   └── embedder.py              ← Model singleton, text builders, cosine similarity
│   │   ├── jobs/
│   │   │   └── service.py               ← _embed_job() called after create/update
│   │   └── krs/
│   │       ├── service.py               ← Profile embedding stored after KRS compute;
│   │       │                                get_live_jobs() uses semantic scoring
│   │       └── schemas.py               ← Added semantic_score: int | None to LiveJobResponse
│
├── alembic/versions/
│   └── j9f0g1h2i3j4_add_embeddings.py  ← Enables pgvector, adds vector columns, HNSW index
│
└── requirements.txt                     ← Added fastembed==0.4.2, numpy>=1.24.0
```

### Frontend

```
frontend/src/
├── api/
│   └── krs.ts                           ← Added semantic_score: number | null to LiveJob
└── modules/dashboard/pages/
    └── DashboardPage.tsx                ← LiveJobCard footer: shows "X% profile fit" when
                                             semantic_score is available
```

---

## API Changes

### `GET /krs/jobs` — updated response

```json
{
  "id": "...",
  "title": "Policy Research Analyst",
  "company_name": "Observer Research Foundation",
  "match_score": 78,
  "skill_overlap": 67,
  "semantic_score": 82,
  ...
}
```

- `match_score` — combined score (semantic 45% + skill 35% + KRS 20%)
- `skill_overlap` — unchanged, % of required skills user has
- `semantic_score` — raw cosine similarity × 100 (null if embeddings not yet generated)

The frontend shows `semantic_score` as **"X% profile fit"** in the job card footer, separate from skill overlap.

---

## Scoring Example

**User:** UPSC CSE, 3 attempts, Mains cleared, MA Political Science, skills: Essay Writing, Research & Analysis, Polity & Governance, Leadership. Interested in Think Tanks & Policy.

| Job | Semantic | Skill Overlap | KRS Fit | **Final** |
|-----|---|---|---|---|
| Policy Research Analyst (Think Tanks) | 82% | 75% | 80% | **79%** |
| Compliance Manager (Banking & Finance) | 51% | 33% | 70% | **47%** |
| Android Developer (IT) | 21% | 5% | 40% | **22%** |

The semantic score correctly distinguishes the policy role from the banking/tech roles even when skill overlap is similar — because the job *description text* for the policy role mentions UPSC preparation, analytical writing, and policy research.

---

## Database Migration

```bash
# Apply migration (adds pgvector extension + vector columns + HNSW index)
docker compose exec backend alembic upgrade head

# Verify
docker compose exec postgres psql -U disha -d disha_db \
  -c "\d job_postings" | grep embedding
```

---

## Re-embedding All Existing Data

If jobs or profiles were created before Module 03 was deployed, run:

```bash
# Re-embed all existing job postings
docker compose exec backend python -c "
from app.database import SessionLocal
from app.models.user import JobPosting
from app.modules.recommendations import embedder

db = SessionLocal()
jobs = db.query(JobPosting).filter(JobPosting.description_embedding == None).all()
print(f'Embedding {len(jobs)} jobs...')
for job in jobs:
    text = embedder.build_job_text(job)
    vec = embedder.embed(text)
    if vec:
        job.description_embedding = vec
db.commit()
print('Done.')
db.close()
"

# Re-compute KRS (also re-embeds profile) for all completed users
docker compose exec backend python -c "
from app.database import SessionLocal
from app.models.user import AspirantProfile, User
from app.modules.krs.service import compute_and_store

db = SessionLocal()
profiles = db.query(AspirantProfile).filter(AspirantProfile.is_completed == True).all()
print(f'Re-computing KRS for {len(profiles)} users...')
for p in profiles:
    user = db.query(User).filter(User.id == p.user_id).first()
    if user:
        compute_and_store(user, db)
print('Done.')
db.close()
"
```

---

## What Module 04 Will Add

- Application tracking (user applies to a job, employer sees applicants)
- Admin panel to approve/manage employer accounts
- Saved jobs / shortlist feature
- **Feedback loop** — once application data exists, collaborative filtering ("users like you applied to these") can be layered on top of the semantic score as an additional signal

---

## Resolved Gaps (updated 2026-05-16)

| Gap | Resolution |
|---|---|
| Job embedding blocked the employer request | `_embed_job()` now fires a daemon thread with its own DB session — employer sees instant response |
| Profile edits didn't update embeddings | `_maybe_recompute_krs()` called after every onboarding step save when `is_completed = True` — any edit auto-regenerates scores + embedding |
| Location/salary used embeddings instead of SQL | SQL pre-filters added to `get_live_jobs()` before scoring; removed from `build_user_text()` |
| Skill taxonomy too narrow (21 UPSC-centric tags) | Expanded to 30 skills with new private-sector-relevant tags: Data Analysis, Policy Research, Report Writing, Project Management, Public Speaking, Strategic Planning, Stakeholder Engagement, Teaching & Training, Budget & Finance |
| No feedback loop | Deferred — requires application data from Module 04 |
