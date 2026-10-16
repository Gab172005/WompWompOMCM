"""Read-only, evidence-grounded explanation boundary."""
from models.clinic import PlacementRequest
from services.simulation_engine import simulate_scenario
from services.explanations import DeterministicProvider, FOOTER


def test_explanations_auth_and_no_persistence(client, auth, monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    monkeypatch.setenv("OMCM_EXPLANATION_PROVIDER", "deterministic")
    published = client.get("/api/schedules").json()
    assert client.post("/api/explanations", json={"scenario": {}}).status_code == 401
    from services import repository as repo
    with repo.connect() as db:
        count = db.execute("SELECT count(*) FROM plans").fetchone()[0]
    response = client.post("/api/explanations", json={"scenario": {}}, auth=auth)
    assert response.status_code == 200
    text = response.json()["text"]
    for phrase in ["need-index points", "Capacity trade-off", "modeled journey", "population-first baseline", "No scenario parameter changed", FOOTER]:
        assert phrase in text
    assert client.get("/api/schedules").json() == published
    with repo.connect() as db:
        assert db.execute("SELECT count(*) FROM plans").fetchone()[0] == count
    monkeypatch.setenv("OMCM_EXPLANATION_PROVIDER", "unconfigured")
    assert client.post("/api/explanations", json={"scenario": {}}, auth=auth).status_code == 422


def test_scenario_explains_actual_changes(client, auth, monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    monkeypatch.setenv("OMCM_EXPLANATION_PROVIDER", "deterministic")
    body = {"scenario": {"clinic_count": 0, "flood_level": "severe"}}
    response = client.post("/api/explanations", json=body, auth=auth)
    assert response.status_code == 200
    text = response.json()["text"]
    assert "No clinic was allocated" in text
    assert "Removed sites:" in text
    assert "→ 0 after" in text
    assert "flood level" in text
    assert "cannot isolate the effect" in text
    assert "Sites excluded" in text
    assert client.post("/api/explanations", json={"scenario": {"municipality_flood_levels": {"Unknown": "severe"}}}, auth=auth).status_code == 422


def test_manual_sites_and_unproven_optimum(monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    from models.scenario import SimulationRequest
    evidence = simulate_scenario(SimulationRequest(scenario=PlacementRequest(manual_sites=[])))
    evidence["exclusions"] = []
    evidence["after"]["optimized"]["optimal"] = False
    text = DeterministicProvider().explain(evidence)
    assert "manually selected by the planner" in text
    assert "optimality is not proven" in text
