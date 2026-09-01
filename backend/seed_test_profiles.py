"""
Seed script: Delete all aspirant and employer users, then create 5 fresh entries each
with ALL profile fields filled (including PsychologicalAssessment for aspirants).
Run inside the backend Docker container:
  docker exec -it disha_backend python seed_test_profiles.py
"""
import sys
from datetime import date
from passlib.context import CryptContext
from sqlalchemy import text
from app.database import SessionLocal
from app.models.user import (
    AspirantProfile, EmployerProfile, PsychologicalAssessment, Role, User,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_pw(plain: str) -> str:
    return pwd_context.hash(plain)


ASPIRANTS = [
    {
        "email": "aspirant1@disha.test",
        "phone": "+911111111001",
        "password": "Test@1234",
        # Step 1: Personal
        "full_name": "Aarav Sharma",
        "current_status": "student",
        "date_of_birth": date(1999, 6, 15),
        "gender": "male",
        "city": "Delhi",
        "state": "Delhi",
        # Step 2: Education
        "highest_qualification": "graduate",
        "degree": "B.A. Political Science",
        "field_of_study": "Political Science",
        "institution": "Delhi University",
        "graduation_year": 2023,
        # Step 3: UPSC Journey
        "upsc_exam": "cse",
        "years_preparing": 2,
        "upsc_attempts": 1,
        "highest_stage_cleared": "prelims",
        "optional_subject": "Political Science",
        # Step 4: Work Experience
        "has_work_experience": False,
        "work_experience_years": None,
        "work_experience_domain": None,
        "last_designation": None,
        # Step 5: Skills
        "skills": ["Essay Writing", "Current Affairs", "Analytical Thinking", "Public Administration", "Ethics"],
        # Step 6: Career Preferences
        "preferred_sectors": ["Civil Services", "Government", "Public Policy"],
        "preferred_locations": ["Delhi", "Noida", "Gurugram"],
        "open_to_relocation": True,
        "expected_salary_min": 6,
        "expected_salary_max": 12,
        "disha_insight": "You have a strong sense of purpose and are in a good mental space to push forward. Your moderate financial pressure keeps you focused without overwhelming you.",
        "weekly_study_hours": 10,
        # One-time learning setup (formerly Step 7)
        "psych": {"burnout_score": 30, "confidence_index": 65},
    },
    {
        "email": "aspirant2@disha.test",
        "phone": "+911111111002",
        "password": "Test@1234",
        # Step 1
        "full_name": "Priya Verma",
        "current_status": "fresher",
        "date_of_birth": date(1997, 3, 22),
        "gender": "female",
        "city": "Lucknow",
        "state": "Uttar Pradesh",
        # Step 2
        "highest_qualification": "post_graduate",
        "degree": "M.A. History",
        "field_of_study": "History",
        "institution": "Lucknow University",
        "graduation_year": 2022,
        # Step 3
        "upsc_exam": "cse",
        "years_preparing": 3,
        "upsc_attempts": 2,
        "highest_stage_cleared": "mains",
        "optional_subject": "History",
        # Step 4
        "has_work_experience": False,
        "work_experience_years": None,
        "work_experience_domain": None,
        "last_designation": None,
        # Step 5
        "skills": ["Research", "Report Writing", "Hindi Writing", "Sanskrit", "Modern History"],
        # Step 6
        "preferred_sectors": ["Civil Services", "Education", "Culture & Heritage"],
        "preferred_locations": ["Lucknow", "Delhi", "Allahabad"],
        "open_to_relocation": True,
        "expected_salary_min": 7,
        "expected_salary_max": 14,
        "disha_insight": "Two mains attempts show real grit. The moderate burnout you're feeling is normal — channel the financial pressure as fuel, not fear.",
        "weekly_study_hours": 8,
        # One-time learning setup (formerly Step 7)
        "psych": {
            "burnout_score": 55,
            "confidence_index": 50,
        },
    },
    {
        "email": "aspirant3@disha.test",
        "phone": "+911111111003",
        "password": "Test@1234",
        # Step 1
        "full_name": "Rahul Mishra",
        "current_status": "experienced",
        "date_of_birth": date(1996, 11, 8),
        "gender": "male",
        "city": "Patna",
        "state": "Bihar",
        # Step 2
        "highest_qualification": "graduate",
        "degree": "B.Tech Computer Science",
        "field_of_study": "Computer Science",
        "institution": "NIT Patna",
        "graduation_year": 2020,
        # Step 3
        "upsc_exam": "cse",
        "years_preparing": 1,
        "upsc_attempts": 0,
        "highest_stage_cleared": "none",
        "optional_subject": "Mathematics",
        # Step 4
        "has_work_experience": True,
        "work_experience_years": 3,
        "work_experience_domain": "Software Engineering",
        "last_designation": "Software Engineer",
        # Step 5
        "skills": ["Programming", "Data Analysis", "Problem Solving", "System Design", "Quantitative Aptitude"],
        # Step 6
        "preferred_sectors": ["Technology", "Civil Services", "PSU"],
        "preferred_locations": ["Patna", "Delhi", "Bangalore", "Hyderabad"],
        "open_to_relocation": True,
        "expected_salary_min": 12,
        "expected_salary_max": 20,
        "disha_insight": "Your technical background is a huge strategic advantage. Low pressure and high confidence — you're in an ideal position to prepare systematically without anxiety.",
        "weekly_study_hours": 15,
        # One-time learning setup (formerly Step 7)
        "psych": {
            "burnout_score": 20,
            "confidence_index": 75,
        },
    },
    {
        "email": "aspirant4@disha.test",
        "phone": "+911111111004",
        "password": "Test@1234",
        # Step 1
        "full_name": "Sneha Gupta",
        "current_status": "student",
        "date_of_birth": date(2001, 8, 30),
        "gender": "female",
        "city": "Jaipur",
        "state": "Rajasthan",
        # Step 2
        "highest_qualification": "graduate",
        "degree": "B.Com",
        "field_of_study": "Commerce",
        "institution": "University of Rajasthan",
        "graduation_year": 2024,
        # Step 3
        "upsc_exam": "state_pcs",
        "years_preparing": 1,
        "upsc_attempts": 0,
        "highest_stage_cleared": "none",
        "optional_subject": "Geography",
        # Step 4
        "has_work_experience": False,
        "work_experience_years": None,
        "work_experience_domain": None,
        "last_designation": None,
        # Step 5
        "skills": ["Accounting", "Current Affairs", "Communication", "MS Excel", "GK & Reasoning"],
        # Step 6
        "preferred_sectors": ["State Services", "Banking", "Finance"],
        "preferred_locations": ["Jaipur", "Ajmer", "Jodhpur"],
        "open_to_relocation": False,
        "expected_salary_min": 5,
        "expected_salary_max": 10,
        "disha_insight": "Fresh start, clear goals — you have everything ahead of you. Your strong support system will be key in the initial tough months of preparation.",
        "weekly_study_hours": 6,
        # One-time learning setup (formerly Step 7)
        "psych": {
            "burnout_score": 15,
            "confidence_index": 60,
        },
    },
    {
        "email": "aspirant5@disha.test",
        "phone": "+911111111005",
        "password": "Test@1234",
        # Step 1
        "full_name": "Vikram Singh",
        "current_status": "experienced",
        "date_of_birth": date(1995, 2, 14),
        "gender": "male",
        "city": "Bhopal",
        "state": "Madhya Pradesh",
        # Step 2
        "highest_qualification": "post_graduate",
        "degree": "M.Sc Economics",
        "field_of_study": "Economics",
        "institution": "Barkatullah University",
        "graduation_year": 2021,
        # Step 3
        "upsc_exam": "cse",
        "years_preparing": 4,
        "upsc_attempts": 3,
        "highest_stage_cleared": "mains",
        "optional_subject": "Economics",
        # Step 4
        "has_work_experience": True,
        "work_experience_years": 2,
        "work_experience_domain": "Banking",
        "last_designation": "Junior Analyst",
        # Step 5
        "skills": ["Economic Analysis", "Policy Research", "Data Interpretation", "Budget Analysis", "Essay Writing"],
        # Step 6
        "preferred_sectors": ["Civil Services", "Finance", "Economic Advisory"],
        "preferred_locations": ["Bhopal", "Delhi", "Mumbai"],
        "open_to_relocation": True,
        "expected_salary_min": 8,
        "expected_salary_max": 18,
        "disha_insight": "Three mains attempts is an incredible journey — don't let the fatigue define you. The burnout is real and needs attention. Consider structured breaks alongside focused preparation.",
        "weekly_study_hours": 5,
        # One-time learning setup (formerly Step 7)
        "psych": {
            "burnout_score": 70,
            "confidence_index": 40,
        },
    },
]

EMPLOYERS = [
    {
        "email": "employer1@disha.test",
        "phone": "+912222222001",
        "password": "Test@1234",
        "company_name": "TechMinds Consulting",
        "industry": "Consulting",
        "company_size": "51-200",
        "website": "https://techminds.example.com",
        "gst_number": "07AABCT1234A1Z5",
        "contact_person": "Ankit Joshi",
        "designation": "HR Manager",
        "city": "New Delhi",
        "description": "Leading consulting firm specializing in government policy and digital transformation projects.",
    },
    {
        "email": "employer2@disha.test",
        "phone": "+912222222002",
        "password": "Test@1234",
        "company_name": "GovTech Solutions",
        "industry": "Technology",
        "company_size": "201-500",
        "website": "https://govtech.example.com",
        "gst_number": "29AABCG5678B2Z1",
        "contact_person": "Meera Kapoor",
        "designation": "Talent Acquisition Lead",
        "city": "Bengaluru",
        "description": "Building secure digital infrastructure and e-governance platforms for public sector organizations across India.",
    },
    {
        "email": "employer3@disha.test",
        "phone": "+912222222003",
        "password": "Test@1234",
        "company_name": "PolicyPulse Research",
        "industry": "Research",
        "company_size": "11-50",
        "website": "https://policypulse.example.com",
        "gst_number": "27AABCP9012C3Z7",
        "contact_person": "Suresh Nair",
        "designation": "Founder & Director",
        "city": "Mumbai",
        "description": "Independent think tank focused on public policy research, governance advocacy, and social impact analysis.",
    },
    {
        "email": "employer4@disha.test",
        "phone": "+912222222004",
        "password": "Test@1234",
        "company_name": "CivicEdge Academy",
        "industry": "Education",
        "company_size": "51-200",
        "website": "https://civicedge.example.com",
        "gst_number": "36AABCC3456D4Z9",
        "contact_person": "Deepa Rao",
        "designation": "Operations Head",
        "city": "Hyderabad",
        "description": "Premier coaching and career development institute for civil services aspirants, offering structured mentorship and mock test programs.",
    },
    {
        "email": "employer5@disha.test",
        "phone": "+912222222005",
        "password": "Test@1234",
        "company_name": "PublicSector Hire",
        "industry": "Staffing",
        "company_size": "11-50",
        "website": "https://publicsectorhire.example.com",
        "gst_number": "20AABCP7890E5Z3",
        "contact_person": "Ramesh Tiwari",
        "designation": "CEO",
        "city": "Pune",
        "description": "Specialized recruitment firm connecting UPSC/PCS talent with government bodies, PSUs, and allied public sector roles.",
    },
]


def main():
    db = SessionLocal()
    try:
        aspirant_role = db.query(Role).filter(Role.name == "aspirant").first()
        employer_role = db.query(Role).filter(Role.name == "employer").first()

        if not aspirant_role:
            print("ERROR: 'aspirant' role not found. Run migrations first.")
            sys.exit(1)
        if not employer_role:
            print("ERROR: 'employer' role not found. Run migrations first.")
            sys.exit(1)

        # ── Delete all existing aspirant & employer users (DB CASCADE cleans profiles) ──
        r1 = db.execute(text("DELETE FROM users WHERE role_id = :rid"), {"rid": str(aspirant_role.id)})
        r2 = db.execute(text("DELETE FROM users WHERE role_id = :rid"), {"rid": str(employer_role.id)})
        db.commit()
        print(f"Deleted {r1.rowcount} aspirant(s) and {r2.rowcount} employer(s).\n")

        # ── Create 5 aspirants ────────────────────────────────────────────────
        print("Creating 5 aspirant profiles...")
        for data in ASPIRANTS:
            password = data.pop("password")
            email = data.pop("email")
            phone = data.pop("phone")
            psych_data = data.pop("psych")

            user = User(
                email=email,
                phone=phone,
                password_hash=hash_pw(password),
                role_id=aspirant_role.id,
                email_verified=True,
                phone_verified=True,
                is_active=True,
            )
            db.add(user)
            db.flush()

            profile = AspirantProfile(
                user_id=user.id,
                current_step=6,
                is_completed=True,
                **data,
            )
            db.add(profile)

            psych = PsychologicalAssessment(user_id=user.id, **psych_data)
            db.add(psych)

            print(f"  + {data['full_name']} <{email}>  pw: Test@1234")

        db.commit()

        # ── Create 5 employers ────────────────────────────────────────────────
        print("\nCreating 5 employer profiles...")
        for data in EMPLOYERS:
            password = data.pop("password")
            email = data.pop("email")
            phone = data.pop("phone")

            user = User(
                email=email,
                phone=phone,
                password_hash=hash_pw(password),
                role_id=employer_role.id,
                email_verified=True,
                phone_verified=True,
                is_active=True,
            )
            db.add(user)
            db.flush()

            profile = EmployerProfile(user_id=user.id, is_approved=True, is_owner=True, **data)
            db.add(profile)

            print(f"  + {data['contact_person']} ({data['company_name']}) <{email}>  pw: Test@1234")

        db.commit()
        print("\nDone! All profiles fully seeded.")

    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
