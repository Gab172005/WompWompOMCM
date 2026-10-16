from app.services.data import load_data, road_graph, travel_times, load_geographic_data
from risk_scoring import calculate_scores
from app.models.schemas import Weights, PlacementRequest
from app.models.results import RiskResult
from optimization import optimize


def test_supplied_geography_and_network(monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "province")
    frame, network, metadata = load_data()
    assert len(frame) == 681
    assert frame.municipality.nunique() == 30
    assert frame.id.is_unique
    assert frame.iloc[0]["name"] == "Barangay I"
    assert frame.iloc[0].lat == 14.0623
    assert all(r["source"] in set(frame.id) and r["target"] in set(frame.id) for r in network["roads"])
    graph = road_graph(frame, network)
    assert graph.has_edge(frame.iloc[0].id, frame.iloc[1].id)  # Poblacion alias
    assert len(network["sites"]) == 30
    scores = calculate_scores(frame, network, travel_times(graph), Weights())
    result = RiskResult(barangays=scores, metadata=metadata)
    assert all(b.municipality and b.synthetic for b in result.barangays)
    assert "synthetic population" in result.metadata.source
    shuffled, _, _ = load_geographic_data(frame.rename(columns={"name": "barangay_name", "municipality": "city_municipality", "lat": "latitude", "lng": "longitude"}).sample(frac=1))
    assert dict(zip(frame.source_url, frame.id)) == dict(zip(shuffled.source_url, shuffled.id))


def test_supplied_geography_optimization(monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "province")
    result = optimize(PlacementRequest(clinic_count=1, capacity=70))
    assert len(result["barangays"]) == 681
    assert result["optimized"]["metrics"]["residents_served"] <= 70
    assert len(result["optimized"]["clinics"]) <= 1
