"""Export inspectable dataset tables from the pinned demo fixtures (no network).

Run from omcm: backend/.venv/Scripts/python.exe backend/export_datasets.py
Use --check to verify that the exports still match the runtime fixtures.
"""
import argparse
import csv
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def csv_bytes(rows, fields):
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


def dataset_exports():
    pilot = json.loads((ROOT / "backend/data/pilot.json").read_text(encoding="utf-8"))
    return {
        "barangays.geojson": (ROOT / "frontend/public/assets/pilot/barangays.geojson").read_bytes(),
        "laguna_municipalities.geojson": (ROOT / "frontend/public/assets/geo/laguna_municipalities.geojson").read_bytes(),
        "hospitals.csv": csv_bytes([{**h, "services": "|".join(h.get("services", []))} for h in pilot["hospitals"]], ["id", "name", "lat", "lng", "services"]),
        "population.csv": csv_bytes(pilot["barangays"], [
            "id", "psgc", "name", "municipality", "population", "children", "elderly",
            "lat", "lng", "poverty_pct", "flood_exposure", "healthcare_access_time_minutes",
            "demand_rate", "source_date", "confidence",
        ]),
        "disease_cases.csv": csv_bytes(pilot["barangays"], [
            "id", "psgc", "name", "municipality", "disease_cases", "source_date", "confidence",
        ]),
        "flood_hazards.geojson": (json.dumps(pilot["hazards"], ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8"),
        "candidate_sites.csv": csv_bytes([
            {**site, "hazards": "|".join(site["hazards"])} for site in pilot["sites"]
        ], ["id", "barangay_id", "name", "lat", "lng", "capacity", "eligible", "verified", "hazards", "source"]),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    for name, content in dataset_exports().items():
        target = ROOT / "datasets" / name
        if args.check:
            if not target.exists() or target.read_bytes() != content:
                raise SystemExit(f"Dataset export is missing or stale: {name}")
        else:
            target.write_bytes(content)
    print("Dataset exports verified." if args.check else "Exported dataset tables and geometry.")


if __name__ == "__main__":
    main()
