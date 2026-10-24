from ortools.sat.python import cp_model
from services.risk_scoring import calculate_scores
from services.data import load_data, road_graph, travel_times, validate_references
from services.pilot import active_hazards, road_evidence
from services.demand_model import estimate_demands, forecast_illness, TARGET_PREFIX
from services.deployment_rules import deployment_restricted


def preventive_services(assignments, barangays):
    """Reuse Python need-scoring suggestions for the communities actually served."""
    served_ids = {a["barangay_id"] for a in assignments}
    services = sorted({service for b in barangays if b["id"] in served_ids
                       for service in b["recommended_services"]})
    return " Suggested preventive services: " + ", ".join(services) + "." if services else ""


def solve(barangays, sites, times, request, selected=None):
    model = cp_model.CpModel()
    active = {s["id"]: model.new_bool_var(f"open_{s['id']}") for s in sites}
    model.add(sum(active.values()) <= request.clinic_count)
    if selected is not None:
        for site_id, var in active.items():
            model.add(var == int(site_id in selected))
    allocations, minutes = {}, {}
    by_barangay = {b["id"]: [] for b in barangays}
    by_site = {s["id"]: [] for s in sites}
    for b in barangays:
        for s in sites:
            travel = times.get(b["id"], {}).get(s["barangay_id"])
            if travel is not None and travel <= request.max_travel_minutes:
                key = (b["id"], s["id"])
                allocations[key] = model.new_int_var(0, min(b["demand"], s["capacity"], request.capacity), f"demand_{key}")
                minutes[key] = travel
                by_barangay[b["id"]].append(allocations[key])
                by_site[s["id"]].append(allocations[key])
                model.add(allocations[key] <= b["demand"] * active[s["id"]])
    for b in barangays:
        model.add(sum(by_barangay[b["id"]]) <= b["demand"])
    for s in sites:
        used = sum(by_site[s["id"]])
        model.add(used <= min(request.capacity, s["capacity"]) * active[s["id"]])
        model.add(used >= active[s["id"]])
    # Lexicographic integer objective: priority demand, then shorter travel, then fewer sites.
    # Every weighted unit outweighs the maximum possible total secondary penalty.
    priority = {b["id"]: max(1, round(b["score"] * 100)) for b in barangays}
    maximum_open = min(request.clinic_count, len(sites))
    maximum_served = min(sum(b["demand"] for b in barangays),
                         sum(sorted((min(s["capacity"], request.capacity) for s in sites), reverse=True)[:maximum_open]))
    travel_scale = maximum_open + 1
    scale = maximum_served * request.max_travel_minutes * travel_scale + maximum_open + 1
    model.maximize(sum(v * (priority[bid] * scale - minutes[(bid, sid)] * travel_scale)
                       for (bid, sid), v in allocations.items()) - sum(active.values()))
    solver = cp_model.CpSolver()
    # Bound search work reproducibly; allow the larger provincial model to presolve.
    solver.parameters.max_deterministic_time = 10.0
    solver.parameters.max_time_in_seconds = 20.0
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 42
    status = solver.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise ValueError("No feasible allocation for these manual locations. Try fewer sites or a longer travel limit.")
    clinics, served_by_barangay = [], {b["id"]: 0 for b in barangays}
    weighted, travel_sum, high = 0.0, 0, 0
    by_id = {b["id"]: b for b in barangays}
    for s in sites:
        if not solver.value(active[s["id"]]):
            continue
        assignments = []
        for (bid, sid), var in allocations.items():
            amount = solver.value(var)
            if sid == s["id"] and amount:
                b = by_id[bid]
                assignments.append(dict(barangay_id=bid, name=b["name"], residents=amount, minutes=minutes[(bid, sid)]))
                served_by_barangay[bid] += amount
                weighted += amount * priority[bid] / 10000
                travel_sum += amount * minutes[(bid, sid)]
                high += amount if b["high_priority"] else 0
        served = sum(a["residents"] for a in assignments)
        capacity = min(request.capacity, s["capacity"])
        clinics.append(dict(**s, daily_capacity=capacity, served=served, assignments=assignments,
                            utilization=round(served / capacity * 100, 2),
                            reason=f"This sample location could serve {len(assignments)} barangays within an estimated {request.max_travel_minutes}-minute road journey. The plan assigns {served} of {capacity} available daily appointments. Local access and safety still need review." + preventive_services(assignments, barangays)))
    served = sum(served_by_barangay.values())
    demand = sum(b["demand"] for b in barangays)
    return dict(clinics=clinics, served_by_barangay=served_by_barangay,
                metrics=dict(residents_served=served, high_priority_reached=high, weighted_demand=round(weighted, 4),
                             total_demand=demand, unserved_demand=demand-served,
                             unserved_population=max(0, sum(b["population"] for b in barangays) - served),
                             average_travel_minutes=round(travel_sum / served, 2) if served else 0,
                             capacity_utilization=round(served / sum(c["daily_capacity"] for c in clinics) * 100, 2) if clinics else 0,
                             demand_served_pct=round(served / demand * 100, 2) if demand else 0,
                             flood_safe_accessibility_pct=round(served / demand * 100, 2) if demand else 0),
                solver_status=solver.status_name(status), optimal=status == cp_model.OPTIMAL)


