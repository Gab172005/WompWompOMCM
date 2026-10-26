"""Saved work uses authenticated reads and the same durable repository."""
import os
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from main import app, today
from services import repository as repo


@pytest.fixture(params=["sqlite", "postgresql"])
def saved_client(request, tmp_path, monkeypatch, demo_data):
    monkeypatch.setenv("OMCM_DEMO_AUTH", "true")
    monkeypatch.setenv("OMCM_ADMIN_USERNAME", "test-admin")
    monkeypatch.setenv("OMCM_ADMIN_PASSWORD", "test-only-password-123")
    monkeypatch.setenv("OMCM_DATABASE_PATH", str(tmp_path / "saved.db"))
    url = os.getenv("OMCM_TEST_DATABASE_URL")
    if request.param == "postgresql":
        if not url:
            pytest.skip("Set OMCM_TEST_DATABASE_URL for isolated real PostgreSQL checks.")
        import psycopg
        from psycopg.conninfo import make_conninfo
        schema = "omcm_test_" + uuid4().hex
        with psycopg.connect(url, autocommit=True) as db:
            from psycopg import sql
            db.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        monkeypatch.setenv("DATABASE_URL", make_conninfo(url, options=f"-csearch_path={schema}"))
    else:
        monkeypatch.delenv("DATABASE_URL", raising=False)
    try:
        with TestClient(app) as client:
            yield client
    finally:
        if request.param == "postgresql" and url:
            with psycopg.connect(url, autocommit=True) as db:
                db.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


def test_saved_plans_are_private_paginated_and_reopenable(saved_client, auth):
    client = saved_client
    assert client.get("/api/planning/plans").status_code == 401
    first = client.post("/api/optimize", json={"clinic_count": 1}, auth=auth).json()
    second = client.post("/api/optimize", json={"clinic_count": 2}, auth=auth).json()
    listing = client.get("/api/planning/plans?limit=1", auth=auth)
    assert listing.headers["cache-control"] == "no-store"
    data = listing.json()
    assert data["total"] == 2
    assert data["plans"][0]["plan_id"] == second["plan_id"]
    assert "barangays" not in data["plans"][0]
    assert client.get("/api/planning/plans?limit=1&offset=1", auth=auth).json()["plans"][0]["plan_id"] == first["plan_id"]
    assert client.get("/api/planning/plans?limit=0", auth=auth).status_code == 422
    path = "/api/planning/plans/" + first["plan_id"]
    assert client.get(path).status_code == 401
    assert client.get(path, auth=("wrong", "wrong")).status_code == 401
    reopened = client.get(path, auth=auth)
    assert reopened.headers["cache-control"] == "no-store"
    assert reopened.json() == first
    assert client.get("/api/planning/plans/not-found", auth=auth).status_code == 404
    assert client.get("/api/schedules").json()["schedules"] == []
    assert client.get("/api/schedules").json().get("plans") is None


def test_deployments_and_plans_survive_another_app_lifespan(saved_client, auth):
    plan = saved_client.post("/api/optimize", json={}, auth=auth).json()
    payload = {"plan_id": plan["plan_id"], "deployment_date": (today() + timedelta(days=1)).isoformat()}
    published = saved_client.post("/api/schedules/approve", json=payload, auth=auth)
    assert published.status_code == 200
    with TestClient(app) as another_client:
        reopened = another_client.get("/api/planning/plans/" + plan["plan_id"], auth=auth).json()
        assert reopened["status"] == "published"
        assert reopened["optimized"] == plan["optimized"]
        assert another_client.get("/api/schedules").json()["schedules"][0]["clinics"] == published.json()["clinics"]
    assert saved_client.post("/api/schedules/approve", json=payload, auth=auth).status_code == 409


def test_publication_is_atomic_under_concurrent_requests(saved_client, auth):
    from concurrent.futures import ThreadPoolExecutor
    plan = saved_client.post("/api/optimize", json={}, auth=auth).json()
    payload = {"plan_id": plan["plan_id"], "deployment_date": (today() + timedelta(days=1)).isoformat()}
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: saved_client.post("/api/schedules/approve", json=payload, auth=auth), range(2)))
    assert sorted(response.status_code for response in responses) == [200, 409]
    assert len(repo.audit_log()) == 1


def test_configured_postgres_never_falls_back_to_sqlite(monkeypatch):
    import psycopg
    monkeypatch.setenv("DATABASE_URL", "postgresql://unavailable.invalid/omcm")
    monkeypatch.setattr(psycopg, "connect", lambda *args, **kwargs: (_ for _ in ()).throw(psycopg.OperationalError("Test unavailable database")))
    monkeypatch.setattr(repo.sqlite3, "connect", lambda *args, **kwargs: pytest.fail("Silent SQLite fallback"))
    assert repo.storage_info() == {"engine": "postgresql", "temporary": False}
    with pytest.raises(psycopg.OperationalError):
        repo.initialize()
