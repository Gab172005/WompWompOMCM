"""Server-side application of the same approximate Paete exclusion as the map."""
from functools import lru_cache
import json
import math
from pathlib import Path

EXCLUSION_PATH = Path(__file__).resolve().parents[2] / "frontend/src/data/paete-forest-land.json"


@lru_cache(maxsize=1)
def excluded_polygons():
    data = json.loads(EXCLUSION_PATH.read_text())
    polygons = []
    for feature in data["features"]:
        geometry = feature["geometry"]
        polygons.extend([geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"])
    return polygons


def in_ring(lng, lat, ring):
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        cross = (lng - x1) * (y2 - y1) - (lat - y1) * (x2 - x1)
        if abs(cross) <= 1e-12 and min(x1, x2) <= lng <= max(x1, x2) and min(y1, y2) <= lat <= max(y1, y2):
            return True
        if (y1 > lat) != (y2 > lat) and lng < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def deployment_restricted(site):
    lat, lng = site["lat"], site["lng"]
    if not math.isfinite(lat) or not math.isfinite(lng) or not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return True
    return any(in_ring(lng, lat, polygon[0]) and not any(in_ring(lng, lat, hole) for hole in polygon[1:])
               for polygon in excluded_polygons())
