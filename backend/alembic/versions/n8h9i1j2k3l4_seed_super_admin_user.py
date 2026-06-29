"""Seed a dedicated super_admin user, distinct from the existing 'admin' user.

Revision ID: n8h9i1j2k3l4
Revises: m7g8h9i1j2k3
Create Date: 2026-06-27

Default credentials (CHANGE IN PRODUCTION):
  Phone    : 9000000111
  Password : SuperAdmin@123

This is intentionally a separate account from the existing default admin
(phone 9000000000 / Admin@123, role 'admin') so the two permission tiers can
be tested side by side:
  - super_admin: everything, including creating/editing/removing sub-admins
    and editing role permission matrices (see role_permissions seeded in
    migration f1a2b3c4d5e7 — super_admin gets every permission row).
  - admin: platform moderation (users, employers, jobs, audit logs, analytics)
    but NOT sub-admin management or role permission edits.
"""
from alembic import op

revision = "n8h9i1j2k3l4"
down_revision = "m7g8h9i1j2k3"
branch_labels = None
depends_on = None

# bcrypt hash of "SuperAdmin@123"
# Generated with: app.core.security.hash_password("SuperAdmin@123")
SUPER_ADMIN_PASSWORD_HASH = "$2b$12$gwe9sZBpR8F/c9W.yqULS.uy8a1jOh3mnw5tNA.IBIsmJHzNbzP8W"


def upgrade() -> None:
    op.execute(f"""
        DO $$
        DECLARE
            v_role_id UUID;
            v_phone   TEXT := '9000000111';
        BEGIN
            IF EXISTS (SELECT 1 FROM users WHERE phone = v_phone) THEN
                RAISE NOTICE 'Super admin user already exists, skipping seed.';
                RETURN;
            END IF;

            SELECT id INTO v_role_id FROM roles WHERE name = 'super_admin';
            IF v_role_id IS NULL THEN
                RAISE EXCEPTION 'super_admin role not seeded — run earlier migrations first.';
            END IF;

            INSERT INTO users (
                id, phone, password_hash, full_name, phone_verified, email_verified,
                preferred_language, role_id, is_active, created_at, updated_at
            ) VALUES (
                gen_random_uuid(),
                v_phone,
                '{SUPER_ADMIN_PASSWORD_HASH}',
                'Super Admin',
                TRUE,
                FALSE,
                'en',
                v_role_id,
                TRUE,
                now(),
                now()
            );

            RAISE NOTICE 'Default super_admin user created: phone=9000000111 password=SuperAdmin@123';
        END
        $$;
    """)

    # Give the existing default admin a display name too, for table consistency.
    op.execute("""
        UPDATE users SET full_name = 'Platform Admin'
        WHERE phone = '9000000000' AND full_name IS NULL
    """)


def downgrade() -> None:
    op.execute("DELETE FROM users WHERE phone = '9000000111';")
