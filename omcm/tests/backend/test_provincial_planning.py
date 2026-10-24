from datetime import timedelta
import json

import pytest

from config import today
from models.clinic import PlacementRequest
from services.clinic_optimizer import optimize
from services.provincial_planning import (
    bundle, load_provincial_data, provincial_evidence, calculate_provincial_scores,
)


def test_provincial_catalog_keeps_all_barangays_lgus_and_canonical_ids(client):
    frame, network, metadata = load_provincial_data()
    assert len(frame) == frame.id.nunique() == 681
    assert frame.municipality.nunique() == 30
    assert len(network["sites"]) == 681
    response = client.get("/api/planning/clinics")
    assert response.status_code == 200
    assert {s["barangay_id"] for s in response.json()["sites"]} == set(frame.id)
    assert "not establish road access" in metadata["travel_times"]
    assert len(client.get("/api/clinics").json()["sites"]) == 8


def test_native_baseline_matches_shared_browser_hni_for_every_barangay():
    frame, _, _ = load_provincial_data()
    source, _, _ = bundle()
    rows = calculate_provincial_scores(frame, {}, PlacementRequest())
    expected = {b["psgc"]: b for b in source["barangays"]}
    for row in rows:
        assert row["score"] == expected[row["id"]]["needScore"]
        assert row["factors"] == pytest.approx({k: v for k, v in expected[row["id"]]["needFactors"].items() if v is not None})
        assert "disasterRisk" not in row["contributions"]
        assert row["rank"] == 1 + sum(b["score"] > row["score"] for b in rows)


def test_flood_and_explicit_link_exclusions_remove_modeled_connections():
    frame, network, _ = load_provincial_data()
    request = PlacementRequest(flood_level="severe")
    times, excluded, affected = provincial_evidence(frame, network, request)
    assert affected
    for site in network["sites"]:
        if site["barangay_id"] in affected:
            assert site["id"] in excluded
    assert all(not (set(reached) & affected) for bid, reached in times.items() if bid not in affected)
    road = network["roads"][0]
    touching = [r["id"] for r in network["roads"] if road["source"] in (r["source"], r["target"])]
    times, _, _ = provincial_evidence(frame, network, PlacementRequest(closed_roads=touching))
    assert times[road["source"]] == {road["source"]: 0}


def test_manual_allocation_can_reach_each_lgu_and_enforces_capacity():
    frame, network, _ = load_provincial_data()
    chosen = []
    for municipality in sorted(frame.municipality.unique()):
        ids = set(frame.loc[frame.municipality == municipality, "id"])
        chosen.append(next(s for s in network["sites"] if s["barangay_id"] in ids and s["eligible"]))
    # Fixed-site batches avoid expensive global searches while proving every LGU
    # has usable allocation candidates, not only catalog labels.
    for offset in range(0, len(chosen), 10):
        group = chosen[offset:offset + 10]
        request = PlacementRequest(clinic_count=len(group), capacity=10,
                                   manual_sites=[s["id"] for s in group], max_travel_minutes=0)
        plan = optimize(request, provincial=True)
        assert len(plan["barangays"]) == 681
        assert {s["id"] for s in plan["optimized"]["clinics"]} == set(request.manual_sites)
        demands = {b["id"]: b["demand"] for b in plan["barangays"]}
        for clinic in plan["optimized"]["clinics"]:
            assert clinic["served"] == min(10, demands[clinic["barangay_id"]])
            assert clinic["daily_capacity"] == 10
            assert all(a["barangay_id"] == clinic["barangay_id"] and a["minutes"] == 0 for a in clinic["assignments"])


def test_provincial_draft_approval_reaches_public_without_forecast_details(client, auth):
    frame, network, _ = load_provincial_data()
    calamba = set(frame.loc[frame.municipality.str.contains("Calamba"), "id"])
    site = next(s for s in network["sites"] if s["barangay_id"] in calamba and s["eligible"])
    body = dict(clinic_count=1, capacity=30, manual_sites=[site["id"]], max_travel_minutes=0)
    assert client.post("/api/planning/optimize", json=body).status_code == 401
    result = client.post("/api/planning/optimize", json=body, auth=auth)
    assert result.status_code == 200, result.text
    plan = result.json()
    assert len(plan["barangays"]) == 681
    assert client.get("/api/schedules").json()["schedules"] == []
    approved = client.post("/api/schedules/approve", auth=auth,
                           json=dict(plan_id=plan["plan_id"], deployment_date=(today() + timedelta(days=1)).isoformat()))
    assert approved.status_code == 200
    public = client.get("/api/schedules").json()
    assert public["schedules"][0]["clinics"][0]["barangay_id"] in calamba
    assert "case_rate_lag1" not in json.dumps(public)
    assert "Forecast target date" not in json.dumps(public)


def test_unknown_pilot_site_is_not_silently_used_by_provincial_planning(client, auth):
    response = client.post("/api/planning/optimize", auth=auth,
                           json=dict(clinic_count=1, manual_sites=["P01"]))
    assert response.status_code == 422
    assert client.get("/api/schedules").json()["schedules"] == []
