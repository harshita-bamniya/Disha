DISHA AI — Complete System Architecture
EXECUTIVE SUMMARY
Before diving into specifics: DISHA AI is not a job board with an AI wrapper. It is a psychological + cognitive transformation platform. Every architectural decision must reflect that. The data model is behavior-first, not content-first. The AI is a coach, not a chatbot. This shapes everything below.

PART 1 — MODULE DIVISION & DEVELOPMENT PHASES
Module Map
After deep analysis, I'm identifying 11 core modules with clear ownership boundaries:

┌─────────────────────────────────────────────────────────────────┐
│                        DISHA AI PLATFORM                        │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   IDENTITY   │  ONBOARDING  │  INTELLIGENCE│     LEARNING       │
│   MODULE     │   MODULE     │   ENGINE     │     MODULE         │
├──────────────┼──────────────┼──────────────┼────────────────────┤
│   RESUME     │    MOCK      │  EMPLOYER    │  AI COUNSELLOR     │
│   BUILDER    │  INTERVIEW   │  MATCHING    │  (DISHA BOT)       │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│              ADMIN DASHBOARD  │  ANALYTICS ENGINE               │
└─────────────────────────────────────────────────────────────────┘
MODULE 01 — Identity & Auth
Purpose: Secure, stateless identity layer that every other module depends on.

Attribute	Detail
Priority	CRITICAL — Phase 1
Complexity	Medium
Backend	Auth service, JWT issuance, refresh rotation, RBAC enforcement
Frontend	Login, register, forgot password, OTP flows, route guards
DB Tables	users, refresh_tokens, roles, permissions, role_permissions, audit_logs
Dependencies	None — foundational
Features:

Phone + Email registration (phone-first for Tier 2/3 India)
OTP via SMS (MSG91 / Kaleyra) + Email OTP
JWT access tokens (15 min TTL) + rotating refresh tokens (30 days)
Role: aspirant, admin, super_admin (employer role reserved but not built)
Soft delete — never hard delete a user
Login event logging for behavioral analytics seed data
MODULE 02 — Onboarding & Psychological Assessment
Purpose: The most important module. This is where DISHA listens before it speaks. Captures UPSC background, psychological state, motivation patterns, and risk tolerance. Powers all downstream AI.

Attribute	Detail
Priority	CRITICAL — Phase 1
Complexity	High
Backend	Multi-step session management, assessment scoring, profile construction
Frontend	Conversational wizard UI (not a form), progress persistence, bilingual (Hindi/English)
DB Tables	user_profiles, onboarding_sessions, psychological_assessments, upsc_backgrounds, attempt_history
Dependencies	Identity Module
Features:

Multi-step wizard (12–18 questions, conversational tone)
UPSC attempt history capture (attempts, stages cleared, subjects, optional paper)
Psychological state mapping: burnout level, confidence index, financial pressure score
Motivation profiling: intrinsic vs extrinsic drivers
Language preference detection
Incomplete session recovery (resume where you left off)
Generates the seed data for KRS scoring
Why this is Phase 1 critical: Without rich onboarding data, the skill extraction engine has nothing to work with. The quality of this module determines the quality of every downstream recommendation.

MODULE 03 — Intelligence Engine (Skill Extraction + KRS Scoring)
Purpose: The core IP of DISHA AI. Translates a UPSC preparation background into a structured skill taxonomy that private sector employers understand.

Attribute	Detail
Priority	CRITICAL — Phase 1
Complexity	Very High
Backend	AI orchestration, skill taxonomy management, KRS scoring algorithm, vector embedding generation
Frontend	Skill radar visualization, KRS score card, insight cards
DB Tables	skills, skill_categories, user_skills, skill_extractions, krs_scores, krs_components, skill_embeddings
Dependencies	Onboarding Module, AI Infrastructure
KRS Score = Knowledge × Readiness × Skill Application potential

Three sub-scores:

K (Knowledge Depth): Breadth and depth of UPSC subjects mastered
R (Readiness Index): Psychological readiness for private sector transition
S (Skill Transferability): How well UPSC skills map to corporate competencies
Why pgvector here: Each user's skill profile is embedded as a vector. This enables semantic career matching ("find careers whose required skills are most similar to this user's extracted skill vector").

MODULE 04 — Career Mapping
Purpose: Maps the KRS score + skill vector to viable private sector career tracks with honest probability scoring.

Attribute	Detail
Priority	High — Phase 1
Complexity	High
Backend	Career matching algorithm, track management, recommendation engine
Frontend	Career path explorer, match percentage cards, track detail pages
DB Tables	career_tracks, career_skill_requirements, career_recommendations, user_career_selections
Dependencies	Intelligence Engine
Features:

15–20 curated career tracks (Policy Consulting, Civil Services Advisory, ESG, Public Affairs, EdTech, NGO Leadership, etc.)
Each track has a required skill vector stored in pgvector
Cosine similarity between user skill vector and track requirement vector = match score
Honest framing: "You are 73% aligned. Here's what the 27% gap needs."
User can select 1–2 tracks to pursue
MODULE 05 — Learning System
Purpose: Personalized, gap-closing learning paths. Not generic courses — curated to close the specific skill delta identified in Career Mapping.

Attribute	Detail
Priority	High — Phase 2
Complexity	High
Backend	Curriculum engine, progress tracking, content management, adaptive sequencing
Frontend	Learning dashboard, lesson viewer, progress tracker, streaks
DB Tables	learning_paths, path_modules, lessons, resources, user_learning_progress, lesson_completions, resource_bookmarks
Dependencies	Career Mapping, Intelligence Engine
Features:

Paths generated based on identified skill gaps, not generic roadmaps
Content types: video links, articles, case studies, exercises
Progress persistence with streak mechanics
Bilingual content support
Admin CMS for content management
MVP scope: Curated static paths. Adaptive sequencing is Phase 3.

MODULE 06 — Resume Builder
Purpose: Transforms a UPSC-format CV into a private sector resume using AI, with intelligent translation of bureaucratic achievements into corporate impact language.

Attribute	Detail
Priority	High — Phase 2
Complexity	High
Backend	AI transformation service, template management, PDF generation, version control
Frontend	Resume editor (rich text), live preview, template selector, version history
DB Tables	resumes, resume_versions, resume_templates, resume_sections, resume_analysis
Dependencies	Intelligence Engine, Onboarding
Features:

