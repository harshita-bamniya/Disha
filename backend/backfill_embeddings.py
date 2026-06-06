"""
One-time script: backfill description_embedding for existing job postings
that were created before the embedding system was added.

Run inside the container:
  docker compose exec backend python backfill_embeddings.py
"""
import sys
sys.path.insert(0, "/app")

from app.database import SessionLocal
from app.models.user import JobPosting
from app.modules.recommendations import embedder

db = SessionLocal()
try:
    jobs = db.query(JobPosting).filter(JobPosting.description_embedding == None).all()
    print(f"Jobs needing embeddings: {len(jobs)}")
    success = 0
    for job in jobs:
        text = embedder.build_job_text(job)
        vec = embedder.embed(text)
        if vec:
            job.description_embedding = vec
            success += 1
            print(f"  [OK] {job.title!r}")
        else:
            print(f"  [FAIL] {job.title!r} — embedder unavailable")
    db.commit()
    print(f"\nDone: {success}/{len(jobs)} jobs embedded.")
finally:
    db.close()
