import json
import pytest
from config import admin_configuration

pytestmark = pytest.mark.usefixtures("demo_data")


@pytest.mark.parametrize("flag, username, password, issue, field", [
    ("false", "unit-admin", "unit-password-123", "OMCM_DEMO_AUTH", "demo_auth_enabled"),
    ('"true"', "unit-admin", "unit-password-123", "OMCM_DEMO_AUTH", "demo_auth_enabled"),
    ("true", "", "unit-password-123", "OMCM_ADMIN_USERNAME", "username_configured"),
    ("true", "  ", "unit-password-123", "OMCM_ADMIN_USERNAME", "username_configured"),
    ("true", "unit-admin", "", "OMCM_ADMIN_PASSWORD", "password_configured"),
    ("true", "unit-admin", "too-short", "at least 12", "password_minimum_met"),
])
def test_health_identifies_missing_requirement_without_exposing_credentials(
        client, monkeypatch, flag, username, password, issue, field):
    monkeypatch.setenv("OMCM_DEMO_AUTH", flag)
    monkeypatch.setenv("OMCM_ADMIN_USERNAME", username)
    monkeypatch.setenv("OMCM_ADMIN_PASSWORD", password)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    status = response.json()
    assert status["admin_configured"] is False
    assert status["admin_configuration"][field] is False
    assert issue in " ".join(status["admin_configuration"]["issues"])
    assert status["demo_auth"] == status["admin_configuration"]["demo_auth_enabled"]
    # Expose presence/validity only, never usernames, passwords or exact lengths.
    serialized = json.dumps(status)
    assert "unit-admin" not in serialized
    assert "unit-password" not in serialized
    assert "too-short" not in serialized
    assert "password_length" not in serialized
    denied = client.get("/api/auth/me", auth=(username or "user", password))
    assert denied.status_code == 503
    assert issue in denied.json()["detail"]


def test_flag_whitespace_and_case_are_consistent_with_auth(client, monkeypatch):
    monkeypatch.setenv("OMCM_DEMO_AUTH", " TRUE \n")
    monkeypatch.setenv("OMCM_ADMIN_USERNAME", " unit-admin ")
    monkeypatch.setenv("OMCM_ADMIN_PASSWORD", "unit-password-123")
    status = client.get("/api/health").json()
    assert status["admin_configured"] is True
    assert status["demo_auth"] is True
    assert status["admin_configuration"]["issues"] == []
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", auth=("unit-admin", "wrong-password")).status_code == 401
    response = client.get("/api/auth/me", auth=("unit-admin", "unit-password-123"))
    assert response.status_code == 200
    assert response.json()["username"] == "unit-admin"


def test_empty_server_configuration_remains_disabled(monkeypatch):
    for name in ("OMCM_DEMO_AUTH", "OMCM_ADMIN_USERNAME", "OMCM_ADMIN_PASSWORD"):
        monkeypatch.delenv(name, raising=False)
    status = admin_configuration()
    assert status["configured"] is False
    assert len(status["issues"]) == 3
