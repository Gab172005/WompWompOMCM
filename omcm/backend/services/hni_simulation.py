"""One capacity-aware HNI objective for manual and optimized rehearsals.

The six-factor policy and trained artifacts are unchanged. Service is reserved
proportionately across each catchment's XGBoost appointment demand. Overlaps use
the strongest reservation, so a community and a clinic's capacity are never
counted twice. All returned scenarios are transient, not publishable plans.
"""
from datetime import date, timedelta
from functools import lru_cache
import json
import math
from uuid import uuid4

from ortools.sat.python import cp_model

from models.clinic import PlacementRequest
from models.hni_simulation import HniConditions
from services.demand_model import forecast_illness, estimate_demands
from services.provincial_planning import (
    bundle, distance, load_provincial_data, provincial_evidence, calculate_provincial_scores,
)

START_DATE = date(2026, 10, 24)
RADIUS_KM = 3
SERVICE_CEILING = .35
DAILY_CAPACITY = 180
FRACTION_SCALE = 1_000_000


def municipality_hash(psgc):
    value = 2166136261
    for character in f"42:{psgc}":
        value = ((value ^ ord(character)) * 16777619) & 0xffffffff
    return value


def baseline_hni(row, day, conditions, weights):
    """Mirror the established fixed-reference, deterministic morbidity timeline."""
    factors = dict(row["needFactors"])
    if factors["morbidity"] is not None:
        increase = (.35 + municipality_hash(row["municipalityPsgc"]) % 11 * .02) * (day - 1)
        surge = 20 * (conditions.morbiditySpikes.get(row["municipalityPsgc"], 1) - 1)
        factors["morbidity"] = min(100, max(0, factors["morbidity"] + increase + surge))
    available = sum(weight for name, weight in weights.items() if factors[name] is not None)
    if not available:
        raise ValueError("Simulation baseline has no available HNI factors.")
    return sum(factors[name] * weight for name, weight in weights.items() if factors[name] is not None) / available


@lru_cache(maxsize=4)
def simulation_context(conditions_json):
    conditions = HniConditions.model_validate_json(conditions_json)
    source, _, _ = bundle()
    rows = source["barangays"]
    municipality_names = {r["municipalityPsgc"]: r["municipality"] for r in rows}
    if (set(conditions.morbiditySpikes) | set(conditions.floodOverrides)) - municipality_names.keys():
        raise ValueError("Simulation conditions contain an unknown Laguna municipality.")
    request = PlacementRequest(
        capacity=DAILY_CAPACITY, max_travel_minutes=25,
        municipality_outbreak_multipliers={municipality_names[k]: v for k, v in conditions.morbiditySpikes.items()},
        municipality_flood_levels={municipality_names[k]: v for k, v in conditions.floodOverrides.items()},
    )
    frame, network, _ = load_provincial_data()
    times, excluded, affected = provincial_evidence(frame, network, request)
    candidates = [s["barangay_id"] for s in network["sites"] if s["eligible"] and s["id"] not in excluded]
    by_id = {r["psgc"]: r for r in rows}
    # Identical geographic and modeled-access rules for both placement methods.
    catchments = {}
    for host in candidates:
        catchments[host] = {
            r["psgc"]: SERVICE_CEILING * (1 - .5 * d / RADIUS_KM)
            for r in rows
            if (d := distance(by_id[host], r)) <= RADIUS_KM
            and r["psgc"] in times.get(host, {})
        }
    frame["scenario_flood_exposure"] = [100 if r["id"] in affected else r["flood_exposure"] for r in frame.to_dict("records")]
    days = []
    for day in range(1, 31):
        target = START_DATE + timedelta(days=day - 1)
        forecast_frame, forecast_context = forecast_illness(
            frame, issue=target - timedelta(days=1), history_through=START_DATE + timedelta(days=28),
        )
        barangays = calculate_provincial_scores(forecast_frame, forecast_context, request)
        estimate_demands(barangays, request, forecast_context)
        demands = {b["id"]: b["demand"] for b in barangays}
        capacity_scales = {
            host: min(1, DAILY_CAPACITY / max(1, sum(demands[bid] for bid in catchment)))
            for host, catchment in catchments.items()
        }
        fractions = {
            host: {bid: fraction * capacity_scales[host] for bid, fraction in catchment.items()}
            for host, catchment in catchments.items()
        }
        days.append(dict(
            hni={r["psgc"]: baseline_hni(r, day, conditions, source["weights"]) for r in rows},
            demands=demands, fractions=fractions, capacity_scales=capacity_scales,
        ))
    return dict(rows=rows, days=days, candidates=candidates, affected=affected)


