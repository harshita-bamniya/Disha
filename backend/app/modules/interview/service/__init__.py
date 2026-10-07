"""Interview service — split from a single 1497-line service.py into sub-modules
by domain, with shared text-analysis/skill-scoring helpers in core.

This __init__ re-exports every public function so existing callers
(`from app.modules.interview import service` then `service.some_function(...)`)
keep working completely unchanged.
"""
from app.modules.interview.service.feedback import (
    complete_session,
    get_performance,
    get_session_feedback,
    regenerate_readiness_report,
    regrade_session,
    run_grading,
    submit_outcome,
)
from app.modules.interview.service.interaction import (
    get_next_question,
    submit_response,
)
from app.modules.interview.service.session_setup import create_session
from app.modules.interview.service.sessions import (
    discard_session,
    get_session,
    list_questions,
    list_sessions,
    record_consents,
    start_session,
)

__all__ = [
    "complete_session", "get_performance", "get_session_feedback",
    "regenerate_readiness_report", "regrade_session", "run_grading", "submit_outcome",
    "get_next_question", "submit_response",
    "create_session",
    "discard_session", "get_session", "list_questions", "list_sessions", "record_consents", "start_session",
]
