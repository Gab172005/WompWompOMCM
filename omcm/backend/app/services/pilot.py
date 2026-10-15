"""Road-evidence adapter. No inferred graph shortcuts or invented diversion paths."""
import json
import math
import pandas as pd


def load_pilot_data(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = data["barangays"]
    ids = {b["id"] for b in rows}
    if len(ids) != len(rows) or not rows:
        raise ValueError("Pilot requires unique PSGC identifiers.")
    for b in rows:
        if b["population"] <= 0 or not (13.8 < b["lat"] < 14.7 and 120.8 < b["lng"] < 121.8):
            raise ValueError("Invalid pilot population or coordinate.")
    sites = {s["id"]: s for s in data["sites"]}
    for route in data["routes"]:
        if route["site_id"] not in sites or (route["origin_id"] != "depot" and route["origin_id"] not in ids):
            raise ValueError("Unknown route endpoint.")
        if not math.isfinite(route["duration_seconds"]) or route["duration_seconds"] < 0 or len(route["coordinates"]) < 2:
            raise ValueError("Invalid route duration or geometry.")
    roads = [dict(id=c["id"], source="depot", target="", minutes=0, name=c["name"], coordinates=c["coordinates"]) for c in data["closures"]]
    return pd.DataFrame(rows), dict(**data, roads=roads), data["metadata"]


def active_hazards(network, level):
    return {h["properties"]["id"] for h in network["hazards"]["features"]
            if level == "severe" or (level == "moderate" and h["properties"]["level"] == "moderate")}


def road_evidence(network, request):
    blocked = active_hazards(network, request.flood_level) | set(request.closed_roads)
    times, excluded = {}, set(request.flooded_sites)
    sites = {s["id"]: s for s in network["sites"]}
    for s in sites.values():
        if blocked.intersection(s.get("hazards", [])):
            excluded.add(s["id"])
    for route in network["routes"]:
        unsafe = bool(blocked.intersection(route["blocked_by"]))
        if route["origin_id"] == "depot":
            if unsafe:
                excluded.add(route["site_id"])
        elif not unsafe:
            # Directed modeled road time. Never symmetrize or connect shortest-path
            # shortcuts through matrix cells when a route is disrupted.
            times.setdefault(route["origin_id"], {})[sites[route["site_id"]]["barangay_id"]] = math.ceil(route["duration_seconds"] / 60)
    return times, excluded
