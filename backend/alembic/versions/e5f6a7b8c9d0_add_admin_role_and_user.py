"""add admin role and seed admin user

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2025-01-01 00:00:00.000000

Seeds the 'admin' role and creates one default admin user.
Default credentials (CHANGE IN PRODUCTION):
  Phone    : 9000000000
  Password : Admin@123

After running this migration, log in with the above credentials at /auth/login.
The admin is created with is_active=True and phone_verified=True.
"""
from alembic import op

# revision identifiers
revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None

# bcrypt hash of "Admin@123"
# Generated with: from passlib.context import CryptContext; CryptContext(schemes=["bcrypt"]).hash("Admin@123")
ADMIN_PASSWORD_HASH = "$2b$12$8F/rfI03gRJPwQ1fE5p.Xuyy5IakBcHbcHSfimJCcO7HMuuFawKr6"


def upgrade() -> None:
    # 1. Seed admin role (idempotent)
    op.execute("""
        INSERT INTO roles (id, name, description, created_at)
        VALUES (
            gen_random_uuid(),
            'admin',
            'Platform administrator — can approve employers and manage platform data',
            now()
        )
        ON CONFLICT (name) DO NOTHING;
    """)

    # 2. Create default admin user (idempotent — skipped if phone already exists)
    op.execute(f"""
        DO $$
        DECLARE
            v_role_id UUID;
            v_phone   TEXT := '9000000000';
        BEGIN
            -- Abort if admin user already exists
            IF EXISTS (SELECT 1 FROM users WHERE phone = v_phone) THEN
                RAISE NOTICE 'Admin user already exists, skipping seed.';
                RETURN;
            END IF;

            SELECT id INTO v_role_id FROM roles WHERE name = 'admin';

            INSERT INTO users (
                id, phone, password_hash, phone_verified, email_verified,
                preferred_language, role_id, is_active, created_at, updated_at
            ) VALUES (
                gen_random_uuid(),
                v_phone,
                '{ADMIN_PASSWORD_HASH}',
                TRUE,
                FALSE,
                'en',
                v_role_id,
                TRUE,
                now(),
                now()
            );

            RAISE NOTICE 'Default admin user created: phone=9000000000 password=Admin@123';
        END
        $$;
    """)


def downgrade() -> None:
    # Remove the seeded admin user and role
    op.execute("""
        DELETE FROM users WHERE phone = '9000000000';
    """)
    op.execute("""
        DELETE FROM roles WHERE name = 'admin';
    """)