def optimize(request, provincial=False):
    if provincial:
        from services.provincial_planning import load_provincial_data, provincial_evidence, calculate_provincial_scores
        frame, network, metadata = load_provincial_data()
    else:
        frame, network, metadata = load_data()
    validate_references(request, frame, network)
    excluded = set(request.flooded_sites)
    affected = set()
    if provincial:
        times, excluded, affected = provincial_evidence(frame, network, request)
        frame["scenario_flood_exposure"] = [100 if row["id"] in affected else row["flood_exposure"] for row in frame.to_dict("records")]
    elif "routes" in network:
        times, excluded = road_evidence(network, request)
        hazards = active_hazards(network, request.flood_level, request.municipality_flood_levels)
        affected = {h["properties"]["barangay_id"] for h in network["hazards"]["features"] if h["properties"]["id"] in hazards}
        frame = frame.copy()
        frame["scenario_flood"] = frame.id.isin(affected)
        frame["scenario_flood_exposure"] = [
            max(float(row["flood_exposure"]), {"none": 0, "moderate": 50, "severe": 100}[request.municipality_flood_levels[row["municipality"]]])
            if row["municipality"] in request.municipality_flood_levels
            else (100 if row["id"] in affected else float(row["flood_exposure"]))
            for row in frame.to_dict("records")
        ]
    else:
        times = travel_times(road_graph(frame, network, request.closed_roads))
    frame, forecast_context = forecast_illness(frame)
    barangays = (calculate_provincial_scores(frame, forecast_context, request) if provincial else
                 calculate_scores(frame, network, times, request.weights, request.outbreak_barangays, request.outbreak_multiplier, request.municipality_outbreak_multipliers))
    model = estimate_demands(barangays, request, forecast_context)
    metadata = dict(metadata, disease=metadata["disease"] + f"; {model['model_id']} XGBoost next-day synthetic illness forecast for {model['target_date']}")
    sites = [s for s in network["sites"] if s["eligible"] and s["id"] not in excluded
             and not deployment_restricted(s)
             and (request.eligible_sites is None or s["id"] in request.eligible_sites)]
    if request.manual_sites is not None:
        if len(request.manual_sites) > request.clinic_count or set(request.manual_sites) - {s["id"] for s in sites}:
            raise ValueError("Manual sites must be eligible, flood-safe, and within the clinic count.")
    optimum = solve(barangays, sites, times, request, request.manual_sites)
    population = dict(zip(frame.id, frame.population))
    baseline_sites = [s["id"] for s in sorted(sites, key=lambda s: (-population[s["barangay_id"]], s["id"]))[:request.clinic_count]]
    # Baseline picks the most populous hubs and greedily fills them by population.
    baseline = greedy_baseline(barangays, sites, times, request, baseline_sites)
    base = baseline["metrics"]["weighted_demand"]
    gain = round((optimum["metrics"]["weighted_demand"]-base) / base * 100, 2) if base else None
    for allocation in (optimum, baseline):
        open_sites = allocation["clinics"]
        reachable_demand = sum(b["demand"] for b in barangays if any(
            times.get(b["id"], {}).get(s["barangay_id"], float("inf")) <= request.max_travel_minutes
            for s in open_sites))
        total = allocation["metrics"]["total_demand"]
        allocation["metrics"]["flood_safe_accessibility_pct"] = round(reachable_demand / total * 100, 2) if total else 0
    result = dict(optimized=optimum, baseline=baseline, improvement_pct=gain, barangays=barangays,
                inputs=request.model_dump(), metadata=metadata,
                flood_affected_barangays=sorted(affected) if provincial else [],
                notes=["Demand represents estimated daily appointments, not total population coverage.",
                       TARGET_PREFIX + model["target_date"],
                       f"Forecast issued: {model['issue_date']} (Asia/Manila). Dated synthetic history ends on the issue date; actual future observations are excluded.",
                       "Priority-weighted demand = allocated appointments × illustrative need / 100.",
                       f"Illness forecast: {model['model_id']} · XGBoost {model['xgboost_version']} · synthetic-only, not clinically validated. Model SHA256: {model['model_sha256']}.",
                       f"Later-date synthetic daily-case MAE: {model['metrics']['test_mae']:.3f}/1,000; persistence MAE: {model['metrics']['persistence_mae']:.3f}/1,000; linear regression MAE: {model['metrics']['linear_mae']:.3f}/1,000. These are not real-world accuracy estimates.",
                       "The six-factor pilot priority uses tomorrow's modeled rolling 30-day illness burden. The province-wide map retains its separate baseline HNI.",
                       f"Appointment demand uses the unchanged {model['demand_model_id']} XGBoost model with forecast illness inputs, then explicit surge settings. Agreed factor weights and the original demand model artifact are unchanged.",
                       "Flood-safe accessibility is demand with a safe modeled route to an opened site, before capacity limits; demand served includes capacity limits.",
                       "Paete's approximate user-configured forest-land exclusion is enforced server-side; it is not an official land classification.",
                       "Flood safety is based only on selected demo exclusions, not verified hazard conditions.",
                       f"{len(sites)} viable staging sites under this scenario. Blocked fixture routes are excluded; no diversion is assumed."])
    if provincial:
        # Replace pilot-specific claims; preserve the dated model and approval contract.
        result["notes"] = [note for note in result["notes"] if not any(phrase in note for phrase in
                           ("six-factor pilot", "Pilot priority", "Agreed factor weights", "Blocked fixture", "six-factor coefficients"))]
        result["notes"] += [
            "Scope: all 681 Laguna barangays and all 30 LGUs. One illustrative planning point per barangay; these are not verified operating facilities.",
            "Agreed Balanced HNI: morbidity 35%, hospital distance 30%, density 15%, municipal income class 10%, clinic distance 5%, clinic provision 5%. Disaster risk has no HNI weight. Legacy pilot request weights do not alter this fixed provincial policy.",
            "Travel is estimated on supplied barangay adjacency links at 20 km/h, minimum 3 minutes per link. Shared borders are not verified roads; no live traffic, road geometry or provincial OSRM matrix is asserted.",
            "Flood scenarios exclude planning points and touching model links using the selected supplied 25-year or 100-year point flood layer. Coverage is unverified; unknown hazards are not proof of safety.",
            "Appointment features use synthetic children/elderly shares and a neutral 50% poverty assumption; hospital minutes are a straight-line proxy at 20 km/h, capped at 120. These inputs do not change the agreed HNI weights.",
            f"Appointment demand uses the unchanged {model['demand_model_id']} XGBoost model and explicit surge controls.",
            f"{len(sites)} eligible provincial planning points under the selected restrictions. Search times are bounded; Feasible results do not claim global optimality.",
        ]
    if provincial:
        for allocation in (result["optimized"], result["baseline"]):
            for clinic in allocation["clinics"]:
                clinic["reason"] = clinic["reason"].replace("road journey", "journey on modeled adjacency links")
    return result