AI rewrites each bullet: "Studied Constitutional law for Mains" → "Deep expertise in Indian constitutional framework, governance structure, and federal policy design"
Multiple templates (ATS-friendly, design, hybrid)
Version history — never lose a previous draft
PDF + DOCX export
ATS optimization scoring
MODULE 07 — Mock Interview Engine
Purpose: AI-powered interview simulator tuned to the specific career track the user is pursuing, with feedback calibrated to their UPSC communication style.

Attribute	Detail
Priority	Medium — Phase 2
Complexity	Very High
Backend	Interview session management, question bank, AI evaluation engine, feedback generation
Frontend	Interview room UI (text-based MVP, voice Phase 3), feedback cards, performance history
DB Tables	interview_sessions, interview_questions, question_banks, session_responses, interview_feedback, performance_metrics
Dependencies	Career Mapping, Intelligence Engine
Features:

Questions tailored to selected career track
UPSC-specific calibration: UPSC communication style tends to be formal and verbose — coach toward crisp, result-oriented corporate communication
Feedback dimensions: clarity, conciseness, impact, relevance, STAR method adherence
Session playback and review
Text-first MVP, voice capability Phase 3
MODULE 08 — AI Counsellor (DISHA Bot)
Purpose: The emotional and strategic backbone of the platform. Not a FAQ bot. A trauma-informed career counsellor that understands the psychological weight of UPSC failure and guides without judgment.

Attribute	Detail
Priority	High — Phase 2
Complexity	Very High
Backend	Conversation orchestration, memory management, safety layer, context retrieval
Frontend	Chat interface, conversation history, suggested prompts, emotional state indicators
DB Tables	conversations, messages, conversation_context, counsellor_memory, safety_flags
Dependencies	All modules (DISHA needs full user context)
Critical design note: This module requires a safety layer. Users may express distress, hopelessness, or mental health concerns. The system must detect these signals and respond with empathy + escalation paths, not generic advice.

MODULE 09 — Employer Matching
Purpose: Connect verified employers seeking UPSC-background talent with the right aspirants.

Attribute	Detail
Priority	Low — Phase 3
Complexity	Medium
Backend	Job posting management, matching algorithm, application tracking
Frontend	Job board, match cards, application tracker
DB Tables	employers, job_postings, posting_skill_requirements, applications, application_status_history
Dependencies	Intelligence Engine, Career Mapping
Phase 3 rationale: Employer relationships take time to build. Attempting this in Phase 1/2 dilutes focus. MVP focuses on transforming the aspirant. Employer side comes after 500+ aspirants are on the platform with verified profiles.

MODULE 10 — Admin Dashboard
Purpose: Internal operations, content management, user oversight, platform health monitoring.

Attribute	Detail
Priority	Medium — Phase 1 (basic), Phase 2 (full)
Complexity	Medium
Backend	Admin-scoped APIs, user management, content CMS, report generation
Frontend	Admin-only React app (separate route namespace)
DB Tables	admin_users, admin_sessions, platform_settings, feature_flags, content_management
Dependencies	All modules
MODULE 11 — Analytics Engine
Purpose: Track user journeys, conversion funnels, cohort analysis, AI performance metrics, business KPIs.

Attribute	Detail
Priority	Medium — Phase 2
Complexity	Medium
Backend	Event ingestion, aggregation pipelines, report APIs
Frontend	Admin analytics dashboards
DB Tables	user_events, funnel_events, ai_interaction_logs, conversion_events
Dependencies	All modules
Development Phases
Phase 1 — MVP (Months 1–3)
Goal: Working platform that can take a user from registration to KRS score + career recommendation.

✅ Module 01 — Identity & Auth           (fully complete)
✅ Module 02 — Onboarding                (fully complete)
✅ Module 03 — Intelligence Engine       (skill extraction + KRS score)
✅ Module 04 — Career Mapping            (career recommendations)
✅ Module 10 — Admin Dashboard           (basic: user list, content mgmt)
Success metric: 100 users complete onboarding and receive a KRS score + 3 career recommendations.

Phase 2 — Beta (Months 4–6)
Goal: Full platform loop — user arrives, learns, practices, and produces output.

✅ Module 05 — Learning System           (curated paths)
✅ Module 06 — Resume Builder            (AI transformation)
✅ Module 07 — Mock Interview            (text-based)
✅ Module 08 — AI Counsellor             (with safety layer)
✅ Module 11 — Analytics Engine          (basic funnel tracking)
Success metric: 500 users with completed resumes + 3+ interview sessions.

Phase 3 — Scale (Months 7–12)
Goal: Network effects, employer side, advanced AI.

✅ Module 09 — Employer Matching
✅ Advanced adaptive learning
✅ Voice mock interviews
✅ Community features
✅ Mobile app (React Native)
✅ Multi-language expansion (Odia, Marathi, Tamil)
PART 2 — DATABASE ARCHITECTURE
Design Principles
All PKs are UUID (v4) — no sequential integer IDs exposed externally
Every table has: created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
Soft deletes via deleted_at TIMESTAMPTZ (nullable)
Sensitive fields encrypted at application layer before storage
pgvector columns isolated in dedicated embedding tables (not mixed with transactional data)
Indexing strategy noted per table
Schema Groups
GROUP A — Identity & Auth
-- CORE USER RECORD (keep lean — profile data lives elsewhere)
users
├── id                    UUID PK
├── phone                 VARCHAR(15) UNIQUE NOT NULL     -- primary identifier
├── email                 VARCHAR(255) UNIQUE
├── password_hash         TEXT NOT NULL
├── phone_verified        BOOLEAN DEFAULT FALSE
├── email_verified        BOOLEAN DEFAULT FALSE
├── preferred_language    ENUM('en','hi') DEFAULT 'hi'
├── role_id               UUID FK → roles.id
├── is_active             BOOLEAN DEFAULT TRUE
├── last_login_at         TIMESTAMPTZ
├── created_at            TIMESTAMPTZ DEFAULT NOW()
├── updated_at            TIMESTAMPTZ DEFAULT NOW()
└── deleted_at            TIMESTAMPTZ NULL

-- Indexes: phone, email, role_id, is_active + deleted_at

roles
├── id          UUID PK
├── name        VARCHAR(50) UNIQUE NOT NULL   -- aspirant, admin, super_admin
├── description TEXT
└── created_at  TIMESTAMPTZ

permissions
├── id          UUID PK
├── resource    VARCHAR(100)   -- e.g. "resume", "admin_panel"
├── action      VARCHAR(50)    -- e.g. "read", "write", "delete"
└── description TEXT

