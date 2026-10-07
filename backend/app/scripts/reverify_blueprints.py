"""Re-check every stored blueprint reference with the current link rules and drop the ones that fail.

    python -m app.scripts.reverify_blueprints            # apply
    python -m app.scripts.reverify_blueprints --dry-run  # report only

HTTP checks only (no AI calls). Run it after changing the link verification rules.
"""
import asyncio
import sys

from sqlalchemy.orm.attributes import flag_modified

from app.database import SessionLocal
from app.models.role_blueprint import RoleBlueprint
from app.modules.roadmap_engine.blueprint import reverify_references


async def main(dry_run: bool) -> None:
    db = SessionLocal()
    try:
        for bp in db.query(RoleBlueprint).filter(RoleBlueprint.is_current.is_(True)).all():
            graph = bp.graph
            skills = graph.get("skills", [])
            dropped = await reverify_references(skills, bp.title)
            print(f"{bp.title[:60]:60}  dropped {dropped} reference(s)")
            if not dry_run and dropped:
                bp.graph = graph
                flag_modified(bp, "graph")
        if not dry_run:
            db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main("--dry-run" in sys.argv))
