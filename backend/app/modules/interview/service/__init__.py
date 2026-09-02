"""Interview service — split from a single 1497-line service.py into sub-modules
by domain, with shared text-analysis/skill-scoring helpers in core.

This __init__ re-exports every public function so existing callers
(`from app.modules.interview import service` then `service.some_function(...)`)
keep working completely unchanged.
"""
from app.modules.interview.service.feedback import (
    complete_session_and_generate_feedback,
    get_performance,
    get_session_feedback,
    regenerate_readiness_report,
    submit_outcome,
)
from app.modules.interview.service.interaction import (
    get_next_question,
    submit_response,
)
from app.modules.interview.service.session_setup import create_session
from app.modules.interview.service.sessions import (
    get_session,
    list_questions,
    list_sessions,
    start_session,
)

__all__ = [
    "complete_session_and_generate_feedback", "get_performance", "get_session_feedback",
    "regenerate_readiness_report", "submit_outcome",
    "get_next_question", "submit_response",
    "create_session",
    "get_session", "list_questions", "list_sessions", "start_session",
]
