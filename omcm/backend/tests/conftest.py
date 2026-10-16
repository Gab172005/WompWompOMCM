import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import app


@pytest.fixture
def demo_data(monkeypatch):
    from app.services import data
    monkeypatch.setattr(data, "DATA_DIR", Path(__file__).parent / "fixtures")


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("OMCM_DATABASE_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("OMCM_DEMO_AUTH", "true")
    monkeypatch.setenv("OMCM_ADMIN_USERNAME", "test-admin")
    monkeypatch.setenv("OMCM_ADMIN_PASSWORD", "test-only-password-123")
    with TestClient(app) as session:
        yield session


@pytest.fixture
def auth():
    return ("test-admin", "test-only-password-123")
