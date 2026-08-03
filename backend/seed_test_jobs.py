"""
Seed 15 published job postings across the 5 test employers.
Run inside the backend Docker container:
  docker exec -it disha_backend python seed_test_jobs.py
"""
import uuid
from datetime import date, timedelta
from sqlalchemy import text
from app.database import SessionLocal
from app.models.user import JobPosting

# New employer profile IDs (from seed_test_profiles.py run)
TECHMINDS   = '431f62d9-4b53-4b54-b91b-c2cdb7a591c5'   # TechMinds Consulting
GOVTECH     = '267cc224-7b3d-48e6-9e87-c2c3e0483f0f'   # GovTech Solutions
POLICYPULSE = '0ee19689-c69b-4aad-9bd9-8ff6fcc2125e'   # PolicyPulse Research
CIVICEDGE   = '6d150bf2-0cdc-459b-9f60-1cb2a6ba48d2'   # CivicEdge Academy
PUBLICHIRE  = '7bff08e6-7d74-4b1d-8c24-24f4788696d3'   # PublicSector Hire

today = date.today()

JOBS = [
    # ── TechMinds Consulting (3 jobs) ─────────────────────────────────────────
    dict(
        employer_id=TECHMINDS,
        title='Policy Research Analyst',
        description=(
            'Conduct in-depth research on government policies, prepare briefing notes, and present findings '
            'to senior consultants. You will analyse legislative developments, draft policy recommendations, '
            'and engage with public sector clients on governance reforms. Strong written communication and '
            'analytical ability are essential. Prior exposure to UPSC or civil services preparation is a '
            'strong advantage in understanding the regulatory and governance landscape.'
        ),
        sector='Consulting',
        required_skills=['Policy Research', 'Analytical Thinking', 'Report Writing', 'Research', 'Written Communication', 'Stakeholder Engagement'],
        min_k_score=35,
        salary_min=10, salary_max=18,
        growth_outlook='high',
        job_type='hybrid',
        location='New Delhi',
        employment_type='full_time',
        expires_at=today + timedelta(days=45),
    ),
    dict(
        employer_id=TECHMINDS,
        title='Strategy & Management Consultant',
        description=(
            'Work across diverse client engagements in the public and private sector to solve complex '
            'organisational and strategic problems. You will conduct stakeholder interviews, structure '
            'problem statements, build analytical frameworks, and present recommendations to C-suite '
            'and government leadership. Exceptional communication, structured thinking, and resilience '
            'under ambiguity are the core traits we look for. UPSC preparation background strongly preferred.'
        ),
        sector='Consulting',
        required_skills=['Strategic Planning', 'Analytical Thinking', 'Problem Solving', 'Written Communication', 'Decision Making', 'Presentation Skills', 'Stakeholder Engagement'],
        min_k_score=30,
        salary_min=15, salary_max=28,
        growth_outlook='high',
        job_type='hybrid',
        location='New Delhi',
        employment_type='full_time',
        expires_at=today + timedelta(days=60),
    ),
    dict(
        employer_id=TECHMINDS,
        title='Infrastructure Project Coordinator',
        description=(
            'Coordinate multi-stakeholder infrastructure and smart-city projects for state government '
            'clients. Track milestones, prepare status reports, manage vendor relationships, and escalate '
            'risks to project leads. This role suits someone highly organised who can manage multiple '
            'workstreams simultaneously and communicate clearly with both technical and non-technical teams.'
        ),
        sector='Infrastructure',
        required_skills=['Project Management', 'Leadership', 'Organisation & Planning', 'Decision Making', 'Stakeholder Engagement', 'Budget & Finance', 'Report Writing'],
        min_k_score=20,
        salary_min=10, salary_max=20,
        growth_outlook='high',
        job_type='onsite',
        location='Pune',
        employment_type='full_time',
        expires_at=today + timedelta(days=55),
    ),

    # ── GovTech Solutions (3 jobs) ────────────────────────────────────────────
    dict(
        employer_id=GOVTECH,
        title='E-Governance Product Manager',
        description=(
            'Own the roadmap and delivery of digital government platforms used by millions of citizens. '
            'Collaborate with state government stakeholders, design user journeys, write product specs, '
            'and drive cross-functional teams to deliver on time. A deep understanding of how government '
            'works — exactly what UPSC preparation builds — is critical to succeeding in this role.'
        ),
        sector='Technology',
        required_skills=['Strategic Planning', 'Stakeholder Engagement', 'Decision Making', 'Problem Solving', 'Analytical Thinking', 'Written Communication', 'Project Management'],
        min_k_score=30,
        salary_min=18, salary_max=32,
        growth_outlook='high',
        job_type='hybrid',
        location='Bengaluru',
        employment_type='full_time',
        expires_at=today + timedelta(days=40),
    ),
    dict(
        employer_id=GOVTECH,
        title='Data Analyst – Public Services',
        description=(
            'Join our analytics team to design dashboards and reports that help government departments '
            'track programme outcomes. You will work with large structured datasets, build visualisations '
            'in Power BI or Tableau, and present findings to senior officials. Strong quantitative aptitude '
            'and comfort interpreting complex data are essential.'
        ),
        sector='Technology',
        required_skills=['Data Analysis', 'Analytical Thinking', 'MS Office / Excel', 'Problem Solving', 'Attention to Detail', 'Report Writing', 'Research'],
        min_k_score=10,
        salary_min=10, salary_max=18,
        growth_outlook='high',
        job_type='hybrid',
        location='Hyderabad',
        employment_type='full_time',
        expires_at=today + timedelta(days=35),
    ),
    dict(
        employer_id=GOVTECH,
        title='Compliance & Regulatory Affairs Officer',
        description=(
            'Ensure all our government contracts and platform deployments comply with data protection, '
            'cybersecurity, and procurement regulations. Review policy documents, liaise with legal teams, '
            'and maintain compliance trackers. Strong knowledge of Indian administrative and constitutional '
            'law — typically covered in UPSC GS Paper II — gives candidates an immediate advantage.'
        ),
        sector='Technology',
        required_skills=['Critical Thinking', 'Analytical Thinking', 'Attention to Detail', 'Research', 'Ethics & Integrity', 'Report Writing', 'Written Communication'],
        min_k_score=40,
        salary_min=12, salary_max=20,
        growth_outlook='medium',
        job_type='onsite',
        location='Delhi',
        employment_type='full_time',
        expires_at=today + timedelta(days=50),
    ),

    # ── PolicyPulse Research (3 jobs) ─────────────────────────────────────────
    dict(
        employer_id=POLICYPULSE,
        title='Senior Policy Researcher',
        description=(
            'Lead original research on Indian fiscal policy, social welfare programmes, and governance '
            'reforms. Write policy briefs, op-eds, and full research reports for policymakers, media, '
            'and international development agencies. You will independently manage research projects and '
            'mentor junior team members. A post-graduate background and strong English writing skills are '
            'essential. UPSC optional-level depth in Economics, Public Admin, or Political Science is ideal.'
        ),
        sector='Research',
        required_skills=['Policy Research', 'Research', 'Written Communication', 'Analytical Thinking', 'Critical Thinking', 'Report Writing', 'Stakeholder Engagement'],
        min_k_score=50,
        salary_min=12, salary_max=22,
        growth_outlook='medium',
        job_type='hybrid',
        location='Mumbai',
        employment_type='full_time',
        expires_at=today + timedelta(days=45),
    ),
    dict(
        employer_id=POLICYPULSE,
        title='Public Affairs & Communications Lead',
        description=(
            'Manage our relationships with government bodies, media, and civil society organisations. '
            'Draft position papers, coordinate press interactions, and build strategic communication plans. '
            'Your ability to understand policy ecosystems and communicate across stakeholder groups — '
            'skills honed during UPSC preparation — will be central to this role.'
        ),
        sector='Research',
        required_skills=['Written Communication', 'Strategic Planning', 'Stakeholder Engagement', 'Public Speaking', 'Negotiation & Persuasion', 'Research', 'Presentation Skills'],
        min_k_score=25,
        salary_min=12, salary_max=22,
        growth_outlook='medium',
        job_type='hybrid',
        location='New Delhi',
        employment_type='full_time',
        expires_at=today + timedelta(days=50),
    ),
    dict(
        employer_id=POLICYPULSE,
        title='Content & Editorial Lead – Current Affairs',
        description=(
            'Lead the editorial team producing high-quality current affairs content for policy audiences '
            'and corporate newsletters. Write, review, and commission articles on governance, economy, '
            'environment, and international relations. Your UPSC preparation gives you an unmatched '
            'advantage — you understand the audience, the subject matter, and the precision required. '
            'Fully remote with flexible hours.'
        ),
        sector='Media',
        required_skills=['Written Communication', 'GK & Current Affairs', 'Research', 'Critical Thinking', 'Presentation Skills', 'Language Proficiency', 'Attention to Detail'],
        min_k_score=20,
        salary_min=7, salary_max=14,
        growth_outlook='medium',
        job_type='remote',
        location=None,
        employment_type='full_time',
        expires_at=today + timedelta(days=30),
    ),

    # ── CivicEdge Academy (3 jobs) ────────────────────────────────────────────
    dict(
        employer_id=CIVICEDGE,
        title='UPSC Faculty – General Studies',
        description=(
            'Teach General Studies Paper I and II to batches of 50–100 UPSC aspirants. Prepare study '
            'material, conduct mock tests, provide individual mentoring sessions, and analyse student '
            'performance data. We are looking for someone who has cleared UPSC Prelims or Mains and '
            'can connect deeply with students navigating the same journey. Passion for teaching is non-negotiable.'
        ),
        sector='Education',
        required_skills=['Teaching & Training', 'Written Communication', 'Public Speaking', 'GK & Current Affairs', 'Analytical Thinking', 'Presentation Skills', 'Ethics & Integrity'],
        min_k_score=60,
        salary_min=8, salary_max=15,
        growth_outlook='medium',
        job_type='onsite',
        location='Hyderabad',
        employment_type='full_time',
        expires_at=today + timedelta(days=30),
    ),
    dict(
        employer_id=CIVICEDGE,
        title='Learning & Development Specialist',
        description=(
            'Design and deliver training programmes for government officials, corporate leadership teams, '
            'and NGO staff. Content areas include governance, ethics, communication skills, and leadership '
            'development. You will develop curriculum, facilitate workshops, and evaluate learning outcomes. '
            'UPSC aspirants make exceptional trainers — your depth of subject knowledge and ability to '
            'simplify complex topics are rare strengths in the L&D space.'
        ),
        sector='Education',
        required_skills=['Teaching & Training', 'Written Communication', 'Public Speaking', 'Analytical Thinking', 'Presentation Skills', 'Organisation & Planning', 'Adaptability'],
        min_k_score=0,
        salary_min=8, salary_max=15,
        growth_outlook='medium',
        job_type='hybrid',
        location='Hyderabad',
        employment_type='full_time',
        expires_at=today + timedelta(days=35),
    ),
    dict(
        employer_id=CIVICEDGE,
        title='Student Success & Mentorship Coordinator',
        description=(
            'Guide a cohort of 200+ UPSC aspirants through their preparation journey. Conduct weekly '
            'group check-ins, one-on-one mentoring sessions, track progress against milestones, and '
            'identify at-risk students for early intervention. Work with faculty to personalise learning '
            'plans. Empathy, strong listening skills, and firsthand knowledge of the UPSC journey are '
            'what make someone exceptional in this role.'
        ),
        sector='Education',
        required_skills=['Leadership', 'Written Communication', 'Stakeholder Engagement', 'Ethics & Integrity', 'Organisation & Planning', 'Adaptability', 'Public Speaking'],
        min_k_score=0,
        salary_min=5, salary_max=10,
        growth_outlook='medium',
        job_type='onsite',
        location='Hyderabad',
        employment_type='full_time',
        expires_at=today + timedelta(days=25),
    ),

    # ── PublicSector Hire (3 jobs) ────────────────────────────────────────────
    dict(
        employer_id=PUBLICHIRE,
        title='Talent Acquisition Specialist – Government Sector',
        description=(
            'Source, screen, and place candidates for roles across PSUs, central government bodies, '
            'and state undertakings. Build talent pipelines for niche roles requiring UPSC-calibre '
            'analytical and communication skills. Manage end-to-end recruitment cycles, negotiate offers, '
            'and maintain client relationships. Prior recruiting or HR experience preferred but not required '
            'if you have strong interpersonal skills and a structured approach to problem-solving.'
        ),
        sector='HR / Recruitment',
        required_skills=['Stakeholder Engagement', 'Written Communication', 'Negotiation & Persuasion', 'Organisation & Planning', 'Decision Making', 'Attention to Detail', 'Adaptability'],
        min_k_score=0,
        salary_min=6, salary_max=12,
        growth_outlook='high',
        job_type='hybrid',
        location='Pune',
        employment_type='full_time',
        expires_at=today + timedelta(days=40),
    ),
    dict(
        employer_id=PUBLICHIRE,
        title='Programme Officer – Rural Development',
        description=(
            'Manage field-level implementation of livelihood and education programmes across rural '
            'districts. Coordinate with community leaders, local government officials, and donor '
            'representatives. Prepare progress reports, conduct community needs assessments, and ensure '
            'programme targets are met on time and within budget. A genuine commitment to public service '
            'and the ability to work in challenging field conditions are essential prerequisites.'
        ),
        sector='Development',
        required_skills=['Stakeholder Engagement', 'Project Management', 'Research', 'Written Communication', 'Ethics & Integrity', 'Leadership', 'Budget & Finance'],
        min_k_score=0,
        salary_min=5, salary_max=10,
        growth_outlook='medium',
        job_type='onsite',
        location='Bhopal',
        employment_type='full_time',
        expires_at=today + timedelta(days=30),
    ),
    dict(
        employer_id=PUBLICHIRE,
        title='CSR Programme Manager',
        description=(
            'Lead end-to-end CSR projects for corporate clients across education, health, and rural '
            'livelihood sectors. Responsibilities include stakeholder mapping, impact measurement, field '
            'visits, and reporting to client leadership. You will manage budgets, coordinate with NGO '
            'partners, and present quarterly impact reviews. A passion for social impact and strong '
            'project management skills are key to success in this role.'
        ),
        sector='NGO / Corporate',
        required_skills=['Project Management', 'Stakeholder Engagement', 'Written Communication', 'Ethics & Integrity', 'Leadership', 'Budget & Finance', 'Report Writing'],
        min_k_score=15,
        salary_min=8, salary_max=14,
        growth_outlook='medium',
        job_type='hybrid',
        location='Mumbai',
        employment_type='full_time',
        expires_at=today + timedelta(days=30),
    ),
]


def main():
    db = SessionLocal()
    try:
        # Clear any existing jobs first
        deleted = db.execute(text("DELETE FROM job_postings")).rowcount
        db.commit()
        print(f"Cleared {deleted} existing job posting(s).\n")

        count = 0
        for j in JOBS:
            job = JobPosting(
                id=uuid.uuid4(),
                employer_id=j['employer_id'],
                title=j['title'],
                description=j['description'],
                sector=j['sector'],
                required_skills=j['required_skills'],
                min_k_score=j['min_k_score'],
                salary_min=j['salary_min'],
                salary_max=j['salary_max'],
                growth_outlook=j['growth_outlook'],
                job_type=j['job_type'],
                location=j.get('location'),
                employment_type=j['employment_type'],
                expires_at=j['expires_at'],
                is_active=True,
                status='published',
                skill_extraction_status='done',
            )
            db.add(job)
            count += 1
            print(f"  + [{j['sector']}] {j['title']}")

        db.commit()
        print(f"\nDone! Inserted {count} job postings.")
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
