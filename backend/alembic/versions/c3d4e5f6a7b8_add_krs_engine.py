"""add_krs_engine

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-13 02:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import json

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CAREER_TRACKS = [
    {
        "slug": "policy-analyst",
        "title": "Policy Analyst / Researcher",
        "description": "Analyse public policy, draft reports, and advise government bodies or think tanks on governance and development issues. UPSC preparation gives you an unmatched foundation.",
        "sector": "Government & Policy",
        "required_skills": ["Analytical Reasoning", "Research & Analysis", "Economics", "Public Administration", "Polity & Governance", "Current Affairs"],
        "min_k_score": 50,
        "salary_range": "8–25 LPA",
        "growth_outlook": "high",
        "example_roles": ["Policy Researcher", "Government Affairs Analyst", "Legislative Analyst", "Budget Analyst"],
    },
    {
        "slug": "management-consultant",
        "title": "Management Consultant (Public Sector)",
        "description": "Work with consulting firms on government, PSU, and development projects. Aspirants are prized for their structured thinking, ethics, and policy knowledge.",
        "sector": "Consulting",
        "required_skills": ["Analytical Reasoning", "Management", "Communication", "Data Interpretation", "Leadership", "Research & Analysis"],
        "min_k_score": 30,
        "salary_range": "12–40 LPA",
        "growth_outlook": "high",
        "example_roles": ["Associate Consultant", "Business Analyst", "Strategy Analyst", "Project Manager"],
    },
    {
        "slug": "development-sector",
        "title": "Development Sector Professional",
        "description": "Drive social impact at NGOs, INGOs, and social enterprises. UPSC aspirants bring strong field knowledge, ethics, and understanding of grassroots governance.",
        "sector": "NGO & Social Sector",
        "required_skills": ["Communication", "Leadership", "Public Administration", "Ethics & Integrity", "Research & Analysis", "Current Affairs"],
        "min_k_score": 25,
        "salary_range": "5–18 LPA",
        "growth_outlook": "medium",
        "example_roles": ["Program Manager", "Field Coordinator", "Social Impact Analyst", "Community Development Officer"],
    },
    {
        "slug": "research-analyst",
        "title": "Research Analyst (Think Tanks / Academia)",
        "description": "Produce original research on policy, economics, security, or governance for think tanks, universities, or research institutes.",
        "sector": "Research & Analytics",
        "required_skills": ["Research & Analysis", "Analytical Reasoning", "Economics", "Data Interpretation", "International Relations", "Current Affairs"],
        "min_k_score": 55,
        "salary_range": "6–20 LPA",
        "growth_outlook": "medium",
        "example_roles": ["Research Fellow", "Policy Researcher", "Data Analyst", "Academic Researcher"],
    },
    {
        "slug": "banking-finance",
        "title": "Banking & Finance Professional",
        "description": "Join PSU banks, RBI, SEBI, or financial services firms. UPSC aspirants excel in economics, compliance, and regulatory understanding.",
        "sector": "Banking & Finance",
        "required_skills": ["Economics", "Data Interpretation", "Analytical Reasoning", "Management", "Law & Legal Knowledge", "Computer Skills"],
        "min_k_score": 20,
        "salary_range": "8–30 LPA",
        "growth_outlook": "high",
        "example_roles": ["Credit Analyst", "Compliance Officer", "Risk Analyst", "Banking Officer", "RBI Grade B Officer"],
    },
    {
        "slug": "education-administrator",
        "title": "Education & EdTech Professional",
        "description": "Lead learning initiatives at schools, universities, or EdTech companies. UPSC aspirants make excellent educators and curriculum designers.",
        "sector": "Education & Training",
        "required_skills": ["Communication", "Leadership", "Public Administration", "Management", "English Proficiency", "Current Affairs"],
        "min_k_score": 15,
        "salary_range": "5–20 LPA",
        "growth_outlook": "high",
        "example_roles": ["Academic Coordinator", "Curriculum Designer", "Education Manager", "Content Lead", "Training Manager"],
    },
    {
        "slug": "government-relations",
        "title": "Government Relations & Corporate Affairs",
        "description": "Represent organisations in dealings with government, regulators, and public institutions. Your UPSC knowledge of policy and governance is a direct advantage.",
        "sector": "Corporate Affairs",
        "required_skills": ["Polity & Governance", "Communication", "Public Administration", "Current Affairs", "Management", "Law & Legal Knowledge"],
        "min_k_score": 35,
        "salary_range": "10–35 LPA",
        "growth_outlook": "high",
        "example_roles": ["Government Affairs Manager", "Regulatory Affairs Analyst", "Public Affairs Specialist", "Liaison Officer"],
    },
    {
        "slug": "legal-compliance",
        "title": "Legal & Compliance Analyst",
        "description": "Work in legal teams, regulatory bodies, or compliance departments. Strong in law, ethics, and analytical reasoning — qualities UPSC trains directly.",
        "sector": "Legal",
        "required_skills": ["Law & Legal Knowledge", "Ethics & Integrity", "Analytical Reasoning", "English Proficiency", "Research & Analysis", "Polity & Governance"],
        "min_k_score": 30,
        "salary_range": "7–25 LPA",
        "growth_outlook": "medium",
        "example_roles": ["Legal Analyst", "Compliance Officer", "Regulatory Counsel", "Policy Legal Advisor"],
    },
    {
        "slug": "international-organizations",
        "title": "International Organizations & Diplomacy",
        "description": "Build a career with UN agencies, World Bank, ADB, or foreign affairs. Requires strong international knowledge, language skills, and analytical depth.",
        "sector": "International Organizations",
        "required_skills": ["International Relations", "English Proficiency", "Research & Analysis", "Economics", "Communication", "Public Administration"],
        "min_k_score": 60,
        "salary_range": "15–60 LPA",
        "growth_outlook": "medium",
        "example_roles": ["Programme Officer", "Policy Specialist", "External Affairs Analyst", "Development Economist"],
    },
    {
        "slug": "social-entrepreneur",
        "title": "Social Impact Entrepreneur",
        "description": "Build organisations that solve India's governance, education, or healthcare challenges. Aspirants bring mission-driven thinking, resilience, and systems understanding.",
        "sector": "Entrepreneurship",
        "required_skills": ["Leadership", "Management", "Communication", "Ethics & Integrity", "Research & Analysis", "Analytical Reasoning"],
        "min_k_score": 0,
        "salary_range": "Variable",
        "growth_outlook": "high",
        "example_roles": ["Founder", "Co-Founder", "Social Entrepreneur", "Impact Investor"],
    },
]


def upgrade() -> None:
    # career_tracks
    op.execute("""
        CREATE TABLE IF NOT EXISTS career_tracks (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            slug            VARCHAR(100) NOT NULL UNIQUE,
            title           VARCHAR(200) NOT NULL,
            description     TEXT NOT NULL,
            sector          VARCHAR(100) NOT NULL,
            required_skills JSONB NOT NULL,
            min_k_score     INTEGER NOT NULL DEFAULT 0,
            salary_range    VARCHAR(50),
            growth_outlook  VARCHAR(20),
            example_roles   JSONB,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_career_tracks_slug ON career_tracks (slug);")

    # Seed career tracks
    for track in CAREER_TRACKS:
        op.execute(f"""
            INSERT INTO career_tracks (slug, title, description, sector, required_skills, min_k_score, salary_range, growth_outlook, example_roles)
            VALUES (
                '{track["slug"]}',
                '{track["title"].replace("'", "''")}',
                '{track["description"].replace("'", "''")}',
                '{track["sector"]}',
                '{json.dumps(track["required_skills"])}'::jsonb,
                {track["min_k_score"]},
                '{track["salary_range"]}',
                '{track["growth_outlook"]}',
                '{json.dumps(track["example_roles"])}'::jsonb
            )
            ON CONFLICT (slug) DO NOTHING;
        """)

    # krs_scores
    op.execute("""
        CREATE TABLE IF NOT EXISTS krs_scores (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            k_score     INTEGER NOT NULL,
            r_score     INTEGER NOT NULL,
            s_score     INTEGER NOT NULL,
            composite   INTEGER NOT NULL,
            computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_krs_scores_user_id ON krs_scores (user_id);")

    # career_matches
    op.execute("""
        CREATE TABLE IF NOT EXISTS career_matches (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            track_id      UUID NOT NULL REFERENCES career_tracks(id) ON DELETE CASCADE,
            match_score   INTEGER NOT NULL,
            skill_overlap INTEGER NOT NULL,
            computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (user_id, track_id)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_career_matches_user_id ON career_matches (user_id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS career_matches;")
    op.execute("DROP TABLE IF EXISTS krs_scores;")
    op.execute("DROP TABLE IF EXISTS career_tracks;")