role_permissions
├── role_id        UUID FK → roles.id
├── permission_id  UUID FK → permissions.id
└── PK (role_id, permission_id)

refresh_tokens
├── id              UUID PK
├── user_id         UUID FK → users.id
├── token_hash      TEXT NOT NULL              -- store hash, not raw token
├── expires_at      TIMESTAMPTZ NOT NULL
├── revoked_at      TIMESTAMPTZ NULL
├── issued_ip       INET
├── user_agent      TEXT
└── created_at      TIMESTAMPTZ

-- Index: user_id, token_hash, expires_at

otp_verifications
├── id          UUID PK
├── user_id     UUID FK → users.id NULL        -- null if pre-registration
├── target      VARCHAR(255)                   -- phone or email
├── otp_hash    TEXT NOT NULL
├── purpose     ENUM('register','login','reset','verify')
├── expires_at  TIMESTAMPTZ NOT NULL
├── used_at     TIMESTAMPTZ NULL
└── created_at  TIMESTAMPTZ

audit_logs
├── id           UUID PK
├── user_id      UUID NULL FK → users.id
├── action       VARCHAR(100)
├── resource     VARCHAR(100)
├── resource_id  UUID NULL
├── ip_address   INET
├── user_agent   TEXT
├── metadata     JSONB
└── created_at   TIMESTAMPTZ

-- Index: user_id, action, created_at
GROUP B — Onboarding & Psychological Assessment
user_profiles
├── id                    UUID PK
├── user_id               UUID UNIQUE FK → users.id
├── full_name             VARCHAR(255) NOT NULL
├── date_of_birth         DATE
├── gender                ENUM('male','female','other','prefer_not_to_say')
├── city                  VARCHAR(100)
├── state                 VARCHAR(100)
├── educational_background TEXT
├── graduation_year       INTEGER
├── graduation_discipline VARCHAR(100)
├── profile_photo_url     TEXT
├── linkedin_url          TEXT
├── is_profile_complete   BOOLEAN DEFAULT FALSE
├── created_at            TIMESTAMPTZ
└── updated_at            TIMESTAMPTZ

upsc_backgrounds
├── id                       UUID PK
├── user_id                  UUID UNIQUE FK → users.id
├── preparation_start_year   INTEGER NOT NULL
├── total_attempts           INTEGER NOT NULL
├── optional_subject         VARCHAR(100)        -- Geography, PSIR, History etc.
├── prelims_cleared_count    INTEGER DEFAULT 0
├── mains_cleared_count      INTEGER DEFAULT 0
├── interview_cleared_count  INTEGER DEFAULT 0
├── highest_stage_reached    ENUM('prelims','mains','interview','not_cleared')
├── coaching_institutes      JSONB               -- [{name, years}]
├── self_study_ratio         INTEGER             -- 0-100 (% self study)
├── subjects_studied         JSONB               -- array of GS topics + depth
├── notes_quality            ENUM('extensive','moderate','minimal')
├── current_status           ENUM('continuing','decided_to_move','exploring')
├── created_at               TIMESTAMPTZ
└── updated_at               TIMESTAMPTZ

onboarding_sessions
├── id              UUID PK
├── user_id         UUID FK → users.id
├── session_version INTEGER DEFAULT 1            -- allows re-onboarding
├── status          ENUM('started','in_progress','completed','abandoned')
├── current_step    INTEGER DEFAULT 1
├── total_steps     INTEGER DEFAULT 15
├── responses       JSONB                        -- step-by-step answers stored here
├── completed_at    TIMESTAMPTZ NULL
├── created_at      TIMESTAMPTZ
└── updated_at      TIMESTAMPTZ

-- Index: user_id, status

psychological_assessments
├── id                      UUID PK
├── user_id                 UUID FK → users.id
├── onboarding_session_id   UUID FK → onboarding_sessions.id
├── burnout_score           INTEGER CHECK (0-100)
├── confidence_index        INTEGER CHECK (0-100)
├── financial_pressure_score INTEGER CHECK (0-100)
├── risk_tolerance          ENUM('low','medium','high')
├── motivation_type         ENUM('intrinsic','extrinsic','mixed')
├── identity_attachment     ENUM('low','medium','high')  -- how attached to "IAS aspirant" identity
├── support_system          ENUM('strong','moderate','weak')
├── raw_scores              JSONB                        -- dimension-by-dimension breakdown
├── assessed_at             TIMESTAMPTZ
└── created_at              TIMESTAMPTZ
GROUP C — Intelligence Engine (Skills & KRS)
skill_categories
├── id          UUID PK
├── name        VARCHAR(100) UNIQUE    -- e.g. "Analytical Thinking", "Communication"
├── description TEXT
├── icon        VARCHAR(50)
└── sort_order  INTEGER

skills
├── id              UUID PK
├── category_id     UUID FK → skill_categories.id
├── name            VARCHAR(150) UNIQUE
├── description     TEXT
├── upsc_mapping    TEXT           -- how this skill emerges from UPSC prep
├── corporate_label TEXT           -- how employers describe this skill
├── is_active       BOOLEAN DEFAULT TRUE
└── created_at      TIMESTAMPTZ

-- Index: category_id, name

skill_extractions
├── id                    UUID PK
├── user_id               UUID FK → users.id
├── extraction_version    INTEGER DEFAULT 1
├── model_used            VARCHAR(100)           -- e.g. "claude-sonnet-4-6"
├── prompt_version        VARCHAR(50)            -- links to prompt management
├── raw_ai_response       TEXT                   -- for auditing/reprocessing
├── extraction_status     ENUM('pending','processing','completed','failed')
├── error_detail          TEXT NULL
├── created_at            TIMESTAMPTZ
└── completed_at          TIMESTAMPTZ NULL

user_skills
├── id                   UUID PK
├── user_id              UUID FK → users.id
├── skill_id             UUID FK → skills.id
├── extraction_id        UUID FK → skill_extractions.id
├── proficiency_level    INTEGER CHECK (1-10)
├── evidence_summary     TEXT                    -- AI-generated evidence for this skill
├── is_verified          BOOLEAN DEFAULT FALSE
├── created_at           TIMESTAMPTZ
└── updated_at           TIMESTAMPTZ

-- Unique: (user_id, skill_id, extraction_id)
-- Index: user_id, skill_id