def greedy_baseline(barangays, sites, times, request, selected):
    remaining = {b["id"]: b["demand"] for b in barangays}
    clinics, weighted, travel_sum, high = [], 0.0, 0, 0
    for s in sorted(sites, key=lambda s: selected.index(s["id"]) if s["id"] in selected else len(selected)):
        if s["id"] not in selected:
            continue
        limit = min(request.capacity, s["capacity"])
        capacity, assignments = limit, []
        for b in sorted(barangays, key=lambda b: (-b["population"], b["id"])):
            minutes = times.get(b["id"], {}).get(s["barangay_id"])
            if minutes is None or minutes > request.max_travel_minutes:
                continue
            amount = min(capacity, remaining[b["id"]])
            if not amount:
                continue
            capacity -= amount
            remaining[b["id"]] -= amount
            weighted += amount * max(1, round(b["score"]*100)) / 10000
            travel_sum += amount * minutes
            high += amount if b["high_priority"] else 0
            assignments.append(dict(barangay_id=b["id"], name=b["name"], residents=amount, minutes=minutes))
        if assignments:
            clinics.append(dict(**s, daily_capacity=limit, served=limit-capacity, assignments=assignments,
                                utilization=round((limit-capacity)/limit*100, 2), reason="Population-first baseline staging site." + preventive_services(assignments, barangays)))
    served = sum(b["demand"]-remaining[b["id"]] for b in barangays)
    demand = sum(b["demand"] for b in barangays)
    return dict(clinics=clinics, served_by_barangay={b["id"]: b["demand"]-remaining[b["id"]] for b in barangays},
                metrics=dict(residents_served=served, high_priority_reached=high, weighted_demand=round(weighted, 4), total_demand=demand,
                             unserved_demand=demand-served, unserved_population=max(0, sum(b["population"] for b in barangays) - served), average_travel_minutes=round(travel_sum/served, 2) if served else 0,
                             capacity_utilization=round(served/sum(c["daily_capacity"] for c in clinics)*100, 2) if clinics else 0,
                             demand_served_pct=round(served/demand*100, 2), flood_safe_accessibility_pct=round(served / demand * 100, 2) if demand else 0),
                solver_status="POPULATION_GREEDY", optimal=False)
