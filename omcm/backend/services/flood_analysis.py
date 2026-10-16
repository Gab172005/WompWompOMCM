"""Select active synthetic flood hazard footprints for a scenario."""

def active_hazards(network, level, municipality_levels=None):
    municipalities = {b["id"]: b["municipality"] for b in network["barangays"]}
    levels = municipality_levels or {}
    active = set()
    for hazard in network["hazards"]["features"]:
        props = hazard["properties"]
        selected = levels.get(municipalities[props["barangay_id"]], level)
        if selected == "severe" or (selected == "moderate" and props["level"] == "moderate"):
            active.add(props["id"])
    return active