krs_scores
├── id                    UUID PK
├── user_id               UUID FK → users.id
├── extraction_id         UUID FK → skill_extractions.id
├── k_score               DECIMAL(5,2)           -- Knowledge (0-100)
├── r_score               DECIMAL(5,2)           -- Readiness (0-100)
├── s_score               DECIMAL(5,2)           -- Skill Transferability (0-100)
├── composite_score       DECIMAL(5,2)           -- Weighted composite
├── score_version         INTEGER DEFAULT 1
├── calculation_metadata  JSONB                  -- weights, factors used
├── created_at            TIMESTAMPTZ
└── updated_at            TIMESTAMPTZ

-- pgvector embedding table for user skill profiles
user_skill_embeddings
├── id            UUID PK
├── user_id       UUID UNIQUE FK → users.id
├── extraction_id UUID FK → skill_extractions.id
├── embedding     VECTOR(1536)                   -- OpenAI ada-002 or equivalent
├── model_used    VARCHAR(100)
├── created_at    TIMESTAMPTZ
└── updated_at    TIMESTAMPTZ

-- Index: HNSW index on embedding for ANN search
-- CREATE INDEX ON user_skill_embeddings USING hnsw (embedding vector_cosine_ops)
GROUP D — Career Mapping
career_tracks
├── id                  UUID PK
├── name                VARCHAR(200) UNIQUE
├── slug                VARCHAR(200) UNIQUE
├── description         TEXT
├── sector              VARCHAR(100)         -- Policy, ESG, EdTech, Consulting etc.
├── avg_starting_salary_range VARCHAR(50)
├── growth_potential    ENUM('high','medium','low')
├── upsc_relevance_note TEXT                -- "Your GS2 background directly applies..."
├── is_active           BOOLEAN DEFAULT TRUE
├── sort_order          INTEGER
└── created_at          TIMESTAMPTZ

career_track_embeddings
├── id              UUID PK
├── career_track_id UUID UNIQUE FK → career_tracks.id
├── embedding       VECTOR(1536)             -- embedding of track's required skill profile
├── model_used      VARCHAR(100)
└── updated_at      TIMESTAMPTZ

-- This is the core of matching: cosine_similarity(user_skill_embedding, career_track_embedding)

career_skill_requirements
├── id               UUID PK
├── career_track_id  UUID FK → career_tracks.id
├── skill_id         UUID FK → skills.id
├── importance_level ENUM('must_have','important','nice_to_have')
└── weight           DECIMAL(3,2)           -- 0.0 to 1.0

career_recommendations
├── id                UUID PK
├── user_id           UUID FK → users.id
├── career_track_id   UUID FK → career_tracks.id
├── match_score       DECIMAL(5,2)           -- cosine similarity result * 100
├── skill_gap_summary JSONB                  -- which skills need development
├── recommendation_rank INTEGER             -- 1st, 2nd, 3rd choice
├── is_user_selected  BOOLEAN DEFAULT FALSE
├── created_at        TIMESTAMPTZ

-- Index: user_id, match_score DESC
GROUP E — Learning System
learning_paths
├── id                UUID PK
├── career_track_id   UUID FK → career_tracks.id
├── name              VARCHAR(200)
├── description       TEXT
├── estimated_hours   INTEGER
├── difficulty        ENUM('beginner','intermediate','advanced')
├── is_active         BOOLEAN DEFAULT TRUE
└── created_at        TIMESTAMPTZ

path_modules
├── id               UUID PK
├── learning_path_id UUID FK → learning_paths.id
├── title            VARCHAR(200)
├── description      TEXT
├── sort_order       INTEGER
├── skill_id         UUID FK → skills.id NULL    -- which skill this module builds
└── created_at       TIMESTAMPTZ

lessons
├── id               UUID PK
├── module_id        UUID FK → path_modules.id
├── title            VARCHAR(200)
├── content_type     ENUM('article','video','exercise','case_study','quiz')
├── content_url      TEXT NULL
├── content_body     TEXT NULL                   -- for inline articles
├── duration_minutes INTEGER
├── sort_order       INTEGER
├── language         ENUM('en','hi','both')
└── created_at       TIMESTAMPTZ

user_learning_enrollments
├── id               UUID PK
├── user_id          UUID FK → users.id
├── learning_path_id UUID FK → learning_paths.id
├── enrolled_at      TIMESTAMPTZ
├── status           ENUM('enrolled','in_progress','completed','paused')
├── completed_at     TIMESTAMPTZ NULL
└── updated_at       TIMESTAMPTZ

-- Unique: (user_id, learning_path_id)

lesson_completions
├── id             UUID PK
├── user_id        UUID FK → users.id
├── lesson_id      UUID FK → lessons.id
├── completed_at   TIMESTAMPTZ
├── time_spent_sec INTEGER
└── score          INTEGER NULL                  -- for quizzes

user_streaks
├── id              UUID PK
├── user_id         UUID UNIQUE FK → users.id
├── current_streak  INTEGER DEFAULT 0
├── longest_streak  INTEGER DEFAULT 0
├── last_activity   DATE
└── updated_at      TIMESTAMPTZ
GROUP F — Resume Builder
resume_templates
├── id            UUID PK
├── name          VARCHAR(100)
├── description   TEXT
├── template_type ENUM('ats_clean','modern','hybrid','executive')
├── thumbnail_url TEXT
├── is_active     BOOLEAN DEFAULT TRUE
└── created_at    TIMESTAMPTZ

resumes
├── id              UUID PK
├── user_id         UUID FK → users.id
├── template_id     UUID FK → resume_templates.id NULL
├── title           VARCHAR(200)             -- user-given name, e.g. "Policy Consulting Resume"
├── career_track_id UUID FK → career_tracks.id NULL
├── is_primary      BOOLEAN DEFAULT FALSE
├── ats_score       INTEGER NULL             -- 0-100, computed
├── created_at      TIMESTAMPTZ
└── updated_at      TIMESTAMPTZ

resume_versions
├── id           UUID PK
├── resume_id    UUID FK → resumes.id
├── version_num  INTEGER NOT NULL
├── content      JSONB NOT NULL             -- full structured resume data
├── ai_generated BOOLEAN DEFAULT FALSE
├── created_at   TIMESTAMPTZ

-- Index: (resume_id, version_num DESC)

