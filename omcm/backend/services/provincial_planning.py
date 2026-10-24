"""All-Laguna planning from existing geography and explicitly modeled travel."""
from functools import lru_cache
import json
import math
from pathlib import Path
import re
import unicodedata

import networkx as nx
import pandas as pd

from services.deployment_rules import deployment_restricted

SNAPSHOT = Path(__file__).resolve().parents[1] / "data/laguna-planning.json"


def key(value):
    value = re.sub(r"\s*\((?:pob\.?|poblacion)\)", "", value.lower())
    value = re.sub(r"^city of\s+", "", value)
    return "".join(c for c in unicodedata.normalize("NFKD", value) if c.isalnum())


def distance(a, b):
    lat1, lat2 = math.radians(a["lat"]), math.radians(b["lat"])
    dlat, dlng = lat2 - lat1, math.radians(b["lng"] - a["lng"])
    return 12742 * math.asin(min(1, math.sqrt(math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2)**2)))


@lru_cache(maxsize=1)
def bundle():
    data = json.loads(SNAPSHOT.read_text())
    rows = data["barangays"]
    if (len(rows) != 681 or len({r["municipalityPsgc"] for r in rows}) != 30
            or len({r["psgc"] for r in rows}) != 681):
        raise ValueError("Provincial planning requires 681 unique barangays across 30 LGUs.")
    expected = dict(morbidity=.35, hospitalAccess=.30, density=.15, incomeClass=.10,
                    clinicDistance=.05, clinicProvision=.05)
    if data["weights"] != expected:
        raise ValueError("Provincial HNI policy must match the agreed Balanced weights.")
    by_name = {(key(r["name"]), key(r["municipality"])): r for r in rows}
    edges, unresolved = {}, set()
    for row in rows:
        for label in row["adjacentBarangays"]:
            parts = label.rsplit(",", 2)
            neighbor = by_name.get((key(parts[0].strip()), key(parts[1].strip()))) if len(parts) == 3 else None
            if neighbor is None:
                unresolved.add(label)
                continue
            if row["psgc"] == neighbor["psgc"]:
                continue
            a, b = sorted([row["psgc"], neighbor["psgc"]])
            edges[a, b] = dict(id=f"L-{a}-{b}", source=a, target=b,
                               minutes=max(3, math.ceil(distance(row, neighbor) * 3)),
                               name=f"Model link: {row['name']}, {row['municipality']} / {neighbor['name']}, {neighbor['municipality']}")
    return data, list(edges.values()), len(unresolved)


def load_provincial_data():
    data, roads, unresolved = bundle()
    rows, sites = [], []
    for source in data["barangays"]:
        pop = source["population"]
        flood = [source["hazards"].get(f"flood_{period}yr") for period in (5, 25, 100)]
        known = [v for v in flood if v is not None and math.isfinite(v)]
        rows.append(dict(source, id=source["psgc"], geography_level="barangay",
                         children=round(pop * .25), elderly=round(pop * .10),
                         disease_cases=pop * source["morbidity"] / 1000,
                         poverty_pct=50, flood_exposure=max(known) if known else 50))
        sites.append(dict(id="LP-" + source["psgc"], barangay_id=source["psgc"],
                          name=f"Planning point: {source['name']}, {source['municipality']}",
                          capacity=180, eligible=not deployment_restricted(source),
                          lat=source["lat"], lng=source["lng"]))
    metadata = dict(synthetic=True, region="Laguna Province · 681 barangays / 30 LGUs",
                    generated_at="2026-10-24", source="Existing Laguna barangay/hospital/OSM inputs; synthetic health histories and staging capacities",
                    travel_times="Adjacency-based estimates at 20 km/h, minimum 3 minutes per link; shared borders do not establish road access. No verified provincial road matrix.",
                    disease="Synthetic next-day illness and appointment estimates; not clinical predictions")
    metadata["source"] += f"; {unresolved} external or unmatched neighbor labels excluded"
    return pd.DataFrame(rows), dict(sites=sites, roads=roads, hospitals=[]), metadata


