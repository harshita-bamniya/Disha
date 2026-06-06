"""add career mapping (user_career_selections + seed tracks)

Revision ID: k0g1h2i3j4k5
Revises: j9f0g1h2i3j4
Create Date: 2026-05-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'k0g1h2i3j4k5'
down_revision = 'j9f0g1h2i3j4'
branch_labels = None
depends_on = None


# ---------------------------------------------------------------------------
# Seed data — 12 career tracks for UPSC aspirants transitioning to private
# sector. Skills come from the 30-skill master list in scoring.py.
# ---------------------------------------------------------------------------
TRACKS = [
    {
        "slug": "policy-research-consulting",
        "title": "Policy Research & Consulting",
        "description": (
            "Work with think-tanks, consulting firms, or advocacy organisations to "
            "analyse policy, produce research briefs, and advise clients on regulatory "
            "and governance matters. Your UPSC preparation — especially GS Paper II & "
            "III knowledge — translates directly here."
        ),
        "sector": "Consulting",
        "required_skills": [
            "Policy Research", "Analytical Thinking", "Report Writing",
            "Research", "Written Communication", "Strategic Planning",
            "Stakeholder Engagement",
        ],
        "min_k_score": 35,
        "salary_range": "10–22 LPA",
        "growth_outlook": "high",
        "example_roles": [
            "Policy Analyst", "Research Associate",
            "Strategy Consultant", "Public Affairs Manager",
        ],
    },
    {
        "slug": "csr-social-impact",
        "title": "CSR & Social Impact",
        "description": (
            "Lead or execute corporate social responsibility programmes, impact "
            "measurement, and community development initiatives. Strong alignment "
            "with public service values; your field exposure and ethics grounding "
            "are a natural fit."
        ),
        "sector": "NGO / Corporate",
        "required_skills": [
            "Stakeholder Engagement", "Project Management", "Written Communication",
            "Research", "Ethics & Integrity", "Leadership", "Report Writing",
        ],
        "min_k_score": 15,
        "salary_range": "6–14 LPA",
        "growth_outlook": "medium",
        "example_roles": [
            "CSR Manager", "Impact Analyst",
            "Community Development Officer", "Programme Manager",
        ],
    },
    {
        "slug": "education-edtech",
        "title": "Education & EdTech",
        "description": (
            "Design curriculum, teach, or build educational products at schools, "
            "coaching institutes, or EdTech platforms. UPSC aspirants make exceptional "
            "educators — deep subject knowledge, structured thinking, and communication "
            "skills are all here."
        ),
        "sector": "Education",
        "required_skills": [
            "Teaching & Training", "Written Communication", "Public Speaking",
            "Analytical Thinking", "Digital Literacy", "Presentation Skills", "Research",
        ],
        "min_k_score": 0,
        "salary_range": "5–15 LPA",
        "growth_outlook": "high",
        "example_roles": [
            "Curriculum Designer", "Educator",
            "Academic Content Creator", "EdTech Programme Manager",
        ],
    },
    {
        "slug": "legal-compliance",
        "title": "Legal & Compliance",
        "description": (
            "Navigate regulatory frameworks, ensure organisational compliance, or "
            "support legal teams in drafting and reviewing contracts. Your statutory "
            "knowledge from UPSC — especially Polity and legal GS topics — provides "
            "a strong foundation."
        ),
        "sector": "Legal / Finance",
        "required_skills": [
            "Critical Thinking", "Analytical Thinking", "Written Communication",
            "Attention to Detail", "Research", "Ethics & Integrity", "Report Writing",
        ],
        "min_k_score": 35,
        "salary_range": "8–20 LPA",
        "growth_outlook": "medium",
        "example_roles": [
            "Legal Analyst", "Compliance Officer",
            "Regulatory Affairs Manager", "Contract Manager",
        ],
    },
    {
        "slug": "data-analytics-research",
        "title": "Data Analytics & Research",
        "description": (
            "Apply quantitative and qualitative research skills to turn data into "
            "actionable insights for business, policy, or product decisions. Your "
            "UPSC analytical training — interpreting data-heavy GS questions, "
            "writing precise answers — transitions naturally to this domain."
        ),
        "sector": "Technology / Research",
        "required_skills": [
            "Data Analysis", "Analytical Thinking", "Problem Solving",
            "MS Office / Excel", "Research", "Report Writing", "Attention to Detail",
        ],
        "min_k_score": 0,
        "salary_range": "8–18 LPA",
        "growth_outlook": "high",
        "example_roles": [
            "Data Analyst", "Research Analyst",
            "Business Intelligence Analyst", "Market Research Manager",
        ],
    },
    {
        "slug": "journalism-media",
        "title": "Journalism & Media",
        "description": (
            "Cover news, produce content, or strategise communications for media "
            "organisations. Your breadth of current affairs knowledge, writing "
            "discipline, and ability to synthesise complex topics are rare assets "
            "in a newsroom or content team."
        ),
        "sector": "Media",
        "required_skills": [
            "Written Communication", "GK & Current Affairs", "Research",
            "Critical Thinking", "Presentation Skills", "Public Speaking",
            "Language Proficiency",
        ],
        "min_k_score": 15,
        "salary_range": "4–12 LPA",
        "growth_outlook": "medium",
        "example_roles": [
            "Journalist", "Content Strategist",
            "Editorial Manager", "Fact-Checker",
        ],
    },
    {
        "slug": "ngo-development",
        "title": "NGO & Development Sector",
        "description": (
            "Work with non-profits, international organisations, or bilateral "
            "development agencies on programmes in health, education, livelihoods, "
            "and governance. Mission-driven, field-intensive, and deeply aligned "
            "with public-service motivation."
        ),
        "sector": "Development",
        "required_skills": [
            "Stakeholder Engagement", "Project Management", "Research",
            "Written Communication", "Ethics & Integrity", "Leadership",
            "Budget & Finance",
        ],
        "min_k_score": 0,
        "salary_range": "4–12 LPA",
        "growth_outlook": "medium",
        "example_roles": [
            "Programme Officer", "Field Coordinator",
            "M&E Analyst", "Grants Manager",
        ],
    },
    {
        "slug": "banking-finance",
        "title": "Banking & Finance",
        "description": (
            "Join banks, NBFCs, or financial services firms in analytical and "
            "advisory roles. UPSC preparation builds strong economic reasoning "
            "and attention to detail — both valuable in credit, risk, or "
            "treasury functions."
        ),
        "sector": "Banking / Finance",
        "required_skills": [
            "Analytical Thinking", "Attention to Detail", "MS Office / Excel",
            "Budget & Finance", "Problem Solving", "Decision Making", "Report Writing",
        ],
        "min_k_score": 25,
        "salary_range": "8–20 LPA",
        "growth_outlook": "medium",
        "example_roles": [
            "Credit Analyst", "Financial Analyst",
            "Risk Analyst", "Treasury Manager",
        ],
    },
    {
        "slug": "project-management-infrastructure",
        "title": "Project Management & Infrastructure",
        "description": (
            "Lead complex projects in infrastructure, construction, or operations — "
            "coordinating teams, timelines, and stakeholders. Your administrative "
            "mindset and ability to manage multiple priorities under pressure are "
            "exactly what project-heavy roles demand."
        ),
        "sector": "Infrastructure",
        "required_skills": [
            "Project Management", "Leadership", "Strategic Planning",
            "Decision Making", "Stakeholder Engagement",
            "Organisation & Planning", "Budget & Finance",
        ],
        "min_k_score": 25,
        "salary_range": "10–25 LPA",
        "growth_outlook": "high",
        "example_roles": [
            "Project Manager", "Infrastructure Consultant",
            "Operations Manager", "Programme Director",
        ],
    },
    {
        "slug": "healthcare-administration",
        "title": "Healthcare Administration",
        "description": (
            "Manage hospitals, health programmes, or medical affairs functions — "
            "handling operations, compliance, and stakeholder coordination. "
            "Governance literacy and a structured mindset give UPSC aspirants "
            "a head start in India's growing health-management sector."
        ),
        "sector": "Healthcare",
        "required_skills": [
            "Project Management", "Analytical Thinking", "Report Writing",
            "Stakeholder Engagement", "Ethics & Integrity",
            "Decision Making", "Organisation & Planning",
        ],
        "min_k_score": 15,
        "salary_range": "6–15 LPA",
        "growth_outlook": "high",
        "example_roles": [
            "Hospital Administrator", "Health Programme Manager",
            "Public Health Analyst", "Medical Affairs Manager",
        ],
    },
    {
        "slug": "corporate-affairs-pr",
        "title": "Corporate Affairs & Public Relations",
        "description": (
            "Manage an organisation's relationship with government, media, and "
            "the public — drafting positions, navigating policy, and building "
            "brand credibility. Deep policy knowledge and strong communication "
            "skills make UPSC aspirants stand out here."
        ),
        "sector": "Corporate",
        "required_skills": [
            "Written Communication", "Strategic Planning", "Stakeholder Engagement",
            "Public Speaking", "Negotiation & Persuasion", "Research",
            "Presentation Skills",
        ],
        "min_k_score": 25,
        "salary_range": "8–18 LPA",
        "growth_outlook": "medium",
        "example_roles": [
            "Public Affairs Manager", "Corporate Communications Lead",
            "Govt Relations Manager", "Media Liaison",
        ],
    },
    {
        "slug": "hr-training",
        "title": "Human Resources & Learning Development",
        "description": (
            "Build organisational capability through talent management, employee "
            "development, and learning programmes. Your interpersonal depth, "
            "ability to explain complex ideas clearly, and empathy from the UPSC "
            "journey make you an effective HR or L&D professional."
        ),
        "sector": "HR / L&D",
        "required_skills": [
            "Teaching & Training", "Interpersonal Skills", "Emotional Intelligence",
            "Organisation & Planning", "Written Communication",
            "Team Collaboration", "Adaptability",
        ],
        "min_k_score": 0,
        "salary_range": "5–14 LPA",
        "growth_outlook": "medium",
        "example_roles": [
            "HR Manager", "L&D Specialist",
            "Training Coordinator", "Talent Acquisition Manager",
        ],
    },
]


def upgrade() -> None:
    # ── 1. Create user_career_selections table ────────────────────────────────
    op.create_table(
        "user_career_selections",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("track_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("career_tracks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("selected_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "track_id", name="uq_career_selection_user_track"),
    )
    # ── 2. Seed career tracks ─────────────────────────────────────────────────
    import json, uuid as _uuid
    conn = op.get_bind()
    for t in TRACKS:
        conn.execute(sa.text("""
            INSERT INTO career_tracks
                (id, slug, title, description, sector,
                 required_skills, min_k_score, salary_range,
                 growth_outlook, example_roles, created_at)
            VALUES
                (:id, :slug, :title, :description, :sector,
                 CAST(:required_skills AS jsonb), :min_k_score, :salary_range,
                 :growth_outlook, CAST(:example_roles AS jsonb), NOW())
            ON CONFLICT (slug) DO NOTHING
        """), {
            "id": str(_uuid.uuid4()),
            "slug": t["slug"],
            "title": t["title"],
            "description": t["description"],
            "sector": t["sector"],
            "required_skills": json.dumps(t["required_skills"]),
            "min_k_score": t["min_k_score"],
            "salary_range": t["salary_range"],
            "growth_outlook": t["growth_outlook"],
            "example_roles": json.dumps(t["example_roles"]),
        })


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM career_tracks WHERE slug IN (%s)" % (
        ", ".join(f"'{t['slug']}'" for t in TRACKS)
    )))
    op.drop_table("user_career_selections")
