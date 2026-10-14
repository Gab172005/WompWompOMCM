import pytest
from app.algorithms.placement import optimize
from app.algorithms.scoring import calculate_scores
from app.services.data import load_data, road_graph, travel_times
from app.models.schemas import PlacementRequest, Weights


def test_scores_and_weights():
    frame, network, _ = load_data()
    times = travel_times(road_graph(frame, network))
    scores = calculate_scores(frame, network, times, Weights())
    changed = calculate_scores(frame, network, times, Weights(disease=100, vulnerability=0, accessibility=0, poverty=0, flood=0))
    assert len(scores) == 20
    assert all(0 <= b["score"] <= 100 for b in scores)
    assert {b["id"]: b["score"] for b in scores} != {b["id"]: b["score"] for b in changed}
    row = frame.iloc[0]
    by_id = {b["id"]: b for b in scores}
    assert by_id[row.id]["disease_per_1000"] == round(row.disease_cases / row.population * 1000, 2)


def test_missing_data_is_visible():
    frame, network, _ = load_data()
    frame.loc[0, "disease_cases"] = float("nan")
    scores = calculate_scores(frame, network, travel_times(road_graph(frame, network)), Weights())
    b = next(b for b in scores if b["id"] == frame.iloc[0].id)
    assert any("Missing disease_cases" in warning for warning in b["warnings"])
    assert 0 <= b["score"] <= 100


@pytest.mark.parametrize("count", [0, 1, 3, 8])
def test_capacity_unique_and_reachable(count):
    request = PlacementRequest(clinic_count=count, capacity=70, max_travel_minutes=10, flooded_sites=["S01"])
    result = optimize(request)
    frame, network, _ = load_data()
    times = travel_times(road_graph(frame, network))
    demand = {b["id"]: b["demand"] for b in result["barangays"]}
    for mode in ["optimized", "baseline"]:
        plan = result[mode]
        assert len(plan["clinics"]) <= count
        assert all(c["id"] != "S01" and c["served"] <= 70 for c in plan["clinics"])
        allocated = {bid: 0 for bid in demand}
        for clinic in plan["clinics"]:
            for a in clinic["assignments"]:
                assert times[a["barangay_id"]][clinic["barangay_id"]] <= 10
                allocated[a["barangay_id"]] += a["residents"]
        assert all(allocated[bid] <= demand[bid] for bid in demand)
        assert sum(allocated.values()) == plan["metrics"]["residents_served"]
        assert plan["metrics"]["unserved_demand"] == sum(demand.values())-sum(allocated.values())
    assert result["optimized"]["metrics"]["weighted_demand"] >= result["baseline"]["metrics"]["weighted_demand"] - .0001


def test_road_closure_changes_reachability():
    frame, network, _ = load_data()
    incident = frame.iloc[0].id
    closed = [r["id"] for r in network["roads"] if incident in (r["source"], r["target"])]
    normal = optimize(PlacementRequest(clinic_count=1, capacity=2000, eligible_sites=["S01"], max_travel_minutes=120))
    changed = optimize(PlacementRequest(clinic_count=1, capacity=2000, eligible_sites=["S01"], max_travel_minutes=120, closed_roads=closed))
    assert changed["optimized"]["metrics"]["residents_served"] < normal["optimized"]["metrics"]["residents_served"]
    assert all(a["barangay_id"] == incident for c in changed["optimized"]["clinics"] for a in c["assignments"])


def test_flood_manual_and_unknown_references():
    assert optimize(PlacementRequest(flooded_sites=["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"]))["optimized"]["clinics"] == []
    with pytest.raises(ValueError):
        optimize(PlacementRequest(manual_sites=["S01"], flooded_sites=["S01"]))
    with pytest.raises(ValueError):
        optimize(PlacementRequest(closed_roads=["unknown"]))
    result = optimize(PlacementRequest(clinic_count=1, manual_sites=["S02"]))
    assert [c["id"] for c in result["optimized"]["clinics"]] == ["S02"]


def test_outbreak_and_reduced_clinics():
    normal = optimize(PlacementRequest())
    outbreak = optimize(PlacementRequest(outbreak_barangays=["B01"], outbreak_multiplier=3, clinic_count=1))
    by_id = lambda result: {b["id"]: b for b in result["barangays"]}
    assert by_id(outbreak)["B01"]["demand"] == by_id(normal)["B01"]["demand"] * 3
    assert by_id(outbreak)["B01"]["score"] > by_id(normal)["B01"]["score"]
    assert len(outbreak["optimized"]["clinics"]) <= 1
