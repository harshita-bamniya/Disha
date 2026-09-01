"""
Seed resume_templates table with 3 ATS-friendly templates.
Run: python seed_resume_templates.py
"""
import uuid
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.resume import ResumeTemplate


TEMPLATES = [
    {
        "name": "ATS Clean",
        "description": "Minimal single-column layout optimised for applicant tracking systems. Best for corporate and consulting roles.",
        "template_type": "ats_clean",
        "thumbnail_url": None,
    },
    {
        "name": "Modern Two-Column",
        "description": "Two-column layout with a coloured sidebar. Visually distinct while retaining strong ATS compatibility.",
        "template_type": "modern",
        "thumbnail_url": None,
    },
    {
        "name": "Hybrid Pro",
        "description": "Combines a clean header with a compact skills bar and a single content column. Ideal for policy and ESG roles.",
        "template_type": "hybrid",
        "thumbnail_url": None,
    },
]


def seed():
    db: Session = SessionLocal()
    try:
        existing = db.query(ResumeTemplate).count()
        if existing:
            print(f"resume_templates already has {existing} rows — skipping.")
            return

        for t in TEMPLATES:
            db.add(ResumeTemplate(**t))

        db.commit()
        print(f"Seeded {len(TEMPLATES)} resume templates.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
