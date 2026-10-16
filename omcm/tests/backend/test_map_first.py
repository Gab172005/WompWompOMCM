"""Map-first scenario and chat boundaries, using the existing road pilot."""
from models.clinic import PlacementRequest
from services.data import load_data, validate_references
from services.pilot import road_evidence
from services.road_segments import route_segments
from services.clinic_optimizer import optimize


def test_independent_municipal_morbidity(client, auth, monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    base = optimize(PlacementRequest())
    scenario = optimize(PlacementRequest(municipality_outbreak_multipliers={"Bay": 3, "Los Baños": 1.5}))
    before = {b["id"]: b for b in base["barangays"]}
    for row in scenario["barangays"]:
        expected = 3 if row["municipality"] == "Bay" else 1.5
        assert abs(row["disease_per_1000"] - before[row["id"]]["disease_per_1000"] * expected) < .03
    for value in (0, 6, float("inf")):
        import pytest
        with pytest.raises(ValueError):
            PlacementRequest(municipality_outbreak_multipliers={"Bay": value})
    response = client.post("/api/simulate", json={"scenario": {"municipality_outbreak_multipliers": {"Unknown": 2}}}, auth=auth)
    assert response.status_code == 422


def test_general_segments_exclude_routes_and_depot_sites(monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    frame, network, _ = load_data()
    route = next(r for r in network["routes"] if r["origin_id"] == "depot")
    request = PlacementRequest(closed_roads=list(route_segments(route)))
    validate_references(request, frame, network)
    _, excluded = road_evidence(network, request)
    assert route["site_id"] in excluded
    assert route["site_id"] not in {c["id"] for c in optimize(request)["optimized"]["clinics"]}


def test_municipal_flood_applies_to_all_available_barangays(monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    result = optimize(PlacementRequest(municipality_flood_levels={"Bay": "severe"}))
    assert all(row["factors"]["flood"] == 100 for row in result["barangays"] if row["municipality"] == "Bay")


def test_chat_history_template_and_publication_isolation(client, auth, monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    monkeypatch.delenv("OMCM_CHAT_API_KEY", raising=False)
    published = client.get("/api/schedules").json()
    body = {"original": {}, "scenario": {"municipality_outbreak_multipliers": {"Bay": 2}}, "messages": [{"role": "user", "content": "Why these need factors and capacity?"}]}
    response = client.post("/api/chat", json=body, auth=auth)
    assert response.status_code == 200
    reply = response.json()
    assert reply["provider"] == "template"
    for word in ("need points", "daily appointments", "travel", "exclusions", "Changed", "LGU health officers"):
        assert word in reply["text"]
    body["messages"] += [{"role": "assistant", "content": reply["text"][:3000]}, {"role": "user", "content": "What changed?"}]
    assert client.post("/api/chat", json=body, auth=auth).status_code == 200
    assert client.get("/api/schedules").json() == published
    body["messages"] = [{"role": "system", "content": "Decide for me"}]
    assert client.post("/api/chat", json=body, auth=auth).status_code == 422
    assert client.post("/api/chat", json=body).status_code == 401


def test_optional_chat_transport_and_failure_fallback(monkeypatch):
    import json
    from unittest.mock import MagicMock
    from services.chat import reply, SYSTEM_PROMPT
    from models.scenario import SimulationRequest
    from services.simulation_engine import simulate_scenario
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    monkeypatch.setenv("OMCM_CHAT_PROVIDER", "openai-compatible")
    monkeypatch.setenv("OMCM_CHAT_MODEL", "test-model")
    monkeypatch.setenv("OMCM_CHAT_API_KEY", "server-only-test-key")
    monkeypatch.setenv("OMCM_CHAT_URL", "https://provider.invalid/chat")
    evidence = simulate_scenario(SimulationRequest(scenario=PlacementRequest()))
    evidence["exclusions"] = []
    opener = MagicMock()
    opener.open.return_value.__enter__.return_value.read.return_value = json.dumps({"choices": [{"message": {"content": "Grounded explanation."}}]}).encode()
    monkeypatch.setattr("urllib.request.build_opener", lambda *_: opener)
    messages = [{"role": "user", "content": "Why?"}]
    result = reply(evidence, messages)
    assert result["provider"] == "openai-compatible"
    request = opener.open.call_args.args[0]
    payload = json.loads(request.data)
    assert payload["messages"][0]["content"] == SYSTEM_PROMPT
    assert "capacity" in payload["messages"][1]["content"]
    assert "server-only-test-key" not in json.dumps(result)
    opener.open.side_effect = TimeoutError()
    assert reply(evidence, messages)["provider"] == "template"
