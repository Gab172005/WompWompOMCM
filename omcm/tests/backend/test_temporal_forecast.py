from datetime import date, timedelta

import numpy as np
import pytest

from config import today
from models.clinic import PlacementRequest
from models.municipality import Weights
from services.data import load_data, road_graph, travel_times
from services.demand_model import forecast_illness, load_model, load_demand_model, TARGET_PREFIX
from services.forecast_history import feature_row, history
from services.risk_scoring import calculate_scores


def test_history_prefix_is_stable_when_new_dates_are_added():
    earlier = history("prefix-check", 1, 60, date(2024, 3, 1))
    later = history("prefix-check", 1, 60, date(2024, 4, 1))
    for key in ("case_rate", "rainfall", "temperature"):
        np.testing.assert_array_equal(earlier[key], later[key][:len(earlier[key])])


def test_feature_extraction_cannot_read_future_observations():
    series = history("future-check", 1, 60, date(2024, 3, 1))
    issue = 100
    expected = feature_row(series, issue)
    for key in ("case_rate", "rainfall", "temperature"):
        series[key][issue + 1:] = 99999
    np.testing.assert_array_equal(expected, feature_row(series, issue))


def test_training_validation_and_test_targets_are_chronological():
    _, model = load_model()
    periods = model["periods"]
    assert periods["train"]["last_target"] < periods["validation"]["first_target"]
    assert periods["validation"]["last_target"] < periods["test"]["first_target"]
    assert model["target"] == "next_day_case_rate_per_1000"
    assert model["metrics"]["test_mae"] < model["metrics"]["linear_mae"]
    assert model["metrics"]["test_mae"] < model["metrics"]["rolling7_mae"]


def test_existing_appointment_model_is_still_active_and_unchanged():
    booster, metadata = load_demand_model()
    assert metadata["model_id"] == "appointment-demand-v1"
    assert booster.num_boosted_rounds() == metadata["boosting_rounds"] == 249
    assert metadata["model_sha256"] == "e22eb43268c46cab33021b261fc994790fbcc3c901b55dcb083ba85d27f3fa3e"


@pytest.mark.usefixtures("demo_data")
def test_forecast_uses_issue_date_and_preserves_source_and_policy(monkeypatch):
    import services.demand_model as service
    monkeypatch.setattr(service, "today", lambda: date(2026, 10, 24))
    frame, network, _ = load_data()
    source = frame.copy(deep=True)
    predicted, context = forecast_illness(frame)
    repeated, repeated_context = forecast_illness(frame)
    assert context == repeated_context
    assert predicted.equals(repeated)
    assert frame.equals(source)
    assert context["issue_date"] == "2026-10-24"
    assert context["target_date"] == "2026-10-25"
    times = travel_times(road_graph(frame, network))
    weights = Weights()
    original = {b["id"]: b for b in calculate_scores(frame, network, times, weights)}
    future = calculate_scores(predicted, network, times, weights)
    for barangay in future:
        for factor in ("population", "vulnerability", "poverty", "accessibility", "flood"):
            assert barangay["factors"][factor] == original[barangay["id"]]["factors"][factor]
    assert weights.model_dump() == Weights().model_dump()
    assert any(b["disease_per_1000"] != original[b["id"]]["disease_per_1000"] for b in future)


def test_forecast_approval_must_match_target_and_drafts_stay_private(client, auth):
    plan = client.post("/api/optimize", json={"clinic_count": 2, "capacity": 70}, auth=auth).json()
    assert TARGET_PREFIX + (today() + timedelta(days=1)).isoformat() in plan["notes"]
    assert client.get("/api/schedules").json()["schedules"] == []
    wrong_day = dict(plan_id=plan["plan_id"], deployment_date=(today() + timedelta(days=2)).isoformat())
    assert client.post("/api/schedules/approve", json=wrong_day, auth=auth).status_code == 422
    assert client.get("/api/schedules").json()["schedules"] == []
    right_day = dict(wrong_day, deployment_date=(today() + timedelta(days=1)).isoformat())
    assert client.post("/api/schedules/approve", json=right_day, auth=auth).status_code == 200
    public = client.get("/api/schedules").json()
    assert len(public["schedules"]) == 1
    assert "case_rate_lag1" not in str(public)
    assert "predictions" not in str(public)


@pytest.mark.usefixtures("demo_data")
def test_surge_remains_an_explicit_demand_multiplier():
    from services.clinic_optimizer import optimize
    normal = optimize(PlacementRequest(clinic_count=1))
    surged = optimize(PlacementRequest(clinic_count=1, outbreak_barangays=["B01"], outbreak_multiplier=3))
    before = next(b for b in normal["barangays"] if b["id"] == "B01")
    after = next(b for b in surged["barangays"] if b["id"] == "B01")
    assert after["demand"] == min(after["population"], before["demand"] * 3)