resume_sections
├── id          UUID PK
├── resume_id   UUID FK → resumes.id
├── section_type ENUM('summary','experience','education','skills','achievements','projects')
├── title       VARCHAR(100)
├── content     JSONB                       -- structured per section type
├── sort_order  INTEGER
├── ai_improved BOOLEAN DEFAULT FALSE
└── updated_at  TIMESTAMPTZ
GROUP G — Mock Interview Engine
question_banks
├── id               UUID PK
├── career_track_id  UUID FK → career_tracks.id NULL  -- null = universal
├── skill_id         UUID FK → skills.id NULL
├── question_text    TEXT NOT NULL
├── question_type    ENUM('behavioral','situational','technical','hr','case')
├── difficulty       ENUM('easy','medium','hard')
├── expected_answer_guide TEXT             -- for AI evaluator reference only
├── language         ENUM('en','hi','both')
├── is_active        BOOLEAN DEFAULT TRUE
└── created_at       TIMESTAMPTZ

interview_sessions
├── id               UUID PK
├── user_id          UUID FK → users.id
├── career_track_id  UUID FK → career_tracks.id
├── session_type     ENUM('practice','timed','full_mock')
├── status           ENUM('scheduled','in_progress','completed','abandoned')
├── total_questions  INTEGER DEFAULT 5
├── started_at       TIMESTAMPTZ NULL
├── completed_at     TIMESTAMPTZ NULL
└── created_at       TIMESTAMPTZ

session_responses
├── id               UUID PK
├── session_id       UUID FK → interview_sessions.id
├── question_id      UUID FK → question_banks.id
├── response_text    TEXT NOT NULL
├── response_time_sec INTEGER
├── sequence_num     INTEGER
└── submitted_at     TIMESTAMPTZ

interview_feedback
├── id               UUID PK
├── session_id       UUID FK → interview_sessions.id
├── response_id      UUID FK → session_responses.id NULL   -- null = overall session feedback
├── clarity_score    INTEGER CHECK (0-10)
├── conciseness_score INTEGER CHECK (0-10)
├── impact_score     INTEGER CHECK (0-10)
├── relevance_score  INTEGER CHECK (0-10)
├── star_adherence   INTEGER CHECK (0-10)
├── overall_score    INTEGER CHECK (0-10)
├── strengths        JSONB                  -- array of strength observations
├── improvements     JSONB                  -- array of improvement suggestions
├── rewritten_answer TEXT NULL              -- AI-suggested better answer
└── created_at       TIMESTAMPTZ
GROUP H — AI Counsellor (DISHA Bot)
conversations
├── id             UUID PK
├── user_id        UUID FK → users.id
├── title          VARCHAR(200) NULL        -- auto-generated from first message
├── context_type   ENUM('career','emotional','learning','resume','general')
├── status         ENUM('active','archived')
├── message_count  INTEGER DEFAULT 0
├── created_at     TIMESTAMPTZ
└── updated_at     TIMESTAMPTZ

messages
├── id              UUID PK
├── conversation_id UUID FK → conversations.id
├── role            ENUM('user','assistant','system')
├── content         TEXT NOT NULL
├── content_hi      TEXT NULL               -- Hindi version if auto-translated
├── token_count     INTEGER
├── model_used      VARCHAR(100)
├── safety_flagged  BOOLEAN DEFAULT FALSE
├── created_at      TIMESTAMPTZ

-- Index: conversation_id, created_at

counsellor_memory
├── id              UUID PK
├── user_id         UUID FK → users.id
├── memory_type     ENUM('fact','preference','concern','milestone','goal')
├── content         TEXT NOT NULL           -- "User expressed fear of starting over at 32"
├── importance      ENUM('low','medium','high','critical')
├── source_conv_id  UUID FK → conversations.id NULL
├── is_active       BOOLEAN DEFAULT TRUE
├── expires_at      TIMESTAMPTZ NULL
├── created_at      TIMESTAMPTZ
└── updated_at      TIMESTAMPTZ

-- pgvector for semantic memory retrieval
counsellor_memory_embeddings
├── id         UUID PK
├── memory_id  UUID FK → counsellor_memory.id
├── embedding  VECTOR(1536)
└── updated_at TIMESTAMPTZ

safety_flags
├── id              UUID PK
├── message_id      UUID FK → messages.id
├── user_id         UUID FK → users.id
├── flag_type       ENUM('distress','self_harm','crisis','burnout_severe','anger')
├── severity        ENUM('low','medium','high','critical')
├── triggered_by    VARCHAR(200)            -- keyword or AI pattern that triggered
├── action_taken    ENUM('logged','responded_with_resource','escalated_to_admin')
├── reviewed_by     UUID NULL FK → users.id -- admin who reviewed
└── created_at      TIMESTAMPTZ
GROUP I — Analytics & Events
user_events
├── id           UUID PK
├── user_id      UUID FK → users.id NULL
├── session_id   VARCHAR(64)               -- browser session ID
├── event_name   VARCHAR(100)              -- e.g. "onboarding_step_completed"
├── event_data   JSONB
├── page_url     TEXT
├── created_at   TIMESTAMPTZ

-- Partition this table by month for performance at scale
-- Index: user_id, event_name, created_at

platform_settings
├── id          UUID PK
├── key         VARCHAR(100) UNIQUE
├── value       JSONB
├── description TEXT
└── updated_at  TIMESTAMPTZ

feature_flags
├── id            UUID PK
├── flag_name     VARCHAR(100) UNIQUE
├── is_enabled    BOOLEAN DEFAULT FALSE
├── rollout_pct   INTEGER DEFAULT 0          -- 0-100 rollout percentage
├── target_roles  JSONB NULL                 -- restrict to specific roles
├── description   TEXT
└── updated_at    TIMESTAMPTZ
pgvector Usage Summary
Table	Dimension	Index Type	Purpose
user_skill_embeddings	1536	HNSW (cosine)	User skill profile matching
career_track_embeddings	1536	HNSW (cosine)	Career track requirement matching
counsellor_memory_embeddings	1536	HNSW (cosine)	Semantic memory retrieval
question_bank	Future	IVFFlat	Question similarity for dedup
Why HNSW over IVFFlat for production:
HNSW (Hierarchical Navigable Small World) has better recall and doesn't require training a separate index. IVFFlat needs to be retrained as data grows. For a startup with < 100K users, HNSW is the clear choice.

PART 3 — AUTHENTICATION & RBAC DESIGN
JWT Strategy
┌────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client   │────▶│  Auth Router │────▶│ JWT Service │
└────────────┘     └──────────────┘     └─────────────┘
      │                                        │
      │  Access Token (15 min, stateless)      │
      │  Refresh Token (30 days, DB-backed)    │
      │◀───────────────────────────────────────┘
      │
      │  On API call → attach Bearer access token
      │  On 401 → use refresh token → get new pair
      │  On refresh token expiry → force re-login
