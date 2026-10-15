import json
import hashlib
import math
import re
import os
from pathlib import Path
import pandas as pd
import networkx as nx

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def load_data():
    if (DATA_DIR / "pilot.json").exists() and os.getenv("OMCM_DATASET", "pilot") == "pilot":
        from app.services.pilot import load_pilot_data
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
    frame["population"] = [3400 + seed % 9700 for seed in seeds]
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
                    source="User-provided PhilAtlas barangay geography; synthetic population, health indicators and facilities",
                    travel_times="Estimated adjacency links at 20 km/h, minimum 3 minutes; shared borders do not establish road access",
                    disease="Synthetic case counts; not clinical predictions")
    metadata["source"] += f"; {len(unresolved)} neighbor labels outside the dataset or unmatched"
    return frame, dict(roads=list(edges.values()), sites=sites, hospitals=hospitals), metadata


def road_graph(frame, network, closed_roads=()):
    graph = nx.Graph()
    graph.add_nodes_from(frame.id)
    for road in network["roads"]:
        if road["id"] not in closed_roads:
            graph.add_edge(road["source"], road["target"], weight=road["minutes"])
    return graph


def travel_times(graph):
    return dict(nx.all_pairs_dijkstra_path_length(graph, weight="weight"))


def validate_references(request, frame, network):
    site_ids = {s["id"] for s in network["sites"]}
    road_ids = {r["id"] for r in network["roads"]}
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


def read_osm_graph(graphml_path):
    """Optional offline OSMnx adapter. Snap supplied sites and demand nodes before use.

    External routing is opt-in: this does not replace demo travel times automatically.
    """
    import osmnx as ox
    graph = ox.load_graphml(graphml_path)
    if not all("travel_time" in attributes for _, _, attributes in graph.edges(data=True)):
        graph = ox.routing.add_edge_speeds(graph)
        graph = ox.routing.add_edge_travel_times(graph)
    return graph
