# Module 04 — Career Mapping

**Phase:** MVP  
**Status:** ✅ Complete  
**Built on:** 2026-05-16

---

## What This Module Does

Module 04 gives aspirants a personalised career exploration layer on top of the KRS scores computed in Module 03. It answers two questions:

> *"Which career paths are the best fit for my UPSC background and skills?"*  
> *"For the paths I want to pursue, exactly which skills do I still need to build?"*

The KRS engine (Module 03) already computes a ranked list of career matches algorithmically. Module 04 adds **user agency** — the aspirant can browse all 20 tracks, understand why they match or don't, and explicitly choose up to 2 paths they intend to pursue. That choice then **changes behaviour across the app**:

- The dashboard pins their chosen paths at the top with a personalised gap analysis
- The skill-building nudge focuses on skills for their chosen tracks, not the algorithm's top pick
- Job recommendations give a +10 sector-match bonus to jobs that align with the chosen paths

---

## Career Track Catalogue

20 tracks are seeded in the database. Each track is defined by:

| Field | Type | Purpose |
|---|---|---|
| `slug` | unique string | URL identifier (e.g. `policy-research-consulting`) |
| `title` | string | Human-readable track name |
| `description` | text | 2–3 sentence explanation, written to speak directly to UPSC aspirants |
| `sector` | string | Broad sector label used for job-boost matching |
| `required_skills` | JSONB `string[]` | Subset of the 30-skill master list |
| `min_k_score` | int | Recommended minimum K-score (0 = anyone, 35 = Prelims cleared, etc.) |
| `salary_range` | string | Indicative range e.g. "8–20 LPA" |
| `growth_outlook` | string | `"high"`, `"medium"`, or `"low"` |
| `example_roles` | JSONB `string[]` | 4 concrete job titles within the track |

### The 12 tracks seeded in Module 04

| Track | Sector | Min K | Salary |
|---|---|---|---|
| Policy Research & Consulting | Consulting | 35 | 10–22 LPA |
| CSR & Social Impact | NGO / Corporate | 15 | 6–14 LPA |
| Education & EdTech | Education | 0 | 5–15 LPA |
| Legal & Compliance | Legal / Finance | 35 | 8–20 LPA |
| Data Analytics & Research | Technology / Research | 0 | 8–18 LPA |
| Journalism & Media | Media | 15 | 4–12 LPA |
| NGO & Development Sector | Development | 0 | 4–12 LPA |
| Banking & Finance | Banking / Finance | 25 | 8–20 LPA |
| Project Management & Infrastructure | Infrastructure | 25 | 10–25 LPA |
| Healthcare Administration | Healthcare | 15 | 6–15 LPA |
| Corporate Affairs & Public Relations | Corporate | 25 | 8–18 LPA |
| Human Resources & Learning Development | HR / L&D | 0 | 5–14 LPA |

> 8 additional tracks were pre-seeded in earlier dev sessions (migration `c3d4e5f6a7b8`). Total: 20 tracks. `ON CONFLICT (slug) DO NOTHING` in the Module 04 migration prevents duplicates.

---

## How Match Scores Work

### Track match score (computed by Module 03's KRS engine)

```
match_score = skill_overlap × 0.60 + krs_fit × 0.40
```

| Component | Calculation |
|---|---|
| **skill_overlap** | `len(user_skills ∩ track.required_skills) / len(track.required_skills) × 100` |
| **krs_fit** | If `k_score ≥ track.min_k_score`: 80–100 (with bonus for exceeding). Else: `k_score / min_k_score × 70` |

These scores are stored in the `career_matches` table and recomputed every time KRS runs (onboarding completion or any profile edit).

> Track matching uses a **simpler formula than job matching** (no semantic layer) because career tracks have short `required_skills` lists — there is not enough free text to warrant embeddings. The skill-overlap + KRS-fit formula is precise for this use case.

---

## Gap Analysis

For each career track, the module computes two lists from the user's current skills:

```python
user_skills  = set(profile.skills or [])
required     = set(track.required_skills or [])

skills_you_have     = sorted(user_skills & required)   # intersection
skills_to_develop   = sorted(required - user_skills)   # difference
```

These are returned in `TrackDetailResponse` and also in `CareerMatchResponse` (as `skills_to_develop`) when the track appears on the dashboard.

---

## Career Path Selection

### The rule: max 2

Each user can choose at most 2 career tracks to pursue. This is enforced in `careers/service.py`:

```python
if len(existing) >= 2:
    raise ValueError("You can select at most 2 career tracks...")
```

The frontend prevents the action at the UI level (the button is disabled when 2 are already selected), but the backend enforces it independently.

### What selection changes

Selecting a track is not just a bookmark. It modifies three things downstream:

#### 1. Dashboard — chosen paths pinned at top

`GET /krs/dashboard` fetches `UserCareerSelection` rows for the user. Selected tracks appear in `selected_tracks[]` at the top of the response, each with full gap analysis (`skills_to_develop`).

The frontend renders them in a distinct "Your chosen paths" section above the algorithm's top matches, with a blue border to distinguish them visually.

