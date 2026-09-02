"""Admin service — split from a single 2247-line service.py into sub-modules
by domain, with shared audit-logging helpers in core.

This __init__ re-exports every public function so existing callers
(`from app.modules.admin import service` then `service.some_function(...)`)
keep working completely unchanged.
"""
from app.modules.admin.service.announcements import (
    create_announcement,
    delete_announcement,
    list_announcements,
    publish_announcement,
    update_announcement,
)
from app.modules.admin.service.aspirants import (
    deactivate_user,
    get_aspirant_detail,
    list_aspirants,
    list_candidate_applications,
    list_candidate_support_tickets,
    reactivate_user,
)
from app.modules.admin.service.audit_logs import list_audit_logs
from app.modules.admin.service.career_tracks import (
    create_career_track,
    delete_career_track,
    list_career_tracks_admin,
    update_career_track,
)
from app.modules.admin.service.employers import (
    get_employer_detail,
    get_employer_verification_detail,
    get_verification_document_path,
    list_employer_jobs_admin,
    list_employer_support_tickets,
    list_employer_verifications,
    list_employers,
    review_employer_verification,
    revoke_employer,
)
from app.modules.admin.service.jobs import (
    delete_admin_job,
    get_admin_job_detail,
    list_admin_applications,
    list_admin_jobs,
    list_job_applications,
    toggle_admin_job,
)
from app.modules.admin.service.notifications import (
    delete_notification,
    get_notifications_stats,
    get_user_notifications,
    list_notifications,
)
from app.modules.admin.service.rbac import (
    create_role,
    create_sub_admin,
    delete_role,
    delete_sub_admin,
    list_permissions,
    list_roles,
    list_sub_admins,
    update_role_permissions,
    update_sub_admin_role,
)
from app.modules.admin.service.stats import (
    get_activity_feed,
    get_analytics,
    get_billing_overview,
    get_stats,
    global_search,
)
from app.modules.admin.service.subscriptions import (
    list_subscription_plans,
    update_subscription_plan,
)
from app.modules.admin.service.tickets import (
    add_ticket_message,
    create_ticket,
    get_ticket,
    list_tickets,
    update_ticket,
)
from app.modules.admin.service.user_management import (
    get_device_sessions,
    get_login_history,
    list_managed_users,
    revoke_device_session,
    update_user_status,
)

__all__ = [
    "create_announcement", "delete_announcement", "list_announcements",
    "publish_announcement", "update_announcement",
    "deactivate_user", "get_aspirant_detail", "list_aspirants",
    "list_candidate_applications", "list_candidate_support_tickets", "reactivate_user",
    "list_audit_logs",
    "create_career_track", "delete_career_track", "list_career_tracks_admin", "update_career_track",
    "get_employer_detail", "get_employer_verification_detail", "get_verification_document_path",
    "list_employer_jobs_admin", "list_employer_support_tickets", "list_employer_verifications",
    "list_employers", "review_employer_verification", "revoke_employer",
    "delete_admin_job", "get_admin_job_detail", "list_admin_applications",
    "list_admin_jobs", "list_job_applications", "toggle_admin_job",
    "delete_notification", "get_notifications_stats", "get_user_notifications", "list_notifications",
    "create_role", "create_sub_admin", "delete_role", "delete_sub_admin",
    "list_permissions", "list_roles", "list_sub_admins", "update_role_permissions", "update_sub_admin_role",
    "get_activity_feed", "get_analytics", "get_billing_overview", "get_stats", "global_search",
    "list_subscription_plans", "update_subscription_plan",
    "add_ticket_message", "create_ticket", "get_ticket", "list_tickets", "update_ticket",
    "get_device_sessions", "get_login_history", "list_managed_users", "revoke_device_session", "update_user_status",
]
