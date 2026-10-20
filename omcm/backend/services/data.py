import csv
import json
import hashlib
import math
import re
import os
from pathlib import Path
import pandas as pd
from services.route_service import road_graph, travel_times, read_osm_graph

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
PSA_POPULATION_PATH = Path(__file__).resolve().parents[2] / "datasets/population_per_barangay.csv"
PHILATLAS_PSA_ALIASES = {
    ("liliw", "cabuyao"): ("liliw", "cabuyew"),
    ("santa rosa", "pook"): ("santa rosa", "pooc"),
}


def psa_key(text):
    text = re.sub(r"^city of\s+", "", str(text).strip().lower())
    text = re.sub(r"\s*\(pob\.\)", "", text)
    text = re.sub(r"\s*\(poblacion\)", "", text)
    text = re.sub(r"\s*\(capital\)", "", text)
    return re.sub(r"\s+", " ", text).strip()


def load_psa_barangay_populations():
    if not PSA_POPULATION_PATH.exists():
        return {}
    records = {}
    municipality = None
    with PSA_POPULATION_PATH.open(encoding="utf-8-sig") as f:
        for row in csv.reader(f):
            if not row or not row[0]:
                continue
            label = row[0]
            if label.startswith("......") and not label.startswith("........"):
                if len(row) > 1 and row[1]:
                    municipality = psa_key(label[6:])
            elif label.startswith("........"):
                if len(row) > 3 and row[1] and municipality:
                    bgy = psa_key(label[8:])
                    records[municipality, bgy] = (
                        int(row[1]),
                        int(row[2]),
                        int(row[3]),
                    )
    return records


def load_data():
    if (DATA_DIR / "pilot.json").exists() and os.getenv("OMCM_DATASET", "pilot") == "pilot":
        from services.pilot import load_pilot_data
        return load_pilot_data(DATA_DIR / "pilot.json")
    frame = pd.read_csv(DATA_DIR / "barangays.csv", dtype={"id": str, "psgc": str})
    if "barangay_name" in frame.columns:
        return load_geographic_data(frame)
    if len(frame) == 0 or frame.id.duplicated().any():
        raise ValueError("Barangay CSV must have unique IDs and at least one row.")
    if frame.population.isna().any() or (frame.population <= 0).any():
        raise ValueError("Population must be present and positive.")
    network = json.loads((DATA_DIR / "network.json").read_text(encoding="utf-8"))
    metadata = json.loads((DATA_DIR / "metadata.json").read_text(encoding="utf-8"))
    for site in network["sites"]:
        row = frame[frame.id == site["barangay_id"]].iloc[0]
        site.update(lat=float(row.lat), lng=float(row.lng))
    return frame, network, metadata


def geographic_key(name):
    return re.sub(r"\s+", " ", re.sub(r"\s*\(poblacion\)", "", name.lower())).strip()


