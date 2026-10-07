"""Give admin/super_admin accounts a real email so they can log in through
the standard email+password form.

Revision ID: d94ac2fe1001
Revises: y5z6a7b8c9d0
Create Date: 2026-09-24

Why: the login form only ever accepts an email-shaped identifier
(frontend/src/modules/auth/pages/LoginPage.tsx uses type="email"), but the
admin/super_admin seed accounts (migrations m7g8h9i1j2k3 / n8h9i1j2k3l4) were
only ever given a phone number — so there was no way to actually log in as
either through the product UI. Per product decision, admin accounts are
email+password only (no phone-based login), so the fix is to give them an
email rather than to loosen the login form to also accept phone numbers.

Targets by role name rather than a hardcoded phone number, since the
super_admin seed's phone has already drifted once in this environment
(seeded as 9000000111, live value found to be 9000000001) — matching on
role is what actually stays correct.

Default credentials after this migration (CHANGE IN PRODUCTION):
  admin@disha.test       / Admin@123       (role: admin)
  superadmin@disha.test  / SuperAdmin@123  (role: super_admin)
"""
from alembic import op

revision = "d94ac2fe1001"
down_revision = "y5z6a7b8c9d0"
branch_labels = None
depends_on = None

_EMAIL_BY_ROLE = {
    "admin": "admin@disha.test",
    "super_admin": "superadmin@disha.test",
}


def upgrade() -> None:
    for role_name, email in _EMAIL_BY_ROLE.items():
        op.execute(f"""
            UPDATE users
            SET email = '{email}', email_verified = TRUE
            WHERE role_id = (SELECT id FROM roles WHERE name = '{role_name}')
              AND (email IS NULL OR email = '')
        """)


def downgrade() -> None:
    for email in _EMAIL_BY_ROLE.values():
        op.execute(f"UPDATE users SET email = NULL WHERE email = '{email}'")
