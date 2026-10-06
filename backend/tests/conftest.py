import uuid
import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings(tmp_path):
    return Settings(database=str(tmp_path / "test.db"), auth_limit=1000)


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as client:
        yield client


@pytest.fixture
def credentials():
    return {
        "name": "Fictional Tester",
        "email": str(uuid.uuid4()) + "@example.com",
        "password": "TestingPassword!2026",
    }


@pytest.fixture
def owner(client, credentials):
    response = client.post("/api/auth/register", json=credentials)
    assert response.status_code == 201
    return client


@pytest.fixture
def task(owner):
    response = owner.post("/api/tasks", json={"title": "Review acceptance criteria"})
    assert response.status_code == 201
    return response.json()
