"""Smoke tests that the FastAPI app assembles and boots without a live DB connection."""
from fastapi.testclient import TestClient

from app.main import app


def test_app_boots():
    assert app.title == "DISHA AI API"


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
