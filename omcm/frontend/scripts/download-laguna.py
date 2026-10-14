"""Bundle actual Laguna boundaries from a pinned, MIT-licensed upstream snapshot."""
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen

COMMIT = "8eeead560246863c8c820c31ca6fbca81a279477"
BASE = f"https://raw.githubusercontent.com/faeldon/philippines-json-maps/{COMMIT}/"
DEST = Path(__file__).resolve().parents[1] / "public/data/geo"


def fetch(path):
    with urlopen(BASE + path, timeout=60) as response:
        return response.read()


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    path = "2023/geojson/provdists/hires/municities-provdist-403400000.0.1.json"
    municipalities = json.loads(fetch(path))
    names = {f["properties"]["adm3_psgc"]: f["properties"]["adm3_en"] for f in municipalities["features"]}

    def barangays(code):
        path = f"2023/geojson/municities/hires/bgysubmuns-municity-{code}.0.1.json"
        data = json.loads(fetch(path))
        for feature in data["features"]:
            feature["properties"]["municipality"] = names[code]
        return data["features"]

    with ThreadPoolExecutor(max_workers=6) as executor:
        features = [f for group in executor.map(barangays, sorted(names)) for f in group]
    collections = {
        "laguna_barangays.geojson": {"type": "FeatureCollection", "features": features},
        "laguna_municipalities.geojson": municipalities,
    }
    manifest = {"source": "https://github.com/faeldon/philippines-json-maps", "commit": COMMIT,
                "snapshot": "2023", "resolution": "hires (upstream 10% simplification)",
                "license": "MIT", "files": {}}
    for filename, collection in collections.items():
        payload = json.dumps(collection, ensure_ascii=False, separators=(",", ":")).encode()
        (DEST / filename).write_bytes(payload)
        manifest["files"][filename] = {"features": len(collection["features"]), "sha256": hashlib.sha256(payload).hexdigest()}
        print(filename, len(collection["features"]), "features", len(payload), "bytes")
    (DEST / "source.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (DEST / "LICENSE.txt").write_bytes(fetch("LICENSE"))


if __name__ == "__main__":
    main()