def provincial_evidence(frame, network, request):
    affected = set()
    for row in frame.to_dict("records"):
        level = request.municipality_flood_levels.get(row["municipality"], request.flood_level)
        score = row["hazards"].get("flood_25yr" if level == "moderate" else "flood_100yr")
        if level != "none" and score is not None and score > 0:
            affected.add(row["id"])
    excluded = set(request.flooded_sites) | {s["id"] for s in network["sites"] if s["barangay_id"] in affected}
    graph = nx.Graph()
    graph.add_nodes_from(frame.id)
    for road in network["roads"]:
        if road["id"] not in request.closed_roads and not ({road["source"], road["target"]} & affected):
            graph.add_edge(road["source"], road["target"], weight=road["minutes"])
    times = dict(nx.all_pairs_dijkstra_path_length(graph, cutoff=request.max_travel_minutes, weight="weight"))
    return times, excluded, affected


def percentile(values):
    series = pd.Series(values, dtype=float)
    count = series.notna().sum()
    return ((series.rank(method="average") - 1) / (count - 1) * 100
            if count > 1 else series.where(series.isna(), 50)).tolist()


def calculate_provincial_scores(frame, context, request):
    """Keep the map's agreed policy; vary only the forecast illness input."""
    data, _, _ = bundle()
    weights = data["weights"]
    rows = frame.to_dict("records")
    rates = []
    for row in rows:
        surge = request.municipality_outbreak_multipliers.get(row["municipality"],
                    request.outbreak_multiplier if row["id"] in request.outbreak_barangays else 1)
        rates.append(round(row["disease_cases"] / row["population"] * 1000 * surge, 8))
    illness = percentile(rates)
    output = []
    context["demand_factors"] = {}
    for row, rate, illness_factor in zip(rows, rates, illness):
        factors = dict(row["needFactors"], morbidity=illness_factor)
        available = 0.0
        for name, weight in weights.items():
            if factors[name] is not None:
                available += weight
        # Preserve the shared JS scorer's factor order as well as its formula:
        # changing floating-point addition order can move a half-tenth boundary.
        contributions = {name: factors[name] * weight / available for name, weight in weights.items() if factors[name] is not None}
        # Same one-decimal score and competition ranking as the shared HNI.
        total = 0.0
        # Python 3.12+ sum compensates float error; JS uses sequential addition.
        for value in contributions.values():
            total += value
        score = math.floor(total * 10 + .5) / 10
        hospital = row["nearestHospital"]
        hospital_minutes = min(120, hospital["distanceKm"] * 3) if hospital else None
        warnings = ["Synthetic planning estimate; candidate coordinates are barangay planning points, not verified mobile-clinic facilities."]
        if available < 1 - 1e-9:
            warnings.append("Some agreed HNI factors are unavailable; remaining weights are rescaled.")
        # These auxiliary model inputs never enter the agreed HNI contributions.
        context["demand_factors"][row["id"]] = dict(poverty=row["poverty_pct"], flood=row.get("scenario_flood_exposure", row["flood_exposure"]))
        output.append(dict(id=row["id"], psgc=row["id"], municipality=row["municipality"],
                           geography_level="barangay", name=row["name"], population=row["population"],
                           lat=row["lat"], lng=row["lng"], vulnerable_residents=row["children"] + row["elderly"],
                           children_pct=25, elderly_pct=10, disease_per_1000=rate,
                           factors={k: v for k, v in factors.items() if v is not None},
                           contributions=contributions, score=score,
                           level="Critical" if score >= 70 else "High" if score >= 50 else "Moderate" if score >= 30 else "Low",
                           demand=0, high_priority=score >= 50,
                           nearest_hospital=hospital["name"] if hospital else "Unavailable",
                           hospital_minutes=hospital_minutes,
                           explanation=f"{row['name']}: forecast illness with the agreed Balanced HNI; disaster risk has no HNI weight.",
                           recommended_services=["Primary care", "Blood pressure screening", "Health education"],
                           warnings=warnings, synthetic=True, rank=1))
    for item in output:
        item["rank"] = 1 + sum(b["score"] > item["score"] for b in output)
    return output
