"""Objective, capacity, history, API and model-prefix regression checks."""
from datetime import timedelta
from itertools import combinations

import pytest

from config import today
from models.hni_simulation import HniConditions
from services.demand_model import ModelUnavailable, forecast_illness
from services import hni_simulation as simulation
from services.provincial_planning import bundle, load_provincial_data


def small_context():
    # These hand-computed fractions reserve 180/400 of each catchment's demand.
    values = dict(
        hni={"A": 80, "B": 60, "C": 90},
        demands={"A": 100, "B": 300, "C": 20},
        fractions={"A": {"A": .1575, "B": .07875}, "B": {"A": .07875, "B": .1575}, "C": {"C": .35}},
        capacity_scales={"A": .45, "B": .45, "C": 1},
    )
    rows = [dict(psgc="A", population=100), dict(psgc="B", population=900), dict(psgc="C", population=100)]
    return dict(rows=rows, days=[values] * 30, candidates=["A", "B", "C"])


def test_manual_host_neighbor_deductions_share_a_fixed_population_denominator():
    context = small_context()
    result = simulation.evaluate_history(context, {1: [dict(clinicId="MC-1", psgc="A")]})
    day = result["days"][0]
    expected_baseline = (100 * 80 + 900 * 60 + 100 * 90) / 1100
    expected_hni = (100 * 80 * .8425 + 900 * 60 * .92125 + 100 * 90) / 1100
    assert day["metrics"]["baselineHni"] == pytest.approx(expected_baseline)
    assert day["metrics"]["hni"] == pytest.approx(expected_hni)
    assert day["impacts"]["A"]["scenarioHni"] == pytest.approx(67.4)
    assert day["impacts"]["B"]["scenarioHni"] == pytest.approx(55.275)
    assert "C" not in day["impacts"]
    assert day["metrics"]["servedAppointments"] == pytest.approx(180)
    assert day["metrics"]["capacityUtilization"] == pytest.approx(100)


def test_overlap_and_clinic_order_do_not_duplicate_capacity_or_service():
    values = small_context()["days"][0]
    fractions, appointments = simulation.service_impact(values, ["A", "B"])
    assert fractions == {"A": .1575, "B": .1575}
    assert appointments == pytest.approx({"A": 45, "B": 135})
    assert simulation.service_impact(values, ["B", "A"]) == (fractions, appointments)
    assert all(amount <= 180 for amount in appointments.values())
    assert sum(appointments.values()) <= sum(values["demands"].values())
    assert max(fractions.values()) <= .35


def test_adding_a_clinic_cannot_increase_hni_with_the_same_baseline():
    context = small_context()
    prior = float("inf")
    for count in range(4):
        history = {1: [dict(clinicId=f"MC-{i + 1}", psgc=site) for i, site in enumerate(["A", "B", "C"][:count])]}
        result = simulation.evaluate_history(context, history)
        metrics = result["days"][0]["metrics"]
        assert 0 <= metrics["hni"] <= metrics["baselineHni"] <= 100
        assert metrics["hni"] <= prior
        prior = metrics["hni"]


def test_objective_matches_exhaustive_population_weighted_hni_minimum():
    context = small_context()
    values = context["days"][0]
    populations = {r["psgc"]: r["population"] for r in context["rows"]}
    for count in (1, 2, 3):
        result, status, _ = simulation.select_hni_sites(values, populations, context["candidates"], count, ["A", "B", "C"][:count])
        best = max(simulation.weighted_benefit(values, list(sites), populations)
                   for sites in combinations(context["candidates"], count))
        assert simulation.weighted_benefit(values, result, populations) == pytest.approx(best)
        assert len(set(result)) == count
        assert status == "OPTIMAL"


