"""Step 3: independent small allocation oracle and pilot comparison semantics."""
from itertools import product

import pytest

from models.clinic import PlacementRequest
from models.results import PlanResult
from services.clinic_optimizer import optimize, solve


def test_weighted_cover_matches_exhaustive_feasible_allocations():
    barangays = [dict(id="small", name="Small high risk", demand=3, population=30, score=90,
                      high_priority=True, recommended_services=["Vaccination"]),
                 dict(id="large", name="Large low risk", demand=6, population=60, score=10,
                      high_priority=False, recommended_services=["Health education"])]
    sites = [dict(id="s1", barangay_id="a", capacity=3),
             dict(id="s2", barangay_id="b", capacity=5)]
    times = {"small": {"a": 2, "b": 20}, "large": {"a": 2, "b": 2}}
    request = PlacementRequest(clinic_count=1, capacity=4, max_travel_minutes=5)
    result = solve(barangays, sites, times, request)
    feasible = []
    for site in sites:
        for small, large in product(range(4), range(7)):
            if small + large > min(request.capacity, site["capacity"]):
                continue
            if small and times["small"][site["barangay_id"]] > request.max_travel_minutes:
                continue
            feasible.append(small * .9 + large * .1)
    assert result["optimal"]
    assert result["metrics"]["weighted_demand"] == pytest.approx(max(feasible))
    assert result["clinics"][0]["id"] == "s1"
    assert "Vaccination" in result["clinics"][0]["reason"]


def test_pilot_comparison_services_and_approved_categories(monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    plan = optimize(PlacementRequest(clinic_count=2, capacity=80, flood_level="severe",
                                     closed_roads=["demo-closure-1"]))
    validated = PlanResult(**plan)
    for mode in (validated.optimized, validated.baseline):
        metrics = mode.metrics
        assert metrics.flood_safe_accessibility_pct == round(metrics.residents_served / metrics.total_demand * 100, 2)
        assert metrics.unserved_population == sum(b["population"] for b in plan["barangays"]) - metrics.residents_served
        assert metrics.high_priority_reached <= metrics.residents_served
        assert metrics.unserved_demand + metrics.residents_served == metrics.total_demand
        for clinic in mode.clinics:
            assert clinic.facility_type in {"school", "barangay_hall", "health_center"}
            assert "Suggested preventive services:" in clinic.reason
