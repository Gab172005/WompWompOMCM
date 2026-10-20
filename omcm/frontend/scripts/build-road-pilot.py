"""Rebuild the small attributed road fixture; Python + httpx + shapely required.

21 throttled OSRM requests, one per demand/depot origin with intermediate returns.
No traffic or hazard data is requested. Review SOURCES.md before redistribution.
Existing response cache avoids repeated calls; use a self-hosted OSRM for bulk work.
"""
import csv
import hashlib
import json
import math
import os
import ssl
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
import httpx
from shapely.geometry import shape, Point, LineString

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend/public/assets/pilot"
CACHE = ROOT / "backend/data/route-cache"
BASE = os.getenv("OMCM_OSRM_URL", "https://routing.openstreetmap.de/routed-car")


def key(value):
    return unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower().replace("city of ", "").replace(" (poblacion)", "").replace(" ", "").replace("-", "").replace(".", "").replace(",", "")


def load_psa_populations():
    lookup = {}
    municipality = None
    with (ROOT / "datasets/population_per_barangay.csv").open(encoding="utf-8-sig") as f:
        for row in csv.reader(f):
            if not row or not row[0]:
                continue
            label = row[0]
            if label.startswith("......") and not label.startswith("........"):
                if row[1]:
                    municipality = label[6:].strip()
            elif label.startswith("........"):
                if row[1] and municipality:
                    lookup[(key(municipality), key(label[8:].strip()))] = int(row[1])
    return lookup


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    all_geo = json.loads((ROOT / "frontend/public/assets/geo/laguna_barangays.geojson").read_text(encoding="utf-8"))
    source = list(csv.DictReader((ROOT / "backend/data/barangays.csv").open(encoding="utf-8-sig")))
    psa_populations = load_psa_populations()
    names = {"Calo", "Dila", "Maitim", "San Agustin", "San Antonio", "San Isidro", "San Nicolas", "Tagumpay"}
    rows = [r for r in source if (r["city_municipality"].startswith("Los") and r["barangay_name"] not in {"Bagong Silang", "Putho Tuntungin"}) or (r["city_municipality"] == "Bay" and r["barangay_name"] in names)]
    rows.sort(key=lambda r: (r["city_municipality"], r["barangay_name"]))
    features, inputs = [], []
    for row in rows:
        matches = [f for f in all_geo["features"] if key(f["properties"]["adm4_en"]) == key(row["barangay_name"]) and key(f["properties"]["municipality"]) == key(row["city_municipality"])]
        assert len(matches) == 1, row
        feature = matches[0]
        polygon = shape(feature["geometry"])
        assert polygon.is_valid and not polygon.is_empty
        psgc = str(feature["properties"]["adm4_psgc"])
        point = Point(float(row["longitude"]), float(row["latitude"]))
        if not polygon.covers(point):
            point = polygon.representative_point()
        seed = int(hashlib.sha256(psgc.encode()).hexdigest()[:8], 16)
        population = psa_populations[(key(row["city_municipality"]), key(feature["properties"]["adm4_en"]))]
        synthetic_pop = 2500 + seed % 7500
        inputs.append(dict(id=psgc, psgc=psgc, name=feature["properties"]["adm4_en"], municipality=row["city_municipality"], geography_level="barangay", lat=point.y, lng=point.x,
                           population=population, children=round(population * (.2 + seed % 12 / 100)), elderly=round(population * (.07 + seed % 6 / 100)),
                           disease_cases=round(synthetic_pop * (.02 + seed % 12 / 150)), poverty_pct=20 + seed % 55,
                           flood_exposure=25 + seed % 70, demand_rate=.025, estimated=True,
                           source="2024 PSA Census population; illustrative synthetic health indicators — not reported disease cases", source_date="2026-10-15", confidence="synthetic",
                           geography_source=row["source_url"]))
        features.append(feature)
    assert len(inputs) == 20
    hosts = [("Los", n) for n in ["Anos", "Bambang", "Batong Malake", "Bayog", "Maahas", "Mayondon"]] + [("Bay", "Dila"), ("Bay", "San Nicolas")]
    sites = []
    for i, (municipality, name) in enumerate(hosts):
        b = next(b for b in inputs if b["municipality"].startswith(municipality) and key(b["name"]) == key(name))
        sites.append(dict(id=f"P{i+1:02}", barangay_id=b["id"], name=f"Illustrative site: {b['name']}", lat=b["lat"], lng=b["lng"], capacity=240, facility_type=["school", "barangay_hall", "health_center"][i % 3], eligible=True, verified=False, source="OSRM-snapped road point; facility suitability unverified"))
    depot = next(b for b in inputs if b["name"] == "Timugan")
    origins = [dict(id="depot", lat=depot["lat"], lng=depot["lng"])] + inputs
    routes, requests = [], []
    client = httpx.Client(verify=ssl.create_default_context(), timeout=90, headers={"User-Agent": "OMCM-Laguna-Demo/1.0 (educational road fixture)"})
    for origin in origins:
        points = []
        for s in sites:
            points.extend([(origin["lng"], origin["lat"]), (s["lng"], s["lat"])])
        coordinates = ";".join(f"{x:.6f},{y:.6f}" for x, y in points)
        url = f"{BASE}/route/v1/driving/{coordinates}?overview=false&geometries=geojson&steps=true&continue_straight=false"
        cache = CACHE / (hashlib.sha256(url.encode()).hexdigest() + ".json")
        if cache.exists():
            response = json.loads(cache.read_text(encoding="utf-8"))
        else:
            time.sleep(1.1)
            result = client.get(url)
            result.raise_for_status()
            response = result.json()
            assert response["code"] == "Ok", response
            cache.write_text(json.dumps(response), encoding="utf-8")
        requests.append(dict(url=url, sha256=hashlib.sha256(cache.read_bytes()).hexdigest()))
        for i, s in enumerate(sites):
            leg = response["routes"][0]["legs"][i * 2]
            coords = []
            for step in leg["steps"]:
                for point in step["geometry"]["coordinates"]:
                    if not coords or point != coords[-1]:
                        coords.append(point)
            if len(coords) < 2:
                coords = [response["waypoints"][i*2]["location"], response["waypoints"][i*2+1]["location"]]
            routes.append(dict(id=f"{origin['id']}:{s['id']}", origin_id=origin["id"], site_id=s["id"], coordinates=coords, duration_seconds=leg["duration"], distance_meters=leg["distance"], source="OSRM / OpenStreetMap", blocked_by=[]))
            if origin["id"] == "depot":
                s["lng"], s["lat"] = coords[-1]
                # Snapped routing endpoint must actually belong to its named community.
                host = next(f for f in features if str(f["properties"]["adm4_psgc"]) == s["barangay_id"])
                assert shape(host["geometry"]).buffer(.00005).covers(Point(coords[-1])), s
        print(f"Validated routes from {origin['id']}", flush=True)
    # Scenario footprints deliberately use real community polygons, not official flood extents.
    hazards = []
    for name, municipality, level in [("Bayog", "Los", "moderate"), ("Tagumpay", "Bay", "moderate"), ("San Antonio", "Bay", "severe"), ("Dila", "Bay", "severe")]:
        f = next(f for f in features if key(f["properties"]["adm4_en"]) == key(name) and f["properties"]["municipality"].startswith(municipality))
        hazards.append(dict(type="Feature", geometry=f["geometry"], properties=dict(id=f"flood-{f['properties']['adm4_psgc']}", level=level, name=f"Simulated inundation: {name}", synthetic=True, barangay_id=str(f["properties"]["adm4_psgc"]))))
    closure_route = next(r for r in routes if r["origin_id"] == "depot" and r["site_id"] == "P03")
    mid = len(closure_route["coordinates"]) // 2
    segment = closure_route["coordinates"][mid:mid+2]
    closure = dict(id="demo-closure-1", name="Demo road closure on the Timugan–Batong Malake corridor", coordinates=segment, synthetic=True)
    for r in routes:
        line = LineString(r["coordinates"])
        for hazard in hazards:
            if line.intersects(shape(hazard["geometry"])):
                r["blocked_by"].append(hazard["properties"]["id"])
        if line.intersects(LineString(segment).buffer(.00004)):
            r["blocked_by"].append(closure["id"])
    for s in sites:
        s["hazards"] = [h["properties"]["id"] for h in hazards if shape(h["geometry"]).covers(Point(s["lng"], s["lat"]))]
    stamp = datetime.now(timezone.utc).isoformat()
    data = dict(version=1, metadata=dict(synthetic=True, region="Los Baños–Bay, Laguna · 20-barangay pilot", generated_at=stamp,
                source="2023 PSGC boundary snapshot; PhilAtlas seed coordinates; 2024 PSA Census population; synthetic planning indicators (2026-10-15)",
                travel_times="Bundled OSRM car routes on OpenStreetMap; modeled free-flow duration, no live traffic", disease="Illustrative synthetic data — not reported disease cases"),
                barangays=inputs, sites=sites, hospitals=[dict(id="demo-rhu", name="Illustrative care reference: Timugan", barangay_id=depot["id"], lat=depot["lat"], lng=depot["lng"], services=["Primary care"], verified=False)],
                depot=dict(id="depot", name="Illustrative depot · Timugan", lat=routes[0]["coordinates"][0][1], lng=routes[0]["coordinates"][0][0]), routes=routes, closures=[closure], hazards=dict(type="FeatureCollection", features=hazards),
                provenance=dict(provider=BASE, retrieved_at=stamp, license="OpenStreetMap ODbL 1.0; route fixture attributed to OSRM/FOSSGIS", requests=requests))
    # Hospital access is an explicit synthetic indicator, not a fabricated route to a real hospital.
    for i, b in enumerate(inputs):
        b["healthcare_access_time_minutes"] = 12 + (i * 7) % 49
    (OUT / "pilot.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (ROOT / "backend/data/pilot.json").write_bytes((OUT / "pilot.json").read_bytes())
    (OUT / "barangays.geojson").write_text(json.dumps(dict(type="FeatureCollection", features=features), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Saved {len(inputs)} verified polygon joins and {len(routes)} directed route legs", flush=True)


if __name__ == "__main__":
    main()