Access Token payload (JWT):

{
  "sub": "user-uuid",
  "role": "aspirant",
  "permissions": ["resume:write", "interview:read"],
  "lang": "hi",
  "iat": 1234567890,
  "exp": 1234568790
}
Why 15 min access tokens: Short-lived tokens minimize blast radius of token theft. With silent refresh on the frontend, users never feel the expiry.

Refresh token strategy:

Stored as SHA256(token) in DB — never the raw token
One refresh token per device (user_agent fingerprint)
Refresh rotation: each use issues a new refresh token, old one is revoked
Refresh token family tracking: if a revoked token is used, invalidate ALL tokens for that user (detect token theft)
RBAC Design
Roles (hierarchical):
  super_admin > admin > aspirant
super_admin:
  - Full platform access
  - Can promote/demote admins
  - Access to all user data
  - System configuration
admin:
  - User management (view, soft-delete)
  - Content management (career tracks, lessons, questions)
  - Safety flag review
  - Analytics view
  - Cannot access other admin accounts
aspirant:
  - Own data only
  - Read career tracks and lessons
  - Cannot access other users' data
Permission enforcement model:

Route-level: middleware checks role before handler
Resource-level: service layer checks ownership (user_id == token.sub)
No frontend-only route hiding — always enforce on backend
Auth Flow Diagram
Registration:
  POST /auth/register → validate → create user (aspirant role) → send OTP
  POST /auth/verify-otp → verify → issue access + refresh token pair
Login:
  POST /auth/login → verify credentials → issue token pair
Token Refresh:
  POST /auth/refresh → validate refresh token → rotate → issue new pair
Logout:
  POST /auth/logout → revoke refresh token family
Protected Request:
  GET /api/... → extract Bearer token → verify signature → check expiry
                → extract role + permissions → middleware enforces
Future OAuth Support
Designed-in via oauth_providers table (not built in Phase 1):

oauth_providers (reserved for Phase 3)
├── id           UUID PK
├── user_id      UUID FK → users.id
├── provider     ENUM('google','linkedin')
├── provider_uid VARCHAR(255)
└── created_at   TIMESTAMPTZ
The auth service is built with a provider abstraction so Google/LinkedIn OAuth can be added without refactoring the core flow.

PART 4 — FRONTEND ARCHITECTURE
Routing Structure
/                          → Landing page (public)
/auth/
  login                    → Login
  register                 → Register
  verify                   → OTP verification
  forgot-password          → Password reset
/onboarding/               → Onboarding wizard (protected, aspirant)
  step/:stepNumber
/app/                      → Main app (protected, onboarding-complete aspirants)
  dashboard                → Home dashboard
  profile                  → User profile
  skills/                  → Skill intelligence
    report                 → KRS score + skill breakdown
  careers/                 → Career mapping
    explore                → All career tracks
    :trackSlug             → Individual career track detail
    recommended            → User's recommendations
  learn/                   → Learning system
    paths                  → All available paths
    :pathId                → Learning path detail
    :pathId/lesson/:lessonId → Lesson viewer
  resume/                  → Resume builder
    create                 → New resume
    :resumeId/edit         → Edit resume
    :resumeId/preview      → Preview + export
  interview/               → Mock interview
    prepare                → Session setup
    session/:sessionId     → Active interview
    :sessionId/feedback    → Post-session feedback
    history                → Past sessions
  counsellor/              → DISHA AI chat
    :conversationId?       → Chat view
/admin/                    → Admin dashboard (protected, admin+ role)
  dashboard
  users/
    list
    :userId
  content/
    career-tracks
    lessons
    questions
  moderation/
    safety-flags
  analytics/
    overview
    funnels
Layout System
Layouts:
  PublicLayout        → Navbar + footer, no auth required
  AuthLayout          → Centered card, no navbar, used for login/register
  OnboardingLayout    → Full screen, step progress bar, no main nav
  AppLayout           → Sidebar nav + top bar, requires auth + onboarding complete
  AdminLayout         → Separate sidebar, admin nav only
State Management (Zustand + TanStack Query)
The split: Server state via TanStack Query. Client/UI state via Zustand.

Zustand Stores:
  authStore           → { user, token, role, logout(), refreshToken() }
  onboardingStore     → { currentStep, responses, language, saveStep() }
  uiStore             → { theme, sidebarOpen, language, notifications[] }
  interviewStore      → { activeSession, currentQuestion, responses[] }
TanStack Query (server state):
  useProfile()        → GET /api/user/profile
  useKRSScore()       → GET /api/intelligence/krs
  useCareerRecs()     → GET /api/careers/recommendations
  useLearningPaths()  → GET /api/learn/paths
  useConversation()   → GET /api/counsellor/conversations/:id
Why this split: TanStack Query handles caching, background refetch, stale-while-revalidate, and optimistic updates for server data. Zustand handles ephemeral client state that doesn't need server sync (UI state, in-progress forms).

API Layer
// Single axios instance with interceptors
apiClient
  ├── request interceptor  → attach Bearer token
  ├── response interceptor → handle 401 → trigger silent refresh → retry
  └── error interceptor    → normalize error shape

// Domain-based API modules
api/
  auth.ts         → login, register, refresh, logout
  profile.ts      → getProfile, updateProfile
  onboarding.ts   → saveStep, getSession
  intelligence.ts → triggerExtraction, getKRS, getSkills
  careers.ts      → getTracks, getRecommendations, selectTrack
  learning.ts     → getPaths, enrollPath, completeLesson
  resume.ts       → createResume, updateSection, exportResume
  interview.ts    → createSession, submitResponse, getFeedback
  counsellor.ts   → getConversations, sendMessage, getMemory
Design System
Built on ShadCN UI + Tailwind with DISHA-specific tokens:

Design Tokens:
  Colors:
    primary:    #2D6A4F    (Deep Forest Green — growth, new beginnings)
    secondary:  #F2A65A    (Warm Amber — warmth, India)
    accent:     #1B4965    (Deep Blue — trust, authority)
    surface:    #FAFAF8    (Warm White)
    danger:     #C84B31    (Alert states)
  Typography:
    headings:  'Hind' (Hindi-compatible, professional)
    body:      'Inter'
    mono:      'JetBrains Mono'
  Bilingual:
    All UI text keys stored in i18n JSON
    Language switcher persisted in authStore + user profile
    RTL not needed (Hindi is LTR)
