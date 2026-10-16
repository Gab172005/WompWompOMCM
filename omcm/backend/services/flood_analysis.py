"""Select active synthetic flood hazard footprints for a scenario."""

def active_hazards(network, level):
    return {h["properties"]["id"] for h in network["hazards"]["features"]
            if level == "severe" or (level == "moderate" and h["properties"]["level"] == "moderate")}
