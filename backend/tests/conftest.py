"""Shared pytest fixtures for BEGINABLAI test suite."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.database import Base, get_db
from app.main import app

settings = get_settings()

# Use real Postgres — SQLite can't handle JSONB columns in models.
# Tests run inside Docker where postgres is reachable at the configured URL.
TEST_DATABASE_URL = settings.database_url


engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    # Don't drop tables — other services may be running against the same DB.
    # Tests use per-test transaction rollback for isolation instead.


@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def owner_and_company(db):
    """A fresh Company + an employer_owner User/EmployerProfile, for tests
    that exercise company-scoped service functions (team invites, activity
    log, departments) without needing the full HTTP registration flow."""
    import uuid

    from app.models.company import Company
    from app.models.user import EmployerProfile, Role, User

    role = db.query(Role).filter(Role.name == "employer_owner").first()
    if role is None:
        role = db.query(Role).filter(Role.name == "employer").first()
    assert role is not None, "expected 'employer_owner' or 'employer' role to be seeded"

    company = Company(name=f"Test Co {uuid.uuid4().hex[:8]}", verification_status="verified")
    db.add(company)
    db.flush()

    owner_user = User(
        email=f"owner-{uuid.uuid4().hex[:8]}@example.com",
        role_id=role.id, email_verified=True, is_active=True,
    )
    db.add(owner_user)
    db.flush()

    owner_profile = EmployerProfile(
        user_id=owner_user.id, company_name=company.name, city="Delhi",
        is_approved=True, company_id=company.id, is_owner=True,
    )
    db.add(owner_profile)
    db.commit()

    return owner_user, company


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    # Disable slowapi rate limiting in tests — otherwise OTP/login tests hit limits
    # Routers (auth, admin) each own a module-level Limiter separate from
    # app.state.limiter, so every one of them has to be switched off.
    from app.modules.admin import router as admin_router
    from app.modules.auth import router as auth_router
    limiters = [app.state.limiter, auth_router.limiter, admin_router.limiter]
    originals = [lim.enabled for lim in limiters]
    for lim in limiters:
        lim.enabled = False
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c
    finally:
        for lim, orig in zip(limiters, originals):
            lim.enabled = orig
    app.dependency_overrides.clear()
