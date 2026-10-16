"""Road graph and offline route adapters."""
import networkx as nx

def road_graph(frame, network, closed_roads=()):
    graph = nx.Graph()
    graph.add_nodes_from(frame.id)
    for road in network["roads"]:
        if road["id"] not in closed_roads:
            graph.add_edge(road["source"], road["target"], weight=road["minutes"])
    return graph

def travel_times(graph):
    return dict(nx.all_pairs_dijkstra_path_length(graph, weight="weight"))

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
