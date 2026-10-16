from datetime import timedelta
import pytest
pytestmark = pytest.mark.usefixtures("demo_data")
from main import today


def test_public_data_and_auth(client, auth):
    assert client.get("/api/health").json()["status"] == "ok"
    assert len(client.get("/api/barangays").json()["barangays"]) == 20
    assert client.post("/api/optimize", json={}).status_code == 401
    assert client.post("/api/optimize", json={}, auth=("wrong", "wrong")).status_code == 401
    assert client.get("/api/auth/me", auth=auth).status_code == 200
    assert client.post("/api/risk/calculate", json={"disease":-1}, auth=auth).status_code == 422
    assert client.post("/api/risk/calculate", json=dict(population=0,disease=0,vulnerability=0,accessibility=0,poverty=0,flood=0), auth=auth).status_code == 422
    assert client.post("/api/optimize", json={"clinic_count":-1}, auth=auth).status_code == 422


def test_schedule_approval_simulation_and_emergency(client, auth):
    result = client.post("/api/optimize", json={}, auth=auth)
    assert result.status_code == 200, result.text
    plan = result.json()
    deployment = dict(plan_id=plan["plan_id"], deployment_date=(today()+timedelta(days=1)).isoformat())
    assert client.post("/api/schedules/approve", json=deployment).status_code == 401
    assert client.post("/api/schedules/approve", json=deployment, auth=auth).status_code == 200
    from app.database.repository import get_plan
    assert get_plan(plan["plan_id"])["status"] == "published"
    assert get_plan(plan["plan_id"])["approved_at"]
    assert client.post("/api/schedules/approve", json=deployment, auth=auth).status_code == 409
    original = client.get("/api/schedules").json()
    simulation = client.post("/api/simulate", json={"original":{}, "scenario":{"clinic_count":1,"flooded_sites":["S01"]}}, auth=auth)
    assert simulation.status_code == 200
    assert client.get("/api/schedules").json() == original
    same_day = dict(deployment, deployment_date=today().isoformat())
    assert client.post("/api/schedules/approve", json=same_day, auth=auth).status_code == 422
    override = dict(same_day, notice="Demo emergency: a revised clinic deployment is available.")
    assert client.post("/api/schedules/emergency-override", json=override, auth=auth).status_code == 422
    assert client.post("/api/schedules/emergency-override", json=dict(override, confirmed=True), auth=auth).status_code == 200
    public = client.get("/api/schedules").json()
    assert len(public["notices"]) == 1
    assert any(s["date"] == today().isoformat() for s in public["schedules"])
    assert [e["action"] for e in client.get("/api/audit", auth=auth).json()["events"]] == ["emergency_override", "approve"]


def test_boundaries(client, auth):
    assert client.get("/api/boundaries").json()["geojson"] is None
    feature = {"type":"Feature", "properties":{"barangay_id":"B01"}, "geometry":{"type":"Polygon", "coordinates":[[[121,14],[121.1,14],[121.1,14.1],[121,14]]]}}
    data = {"geojson":{"type":"FeatureCollection","features":[feature]}}
    assert client.post("/api/boundaries", json=data, auth=auth).status_code == 200
    feature["geometry"]["coordinates"][0][0] = [999,14]
    assert client.post("/api/boundaries", json=data, auth=auth).status_code == 422


def test_real_laguna_boundary_upload(client, auth):
    from pathlib import Path
    import json
    path = Path(__file__).resolve().parents[2] / "frontend/public/data/geo/laguna_barangays.geojson"
    boundaries = json.loads(path.read_text(encoding="utf-8"))
    assert client.post("/api/boundaries", json={"geojson": boundaries}, auth=auth).status_code == 200
    loaded = client.get("/api/boundaries").json()["geojson"]
    assert len(loaded["features"]) == 681
    assert loaded["features"][0]["geometry"] == boundaries["features"][0]["geometry"]
    boundaries["features"][0]["properties"]["adm4_psgc"] = 123456789
    assert client.post("/api/boundaries", json={"geojson": boundaries}, auth=auth).status_code == 422


def test_emergency_validation_and_missing_plan(client, auth):
    payload = dict(plan_id="nonexistent", deployment_date=(today()+timedelta(days=1)).isoformat())
    assert client.post("/api/schedules/approve", json=payload, auth=auth).status_code == 404
    payload.update(start_time="17:00", end_time="08:00")
    assert client.post("/api/schedules/approve", json=payload, auth=auth).status_code == 422


def test_concurrent_approvals_cannot_overwrite(client, auth):
    from concurrent.futures import ThreadPoolExecutor
    plan = client.post("/api/optimize", json={}, auth=auth).json()
    payload = dict(plan_id=plan["plan_id"], deployment_date=(today()+timedelta(days=1)).isoformat())
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: client.post("/api/schedules/approve", json=payload, auth=auth).status_code, range(2)))
    assert sorted(outcomes) == [200, 409]
    assert len(client.get("/api/audit", auth=auth).json()["events"]) == 1


def test_need_sensitivity(client, auth):
    assert client.post("/api/risk/sensitivity", json={}).status_code == 401
    response = client.post("/api/risk/sensitivity?top_k=3", json={}, auth=auth)
    assert response.status_code == 200
    result = response.json()
    assert len(result["baseline_ids"]) == 3
    assert len(result["trials"]) == 12
    assert client.post("/api/risk/sensitivity?top_k=0", json={}, auth=auth).status_code == 422
