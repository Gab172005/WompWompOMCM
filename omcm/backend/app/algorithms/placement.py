from ortools.sat.python import cp_model
from app.algorithms.scoring import calculate_scores
from app.services.data import load_data, road_graph, travel_times, validate_references


def solve(barangays, sites, times, request, selected=None):
    model = cp_model.CpModel()
    active = {s["id"]: model.new_bool_var(f"open_{s['id']}") for s in sites}
    model.add(sum(active.values()) <= request.clinic_count)
    if selected is not None:
        for site_id, var in active.items():
            model.add(var == int(site_id in selected))
    allocations, minutes = {}, {}
    for b in barangays:
        for s in sites:
            travel = times.get(b["id"], {}).get(s["barangay_id"])
            if travel is not None and travel <= request.max_travel_minutes:
                key = (b["id"], s["id"])
                allocations[key] = model.new_int_var(0, b["demand"], f"demand_{key}")
                minutes[key] = travel
                model.add(allocations[key] <= b["demand"] * active[s["id"]])
    for b in barangays:
        model.add(sum(v for (bid, _), v in allocations.items() if bid == b["id"]) <= b["demand"])
    for s in sites:
        used = sum(v for (_, sid), v in allocations.items() if sid == s["id"])
        model.add(used <= request.capacity * active[s["id"]])
        model.add(used >= active[s["id"]])
    # Lexicographic integer objective: priority demand, then shorter travel, then fewer sites.
    # Every weighted unit outweighs the maximum possible total secondary penalty.
    priority = {b["id"]: max(1, round(b["score"] * 100)) for b in barangays}
    scale = sum(b["demand"] for b in barangays) * 120 + len(sites) + 1
    model.maximize(sum(v * (priority[bid] * scale - minutes[(bid, sid)]) for (bid, sid), v in allocations.items()) - sum(active.values()))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 15
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
        clinics.append(dict(**s, daily_capacity=request.capacity, served=served, assignments=assignments,
                            utilization=round(served / request.capacity * 100, 2),
                            reason=f"Eligible flood-safe hub reaching {len(assignments)} barangays within {request.max_travel_minutes} minutes; {served} of {request.capacity} daily appointments allocated."))
    served = sum(served_by_barangay.values())
    demand = sum(b["demand"] for b in barangays)
    return dict(clinics=clinics, served_by_barangay=served_by_barangay,
                metrics=dict(residents_served=served, high_priority_reached=high, weighted_demand=round(weighted, 4),
                             total_demand=demand, unserved_demand=demand-served,
                             average_travel_minutes=round(travel_sum / served, 2) if served else 0,
                             capacity_utilization=round(served / (len(clinics) * request.capacity) * 100, 2) if clinics else 0,
                             demand_served_pct=round(served / demand * 100, 2) if demand else 0,
                             flood_safe_accessibility_pct=100 if served else 0),
                solver_status=solver.status_name(status), optimal=status == cp_model.OPTIMAL)


def optimize(request):
    frame, network, metadata = load_data()
    validate_references(request, frame, network)
    times = travel_times(road_graph(frame, network, request.closed_roads))
    barangays = calculate_scores(frame, network, times, request.weights, request.outbreak_barangays, request.outbreak_multiplier)
    sites = [s for s in network["sites"] if s["eligible"] and s["id"] not in request.flooded_sites
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
    return dict(optimized=optimum, baseline=baseline, improvement_pct=gain, barangays=barangays,
                inputs=request.model_dump(), metadata=metadata,
                notes=["Demand represents estimated daily appointments, not total population coverage.",
                       "Priority-weighted demand = allocated appointments × illustrative need / 100.",
                       "Flood safety is based only on selected demo exclusions, not verified hazard conditions."])


def greedy_baseline(barangays, sites, times, request, selected):
    remaining = {b["id"]: b["demand"] for b in barangays}
    clinics, weighted, travel_sum, high = [], 0.0, 0, 0
    for s in sorted(sites, key=lambda s: selected.index(s["id"]) if s["id"] in selected else len(selected)):
        if s["id"] not in selected:
            continue
        capacity, assignments = request.capacity, []
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
            clinics.append(dict(**s, daily_capacity=request.capacity, served=request.capacity-capacity, assignments=assignments,
                                utilization=round((request.capacity-capacity)/request.capacity*100, 2), reason="Population-first baseline staging site."))
    served = sum(b["demand"]-remaining[b["id"]] for b in barangays)
    demand = sum(b["demand"] for b in barangays)
    return dict(clinics=clinics, served_by_barangay={b["id"]: b["demand"]-remaining[b["id"]] for b in barangays},
                metrics=dict(residents_served=served, high_priority_reached=high, weighted_demand=round(weighted, 4), total_demand=demand,
                             unserved_demand=demand-served, average_travel_minutes=round(travel_sum/served, 2) if served else 0,
                             capacity_utilization=round(served/(len(clinics)*request.capacity)*100, 2) if clinics else 0,
                             demand_served_pct=round(served/demand*100, 2), flood_safe_accessibility_pct=100 if served else 0),
                solver_status="POPULATION_GREEDY", optimal=False)
