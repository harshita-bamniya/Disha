"""Seed realistic job postings for testing the dashboard."""
import uuid
from datetime import date, timedelta
from app.database import SessionLocal
from app.models.user import JobPosting

db = SessionLocal()

EMP1 = 'c01f4473-ea8d-46c3-9d60-bf40b76cb36c'   # Indicc Associates (Consulting)
EMP2 = 'ffeecefd-04e7-4cc2-9d38-dbe2238edfb7'   # Harshita Associates (Research)

JOBS = [
    dict(
        employer_id=EMP1,
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
        expires_at=date.today() + timedelta(days=45),
    ),
    dict(
        employer_id=EMP1,
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
        expires_at=date.today() + timedelta(days=30),
    ),
    dict(
        employer_id=EMP1,
        title='Legal & Regulatory Affairs Associate',
        description=(
            'Support the legal team in reviewing contracts, tracking regulatory changes, and ensuring '
            'compliance across client engagements. You will prepare legal summaries, assist in due '
            'diligence, and liaise with government departments. Knowledge of Indian constitutional and '
            'administrative law, as typically covered in UPSC GS Paper II, gives candidates a significant '
            'head start in this role. Strong attention to detail and written communication are essential.'
        ),
        sector='Legal / Finance',
        required_skills=['Critical Thinking', 'Analytical Thinking', 'Written Communication', 'Attention to Detail', 'Research', 'Ethics & Integrity', 'Report Writing'],
        min_k_score=40,
        salary_min=9, salary_max=16,
        growth_outlook='medium',
        job_type='onsite',
        location='New Delhi',
        employment_type='full_time',
        expires_at=date.today() + timedelta(days=60),
    ),
    dict(
        employer_id=EMP2,
        title='Data & Research Analyst',
        description=(
            'Join our research division to design surveys, analyse large datasets, and produce insights '
            'reports for government and development sector clients. You will work with Excel, basic Python '
            'or R, and data visualisation tools. We value structured thinking and the ability to communicate '
            'complex findings simply. Candidates with UPSC background bring strong data interpretation '
            'skills that translate directly to this role.'
        ),
        sector='Technology / Research',
        required_skills=['Data Analysis', 'Analytical Thinking', 'Problem Solving', 'MS Office / Excel', 'Research', 'Report Writing', 'Attention to Detail'],
        min_k_score=0,
        salary_min=7, salary_max=14,
        growth_outlook='high',
        job_type='hybrid',
        location='Bengaluru',
        employment_type='full_time',
        expires_at=date.today() + timedelta(days=40),
    ),
    dict(
        employer_id=EMP2,
        title='Public Affairs & Communications Lead',
        description=(
            'Manage our clients relationships with government bodies, media, and civil society '
            'organisations. Draft position papers, coordinate press interactions, and build strategic '
            'communication plans. Your ability to understand policy ecosystems and communicate across '
            'stakeholder groups, skills honed during UPSC preparation, will be central to this role. '
            'Prior experience in journalism, PR, or government-facing roles is preferred.'
        ),
        sector='Corporate',
        required_skills=['Written Communication', 'Strategic Planning', 'Stakeholder Engagement', 'Public Speaking', 'Negotiation & Persuasion', 'Research', 'Presentation Skills'],
        min_k_score=25,
        salary_min=12, salary_max=22,
        growth_outlook='medium',
        job_type='hybrid',
        location='New Delhi',
        employment_type='full_time',
        expires_at=date.today() + timedelta(days=50),
    ),
    dict(
        employer_id=EMP2,
        title='Learning & Development Specialist',
        description=(
            'Design and deliver training programmes for government officials, corporate leadership teams, '
            'and NGO staff. Content areas include governance, ethics, communication skills, and leadership '
            'development. You will develop curriculum, facilitate workshops, and evaluate learning outcomes. '
            'UPSC aspirants make exceptional trainers as your depth of subject knowledge and ability to '
            'simplify complex topics are rare strengths in the L&D space.'
        ),
        sector='HR / L&D',
        required_skills=['Teaching & Training', 'Written Communication', 'Public Speaking', 'Analytical Thinking', 'Presentation Skills', 'Organisation & Planning', 'Adaptability'],
        min_k_score=0,
        salary_min=8, salary_max=15,
        growth_outlook='medium',
        job_type='hybrid',
        location='Hyderabad',
        employment_type='full_time',
        expires_at=date.today() + timedelta(days=35),
    ),
    dict(
        employer_id=EMP1,
        title='Infrastructure Project Coordinator',
        description=(
            'Coordinate multi-stakeholder infrastructure and smart-city projects for state government '
            'clients. Track milestones, prepare status reports, manage vendor relationships, and escalate '
            'risks to project leads. This role suits someone highly organised who can manage multiple '
            'workstreams simultaneously and communicate clearly with both technical and non-technical teams. '
            'PMP or equivalent certification is a plus but not mandatory.'
        ),
        sector='Infrastructure',
        required_skills=['Project Management', 'Leadership', 'Organisation & Planning', 'Decision Making', 'Stakeholder Engagement', 'Budget & Finance', 'Report Writing'],
        min_k_score=20,
        salary_min=10, salary_max=20,
        growth_outlook='high',
        job_type='onsite',
        location='Pune',
        employment_type='full_time',
        expires_at=date.today() + timedelta(days=55),
    ),
    dict(
        employer_id=EMP2,
        title='Healthcare Programme Analyst',
        description=(
            'Support public health programmes run by state governments and bilateral agencies. '
            'Responsibilities include data collection, monitoring and evaluation, field visits, and '
            'report preparation. You will work closely with district health officials and NGO partners. '
            'Understanding of India public health policy, a key UPSC GS Paper II topic, and strong '
            'interpersonal skills are important for success. Willingness to travel to field locations is required.'
        ),
        sector='Healthcare',
        required_skills=['Project Management', 'Analytical Thinking', 'Report Writing', 'Stakeholder Engagement', 'Ethics & Integrity', 'Organisation & Planning', 'Research'],
        min_k_score=15,
        salary_min=7, salary_max=13,
        growth_outlook='high',
        job_type='hybrid',
        location='Lucknow',
        employment_type='full_time',
        expires_at=date.today() + timedelta(days=25),
    ),
    dict(
        employer_id=EMP1,
        title='Financial Analyst – Public Sector Advisory',
        description=(
            'Provide financial analysis support to government bodies, PSUs, and multilateral clients on '
            'budgeting, expenditure tracking, and fiscal policy. You will build financial models, review '
            'budget documents, and present insights to senior advisors. Strong Excel skills, attention to '
            'detail, and comfort with large numerical datasets are essential. UPSC Economics and Budget '
            'preparation from GS Paper III is directly applicable and valued in this role.'
        ),
        sector='Banking / Finance',
        required_skills=['Analytical Thinking', 'Attention to Detail', 'MS Office / Excel', 'Budget & Finance', 'Problem Solving', 'Decision Making', 'Report Writing'],
        min_k_score=25,
        salary_min=12, salary_max=22,
        growth_outlook='medium',
        job_type='hybrid',
        location='Mumbai',
        employment_type='full_time',
        expires_at=date.today() + timedelta(days=42),
    ),
    dict(
        employer_id=EMP2,
        title='Content & Editorial Lead – Current Affairs',
        description=(
            'Lead the editorial team producing high-quality current affairs content for competitive exam '
            'aspirants, policy audiences, and corporate newsletters. Write, review, and commission articles '
            'on governance, economy, environment, and international relations. Your UPSC preparation gives '
            'you an unmatched advantage as you understand the audience, the subject matter, and the '
            'precision required better than anyone. Fully remote with flexible hours.'
        ),
        sector='Media',
        required_skills=['Written Communication', 'GK & Current Affairs', 'Research', 'Critical Thinking', 'Presentation Skills', 'Language Proficiency', 'Attention to Detail'],
        min_k_score=20,
        salary_min=7, salary_max=14,
        growth_outlook='medium',
        job_type='remote',
        location=None,
        employment_type='full_time',
        expires_at=date.today() + timedelta(days=20),
    ),
    dict(
        employer_id=EMP2,
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
        expires_at=date.today() + timedelta(days=30),
    ),
    dict(
        employer_id=EMP1,
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
        expires_at=date.today() + timedelta(days=60),
    ),
]

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
    )
    db.add(job)
    count += 1

db.commit()
db.close()
print(f'Successfully inserted {count} job postings.')