PART 5 — AI ARCHITECTURE
Provider Abstraction Layer
Why an abstraction layer: We may switch between Claude, GPT-4, and Gemini as pricing and capability evolves. The abstraction ensures no application code has a direct SDK import.

AIProvider (interface)
├── complete(prompt, options) → AIResponse
├── embed(text) → float[]
└── stream(prompt, options) → AsyncIterator<string>
Implementations:
├── ClaudeProvider (claude-sonnet-4-6 for complex reasoning)
├── OpenAIProvider (GPT-4o for speed-critical paths)
└── MockProvider (for testing)
Selection logic:
  skill_extraction → ClaudeProvider (reasoning quality critical)
  interview_eval   → ClaudeProvider (nuanced evaluation)
  counsellor_chat  → ClaudeProvider (empathy + safety)
  embeddings       → OpenAIProvider (text-embedding-3-small)
  simple_rewrite   → OpenAIProvider (cost-efficient)
Prompt Management
Prompts are NOT hardcoded in application code. They are versioned assets.

prompt_templates
├── id             UUID PK
├── name           VARCHAR(100) UNIQUE      -- e.g. "skill_extraction_v3"
├── prompt_type    ENUM('system','user','assistant')
├── use_case       VARCHAR(100)             -- which AI feature uses this
├── content        TEXT NOT NULL
├── version        INTEGER NOT NULL
├── is_active      BOOLEAN DEFAULT TRUE
├── model_hint     VARCHAR(100)             -- preferred model for this prompt
└── created_at     TIMESTAMPTZ
This allows prompt improvements to be deployed without code releases, and enables A/B testing of prompt versions.

Skill Extraction Engine
Input:
  - user_profile data
  - upsc_background data
  - psychological_assessment scores
  - subjects_studied (JSON)
  - attempt history
Pipeline:
  1. Build structured context document from DB
  2. Load active skill_extraction prompt template
  3. Send to Claude with structured output requirement
  4. Parse response → validate against skill taxonomy
  5. Store in skill_extractions + user_skills
  6. Generate embedding of skill summary → store in user_skill_embeddings
  7. Trigger KRS score calculation
  8. Trigger career recommendation matching
Output:
  - 8-15 extracted skills with proficiency levels
  - Evidence summaries per skill
  - KRS scores (K, R, S, composite)
  - Top 3 career recommendations via vector similarity
Extraction prompt structure:

System: You are an expert career counsellor specializing in UPSC-to-private-sector 
transitions. You deeply understand how civil services preparation builds transferable 
competencies that private sector employers value.
Extract skills from the following aspirant profile. Map each skill to the taxonomy 
provided. Be generous in recognizing implicit skills. For each skill, cite the specific 
UPSC preparation activity that demonstrates it.
[Structured JSON output schema]
AI Counsellor (DISHA Bot) Architecture
Request flow:
  User message → Safety pre-check → Context assembly → AI call → Safety post-check → Store + respond
Context Assembly:
  1. Last 20 messages from conversation (sliding window)
  2. User's KRS score summary
  3. Selected career track
  4. Active counsellor memories (top 5 by cosine similarity to current message)
  5. Current onboarding status
  6. Psychological assessment summary
Memory System:
  After each assistant response:
    → Extract potential memories (facts, preferences, concerns)
    → Check if memory already exists (semantic dedup via embedding)
    → Store new memories with importance rating
    → Expire memories older than 90 days (unless marked critical)
Safety Layer:
  Pre-check (keyword + classifier):
    → Distress signals: "give up", "no point", "wasted years", "ending it"
    → Severity classification (low/medium/high/critical)
    
  Response routing:
    → low: respond with empathy, proceed normally
    → medium: add mental health resources to response
    → high: override response with crisis-specific message + helpline numbers
    → critical: flag for admin review + send iCall / Vandrevala Foundation numbers
  Post-check:
    → Verify assistant response is not dismissive of emotional content
    → Ensure response maintains trauma-informed framing
