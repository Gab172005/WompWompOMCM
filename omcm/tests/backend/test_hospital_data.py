"""Offline source integrity and hospital importer regressions for Step A."""
import importlib.util
import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "laguna_importer", ROOT / "frontend/scripts/import-laguna-datasets.py"
)
IMPORTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(IMPORTER)


def test_hospital_register_preserves_missing_values_and_source_status():
    rows = IMPORTER.read_csv("laguna_hospitals.csv")
    hospitals = IMPORTER.hospital_records(rows)
    bundle = json.loads((ROOT / "frontend/src/data/laguna-datasets.json").read_text())
    assert hospitals == bundle["hospitals"]
    assert len(hospitals) == 66
    assert sum(h["verified"] for h in hospitals) == 57
    assert sum(h["lat"] is not None for h in hospitals) == 61
    assert sum(h["verified"] and h["lat"] is not None for h in hospitals) == 56
    assert sum(h["capacity"] is None for h in hospitals) == 9
    assert sum(h["lat"] is None and h["lng"] is None for h in hospitals) == 5
    closed = next(h for h in hospitals if "SAN JOSE HOSPITAL" in h["name"])
    assert closed["verified"] is False
    assert "reported closed" in closed["verificationStatus"]


def test_hospital_locations_match_municipalities_and_have_no_duplicate_points():
    hospitals = IMPORTER.hospital_records(IMPORTER.read_csv("laguna_hospitals.csv"))
    geometry = IMPORTER.osm_clinics
    province = geometry.load_province()
    points = set()
    for hospital in hospitals:
        if hospital["lat"] is None:
            continue
        point = (hospital["lng"], hospital["lat"])
        assert point not in points, hospital["name"]
        points.add(point)
        matches = [
            province.municipality_names[psgc]
            for psgc, polygons in province.municipalities.items()
            if any(geometry.contains_point(polygon, point) for polygon in polygons)
        ]
        assert any(
            IMPORTER.normalize(name) == hospital["municipalityKey"] for name in matches
        ), (hospital["name"], matches)


@pytest.mark.parametrize("changes, message", [
    ({"latitude": "NaN"}, "Invalid hospital coordinates"),
    ({"longitude": "inf"}, "Invalid hospital coordinates"),
    ({"latitude": "91"}, "Invalid hospital coordinates"),
    ({"longitude": "181"}, "Invalid hospital coordinates"),
    ({"latitude": ""}, "Incomplete hospital coordinates"),
    ({"capacity_beds": "-1"}, "Negative hospital bed capacity"),
    ({"name": ""}, "Missing or duplicate hospital identity"),
])
def test_importer_rejects_invalid_hospital_values(changes, message):
    row = IMPORTER.read_csv("laguna_hospitals.csv")[0]
    with pytest.raises(ValueError, match=message):
        IMPORTER.hospital_records([{**row, **changes}])


def test_importer_rejects_duplicate_identity_but_preserves_unlocated_records():
    row = IMPORTER.read_csv("laguna_hospitals.csv")[0]
    with pytest.raises(ValueError, match="duplicate hospital identity"):
        IMPORTER.hospital_records([row, {**row, "name": row["name"].lower()}])
    result = IMPORTER.hospital_records([
        {**row, "latitude": "", "longitude": "", "capacity_beds": ""}
    ])[0]
    assert result["lat"] is result["lng"] is result["capacity"] is None


def test_dataset_bundle_is_reproducible_offline():
    assert IMPORTER.build() == (ROOT / "frontend/src/data/laguna-datasets.json").read_text()
