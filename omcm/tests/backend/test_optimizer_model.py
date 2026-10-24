import json

import pytest

from models.clinic import PlacementRequest
from services.clinic_optimizer import optimize, solve
from services.data import load_data
from services.demand_model import MODEL_DIR, MODEL_NAME, ModelUnavailable, estimate_demands, load_model
from services.deployment_rules import deployment_restricted


def test_native_model_artifact_and_independent_holdout_evidence():
    booster, manifest = load_model()
    assert booster.num_boosted_rounds() > 1
    assert manifest["synthetic"]
    assert manifest["test_rows"] > 0
    assert manifest["metrics"]["test_mae"] < manifest["metrics"]["persistence_mae"]
    assert "do not measure clinical" in manifest["limitations"]
    assert not any("id" in feature or "score" in feature for feature in manifest["features"])


@pytest.mark.usefixtures("demo_data")
def test_model_drives_demand_without_changing_priority_scores(monkeypatch):
    import services.clinic_optimizer as optimizer
    frame, network, metadata = load_data()
    original = optimize(PlacementRequest())
    frame["demand_rate"] = 0.99
    monkeypatch.setattr(optimizer, "load_data", lambda: (frame.copy(), network, metadata))
    changed = optimize(PlacementRequest())
    assert changed["barangays"] == original["barangays"]
    assert any("XGBoost" in note for note in changed["notes"])
    assert all(0 <= b["demand"] <= b["population"] for b in changed["barangays"])


def test_appointment_estimation_requires_temporal_context():
    with pytest.raises(ModelUnavailable, match="Dated forecast context"):
        estimate_demands([], PlacementRequest())


def test_unavailable_or_tampered_model_fails_explicitly(tmp_path, monkeypatch):
    import services.demand_model as demand_model
    monkeypatch.setattr(demand_model, "MODEL_DIR", tmp_path)
    load_model.cache_clear()
    try:
        with pytest.raises(ModelUnavailable):
            load_model()
        manifest = json.loads((MODEL_DIR / f"{MODEL_NAME}.metadata.json").read_text())
        (tmp_path / f"{MODEL_NAME}.metadata.json").write_text(json.dumps(manifest))
        (tmp_path / f"{MODEL_NAME}.json").write_text("tampered")
        with pytest.raises(ModelUnavailable):
            load_model()
    finally:
        load_model.cache_clear()


def test_model_failure_returns_503_without_saving_a_fake_draft(client, auth, monkeypatch):
    import services.clinic_optimizer as optimizer
    def unavailable(*args):
        raise ModelUnavailable("Required model unavailable")
    monkeypatch.setattr(optimizer, "estimate_demands", unavailable)
    response = client.post("/api/optimize", json={}, auth=auth)
    assert response.status_code == 503
    assert client.get("/api/schedules").json()["schedules"] == []


@pytest.mark.usefixtures("demo_data")
def test_restricted_land_cannot_be_selected_through_api_or_catalog(client, auth, monkeypatch):
    import services.clinic_optimizer as optimizer
    import routers.clinics as clinics
    frame, network, metadata = load_data()
    network["sites"][0].update(lat=14.3747, lng=121.5349)
    assert deployment_restricted(network["sites"][0])
    assert not deployment_restricted(dict(lat=14.2681, lng=121.4112))
    monkeypatch.setattr(optimizer, "load_data", lambda: (frame.copy(), network, metadata))
    monkeypatch.setattr(clinics, "load_data", lambda: (frame.copy(), network, metadata))
    assert not client.get("/api/clinics").json()["sites"][0]["eligible"]
    rejected = client.post("/api/optimize", json={"manual_sites": [network["sites"][0]["id"]]}, auth=auth)
    assert rejected.status_code == 422
    allocation = optimize(PlacementRequest())
    assert all(c["id"] != network["sites"][0]["id"] for c in allocation["optimized"]["clinics"])


def test_travel_tiebreak_precedes_saving_an_open_site():
    # Hand-computed optimum: three appointments, zero travel, two opened hubs.
    # One generic hub serves the same three appointments with one total minute.
    barangays = [dict(id=str(i), name=str(i), demand=1, population=100, score=50,
                     high_priority=True, recommended_services=[]) for i in range(3)]
    sites = [dict(id="generic", barangay_id="generic", capacity=3)] + [
        dict(id=f"hub-{i}", barangay_id=str(i), capacity=1) for i in range(3)]
    times = {str(i): {"generic": int(i == 0), str(i): 0} for i in range(3)}
    result = solve(barangays, sites, times, PlacementRequest(clinic_count=3, capacity=3))
    assert result["optimal"]
    assert result["metrics"]["residents_served"] == 3
    assert result["metrics"]["average_travel_minutes"] == 0
    assert {c["id"] for c in result["clinics"]} == {"generic", "hub-0"}
