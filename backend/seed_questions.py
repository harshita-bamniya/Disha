"""
Seed question bank for Mock Interview Engine.
Run: python seed_questions.py

Seeds 50+ questions across universal and career-track-specific categories.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.mvp2 import QuestionBank
from app.models.user import CareerTrack

UNIVERSAL_QUESTIONS = [
    # Behavioral — easy
    ("Tell me about a time you had to learn something complex under pressure.", "behavioral", "easy"),
    ("Describe a situation where you had to work with limited resources.", "behavioral", "easy"),
    ("Give an example of a goal you set and how you achieved it.", "behavioral", "easy"),
    ("Tell me about a time you received critical feedback. How did you respond?", "behavioral", "easy"),
    ("Describe a situation where you showed initiative.", "behavioral", "easy"),

    # Behavioral — medium
    ("Describe a time you had to manage multiple priorities simultaneously.", "behavioral", "medium"),
    ("Tell me about a complex problem you solved. Walk me through your approach.", "behavioral", "medium"),
    ("Describe a time you had to convince a skeptical stakeholder. What was your approach?", "behavioral", "medium"),
    ("Tell me about a time your plan didn't work out. What did you learn?", "behavioral", "medium"),
    ("Describe a situation where you had to collaborate with a difficult team member.", "behavioral", "medium"),

    # Behavioral — hard
    ("Describe a time you had to make a high-stakes decision with incomplete information.", "behavioral", "hard"),
    ("Tell me about a time you had to drive a significant change in an organization or team.", "behavioral", "hard"),
    ("Describe a situation where you had to navigate conflicting interests between stakeholders.", "behavioral", "hard"),

    # Situational — medium
    ("You join a new team and discover the current approach is inefficient. How do you handle it?", "situational", "medium"),
    ("Your manager gives you a target you believe is unrealistic. What do you do?", "situational", "medium"),
    ("You discover a significant error in a report that has already been shared. What do you do?", "situational", "medium"),
    ("A client is unhappy and your team is not taking it seriously. How do you respond?", "situational", "medium"),

    # HR
    ("Why do you want to transition from your current path to the private sector?", "hr", "easy"),
    ("Where do you see yourself in 5 years?", "hr", "easy"),
    ("What are your greatest strengths and how do they translate to a corporate environment?", "hr", "easy"),
    ("What do you consider your biggest weakness? What are you doing about it?", "hr", "medium"),
    ("Why should we hire you over other candidates?", "hr", "medium"),
    ("How do you handle ambiguity and rapid change?", "hr", "medium"),
    ("Tell me about yourself in 2 minutes.", "hr", "easy"),
    ("What motivates you in your work?", "hr", "easy"),
    ("How do you define success?", "hr", "easy"),
    ("What do you know about our company and why does this role interest you?", "hr", "medium"),
]

POLICY_CONSULTING_QUESTIONS = [
    ("You're asked to draft a policy brief on urban housing affordability in 48 hours. Walk me through your approach.", "case", "hard"),
    ("How would you translate a government policy into actionable recommendations for a private client?", "technical", "medium"),
    ("A state government asks your firm to evaluate the success of a flagship welfare scheme. What framework do you use?", "case", "hard"),
    ("Tell me about a public policy issue you've analyzed deeply. What were your key findings?", "behavioral", "medium"),
    ("How do you handle situations where research findings conflict with a client's preferred outcome?", "situational", "hard"),
    ("Explain the difference between policy advocacy and policy implementation. Why does it matter in consulting?", "technical", "easy"),
    ("How would you present a complex policy analysis to an audience of non-experts?", "situational", "medium"),
]

ESG_QUESTIONS = [
    ("How would you build a materiality assessment for a mid-size manufacturing company?", "technical", "hard"),
    ("Tell me about a sustainability or CSR initiative you find particularly effective and why.", "behavioral", "medium"),
    ("A client wants to improve their ESG rating but has limited budget. What do you prioritize?", "case", "hard"),
    ("How do you measure the social impact of a program that has no direct financial metric?", "technical", "hard"),
    ("Explain the difference between ESG reporting and impact investing to a CFO.", "technical", "medium"),
    ("How would you structure a stakeholder engagement process for a infrastructure project affecting communities?", "situational", "hard"),
]

EDTECH_QUESTIONS = [
    ("How would you design a learning product for first-generation learners in Tier-3 cities?", "case", "hard"),
    ("Tell me about a time you had to understand a user's learning needs deeply before building a solution.", "behavioral", "medium"),
    ("A school reports that students are disengaged with your platform. How do you diagnose and solve this?", "situational", "hard"),
    ("How would you measure the educational effectiveness of a course or program?", "technical", "medium"),
    ("What metrics would you track to determine if an EdTech product is succeeding?", "technical", "easy"),
    ("How does blended learning differ from fully online learning? When do you recommend each?", "technical", "medium"),
]

NGO_LEADERSHIP_QUESTIONS = [
    ("How do you build trust with communities that may be skeptical of your organization?", "behavioral", "medium"),
    ("Tell me about a program or initiative you believe was poorly designed and what should have been done differently.", "behavioral", "hard"),
    ("How do you balance donor expectations with beneficiary needs?", "situational", "hard"),
    ("Describe how you would conduct a participatory needs assessment in a rural community.", "technical", "medium"),
    ("How do you measure the long-term impact of a livelihood program?", "technical", "hard"),
    ("A major donor wants to pivot your organization's focus. How do you respond?", "situational", "hard"),
]


def seed():
    db = SessionLocal()
    try:
        existing_count = db.query(QuestionBank).count()
        if existing_count > 0:
            print(f"Question bank already has {existing_count} questions. Skipping seed.")
            return

        # Fetch career tracks for tagging
        tracks = {t.slug: t for t in db.query(CareerTrack).all()}

        # Seed universal questions (no career track)
        for text, q_type, difficulty in UNIVERSAL_QUESTIONS:
            db.add(QuestionBank(
                question_text=text,
                question_type=q_type,
                difficulty=difficulty,
                language="en",
                is_active=True,
            ))

        # Helper: seed with track
        def seed_with_track(questions, track_slug):
            track = tracks.get(track_slug)
            track_id = track.id if track else None
            for text, q_type, difficulty in questions:
                db.add(QuestionBank(
                    career_track_id=track_id,
                    question_text=text,
                    question_type=q_type,
                    difficulty=difficulty,
                    language="en",
                    is_active=True,
                ))

        seed_with_track(POLICY_CONSULTING_QUESTIONS, "policy-consulting")
        seed_with_track(ESG_QUESTIONS, "esg-sustainability")
        seed_with_track(EDTECH_QUESTIONS, "edtech-learning")
        seed_with_track(NGO_LEADERSHIP_QUESTIONS, "ngo-leadership")

        db.commit()
        final_count = db.query(QuestionBank).count()
        print(f"Seeded {final_count} questions successfully.")

    except Exception as e:
        db.rollback()
        print(f"Error seeding questions: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