def context_for(conditions):
    return simulation_context(json.dumps(conditions.model_dump(), sort_keys=True))


def validate_sites(sites, clinic_count, context):
    if len(sites) != clinic_count or len(set(sites)) != clinic_count:
        raise ValueError("Simulation requires one distinct location for each available clinic.")
    if set(sites) - set(context["candidates"]):
        raise ValueError("Simulation locations must be available and outside the selected flood restrictions.")


def validated_history(request, context):
    history, weeks = {}, set()
    for day, allocation in sorted(request.history.items()):
        week = min((day - 1) // 7, 3)
        if week in weeks:
            raise ValueError("Simulation permits one placement in each weekly window.")
        weeks.add(week)
        if {a.clinicId for a in allocation} != {f"MC-{i + 1}" for i in range(request.clinic_count)}:
            raise ValueError("Simulation clinic identifiers must match the available fleet.")
        sites = [a.psgc for a in allocation]
        validate_sites(sites, request.clinic_count, context)
        history[day] = [a.model_dump() for a in allocation]
    return history


def service_impact(day_context, sites):
    # Stable tie breaking makes reordering clinics mathematically irrelevant.
    winners = {}
    for host in sorted(sites):
        for bid, fraction in day_context["fractions"][host].items():
            if bid not in winners or fraction > winners[bid][0]:
                winners[bid] = (fraction, host)
    fractions = {bid: pair[0] for bid, pair in winners.items()}
    appointments = {host: 0.0 for host in sites}
    for bid, (_, host) in winners.items():
        appointments[host] += day_context["demands"][bid] * day_context["capacity_scales"][host]
    return fractions, appointments


def weighted_benefit(day_context, sites, populations):
    fractions, _ = service_impact(day_context, sites)
    return sum(populations[bid] * day_context["hni"][bid] * fraction for bid, fraction in fractions.items())


def evaluate_history(context, history):
    rows = context["rows"]
    population = sum(r["population"] for r in rows)
    if population <= 0 or any(not math.isfinite(r["population"]) or r["population"] < 0 for r in rows):
        raise ValueError("Simulation population must be finite and positive overall.")
    sites, previous_sites, prior_unmet = [], {}, {}
    moves, cumulative = 0, 0.0
    results = []
    for day, values in enumerate(context["days"], 1):
        if day in history:
            current = {a["clinicId"]: a["psgc"] for a in history[day]}
            moves += sum(bid != previous_sites[cid] for cid, bid in current.items() if cid in previous_sites)
            previous_sites = current
            sites = list(current.values())
        fractions, appointments = service_impact(values, sites)
        baseline, total, demand, unmet, reached_population = 0.0, 0.0, 0.0, 0.0, 0
        impacts = {}
        for row in rows:
            bid, pop = row["psgc"], row["population"]
            hni, fraction = values["hni"][bid], fractions.get(bid, 0)
            scenario_hni = hni * (1 - fraction)
            untreated = min(100, hni + .15 * prior_unmet.get(bid, 0))
            prior_unmet[bid] = untreated * (1 - fraction)
            baseline += hni * pop
            total += scenario_hni * pop
            demand += untreated * pop
            unmet += prior_unmet[bid] * pop
            if fraction > 0:
                impacts[bid] = dict(scenarioHni=scenario_hni, serviceFraction=fraction)
                reached_population += pop
        cumulative += unmet
        served = sum(appointments.values())
        results.append(dict(day=day, impacts=impacts, metrics=dict(
            baselineHni=baseline / population, hni=total / population,
            uhni=unmet / population, totalUnmetPriority=unmet,
            servedBarangays=len(impacts), coveredPercent=100 * (demand - unmet) / demand if demand else 0,
            relocations=moves, cumulativeUnmetPriority=cumulative,
            servedAppointments=served, totalAppointments=sum(values["demands"].values()),
            capacityUtilization=100 * served / (len(sites) * DAILY_CAPACITY) if sites else 0,
            reachedPopulation=reached_population,
        )))
    return dict(days=results, notes=[
        "Agreed Balanced HNI factors and trained XGBoost artifacts are unchanged.",
        "XGBoost demand is dated to each synthetic simulation day; illness and weather histories are mock data.",
        "Service reserves up to 180 modeled appointments per clinic proportionately across its catchment demand; overlaps keep the strongest single reservation.",
        "Reach requires both a 3 km centroid radius and a safe modeled adjacency path within 25 minutes; these are not verified roads.",
        "Road reference markers do not change modeled access. Flood restrictions apply equally to manual and optimized service.",
        "Simulation is private and transient. No approved public schedule is changed.",
    ])


def evaluate_simulation(request):
    context = context_for(request.conditions)
    return evaluate_history(context, validated_history(request, context))


def select_hni_sites(values, populations, candidates, clinic_count, comparison_sites):
    """Maximize the same population-weighted HNI benefit returned by evaluation."""
    if len(candidates) < clinic_count:
        raise ValueError("Simulation has insufficient candidate locations; reduce the clinic count or flood restrictions.")
    # A real marginal-gain incumbent also gives the bounded solver a warm start.
    incumbent = []
    for _ in range(clinic_count):
        incumbent.append(max(
            (site for site in candidates if site not in incumbent),
            key=lambda site: weighted_benefit(values, incumbent + [site], populations),
        ))
    if comparison_sites and weighted_benefit(values, comparison_sites, populations) > weighted_benefit(values, incumbent, populations):
        incumbent = list(comparison_sites)
    model = cp_model.CpModel()
    opened = {site: model.new_bool_var(f"open_{site}") for site in candidates}
    model.add(sum(opened.values()) == clinic_count)
    by_barangay = {bid: [] for bid in populations}
    for site in candidates:
        for bid, fraction in values["fractions"][site].items():
            by_barangay[bid].append(round(fraction * FRACTION_SCALE) * opened[site])
    objective = []
    for bid, options in by_barangay.items():
        if options:
            served = model.new_int_var(0, round(SERVICE_CEILING * FRACTION_SCALE), f"service_{bid}")
            model.add_max_equality(served, options)
            objective.append(round(populations[bid] * values["hni"][bid] * 100) * served)
    model.maximize(sum(objective))
    for site, variable in opened.items():
        model.add_hint(variable, int(site in incumbent))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 12
    solver.parameters.max_deterministic_time = 6
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 42
    status = solver.solve(model)
    result, status_name, optimal = incumbent, "FEASIBLE_INCUMBENT", False
    if status in (cp_model.FEASIBLE, cp_model.OPTIMAL):
        selected = [site for site in candidates if solver.value(opened[site])]
        # Compare unrounded physical fractions, not the integer solver proxy.
        if weighted_benefit(values, selected, populations) >= weighted_benefit(values, incumbent, populations):
            result, status_name = selected, solver.status_name(status)
            # CP-SAT proves optimality only for its finite-precision objective.
            optimal = status == cp_model.OPTIMAL
    return result, status_name, optimal


def optimize_simulation(request):
    context = context_for(request.conditions)
    history = validated_history(request, context)
    if any(day > request.day or min((day - 1) // 7, 3) == min((request.day - 1) // 7, 3) for day in history):
        raise ValueError("Simulation optimization requires an unused current placement window.")
    if request.comparison_sites:
        validate_sites(request.comparison_sites, request.clinic_count, context)
    values = context["days"][request.day - 1]
    populations = {r["psgc"]: r["population"] for r in context["rows"]}
    sites, status, optimal = select_hni_sites(values, populations, context["candidates"], request.clinic_count, request.comparison_sites)
    locations = [dict(clinicId=f"MC-{i + 1}", psgc=site) for i, site in enumerate(sites)]
    history[request.day] = locations
    evaluation = evaluate_history(context, history)
    baseline = evaluation["days"][request.day - 1]["metrics"]["baselineHni"]
    comparison_hni = (baseline - weighted_benefit(values, request.comparison_sites, populations) / sum(populations.values())
                      if request.comparison_sites else None)
    return dict(
        proposal_id=str(uuid4()), day=request.day, locations=locations,
        evaluation=evaluation, solver_status=status, optimal=optimal,
        comparison_hni=comparison_hni,
        notes=[
            "Objective: minimize population-weighted scenario HNI on the selected simulation day.",
            "The feasible manual comparison is an incumbent; the returned plan cannot have a worse unrounded HNI on this day.",
            "A tie is valid. More barangays alone does not imply more population-weighted need reduced.",
            "Held locations are not reoptimized automatically on later days or after manual decisions change.",
        ],
    )
