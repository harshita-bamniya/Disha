"""RBAC expansion: sub-admin/company roles, permission matrix, login history,
device sessions, 2FA credentials, and user status/lockout columns.

Revision ID: f1a2b3c4d5e7
Revises: e9f0a1b2c3d4
Create Date: 2026-06-26

Part of Module 05 — Enterprise Admin Panel & Employer Portal, Phase 1.
Purely additive: new tables + new nullable/defaulted columns. No existing
data is touched beyond the role/permission seed inserts (ON CONFLICT DO NOTHING).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f1a2b3c4d5e7'
down_revision: Union[str, None] = 'e9f0a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_ROLES = [
    ("super_admin", "Full platform control, including sub-admin creation", True),
    ("moderator", "Content/user moderation: suspend users, approve/delete jobs", True),
    ("verification_officer", "Reviews and approves/rejects employer KYC verification", True),
    ("finance_manager", "Revenue, refunds, subscription plan management", True),
    ("support_executive", "Read-only user lookup and support tooling", True),
    ("employer_owner", "Company owner — full control over company profile, team, billing", True),
    ("hr_manager", "Manages jobs, candidates, and team invites for a company", True),
    ("recruiter", "Manages own job postings and candidate pipeline", True),
    ("interviewer", "Views assigned candidates and submits interview feedback", True),
]

# (resource, action, description)
PERMISSIONS = [
    ("users", "view", "View user accounts"),
    ("users", "create", "Create user accounts"),
    ("users", "edit", "Edit user accounts"),
    ("users", "delete", "Delete user accounts"),
    ("users", "suspend", "Suspend or ban user accounts"),
    ("users", "export", "Export user data"),
    ("employers", "view", "View employer accounts"),
    ("employers", "approve", "Approve employer registration"),
    ("employers", "reject", "Reject employer registration"),
    ("employers", "suspend", "Suspend employer accounts"),
    ("employers", "delete", "Delete employer accounts"),
    ("jobs", "view", "View job postings"),
    ("jobs", "approve", "Approve job postings"),
    ("jobs", "delete", "Delete job postings"),
    ("jobs", "feature", "Feature job postings"),
    ("analytics", "view", "View analytics dashboards"),
    ("analytics", "export", "Export analytics data"),
    ("finance", "view_revenue", "View revenue figures"),
    ("finance", "manage_refunds", "Issue refunds"),
    ("finance", "generate_reports", "Generate financial reports"),
    ("companies", "view", "View company profiles"),
    ("companies", "edit", "Edit company profile"),
    ("companies", "verify", "Verify company KYC documents"),
    ("candidates", "view", "View candidate profiles"),
    ("candidates", "shortlist", "Shortlist/move candidates through pipeline"),
    ("candidates", "reject", "Reject candidates"),
    ("candidates", "message", "Message candidates"),
    ("team", "invite", "Invite team members"),
    ("team", "remove", "Remove team members"),
    ("team", "transfer_ownership", "Transfer company ownership"),
    ("audit_logs", "view", "View audit logs"),
    ("subscriptions", "view", "View subscription plans/usage"),
    ("subscriptions", "manage", "Manage subscription plans"),
    ("sub_admins", "manage", "Create/edit/remove sub-admin accounts"),
]

# role_name -> list of (resource, action)
ROLE_PERMISSIONS = {
    "super_admin": [(r, a) for r, a, _ in PERMISSIONS],  # everything
    "admin": [
        ("users", "view"), ("users", "edit"), ("users", "suspend"), ("users", "export"),
        ("employers", "view"), ("employers", "approve"), ("employers", "reject"),
        ("employers", "suspend"), ("employers", "delete"),
        ("jobs", "view"), ("jobs", "approve"), ("jobs", "delete"), ("jobs", "feature"),
        ("analytics", "view"), ("analytics", "export"),
        ("companies", "view"), ("companies", "edit"), ("companies", "verify"),
        ("audit_logs", "view"),
    ],
    "moderator": [
        ("users", "view"), ("users", "suspend"),
        ("jobs", "view"), ("jobs", "approve"), ("jobs", "delete"),
    ],
    "verification_officer": [
        ("employers", "view"), ("employers", "approve"), ("employers", "reject"),
        ("companies", "view"), ("companies", "verify"),
    ],
    "finance_manager": [
        ("analytics", "view"),
        ("finance", "view_revenue"), ("finance", "manage_refunds"), ("finance", "generate_reports"),
        ("subscriptions", "view"), ("subscriptions", "manage"),
    ],
    "support_executive": [
        ("users", "view"), ("users", "export"),
    ],
    "employer_owner": [
        ("jobs", "view"), ("jobs", "approve"),
        ("candidates", "view"), ("candidates", "shortlist"), ("candidates", "reject"), ("candidates", "message"),
        ("team", "invite"), ("team", "remove"), ("team", "transfer_ownership"),
        ("companies", "view"), ("companies", "edit"),
        ("subscriptions", "view"), ("subscriptions", "manage"),
    ],
    "hr_manager": [
        ("jobs", "view"), ("jobs", "approve"),
        ("candidates", "view"), ("candidates", "shortlist"), ("candidates", "reject"), ("candidates", "message"),
        ("team", "invite"), ("team", "remove"),
        ("companies", "view"), ("companies", "edit"),
    ],
    "recruiter": [
        ("jobs", "view"),
        ("candidates", "view"), ("candidates", "shortlist"), ("candidates", "reject"), ("candidates", "message"),
    ],
    "interviewer": [
        ("candidates", "view"),
    ],
}


def upgrade() -> None:
    # ── 1. Seed new roles ─────────────────────────────────────────────────────
    for name, description, is_system in NEW_ROLES:
        op.execute(
            sa.text(
                "INSERT INTO roles (id, name, description, is_system) "
                "VALUES (gen_random_uuid(), :name, :description, :is_system) "
                "ON CONFLICT (name) DO NOTHING"
            ).bindparams(name=name, description=description, is_system=is_system)
        )

    # ── 2. Seed permissions ───────────────────────────────────────────────────
    for resource, action, description in PERMISSIONS:
        op.execute(
            sa.text(
                "INSERT INTO permissions (id, resource, action, description) "
                "VALUES (gen_random_uuid(), :resource, :action, :description) "
                "ON CONFLICT (resource, action) DO NOTHING"
            ).bindparams(resource=resource, action=action, description=description)
        )

    # ── 3. Seed role_permissions ───────────────────────────────────────────────
    for role_name, perms in ROLE_PERMISSIONS.items():
        for resource, action in perms:
            op.execute(
                sa.text(
                    """
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id FROM roles r, permissions p
                    WHERE r.name = :role_name AND p.resource = :resource AND p.action = :action
                    ON CONFLICT DO NOTHING
                    """
                ).bindparams(role_name=role_name, resource=resource, action=action)
            )

    # ── 4. users: status/lockout columns ──────────────────────────────────────
    op.add_column("users", sa.Column("status", sa.String(20), nullable=False, server_default="active"))
    op.add_column("users", sa.Column("status_reason", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("status_changed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    op.add_column("users", sa.Column("status_changed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"))
    op.create_check_constraint("ck_users_status", "users", "status IN ('active','suspended','banned')")

    # ── 5. login_history ──────────────────────────────────────────────────────
    op.create_table(
        "login_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("device_label", sa.String(150), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("failure_reason", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_login_history_user_id", "login_history", ["user_id"])
    op.create_index("ix_login_history_created_at", "login_history", ["created_at"])

    # ── 6. device_sessions ─────────────────────────────────────────────────────
    op.create_table(
        "device_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("refresh_token_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("refresh_tokens.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("device_label", sa.String(150), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_device_sessions_user_id", "device_sessions", ["user_id"])

    # ── 7. two_factor_credentials ──────────────────────────────────────────────
    op.create_table(
        "two_factor_credentials",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("secret_encrypted", sa.Text(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("backup_codes_hash", postgresql.JSONB(), nullable=True),
        sa.Column("enabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("two_factor_credentials")
    op.drop_index("ix_device_sessions_user_id", table_name="device_sessions")
    op.drop_table("device_sessions")
    op.drop_index("ix_login_history_created_at", table_name="login_history")
    op.drop_index("ix_login_history_user_id", table_name="login_history")
    op.drop_table("login_history")

    op.drop_constraint("ck_users_status", "users", type_="check")
    op.drop_column("users", "failed_login_attempts")
    op.drop_column("users", "status_changed_at")
    op.drop_column("users", "status_changed_by")
    op.drop_column("users", "status_reason")
    op.drop_column("users", "status")

    role_names = tuple(name for name, _, _ in NEW_ROLES)
    op.execute(sa.text("DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE name IN :names)").bindparams(sa.bindparam("names", expanding=True)).bindparams(names=list(role_names)))
    op.execute(sa.text("DELETE FROM roles WHERE name IN :names").bindparams(sa.bindparam("names", expanding=True)).bindparams(names=list(role_names)))
