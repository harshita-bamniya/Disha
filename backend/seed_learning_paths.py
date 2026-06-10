"""
Seed curated learning paths for MVP2.
Run: python seed_learning_paths.py

Creates 5 learning paths, each with 3 modules and 3-5 lessons each.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.mvp2 import LearningPath, PathModule, Lesson
from app.models.user import CareerTrack

PATHS = [
    {
        "slug": "policy-consulting",
        "name": "Breaking into Policy Consulting",
        "description": "From UPSC analyst to policy consultant — translate your governance depth into client-facing advisory skills.",
        "estimated_hours": 12,
        "difficulty": "intermediate",
        "target_skills": ["Policy Research", "Analytical Reasoning", "Report Writing", "Stakeholder Engagement", "Strategic Planning", "Written Communication", "Presentation Skills"],
        "modules": [
            {
                "title": "The Consulting Mindset",
                "skill_focus": "Structured thinking",
                "lessons": [
                    {"title": "How consulting differs from government work", "content_type": "article", "duration_minutes": 10, "content_body": "Consulting is client-driven, time-bound, and deliverable-focused. Unlike government work where impact is often long-term and diffuse, consulting projects have clear milestones and measurable outputs. Your UPSC training in breaking down complex policy questions is exactly the analytical foundation consultants need — you just need to package it differently."},
                    {"title": "The McKinsey way: MECE and hypothesis-first thinking", "content_type": "article", "duration_minutes": 15, "content_body": "MECE (Mutually Exclusive, Collectively Exhaustive) is the cornerstone of consulting analysis. Hypothesis-first means starting with a clear answer and working backward to prove or disprove it — the opposite of how UPSC essays work, but far more efficient for client delivery."},
                    {"title": "Structuring a 48-hour policy brief", "content_type": "exercise", "duration_minutes": 30, "content_body": "Exercise: You are hired by a state government to evaluate the effectiveness of their direct benefit transfer program. Structure your analysis in a 1-page brief. Time yourself to 45 minutes. Focus on: problem statement, methodology, 3 key findings, 2 recommendations."},
                ]
            },
            {
                "title": "Stakeholder Communication",
                "skill_focus": "Communication",
                "lessons": [
                    {"title": "Translating bureaucratic findings into executive summaries", "content_type": "article", "duration_minutes": 10, "content_body": "Government reports often run 200+ pages. Consultants distill to 2-pagers. The key shift: lead with the 'so what', not the methodology. Executives buy the conclusion, not the process."},
                    {"title": "Presenting to non-experts: the Pyramid Principle", "content_type": "article", "duration_minutes": 12, "content_body": "Barbara Minto's Pyramid Principle: start with the answer, then support it with grouped arguments, each supported by data. This is how McKinsey presentations are structured. Practice converting your UPSC answers into this format."},
                    {"title": "Mock stakeholder meeting exercise", "content_type": "exercise", "duration_minutes": 20, "content_body": "Scenario: You need to present findings from a healthcare program evaluation to a Secretary-level official who has 15 minutes. Prepare 3 slides: problem, findings, recommendation. What do you cut? What do you keep?"},
                ]
            },
            {
                "title": "Building Your Consulting Profile",
                "skill_focus": "Career positioning",
                "lessons": [
                    {"title": "Crafting your narrative: UPSC to consulting", "content_type": "article", "duration_minutes": 8, "content_body": "The question you'll face: 'Why consulting after UPSC?' Your answer must be genuine, forward-looking, and skills-based. Bad answer: 'I didn't make it.' Good answer: 'Policy consulting lets me drive the change I wanted, working with governments and private actors simultaneously.'"},
                    {"title": "Consulting case study practice guide", "content_type": "article", "duration_minutes": 10, "content_body": "Public policy cases (health, education, infrastructure) are your stronghold. Practice 2 cases per week using the Case in Point framework. Resources: casebook.io, Management Consulted, Victor Cheng's LOMS."},
                    {"title": "Networking into policy consulting firms", "content_type": "article", "duration_minutes": 8, "content_body": "Target firms: Dalberg, IDinsight, J-PAL, KPMG Public Sector, EY-Parthenon, BCG Center for Public Impact. LinkedIn outreach templates, informational interview approach, conference strategy."},
                ]
            },
        ]
    },
    {
        "slug": "esg-sustainability",
        "name": "ESG and Sustainability Careers",
        "description": "Leverage your policy and governance knowledge to enter the rapidly growing ESG and sustainability sector.",
        "estimated_hours": 10,
        "difficulty": "beginner",
        "target_skills": ["Ethics & Integrity", "Research & Analysis", "Stakeholder Engagement", "Data Interpretation", "Policy Research", "Report Writing", "Project Management"],
        "modules": [
            {
                "title": "ESG Fundamentals",
                "skill_focus": "Domain knowledge",
                "lessons": [
                    {"title": "What is ESG and why it matters now", "content_type": "article", "duration_minutes": 10, "content_body": "ESG (Environmental, Social, Governance) is how investors and regulators evaluate corporate non-financial risk and impact. With SEBI's Business Responsibility & Sustainability Report (BRSR) now mandatory for top 1000 companies, ESG professionals are in high demand in India."},
                    {"title": "ESG frameworks: GRI, SASB, TCFD explained", "content_type": "article", "duration_minutes": 15, "content_body": "GRI (Global Reporting Initiative) — most widely used global standard. SASB — sector-specific, investor-focused. TCFD — climate risk disclosure for financial institutions. Understanding the differences and when each applies is foundational ESG knowledge."},
                    {"title": "India's ESG regulatory landscape", "content_type": "article", "duration_minutes": 10, "content_body": "Key milestones: SEBI BRSR (2022), RBI ESG guidelines for banks, MCA's National Guidelines on Responsible Business Conduct. Your UPSC knowledge of regulatory frameworks gives you a real edge here."},
                ]
            },
            {
                "title": "Materiality and Impact Measurement",
                "skill_focus": "Analysis",
                "lessons": [
                    {"title": "Conducting a materiality assessment", "content_type": "article", "duration_minutes": 12, "content_body": "A materiality assessment identifies which ESG topics are most significant for a company and its stakeholders. Process: stakeholder mapping, issue identification, prioritization matrix, validation. Your GS Paper II knowledge of stakeholder analysis applies directly."},
                    {"title": "Social impact measurement frameworks", "content_type": "article", "duration_minutes": 10, "content_body": "SROI (Social Return on Investment), Theory of Change, Outcome Harvesting. The challenge: measuring what matters vs. what's measurable. UPSC preparation in social sector policy gives you the conceptual depth others lack."},
                    {"title": "Capstone: Draft a materiality matrix", "content_type": "exercise", "duration_minutes": 25, "content_body": "Choose any company you know (Tata Steel, NTPC, Infosys). Identify 10 potential ESG issues, plot them on a materiality matrix (impact on business × impact on stakeholders). Justify your placement."},
                ]
            },
            {
                "title": "Career Pathways in ESG",
                "skill_focus": "Career positioning",
                "lessons": [
                    {"title": "Types of ESG roles and which suits you", "content_type": "article", "duration_minutes": 8, "content_body": "ESG roles: Corporate Sustainability Manager, ESG Analyst (investor side), Impact Investment Analyst, CSR Head, ESG Consultant, Sustainability Reporting Specialist. UPSC background fits best in: consulting, corporate roles, development finance."},
                    {"title": "Building an ESG certification path", "content_type": "article", "duration_minutes": 6, "content_body": "Relevant certifications: CFA ESG Certificate, GRI Certified Sustainability Professional, SASB FSA Credential, CDP accreditation. Start with GRI Certified Course (free online materials available)."},
                ]
            },
        ]
    },
    {
        "slug": "communication-corporate",
        "name": "Corporate Communication Mastery",
        "description": "Transform formal UPSC communication style into crisp, impact-focused corporate communication.",
        "estimated_hours": 8,
        "difficulty": "beginner",
        "target_skills": ["Written Communication", "Public Speaking", "Presentation Skills", "Report Writing", "Stakeholder Engagement", "English Proficiency"],
        "modules": [
            {
                "title": "The Corporate Communication Shift",
                "skill_focus": "Communication",
                "lessons": [
                    {"title": "Why UPSC writing style doesn't work in corporate settings", "content_type": "article", "duration_minutes": 8, "content_body": "UPSC writing: comprehensive, balanced, nuanced, long. Corporate writing: direct, actionable, brief, outcome-focused. The skills you developed are valuable — they just need to be deployed differently. A 1000-word UPSC answer would be a 200-word corporate email with 3 bullet points."},
                    {"title": "Email communication: the 5-sentence rule", "content_type": "article", "duration_minutes": 8, "content_body": "Every professional email should answer: What do you want? Why does it matter? What's the ask? When is the deadline? What happens if no response? Anything beyond 5-7 lines becomes a document, not an email."},
                    {"title": "Writing executive updates and memos", "content_type": "exercise", "duration_minutes": 20, "content_body": "Exercise: Convert a 500-word policy analysis into a 1-page executive memo for a CEO. Include: situation (1 sentence), complication (1-2 sentences), question (1 sentence), answer (1-2 sentences), supporting argument (3 bullets)."},
                ]
            },
            {
                "title": "Verbal Communication and Presentations",
                "skill_focus": "Public speaking",
                "lessons": [
                    {"title": "The 3-point structure for any verbal answer", "content_type": "article", "duration_minutes": 6, "content_body": "In interviews and meetings, every answer should have 3 parts: Position (your answer upfront), Proof (evidence/example), Payoff (why it matters for the audience). This is the corporate equivalent of the UPSC answer structure, but inverted."},
                    {"title": "Eliminating filler language and hesitation markers", "content_type": "exercise", "duration_minutes": 15, "content_body": "Common UPSC-background habits to unlearn: over-explaining context before the point, 'actually' and 'basically', excessive qualifications, thinking out loud. Practice: Record yourself answering 'Tell me about yourself' for 2 minutes. Listen back. Count your filler words."},
                    {"title": "Slide design for non-designers", "content_type": "article", "duration_minutes": 10, "content_body": "Corporate slide rule: one idea per slide, title is the takeaway (not the topic), maximum 3 data points per chart, always ask 'so what?' about every element. McKinsey slides have no text — just charts and the headline tells the story."},
                ]
            },
            {
                "title": "Networking and Relationship Building",
                "skill_focus": "Networking",
                "lessons": [
                    {"title": "Cold outreach that gets responses", "content_type": "article", "duration_minutes": 8, "content_body": "3-sentence LinkedIn message formula: Specific connection point + Genuine reason you're reaching out + Clear, small ask. Avoid: long life stories, vague asks like 'guidance', anything that puts the burden on the recipient."},
                    {"title": "Building a professional network from scratch", "content_type": "article", "duration_minutes": 8, "content_body": "Start with: alumni networks, UPSC community networks (many have transitioned), LinkedIn groups for policy/ESG/NGO professionals, sector-specific events and conferences. One meaningful conversation per week is more valuable than 50 connection requests."},
                ]
            },
        ]
    },
    {
        "slug": "data-analytics",
        "name": "Data Analysis for Non-Technical Professionals",
        "description": "Build data fluency to complement your policy expertise — from Excel to basic Python data analysis.",
        "estimated_hours": 15,
        "difficulty": "intermediate",
        "target_skills": ["Data Analysis", "Data Interpretation", "Research & Analysis", "Analytical Reasoning", "MS Office / Excel", "Computer Skills", "Problem Solving"],
        "modules": [
            {
                "title": "Excel for Policy Analysis",
                "skill_focus": "Data analysis",
                "lessons": [
                    {"title": "Pivot tables and data summarization", "content_type": "article", "duration_minutes": 15, "content_body": "Pivot tables are the single most powerful Excel tool for analyzing large datasets without coding. For policy analysis: summarize survey data by state, compare pre/post program metrics, cross-tabulate demographic data. Practice: Download any NSSO or NFHS dataset and build a pivot table."},
                    {"title": "Visualizing data for impact", "content_type": "article", "duration_minutes": 10, "content_body": "Chart selection guide: Comparison over time → Line chart. Part-of-whole → Pie or treemap. Distribution → Histogram. Relationship → Scatter plot. Geographic → Map. The UPSC habit of using tables works for academic writing — in corporate, visuals win."},
                    {"title": "Building an analytical dashboard in Excel", "content_type": "exercise", "duration_minutes": 30, "content_body": "Download the World Bank India development indicators dataset. Build a 1-page dashboard showing: literacy rate trends (2000-2020), state-wise comparison for one indicator, and a forecast using simple linear extrapolation."},
                ]
            },
            {
                "title": "Introduction to Data-Driven Decision Making",
                "skill_focus": "Analytical thinking",
                "lessons": [
                    {"title": "Correlation vs. causation in policy analysis", "content_type": "article", "duration_minutes": 10, "content_body": "One of the most important distinctions in policy analysis. Ice cream sales and drowning deaths are correlated — but ice cream doesn't cause drowning (both correlate with summer heat). Before claiming a policy caused an outcome, you need to rule out confounders."},
                    {"title": "Basic statistical concepts every analyst needs", "content_type": "article", "duration_minutes": 12, "content_body": "Mean vs. median (why median household income matters more than average). Standard deviation (understanding spread). p-value and statistical significance (when is a result real vs. random?). Confidence intervals. Sample size and representativeness."},
                    {"title": "Reading and critiquing research reports", "content_type": "exercise", "duration_minutes": 20, "content_body": "Find any policy evaluation report from J-PAL, NITI Aayog, or IFPRI. Read the methodology section. Answer: What was the sample size? What was the comparison group? What are the 3 key limitations the authors acknowledge? What claims cannot be supported by the data?"},
                ]
            },
            {
                "title": "Introduction to Python for Analysis",
                "skill_focus": "Technical skills",
                "lessons": [
                    {"title": "Python basics for complete beginners", "content_type": "article", "duration_minutes": 15, "content_body": "You don't need to be a programmer. You need to be able to: load a CSV, filter rows, calculate means by group, create a chart. These 4 things cover 80% of policy data analysis tasks. Start with Jupyter notebooks — the most accessible Python environment."},
                    {"title": "Pandas in 30 minutes", "content_type": "article", "duration_minutes": 20, "content_body": "Pandas is Python's Excel. Key operations: pd.read_csv(), df.head(), df.describe(), df.groupby(), df.merge(), df.plot(). The mental model: think of it as Excel formulas, but one line of code instead of navigating menus."},
                    {"title": "Your first data analysis project", "content_type": "exercise", "duration_minutes": 45, "content_body": "Use the Census 2011 District Level Database (freely available). Using Pandas: Load the data, calculate literacy rates by state, find the 5 districts with the highest female-to-male literacy ratio gap, create a bar chart. Save your notebook and share it on GitHub."},
                ]
            },
        ]
    },
    {
        "slug": "leadership-management",
        "name": "Leadership and Team Management",
        "description": "Translate your grassroots leadership experience into structured management frameworks valued by employers.",
        "estimated_hours": 8,
        "difficulty": "beginner",
        "target_skills": ["Leadership", "Management", "Project Management", "Strategic Planning", "Decision Making", "Stakeholder Engagement", "Budget & Finance"],
        "modules": [
            {
                "title": "Leadership Frameworks",
                "skill_focus": "Leadership",
                "lessons": [
                    {"title": "Situational leadership: adapting your style", "content_type": "article", "duration_minutes": 10, "content_body": "Hersey and Blanchard's model: your leadership style should change based on team member readiness. Directive → Coaching → Supporting → Delegating. UPSC prep taught you self-directed learning — how do you lead someone who needs direction vs. someone who needs autonomy?"},
                    {"title": "The difference between managing tasks and developing people", "content_type": "article", "duration_minutes": 8, "content_body": "New managers (and UPSC aspirants entering leadership) often default to controlling outputs. Effective managers multiply capability. The 70-20-10 learning model: 70% on-the-job, 20% coaching/feedback, 10% formal training."},
                    {"title": "Case study: Leading through organizational change", "content_type": "case_study", "duration_minutes": 20, "content_body": "You are 6 months into a role as a program manager at an NGO. The board decides to pivot from education to livelihood programs. Half your team is resistant. Using Kotter's 8-step change model, outline how you would lead this transition. Focus on: urgency creation, coalition building, and sustaining momentum."},
                ]
            },
            {
                "title": "Performance and Feedback",
                "skill_focus": "Management",
                "lessons": [
                    {"title": "Giving feedback without hierarchy", "content_type": "article", "duration_minutes": 8, "content_body": "In government, feedback flows downward through hierarchy. In corporations, feedback is peer-to-peer and upward. The SBI model: Situation → Behavior → Impact. Avoid: personality judgements, vague statements, feedback by proxy."},
                    {"title": "Setting OKRs and measuring team performance", "content_type": "article", "duration_minutes": 10, "content_body": "OKR (Objectives and Key Results) is how Google, LinkedIn, and most tech companies set goals. Objective: Qualitative, ambitious, inspirational. Key Results: 2-5 quantitative, measurable outcomes. For policy professionals, this replaces the vague 'improve governance' with 'reduce beneficiary grievances by 30% in Q2'."},
                ]
            },
            {
                "title": "Managing Up and Across",
                "skill_focus": "Organizational navigation",
                "lessons": [
                    {"title": "How to work effectively with your manager", "content_type": "article", "duration_minutes": 8, "content_body": "Managing up means understanding what your manager needs, communicating proactively, and making their job easier. Key behaviors: regular status updates without being asked, flagging issues early, making recommendations not just problems, aligning on priorities weekly."},
                    {"title": "Cross-functional collaboration in matrix organizations", "content_type": "article", "duration_minutes": 8, "content_body": "Most corporate projects involve people you don't manage — marketing, finance, tech. Influencing without authority requires: understanding their incentives, framing requests in terms of their goals, building social capital before you need it, and using data rather than authority to make arguments."},
                    {"title": "Organizational politics — reading the room", "content_type": "article", "duration_minutes": 8, "content_body": "Organizational politics isn't inherently negative — it's understanding power dynamics and decision-making flows. UPSC aspirants often underestimate this because government has explicit hierarchy. In corporations, influence is often informal. Identify: who has informal power, where decisions actually get made, what the unspoken success metrics are."},
                ]
            },
        ]
    },
]


def seed():
    db = SessionLocal()
    try:
        existing = db.query(LearningPath).count()
        if existing > 0:
            print(f"Learning paths already seeded ({existing} paths). Skipping.")
            return

        tracks = {t.slug: t for t in db.query(CareerTrack).all()}

        for i, path_data in enumerate(PATHS):
            track = tracks.get(path_data["slug"])
            path = LearningPath(
                career_track_id=track.id if track else None,
                name=path_data["name"],
                description=path_data["description"],
                estimated_hours=path_data["estimated_hours"],
                difficulty=path_data["difficulty"],
                target_skills=path_data.get("target_skills"),
                is_active=True,
                sort_order=i,
            )
            db.add(path)
            db.flush()

            for j, mod_data in enumerate(path_data["modules"]):
                mod = PathModule(
                    learning_path_id=path.id,
                    title=mod_data["title"],
                    skill_focus=mod_data.get("skill_focus"),
                    sort_order=j,
                )
                db.add(mod)
                db.flush()

                for k, lesson_data in enumerate(mod_data["lessons"]):
                    lesson = Lesson(
                        module_id=mod.id,
                        title=lesson_data["title"],
                        content_type=lesson_data["content_type"],
                        content_body=lesson_data.get("content_body"),
                        content_url=lesson_data.get("content_url"),
                        duration_minutes=lesson_data.get("duration_minutes", 10),
                        sort_order=k,
                        language="en",
                        is_active=True,
                    )
                    db.add(lesson)

        db.commit()
        final = db.query(LearningPath).count()
        print(f"Seeded {final} learning paths successfully.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
