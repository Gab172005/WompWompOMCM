import logging
import os
import sqlite3
import subprocess
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from main import app
from services import repository


def test_vercel_starts_with_readonly_application_directory(tmp_path, monkeypatch, caplog):
    deployment = tmp_path / "deployment"
    deployment.mkdir()
    scratch = tmp_path / "scratch"
    scratch.mkdir()
    monkeypatch.chdir(deployment)
    monkeypatch.setenv("OMCM_DATABASE_PATH", "omcm.db")
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.setattr(repository.tempfile, "gettempdir", lambda: str(scratch))
    sqlite_connect = sqlite3.connect

    def read_only_application(path, *args, **kwargs):
        # Model Vercel's filesystem restriction even on root/Windows test runners.
        if Path(path).resolve().is_relative_to(deployment):
            raise sqlite3.OperationalError("unable to open database file")
        return sqlite_connect(path, *args, **kwargs)

    monkeypatch.setattr(repository.sqlite3, "connect", read_only_application)
    with pytest.raises(sqlite3.OperationalError):
        repository.initialize()
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    with caplog.at_level(logging.WARNING):
        with TestClient(app) as client:
            response = client.get("/api/health")
            assert response.status_code == 200
            assert response.json()["storage"] == {"engine": "sqlite", "temporary": True}
            assert client.get("/api/assistant/status").status_code == 200
            assert client.get("/openapi.json").status_code == 200
            # Tables remain available over separate SQLite connections.
            schedules = client.get("/api/schedules")
            assert schedules.status_code == 200
            assert schedules.json()["schedules"] == []
            assert schedules.json()["notices"] == []
    assert (scratch / "omcm" / "omcm.db").is_file()
    assert not (deployment / "omcm.db").exists()
    assert "not shared across Vercel instances" in caplog.text


def test_local_database_and_explicit_absolute_paths_are_preserved(tmp_path, monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.setenv("OMCM_DATABASE_PATH", "data/local.db")
    assert repository.database_path() == Path("data/local.db")
    absolute = tmp_path / "nested" / "persistent.db"
    monkeypatch.setenv("OMCM_DATABASE_PATH", str(absolute))
    monkeypatch.setenv("VERCEL", "1")
    repository.initialize()
    assert repository.database_path() == absolute
    assert absolute.is_file()


def test_vercel_default_and_explicit_tmp_storage(tmp_path, monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setattr(repository.tempfile, "gettempdir", lambda: str(tmp_path))
    monkeypatch.delenv("OMCM_DATABASE_PATH", raising=False)
    assert repository.database_path() == tmp_path / "omcm" / "omcm.db"
    explicit = tmp_path / "custom" / "demo.db"
    monkeypatch.setenv("OMCM_DATABASE_PATH", str(explicit))
    assert repository.database_path() == explicit
    assert repository.storage_info()["temporary"] is True
    repository.initialize()
    assert explicit.is_file()


def test_production_cors_accepts_the_frontend_origin(tmp_path):
    # Import the real entrypoint with production settings in a fresh process,
    # since Starlette captures middleware configuration at app construction.
    script = """
from fastapi.testclient import TestClient
from main import app
with TestClient(app) as client:
    headers = {'Access-Control-Request-Method': 'POST',
               'Access-Control-Request-Headers': 'authorization,content-type'}
    for origin in (
        'https://omcm-two.vercel.app',
        'https://omcm-two-git-ui-simulation-scenario-dashboard-gab-s-projects2.vercel.app',
        'https://omcm-two-zwkwgeh9l-gab-s-projects2.vercel.app',
    ):
        response = client.options('/api/assistant', headers={**headers, 'Origin': origin})
        assert response.status_code == 200, response.text
        assert response.headers['access-control-allow-origin'] == origin
    for origin in (
        'https://unrelated.example',
        'https://omcm-two-git-ui-simulation-scenario-dashboard-other-team.vercel.app',
        'https://omcm-two-other-project-gab-s-projects2.vercel.app',
    ):
        response = client.options('/api/assistant', headers={**headers, 'Origin': origin})
        assert response.status_code == 400
        assert 'access-control-allow-origin' not in response.headers
"""
    env = dict(os.environ, VERCEL="1", OMCM_DATASET="pilot",
               OMCM_DATABASE_PATH=str(tmp_path / "cors.db"),
               OMCM_CORS_ORIGINS=" https://omcm-two.vercel.app/ , http://localhost:5173 ")
    env.pop("OMCM_CORS_ORIGIN_REGEX", None)
    result = subprocess.run([sys.executable, "-c", script],
                            cwd=Path(__file__).resolve().parents[2] / "backend",
                            env=env, capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
