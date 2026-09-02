"""Matching service — split from a single 2260-line service.py into sub-modules
by domain (browse, applications, pipeline, offers, interviews, analytics,
cross_job_views, pipeline_stages), with shared auth/scoping helpers in core.

This __init__ re-exports every public function so existing callers
(`from app.modules.matching import service` then `service.some_function(...)`)
keep working completely unchanged. It also re-exports a few "private" names
(PIPELINE_FORWARD_ORDER, _ALLOWED_BACKWARDS, _employer_display_name) that
tests/test_qa_failures.py imports directly from app.modules.matching.service.
"""
from app.modules.matching.service.core import (
    PIPELINE_FORWARD_ORDER,
    _employer_display_name,
)
from app.modules.matching.service.pipeline import _ALLOWED_BACKWARDS
from app.modules.matching.service.analytics import (
    get_application_trend,
    get_dashboard_kpis,
    get_employer_funnel,
    get_job_performance,
    get_recruiter_performance,
)
from app.modules.matching.service.applications import (
    apply_to_job,
    get_application_detail,
    list_my_applications,
    list_my_interviews,
    request_interview_reschedule,
    reschedule_interview,
    withdraw_application,
)
from app.modules.matching.service.browse import (
    get_job_detail,
    get_job_recommendations,
)
from app.modules.matching.service.cross_job_views import (
    list_all_applicants,
    list_all_interviews,
    list_all_offers,
)
from app.modules.matching.service.interviews import (
    cancel_interview,
    get_interview_ics,
    list_upcoming_interviews,
    schedule_interview,
    submit_interview_feedback,
)
from app.modules.matching.service.offers import (
    accept_offer_letter,
    bulk_email_candidates,
    decline_offer_letter,
    download_my_offer_letter_pdf,
    download_offer_letter_pdf_employer,
    get_my_offer_letter,
    get_offer_letter_for_employer,
    send_offer_letter,
)
from app.modules.matching.service.pipeline import (
    add_candidate_note,
    bulk_update_status,
    export_pipeline_csv,
    get_application_responses,
    get_job_pipeline,
    list_candidate_emails,
    send_candidate_email,
    set_candidate_rating,
    update_application_status,
)
from app.modules.matching.service.pipeline_stages import (
    apply_template_to_job,
    bulk_upsert_pipeline_stages,
    create_pipeline_template,
    delete_pipeline_template,
    get_pipeline_stages,
    list_pipeline_templates,
)

__all__ = [
    "PIPELINE_FORWARD_ORDER", "_ALLOWED_BACKWARDS", "_employer_display_name",
    "get_application_trend", "get_dashboard_kpis", "get_employer_funnel",
    "get_job_performance", "get_recruiter_performance",
    "apply_to_job", "get_application_detail", "list_my_applications",
    "list_my_interviews", "request_interview_reschedule", "reschedule_interview",
    "withdraw_application",
    "get_job_detail", "get_job_recommendations",
    "list_all_applicants", "list_all_interviews", "list_all_offers",
    "cancel_interview", "get_interview_ics", "list_upcoming_interviews",
    "schedule_interview", "submit_interview_feedback",
    "accept_offer_letter", "bulk_email_candidates", "decline_offer_letter",
    "download_my_offer_letter_pdf", "download_offer_letter_pdf_employer",
    "get_my_offer_letter", "get_offer_letter_for_employer", "send_offer_letter",
    "add_candidate_note", "bulk_update_status", "export_pipeline_csv",
    "get_application_responses", "get_job_pipeline", "list_candidate_emails",
    "send_candidate_email", "set_candidate_rating", "update_application_status",
    "apply_template_to_job", "bulk_upsert_pipeline_stages", "create_pipeline_template",
    "delete_pipeline_template", "get_pipeline_stages", "list_pipeline_templates",
]
