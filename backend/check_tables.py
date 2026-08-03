"""List all DB tables and check model table names."""
from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
rows = db.execute(
    text("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
).fetchall()
print("=== All tables in DB ===")
for r in rows:
    print(" ", r[0])

# Check ATS-related model table names
print("\n=== ATS Model __tablename__ values ===")
try:
    from app.modules.application_forms.service import ApplicationForm, FormSection, Question
    print("ApplicationForm.__tablename__:", ApplicationForm.__tablename__)
    print("FormSection.__tablename__:", FormSection.__tablename__)
    print("Question.__tablename__:", Question.__tablename__)
except Exception as e:
    print("Error importing service models:", e)

try:
    from app.models import application_forms as af_models
    import inspect
    for name, obj in inspect.getmembers(af_models):
        if hasattr(obj, '__tablename__'):
            print(f"  {name}.__tablename__ = {obj.__tablename__}")
except Exception as e:
    print("models.application_forms import error:", e)

# Try finding any model file
import os
for root, dirs, files in os.walk("/app/app/models"):
    for f in files:
        if "form" in f or "ats" in f or "application" in f:
            print(f"  model file: {os.path.join(root, f)}")

db.close()