#### 2. Skill nudge — focused on chosen paths

```python
# krs/service.py — get_dashboard()
if selected_tracks:
    # Union of gap skills across both selected tracks, capped at 5
    gap_set = set()
    for st in selected_tracks:
        gap_set.update(st.skills_to_develop)
    missing = sorted(gap_set)[:5]
else:
    # Fallback: gaps from top KRS match (original behaviour)
    missing = list(set(matches[0].track.required_skills) - user_skills)[:4]
```

The "Boost your top match" card on the dashboard becomes **"Skills to build for your chosen paths"** and lists the union of skill gaps across both selections.

#### 3. Job recommendations — sector-match bonus

```python
# krs/service.py — get_live_jobs()
selected_sectors = {sel.track.sector.lower() for sel in sels}

# Per job:
if selected_sectors and job.sector and job.sector.lower() in selected_sectors:
    match_score = min(100, match_score + 10)
```

Jobs whose `sector` matches a selected track's sector get **+10 points** added to their combined match score. This surfaces relevant jobs higher in the ranked list even if their skill or semantic overlap is slightly lower.

---

## API Endpoints

All endpoints are under `/api/careers/` and require a valid JWT (`Authorization: Bearer <token>`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/careers/tracks` | All 20 tracks sorted by match score desc (None scores last) |
| `GET` | `/careers/tracks/mine` | User's selected tracks only |
| `GET` | `/careers/tracks/{slug}` | Full track detail + gap analysis |
| `POST` | `/careers/tracks/{track_id}/select` | Select a track (max 2) |
| `DELETE` | `/careers/tracks/{track_id}/select` | Deselect a track |

### `GET /careers/tracks` — response shape

```json
[
  {
    "id": "uuid",
    "slug": "policy-research-consulting",
    "title": "Policy Research & Consulting",
    "sector": "Consulting",
    "salary_range": "10–22 LPA",
    "growth_outlook": "high",
    "match_score": 74,
    "skill_overlap": 71,
    "is_selected": true
  },
  ...
]
```

`match_score` and `skill_overlap` are `null` if KRS has not been computed yet (user just completed onboarding).

### `GET /careers/tracks/{slug}` — response shape

```json
{
  "id": "uuid",
  "slug": "policy-research-consulting",
  "title": "Policy Research & Consulting",
  "description": "Work with think-tanks...",
  "sector": "Consulting",
  "required_skills": ["Policy Research", "Analytical Thinking", ...],
  "min_k_score": 35,
  "salary_range": "10–22 LPA",
  "growth_outlook": "high",
  "example_roles": ["Policy Analyst", "Research Associate", ...],
  "match_score": 74,
  "skill_overlap": 71,
  "skills_you_have": ["Analytical Thinking", "Research", "Written Communication"],
  "skills_to_develop": ["Policy Research", "Stakeholder Engagement"],
  "is_selected": true
}
```

### `POST /careers/tracks/{track_id}/select` — response shape

```json
{
  "track_id": "uuid",
  "is_selected": true,
  "total_selections": 2,
  "message": "'Policy Research & Consulting' added to your career paths"
}
```

Returns HTTP 400 if the user already has 2 selections.

### Updated `GET /krs/dashboard` — new fields

```json
{
  "krs": { "k_score": 65, "r_score": 58, "s_score": 72, "composite": 64 },
  "matches": [...],
  "missing_skills": ["Policy Research", "Stakeholder Engagement", "Strategic Planning"],
  "profile_complete": true,
  "selected_tracks": [
    {
      "track": { "id": "...", "slug": "policy-research-consulting", ... },
      "match_score": 74,
      "skill_overlap": 71,
      "skills_to_develop": ["Policy Research", "Stakeholder Engagement"]
    }
  ]
}
```

`selected_tracks` is an empty array `[]` when the user has not yet chosen any paths. `missing_skills` draws from `selected_tracks` gaps when selections exist, otherwise from the top KRS match.

---

## Database

### New table: `user_career_selections`

```sql
CREATE TABLE user_career_selections (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id    UUID NOT NULL REFERENCES career_tracks(id) ON DELETE CASCADE,
    selected_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_career_selection_user_track UNIQUE (user_id, track_id)
);
CREATE INDEX ix_user_career_selections_user_id ON user_career_selections (user_id);
```

The `UNIQUE` constraint ensures the same track can't be selected twice. The `max 2` rule is enforced at the application layer (not DB level) so a clear user-facing message can be returned.

### Migration

```
alembic/versions/k0g1h2i3j4k5_add_career_mapping.py
```

Runs two operations:
1. Creates `user_career_selections` table
2. Seeds 12 career tracks (`ON CONFLICT (slug) DO NOTHING` — safe to re-run)

---

## Frontend Pages

### `/app/careers/explore` — Career Explorer

- All 20 tracks as cards sorted by match score
- Each card shows: match % ring (colour-coded), sector, salary range, growth outlook, skill overlap %, selected badge
- Search bar (title/sector free text)
- Sector filter pills (scrollable)
- Score legend (green ≥70%, amber 45–69%, grey <45%)
- Banner when 1–2 tracks already selected ("Policy Research is your chosen path. You can add one more.")
- Clicking a card navigates to the track detail page

### `/app/careers/:slug` — Track Detail

- Large match score arc (colour-coded)
- Salary range, growth outlook badge
- "About this path" description (UPSC-aspirant-specific language)
- **Skill gap analysis:** green chips for skills you have, grey chips for skills to develop
- Example roles grid (2×2)
- UPSC fit context banner (shown when `min_k_score > 0`)
- Fixed bottom CTA: "Choose this career path" / "Remove from my paths"
- Flash message on select/deselect

### Dashboard changes

| Element | Before | After selection |
|---|---|---|
| Section at top | "Top career matches" (algorithm) | "Your chosen paths" (pinned, border-highlighted) |
| Section below | — | "Other strong matches" (algorithm, renamed) |
| Skill nudge title | "Boost your top match" | "Skills to build for your chosen paths" |
| Skill nudge body | "These skills would improve match for {top KRS track}" | "These skills will strengthen your readiness for {track1} & {track2}" |
| Job ranking | Skill + semantic + KRS fit | Same + sector-match +10 bonus for jobs in chosen sectors |

---

## Files Created / Modified

### Backend

```
backend/
├── app/
│   ├── models/
│   │   └── user.py                      ← Added UserCareerSelection model;
│   │                                        added career_selections relationship to User;
│   │                                        added selections relationship to CareerTrack
│   ├── modules/
│   │   ├── careers/                     ← NEW module
│   │   │   ├── __init__.py
│   │   │   ├── schemas.py               ← TrackSummaryResponse, TrackDetailResponse,
│   │   │   │                                SelectionResponse, MySelectionsResponse
│   │   │   ├── service.py               ← get_all_tracks, get_track_detail,
│   │   │   │                                select_track, deselect_track, get_my_selections
│   │   │   └── router.py                ← 5 endpoints under /careers/
│   │   └── krs/
│   │       ├── service.py               ← get_dashboard() includes selected_tracks + adjusted
│   │       │                                missing_skills; get_live_jobs() adds sector bonus
│   │       └── schemas.py               ← CareerMatchResponse.skills_to_develop added;
│   │                                        KrsDashboardResponse.selected_tracks added
│   └── main.py                          ← Registered careers_router
│
└── alembic/versions/
    └── k0g1h2i3j4k5_add_career_mapping.py  ← user_career_selections table + 12 track seeds
```

### Frontend

```
frontend/src/
├── api/
│   ├── krs.ts                           ← Added skills_to_develop to CareerMatch;
│   │                                        added selected_tracks to KrsDashboard
│   └── careers.ts                       ← NEW — full typed API client for careers module
├── modules/
│   └── careers/
│       ├── hooks/
│       │   └── useCareers.ts            ← NEW — useCareerTracks, useCareerTrack,
│       │                                    useMySelections, useSelectTrack, useDeselectTrack
│       └── pages/
│           ├── CareerExplorePage.tsx    ← NEW — full track explorer with search + filters
│           └── CareerTrackPage.tsx      ← NEW — track detail + gap analysis + select CTA
└── modules/dashboard/pages/
    └── DashboardPage.tsx                ← Added SelectedPathCard component; "Your chosen paths"
                                             section; updated skill nudge; sector-aware job list
```

---

## Scoring Example

**User:** UPSC CSE Mains cleared, MA Political Science, skills: Research, Written Communication, Analytical Thinking, Critical Thinking, GK & Current Affairs.

**Selected tracks:** Policy Research & Consulting + Journalism & Media

| Signal | Policy Research | Journalism & Media |
|---|---|---|
| Required skills | Policy Research, Analytical Thinking, Report Writing, Research, Written Communication, Strategic Planning, Stakeholder Engagement | Written Communication, GK & Current Affairs, Research, Critical Thinking, Presentation Skills, Public Speaking, Language Proficiency |
| User has | Analytical Thinking, Research, Written Communication | Written Communication, GK & Current Affairs, Research, Critical Thinking |
| skill_overlap | 3/7 = 43% | 4/7 = 57% |
| K-score (Mains = ~60) vs min_k | 60 ≥ 35 → 88 fit | 60 ≥ 15 → 100 fit |
| **match_score** | 0.60×43 + 0.40×88 = **61%** | 0.60×57 + 0.40×100 = **74%** |

**Gap skills shown on dashboard (union, capped 5):**  
`Policy Research`, `Report Writing`, `Stakeholder Engagement`, `Strategic Planning`, `Presentation Skills`

**Job boost:** Jobs with `sector = "Consulting"` or `sector = "Media"` get +10 to their match score.

---

## What Module 05 Will Add

Based on `guide.md`, the next phase builds out the application tracking system — aspirants apply to jobs, employers see a ranked applicant list. Module 05 will also be able to consume `UserCareerSelection` data to prioritise applications from candidates whose chosen paths align with the job sector.
