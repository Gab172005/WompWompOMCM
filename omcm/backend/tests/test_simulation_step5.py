"""Scenario safety and publication isolation using the actual pilot fixtures."""
from datetime import timedelta

from app.models.schemas import PlacementRequest
from app.services.data import load_data
from app.services.pilot import active_hazards, road_evidence
from optimization import optimize
from main import today


def test_municipal_hazards_and_heatmap(monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    _, network, _ = load_data()
    request = PlacementRequest(flood_level="severe", municipality_flood_levels={"Bay": "none"})
    hazards = active_hazards(network, request.flood_level, request.municipality_flood_levels)
    by_id = {b["id"]: b for b in network["barangays"]}
    assert hazards
    assert all(by_id[h["properties"]["barangay_id"]]["municipality"] != "Bay"
               for h in network["hazards"]["features"] if h["properties"]["id"] in hazards)
    baseline = optimize(PlacementRequest())
    result = optimize(request)
    before = {b["id"]: b for b in baseline["barangays"]}
    affected = {h["properties"]["barangay_id"] for h in network["hazards"]["features"]
                if h["properties"]["id"] in hazards}
    for b in result["barangays"]:
        assert b["factors"]["flood"] == (100 if b["id"] in affected else before[b["id"]]["factors"]["flood"])
    _, excluded = road_evidence(network, request)
    assert not excluded.intersection(c["id"] for c in result["optimized"]["clinics"])


def test_scenario_preview_and_application_do_not_publish(client, auth, monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    draft = client.post("/api/optimize", json={}, auth=auth).json()
    assert client.post("/api/schedules/approve", json={"plan_id": draft["plan_id"],
                       "deployment_date": (today() + timedelta(days=1)).isoformat()}, auth=auth).status_code == 200
    published = client.get("/api/schedules").json()
    _, network, _ = load_data()
    bid = network["barangays"][0]["id"]
    scenario = dict(clinic_count=1, municipality_flood_levels={"Bay": "severe", "Los Baños": "severe"},
                    closed_roads=[network["closures"][0]["id"]], outbreak_barangays=[bid], outbreak_multiplier=2)
    response = client.post("/api/simulate", json={"original": {}, "scenario": scenario}, auth=auth)
    assert response.status_code == 200, response.text
    after = response.json()["after"]
    assert not after.get("plan_id")
    assert len(after["optimized"]["clinics"]) <= 1
    before_b = next(b for b in response.json()["before"]["barangays"] if b["id"] == bid)
    after_b = next(b for b in after["barangays"] if b["id"] == bid)
    assert after_b["disease_per_1000"] == round(before_b["disease_per_1000"] * 2, 2)
    assert client.get("/api/schedules").json() == published
    applied = client.post("/api/optimize", json=after["inputs"], auth=auth)
    assert applied.status_code == 200
    assert applied.json()["plan_id"] != draft["plan_id"]
    assert client.get("/api/schedules").json() == published
    invalid = client.post("/api/simulate", json={"scenario": {"municipality_flood_levels": {"Unknown": "severe"}}}, auth=auth)
    assert invalid.status_code == 422
    empty = client.post("/api/simulate", json={"scenario": {"clinic_count": 0}}, auth=auth)
    assert empty.status_code == 200
    assert not empty.json()["after"]["optimized"]["clinics"]
