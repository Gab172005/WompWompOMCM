"""Derive the user-configured upland exclusion from bundled boundaries.

Generation only: requires Shapely. The app consumes the committed JSON.
"""
import json
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "public/assets/geo"


def main():
    municipalities = json.loads((GEO / "laguna_municipalities.geojson").read_text())
    barangays = json.loads((GEO / "laguna_barangays.geojson").read_text())
    paete = shape(next(
        f["geometry"] for f in municipalities["features"]
        if f["properties"]["adm3_psgc"] == 403418000
    ))
    town = unary_union([
        shape(f["geometry"]) for f in barangays["features"]
        if f["properties"]["adm3_psgc"] == 403418000
    ])
    remainder = paete.difference(town)
    # Keep the contiguous upland area; discard tiny boundary-simplification slivers.
    parts = list(remainder.geoms) if hasattr(remainder, "geoms") else [remainder]
    forest = max(parts, key=lambda p: p.area)
    assert forest.is_valid and not forest.is_empty
    collection = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {
                "restriction": "no_mobile_clinic_deployment",
                "name": "Sierra Madre Mountains Forest Land",
                "jurisdiction": "Paete, Laguna",
            },
            "geometry": mapping(forest),
        }],
    }
    (ROOT / "src/data/paete-forest-land.json").write_text(
        json.dumps(collection, separators=(",", ":")) + "\n"
    )


if __name__ == "__main__":
    main()