def load_geographic_data(source):
    """Adapt sourced geography; explicitly synthetic planning inputs stay separate."""
    frame = source.rename(columns={"barangay_name": "name", "city_municipality": "municipality",
                                   "latitude": "lat", "longitude": "lng"}).copy()
    keys = [tuple(geographic_key(str(row[k])) for k in ("name", "municipality", "province"))
            for row in frame.to_dict("records")]
    if not keys or len(set(keys)) != len(keys):
        raise ValueError("Barangay geography must contain unique municipality-qualified names.")
    if frame[["lat", "lng"]].isna().any().any() or not (
        frame.lat.between(-90, 90).all() and frame.lng.between(-180, 180).all()
    ):
        raise ValueError("Barangay coordinates must be finite WGS84 coordinates.")
    seeds = [int(hashlib.sha256("|".join(key).encode()).hexdigest()[:8], 16) for key in keys]
    frame["id"] = [f"BG-{seed:08x}" for seed in seeds]
    if frame.id.duplicated().any():
        raise ValueError("Generated barangay IDs must be unique.")
    frame["geography_level"] = "barangay"
    psa_populations = load_psa_barangay_populations()
    populations = []
    household_populations = []
    households = []
    for row, seed in zip(frame.to_dict("records"), seeds):
        lookup_key = (psa_key(row["municipality"]), psa_key(row["name"]))
        lookup_key = PHILATLAS_PSA_ALIASES.get(lookup_key, lookup_key)
        if lookup_key in psa_populations:
            pop, hh_pop, hh = psa_populations[lookup_key]
        elif pd.notna(row.get("population")) and int(row["population"]) > 0:
            pop = int(row["population"])
            hh_pop = int(row["household_population"]) if pd.notna(row.get("household_population")) else pop
            hh = int(row["households"]) if pd.notna(row.get("households")) else max(1, round(pop / 4))
        else:
            pop = 3400 + seed % 9700
            hh_pop = pop
            hh = max(1, round(pop / 4))
        populations.append(pop)
        household_populations.append(hh_pop)
        households.append(hh)
    frame["population"] = populations
    frame["household_population"] = household_populations
    frame["households"] = households
    frame["children"] = (frame.population * .25).round().astype(int)
    frame["elderly"] = (frame.population * .10).round().astype(int)
    frame["disease_cases"] = [round(pop * (.012 + seed % 15 * .006)) for pop, seed in zip(frame.population, seeds)]
    frame["poverty_pct"] = [15 + seed % 60 for seed in seeds]
    frame["flood_exposure"] = [seed % 101 for seed in seeds]
    frame["demand_rate"] = .03
    frame["estimated"] = True
    rows = frame.to_dict("records")
    lookup = dict(zip(keys, rows))
    edges = {}
    unresolved = set()
    for row in rows:
        for label in str(row.get("adjacent_barangays", "")).split("|"):
            parts = label.strip().rsplit(",", 2)
            if len(parts) != 3:
                continue
            key = tuple(geographic_key(part) for part in parts)
            neighbor = lookup.get(key)
            if neighbor is None:
                unresolved.add(label.strip())
                continue
            if neighbor["id"] == row["id"]:
                continue
            a, b = sorted([row["id"], neighbor["id"]])
            lat1, lat2 = map(math.radians, [row["lat"], neighbor["lat"]])
            dlat = lat2 - lat1
            dlng = math.radians(neighbor["lng"] - row["lng"])
            distance = 12742 * math.asin(min(1, math.sqrt(math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2)**2)))
            edges[a, b] = dict(id=f"R-{a}-{b}", source=a, target=b, minutes=max(3, round(distance * 3)),
                               name=f"Estimated adjacency link: {row['name']} / {neighbor['name']}")
    # One illustrative staging candidate per municipality, no claim of an actual facility.
    hosts = frame.sort_values(["municipality", "id"]).groupby("municipality", sort=True).head(1).to_dict("records")
    sites = [dict(id=f"S{i+1:02}", barangay_id=row["id"], name=f"Demo hub: {row['name']}, {row['municipality']}",
                  capacity=180, eligible=True, lat=row["lat"], lng=row["lng"]) for i, row in enumerate(hosts)]
    hospitals = [dict(id=f"H{i+1}", barangay_id=row["id"], name=f"Demo hospital: {row['municipality']}",
                      lat=row["lat"], lng=row["lng"], services=["Primary care", "Emergency assessment"])
                 for i, row in enumerate(hosts)]
    metadata = dict(synthetic=True, region="Laguna", generated_at=str(source.retrieved_at_utc.iloc[0]),
                    source="User-provided PhilAtlas barangay geography; 2024 PSA Census population; synthetic health indicators and facilities",
                    travel_times="Estimated adjacency links at 20 km/h, minimum 3 minutes; shared borders do not establish road access",
                    disease="Synthetic case counts; not clinical predictions")
    metadata["source"] += f"; {len(unresolved)} neighbor labels outside the dataset or unmatched"
    return frame, dict(roads=list(edges.values()), sites=sites, hospitals=hospitals), metadata








def validate_references(request, frame, network):
    unknown = (set(request.municipality_flood_levels) | set(request.municipality_outbreak_multipliers)) - (set(frame["municipality"].dropna()) if "municipality" in frame else set())
    if unknown:
        raise ValueError("Unknown municipality: " + ", ".join(sorted(unknown)))
    site_ids = {s["id"] for s in network["sites"]}
    road_ids = {r["id"] for r in network["roads"]}
    if "routes" in network:
        from services.road_segments import route_segments
        road_ids.update(segment for route in network["routes"] for segment in route_segments(route))
    for values, valid, name in [(request.eligible_sites, site_ids, "staging site"),
                                (request.flooded_sites, site_ids, "flooded site"),
                                (request.manual_sites, site_ids, "manual site"),
                                (request.closed_roads, road_ids, "road"),
                                (request.outbreak_barangays, set(frame.id), "barangay")]:
        if values is not None:
            if len(values) != len(set(values)):
                raise ValueError(f"Duplicate {name} IDs are not allowed.")
            if set(values) - valid:
                raise ValueError(f"Unknown {name}: {', '.join(sorted(set(values) - valid))}")