Embedding Search Architecture
Two search use cases:
1. Career Matching (batch, on skill extraction completion):
   SELECT ct.id, ct.name,
     1 - (cte.embedding <=> $1) AS similarity_score
   FROM career_track_embeddings cte
   JOIN career_tracks ct ON ct.id = cte.career_track_id
   ORDER BY similarity_score DESC
   LIMIT 5;
   
   ($1 = user's skill embedding)
2. Memory Retrieval (real-time, before each counsellor response):
   SELECT cm.content, cm.memory_type,
     1 - (cme.embedding <=> $1) AS relevance
   FROM counsellor_memory_embeddings cme
   JOIN counsellor_memory cm ON cm.id = cme.memory_id
   WHERE cm.user_id = $2 AND cm.is_active = true
   ORDER BY relevance DESC
   LIMIT 5;
   
   ($1 = current message embedding, $2 = user_id)
PART 6 — DEVOPS & DEPLOYMENT
Docker Architecture
docker-compose.yml (development):
  services:
    postgres:
      image: pgvector/pgvector:pg16
      volumes: [postgres_data:/var/lib/postgresql/data]
      ports: [5432:5432]
    redis:
      image: redis:7-alpine
      purpose: rate limiting, session cache, job queues
    backend:
      build: ./backend
      volumes: [./backend:/app]    ← hot reload in dev
      depends_on: [postgres, redis]
      ports: [8000:8000]
    frontend:
      build: ./frontend
      volumes: [./frontend:/app]   ← Vite HMR
      ports: [5173:5173]
    worker:
      build: ./backend
      command: celery worker         ← async AI jobs (skill extraction etc.)
      depends_on: [postgres, redis]
docker-compose.prod.yml:
  → No volume mounts
  → Multi-stage builds (slim images)
  → Environment via secrets, not .env files
  → Nginx reverse proxy container
Environment Strategy
Environments:
  local       → docker-compose.yml, .env.local
  staging     → mirrors production, separate DB, .env.staging
  production  → .env.production (never committed, injected by CI)
.env structure:
  DATABASE_URL
  REDIS_URL
  JWT_SECRET_KEY
  JWT_REFRESH_SECRET_KEY
  ANTHROPIC_API_KEY
  OPENAI_API_KEY
  MSG91_API_KEY
  STORAGE_BUCKET_URL
  ENVIRONMENT=local|staging|production
  LOG_LEVEL=DEBUG|INFO|WARNING
Never commit: .env.staging, .env.production
Commit: .env.example (all keys, no values)
CI/CD Pipeline (GitHub Actions)
On PR to main:
  → Lint (ruff for Python, ESLint for TS)
  → Type check (mypy, tsc --noEmit)
  → Unit tests (pytest, vitest)
  → Build Docker image (verify it builds)

On merge to main:
  → All PR checks
  → Build + push images to registry (GHCR)
  → Deploy to staging (auto)
  → Run integration tests against staging
  → Slack notification

On release tag (v*):
  → Build production images
  → Deploy to production (manual approval gate)
  → Post-deploy smoke tests
  → Rollback trigger if smoke tests fail
Backend Folder Architecture (FastAPI)
backend/
├── app/
│   ├── main.py                    ← FastAPI app init, middleware, routers
│   ├── config.py                  ← Settings via pydantic-settings
│   ├── database.py                ← SQLAlchemy engine + session
│   │
│   ├── modules/                   ← One folder per module
│   │   ├── auth/
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── schemas.py         ← Pydantic request/response models
│   │   │   └── dependencies.py    ← FastAPI dependency injection
│   │   ├── onboarding/
│   │   ├── intelligence/
│   │   ├── careers/
│   │   ├── learning/
│   │   ├── resume/
│   │   ├── interview/
│   │   └── counsellor/
│   │
│   ├── models/                    ← SQLAlchemy ORM models (all tables)
│   │   ├── user.py
│   │   ├── onboarding.py
│   │   ├── intelligence.py
│   │   └── ...
│   │
│   ├── ai/                        ← AI architecture
│   │   ├── providers/
│   │   │   ├── base.py            ← AIProvider interface
│   │   │   ├── claude.py
│   │   │   └── openai.py
│   │   ├── extractors/
│   │   │   └── skill_extractor.py
│   │   ├── counsellor/
│   │   │   ├── orchestrator.py
│   │   │   ├── memory.py
│   │   │   └── safety.py
│   │   └── prompts/
│   │       └── loader.py          ← Loads from DB or file fallback
│   │
│   ├── tasks/                     ← Celery async tasks
│   │   ├── worker.py
│   │   ├── skill_extraction.py
│   │   └── embedding_gen.py
│   │
│   └── core/
│       ├── security.py            ← JWT logic
│       ├── rbac.py                ← Permission checking
│       ├── exceptions.py          ← Custom exception classes
│       └── middleware.py          ← Rate limiting, request ID, logging
│
├── alembic/                       ← DB migrations
├── tests/
│   ├── unit/
│   └── integration/
├── Dockerfile
└── requirements.txt
Frontend Folder Architecture
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx                    ← Router setup
│   │
│   ├── modules/                   ← Mirror backend module structure
│   │   ├── auth/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── onboarding/
│   │   ├── intelligence/
│   │   ├── careers/
│   │   ├── learning/
│   │   ├── resume/
│   │   ├── interview/
│   │   └── counsellor/
│   │
│   ├── layouts/
│   │   ├── AppLayout.tsx
│   │   ├── AuthLayout.tsx
│   │   ├── OnboardingLayout.tsx
│   │   └── AdminLayout.tsx
│   │
│   ├── components/                ← Shared, reusable
│   │   ├── ui/                    ← ShadCN extensions
│   │   ├── feedback/              ← Loading, error, empty states
│   │   └── data-display/         ← Charts, score cards, radar
│   │
│   ├── stores/                    ← Zustand stores
│   ├── api/                       ← API layer (axios)
│   ├── hooks/                     ← Shared custom hooks
│   ├── i18n/                      ← en.json, hi.json
│   ├── lib/                       ← Utilities
│   └── types/                     ← Shared TypeScript types
│
├── public/
├── index.html
├── vite.config.ts
└── tailwind.config.ts
Monitoring & Logging
Application Logging:
  → Structured JSON logs (structlog for Python)
  → Request ID on every log line
  → Log levels: DEBUG (local), INFO (staging), WARNING+ (production)
  → Ship to: Grafana Loki (self-hosted) or Papertrail (managed)
Metrics:
  → Prometheus metrics on /metrics endpoint
  → FastAPI instrumentation middleware
  → Key metrics: request latency p50/p95/p99, AI call duration, queue depth
Error Tracking:
  → Sentry (both frontend and backend)
  → Alert on: unhandled exceptions, p99 latency spike, safety flag surge
Uptime:
  → UptimeRobot for external health check ping
  → /health endpoint returns DB + Redis connectivity status
DEVELOPMENT ROADMAP SUMMARY
Week 1-2:   Project scaffold, Docker setup, CI/CD pipeline
Week 3-4:   Module 01 — Auth + RBAC (100% complete)
Week 5-6:   Module 02 — Onboarding (DB + API + basic frontend)
Week 7-8:   Module 03 — Intelligence Engine (skill extraction AI pipeline)
Week 9:     Module 04 — Career Mapping (vector matching)
Week 10:    Admin dashboard (basic), QA, security review
            ↓ MVP LAUNCH ↓
Week 11-12: Module 05 — Learning System
Week 13-14: Module 06 — Resume Builder
Week 15-16: Module 07 — Mock Interview Engine
Week 17-18: Module 08 — AI Counsellor + Safety Layer
Week 19:    Analytics, polish, performance audit
            ↓ BETA LAUNCH ↓
Week 20+:   Module 09 — Employer Matching, voice interviews, mobile
ARCHITECTURAL DECISIONS LOG
Decision	Rationale
Modular monolith over microservices	Startup speed matters. Extract services only when there's a real scaling bottleneck, not prematurely.
Phone-first registration	Tier 2/3 India has inconsistent email habits. Phone + OTP is the natural auth UX.
pgvector over Pinecone/Weaviate	Keeps infrastructure simple. One DB for everything. Easier ops. Performance is sufficient for < 500K users.
Celery for AI jobs	Skill extraction takes 5-15 seconds. Must be async. Celery + Redis is battle-tested.
Hindi-first content support	Target users think in Hindi. English-only platform would exclude a large portion of the addressable market.
Soft deletes everywhere	Users may want to return. Legal compliance for data retention. Never destroy data.
Prompt versioning in DB	Prompt engineering is a continuous process. Deploying better prompts should not require code deployments.
Safety layer before counsellor	UPSC failure carries real psychological weight. This is non-negotiable. Build it before the feature, not after.
Architecture is complete. Ready to begin implementation when you approve.

The recommended starting point is Module 01 (Auth) — I'll scaffold the full backend + frontend for authentication with all the JWT, RBAC, and OTP infrastructure before we touch any other module.