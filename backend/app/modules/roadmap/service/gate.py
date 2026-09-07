"""Stage gate checking and advancement."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.roadmap import (
    StageGateEvaluation, UserRoadmap,
)
from app.models.user import (
    User,
)
from app.modules.roadmap.schemas import (
    GateCheckOut,
)
from app.modules.roadmap.service import core

logger = logging.getLogger(__name__)


def check_gate(roadmap_id: str, stage_number: int, user: User, db: Session) -> GateCheckOut:
    """Evaluate whether the user meets stage gate criteria."""
    roadmap = core._get_owned_roadmap(roadmap_id, user, db)
    criteria = core._GATE_CRITERIA.get(stage_number, [])
    results = core._evaluate_gate_criteria(criteria, stage_number, roadmap, user, db)

    all_passed = all(r["passed"] for r in results)
    status = "passed" if all_passed else "failed"

    # Persist gate evaluation
    gate_eval = StageGateEvaluation(
        roadmap_id=roadmap.id,
        stage_number=stage_number,
        status=status,
        gate_criteria=criteria,
        gate_results={"items": results},
    )
    db.add(gate_eval)
    db.commit()

    msg = (
        f"Stage {stage_number} gate passed. You can advance to Stage {stage_number + 1}."
        if all_passed
        else f"Not quite there yet. Complete the remaining requirements to unlock Stage {stage_number + 1}."
    )
    return GateCheckOut(
        stage_number=stage_number,
        can_advance=all_passed,
        status=status,
        criteria=results,
        message=msg,
    )


def advance_stage(roadmap_id: str, user: User, db: Session) -> UserRoadmap:
    """Advance roadmap to next stage. Validates gate first."""
    roadmap = core._get_owned_roadmap(roadmap_id, user, db)
    if roadmap.current_stage >= 6:
        raise ValueError("Already at Stage 6 — the final stage.")

    gate = check_gate(roadmap_id, roadmap.current_stage, user, db)
    if not gate.can_advance:
        raise ValueError(f"Stage {roadmap.current_stage} gate not yet passed.")

    roadmap.current_stage += 1
    roadmap.job_readiness_score = core._compute_jrs_internal(user, roadmap, db)
    db.commit()
    db.refresh(roadmap)

    # Award XP for completing a stage
    try:
        from app.modules.xp.service import award_xp
        award_xp(user.id, "stage_complete", ref_id=roadmap_id,
                 note=f"Completed Stage {roadmap.current_stage - 1}", db=db)
        db.commit()
    except Exception as exc:
        logger.warning("[ROADMAP] XP award failed on stage advance: %s", exc)

    return roadmap