def test_area_count_does_not_replace_the_actual_hni_objective():
    values = dict(hni={"A": 20, "B": 20, "C": 90}, demands={"A": 10, "B": 10, "C": 10},
                  fractions={"A": {"A": .35, "B": .20}, "C": {"C": .35}}, capacity_scales={"A": 1, "C": 1})
    populations = {"A": 100, "B": 100, "C": 10000}
    selected, _, _ = simulation.select_hni_sites(values, populations, ["A", "C"], 1, ["A"])
    assert selected == ["C"]
    assert len(simulation.service_impact(values, selected)[0]) == 1
    assert len(simulation.service_impact(values, ["A"])[0]) == 2


def test_solver_timeout_retains_a_genuine_incumbent_at_least_as_good_as_manual(monkeypatch):
    from ortools.sat.python import cp_model

    class TimedOut:
        def __init__(self):
            self.parameters = type("Parameters", (), {})()

        def solve(self, model):
            return cp_model.UNKNOWN

    monkeypatch.setattr(simulation.cp_model, "CpSolver", TimedOut)
    context = small_context()
    values = context["days"][0]
    populations = {r["psgc"]: r["population"] for r in context["rows"]}
    result, status, optimal = simulation.select_hni_sites(values, populations, context["candidates"], 2, ["A", "C"])
    assert simulation.weighted_benefit(values, result, populations) >= simulation.weighted_benefit(values, ["A", "C"], populations)
    assert status == "FEASIBLE_INCUMBENT"
    assert optimal is False


def test_reused_synthetic_history_has_identical_predictions_without_future_leakage():
    frame, _, _ = load_provincial_data()
    frame = frame.iloc[:2].copy()
    issue = simulation.START_DATE + timedelta(days=14)
    ordinary, first = forecast_illness(frame, issue=issue)
    reused, second = forecast_illness(frame, issue=issue, history_through=issue + timedelta(days=14))
    assert first == second
    assert ordinary.disease_cases.tolist() == reused.disease_cases.tolist()
    with pytest.raises(ValueError, match="include the forecast issue"):
        forecast_illness(frame, issue=issue, history_through=issue - timedelta(days=1))


def test_backend_preserves_balanced_weights_missing_factors_and_daily_progression():
    source, _, _ = bundle()
    frozen_weights = dict(source["weights"])
    conditions = HniConditions()
    row = source["barangays"][0]
    original = dict(row["needFactors"])
    known = {k: v for k, v in original.items() if v is not None}
    expected = sum(v * frozen_weights[k] for k, v in known.items()) / sum(frozen_weights[k] for k in known)
    assert simulation.baseline_hni(row, 1, conditions, frozen_weights) == pytest.approx(expected)
    assert simulation.baseline_hni(row, 30, conditions, frozen_weights) >= expected
    missing = dict(row, needFactors=dict(original, hospitalAccess=None))
    remaining = {k: v for k, v in missing["needFactors"].items() if v is not None}
    assert simulation.baseline_hni(missing, 1, conditions, frozen_weights) == pytest.approx(
        sum(v * frozen_weights[k] for k, v in remaining.items()) / sum(frozen_weights[k] for k in remaining))
    assert row["needFactors"] == original
    assert source["weights"] == frozen_weights
    assert frozen_weights == dict(morbidity=.35, hospitalAccess=.30, density=.15, incomeClass=.10, clinicDistance=.05, clinicProvision=.05)


