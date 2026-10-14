import json
from pathlib import Path
import pandas as pd
import networkx as nx

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def load_data():
    frame = pd.read_csv(DATA_DIR / "barangays.csv", dtype={"id": str, "psgc": str})
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
