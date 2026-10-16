import json
from pathlib import Path
import pytest
from optimization import optimize
from app.models.schemas import PlacementRequest
from app.services.data import load_data
from app.services.pilot import road_evidence, active_hazards


def test_fixture_copies_and_geography():
    root = Path(__file__).resolve().parents[2]
    assert (root / "backend/data/pilot.json").read_bytes() == (root / "frontend/public/data/pilot/pilot.json").read_bytes()
    frame, network, _ = load_data()
    assert len(frame) == 20 and frame.psgc.is_unique
    geo = json.loads((root / "frontend/public/data/pilot/barangays.geojson").read_text(encoding="utf-8"))
    assert {str(f["properties"]["adm4_psgc"]) for f in geo["features"]} == set(frame.id)
    assert len(network["routes"]) == 168
    assert len({r["id"] for r in network["routes"]}) == 168


@pytest.mark.parametrize("kwargs", [{}, {"clinic_count":2}, {"clinic_count":5,"capacity":500}, {"flood_level":"moderate"}, {"flood_level":"severe"}, {"closed_roads":["demo-closure-1"]}])
def test_road_constraints_and_determinism(kwargs):
    request = PlacementRequest(**kwargs)
    first = optimize(request)
    assert optimize(request) == first
    _, network, _ = load_data()
    times, excluded = road_evidence(network, request)
    for allocation in [first["optimized"], first["baseline"]]:
        clinics = allocation["clinics"]
        assert len(clinics) <= request.clinic_count
        assert len({c["id"] for c in clinics}) == len(clinics)
        for c in clinics:
            assert c["id"] not in excluded
            assert c["served"] <= min(c["capacity"],request.capacity)
            for a in c["assignments"]:
                assert a["minutes"] == times[a["barangay_id"]][c["barangay_id"]]
                assert a["minutes"] <= request.max_travel_minutes
        for b in first["barangays"]:
            assert allocation["served_by_barangay"][b["id"]] <= b["demand"]


def test_closure_reduces_access_and_flood_changes_sites():
    base = optimize(PlacementRequest())
    flood = optimize(PlacementRequest(flood_level="severe"))
    closure = optimize(PlacementRequest(closed_roads=["demo-closure-1"]))
    assert [c["id"] for c in base["optimized"]["clinics"]] != [c["id"] for c in flood["optimized"]["clinics"]]
    assert closure["optimized"]["metrics"]["residents_served"] < base["optimized"]["metrics"]["residents_served"]
