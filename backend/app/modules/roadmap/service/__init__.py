"""Roadmap service — split from a single 1264-line service.py into sub-modules
by domain, with shared stage-config/gate/JRS/roadmap-lookup helpers in core.

This __init__ re-exports every public function so existing callers keep
working completely unchanged — both `from app.modules.roadmap import
service` (roadmap/router.py), and the few direct imports elsewhere
(interview/service/feedback.py and jobs/plan_router.py import
update_skill_competence directly; tasks/roadmap_tasks.py imports
recalibrate_roadmap directly).
"""
from app.modules.roadmap.service.cohort_signals import get_cohort_signals
from app.modules.roadmap.service.core import compute_jrs, get_roadmap
from app.modules.roadmap.service.daily_mission import get_daily_mission
from app.modules.roadmap.service.gate import advance_stage, check_gate
from app.modules.roadmap.service.narrative import save_narrative
from app.modules.roadmap.service.recalibrate import recalibrate_roadmap
from app.modules.roadmap.service.roadmap_crud import (
    generate_roadmap,
    get_all_roadmaps,
    get_all_roadmaps_out,
    get_roadmap_by_id,
    get_roadmap_out,
)
from app.modules.roadmap.service.skills import (
    get_gap_skills_with_competence,
    get_skill_competence,
    update_skill_competence,
)
from app.modules.roadmap.service.tickets import (
    get_submissions,
    get_tickets,
    submit_ticket,
)

__all__ = [
    "get_cohort_signals",
    "compute_jrs", "get_roadmap",
    "get_daily_mission",
    "advance_stage", "check_gate",
    "save_narrative",
    "recalibrate_roadmap",
    "generate_roadmap", "get_all_roadmaps", "get_all_roadmaps_out",
    "get_roadmap_by_id", "get_roadmap_out",
    "get_gap_skills_with_competence", "get_skill_competence", "update_skill_competence",
    "get_submissions", "get_tickets", "submit_ticket",
]