def test_real_api_uses_shared_day_hni_and_never_publishes_simulation(client, auth):
    context = simulation.context_for(HniConditions())
    sites = context["candidates"][:5]
    history = {"1": [dict(clinicId=f"MC-{i + 1}", psgc=site) for i, site in enumerate(sites)]}
    body = dict(clinic_count=5, conditions={}, history=history)
    manual = client.post("/api/planning/simulation/evaluate", auth=auth, json=body)
    assert manual.status_code == 200, manual.text
    optimized = client.post("/api/planning/simulation/optimize", auth=auth,
                            json=dict(clinic_count=5, day=15, comparison_sites=sites))
    assert optimized.status_code == 200, optimized.text
    plan = optimized.json()
    manual_day = manual.json()["days"][14]
    optimized_day = plan["evaluation"]["days"][14]
    assert optimized_day["metrics"]["baselineHni"] == manual_day["metrics"]["baselineHni"]
    assert optimized_day["metrics"]["hni"] <= manual_day["metrics"]["hni"] + 1e-12
    assert plan["comparison_hni"] == pytest.approx(manual_day["metrics"]["hni"])
    # The same sites must produce exactly the same deductions via either path.
    repeat = client.post("/api/planning/simulation/evaluate", auth=auth,
                         json=dict(clinic_count=5, history={"15": plan["locations"]}))
    assert repeat.status_code == 200, repeat.text
    assert repeat.json() == plan["evaluation"]
    assert len(plan["locations"]) == 5
    assert len(plan["evaluation"]["days"]) == 30
    assert all(0 <= d["metrics"]["capacityUtilization"] <= 100 + 1e-9 for d in plan["evaluation"]["days"])
    assert "XGBoost" in " ".join(plan["evaluation"]["notes"])
    public = client.get("/api/schedules").json()
    assert public["schedules"] == []
    assert "proposal_id" not in public
    assert client.post("/api/schedules/approve", auth=auth, json=dict(
        plan_id=plan["proposal_id"], deployment_date=(today() + timedelta(days=1)).isoformat(),
    )).status_code == 404


def test_authentication_and_input_validation_precede_simulation_work(client, auth):
    for path in ("evaluate", "optimize"):
        url = "/api/planning/simulation/" + path
        assert client.post(url, json={}).status_code == 401
        assert client.post(url, auth=auth, json=dict(clinic_count=11)).status_code == 422
    assert client.post("/api/planning/simulation/optimize", auth=auth, json=dict(day=31)).status_code == 422
    assert client.post("/api/planning/simulation/evaluate", auth=auth,
                       json=dict(conditions=dict(morbiditySpikes={"unknown": 2}))).status_code == 422
    assert client.post("/api/planning/simulation/evaluate", auth=auth,
                       json=dict(conditions=dict(morbiditySpikes={"403402000": 0}))).status_code == 422


def test_history_rejects_duplicate_sites_extra_clinics_and_repeat_week(client, auth):
    site = simulation.context_for(HniConditions())["candidates"][0]
    url = "/api/planning/simulation/evaluate"
    duplicate = [dict(clinicId="MC-1", psgc=site), dict(clinicId="MC-2", psgc=site)]
    assert client.post(url, auth=auth, json=dict(clinic_count=2, history={"1": duplicate})).status_code == 422
    single = [dict(clinicId="MC-1", psgc=site)]
    assert client.post(url, auth=auth, json=dict(clinic_count=1, history={"1": single, "2": single})).status_code == 422
    assert client.post(url, auth=auth, json=dict(clinic_count=1, history={"1": single * 2})).status_code == 422
    assert client.post("/api/planning/simulation/optimize", auth=auth,
                       json=dict(clinic_count=1, day=2, history={"1": single})).status_code == 422


def test_flood_restrictions_apply_to_both_placement_modes_and_service():
    source, _, _ = bundle()
    row = next(r for r in source["barangays"] if (r["hazards"].get("flood_100yr") or 0) > 0)
    conditions = HniConditions(floodOverrides={row["municipalityPsgc"]: "severe"})
    context = simulation.context_for(conditions)
    assert row["psgc"] in context["affected"]
    assert not set(context["candidates"]) & context["affected"]
    for values in context["days"]:
        assert not any(set(catchment) & context["affected"] for catchment in values["fractions"].values())
    with pytest.raises(ValueError, match="flood restrictions"):
        simulation.validate_sites([row["psgc"]], 1, context)


def test_model_failure_is_explicit_and_never_replaced_with_mock_placements(client, auth, monkeypatch):
    def unavailable(conditions):
        raise ModelUnavailable("XGBoost model unavailable")

    monkeypatch.setattr(simulation, "context_for", unavailable)
    for path in ("evaluate", "optimize"):
        response = client.post("/api/planning/simulation/" + path, auth=auth, json={})
        assert response.status_code == 503
        assert response.json()["detail"] == "XGBoost model unavailable"
