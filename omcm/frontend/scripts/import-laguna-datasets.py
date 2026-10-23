"""Join the supplied CSVs to bundled PSGC geometry without guessing missing values.

The bundle also embeds the offline OSM clinic snapshot produced by
``frontend/scripts/import-osm-clinics.py``: ``clinics`` (typed ``OsmClinic``
records) and ``clinicSnapshot`` (``ClinicSnapshot``). When the snapshot is
missing or invalid the bundle carries no clinics and ``clinicSnapshot.valid``
is false, so downstream scoring excludes the clinic factors instead of
reading an unavailable snapshot as "zero clinics".
"""
import argparse
import csv
import json
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "frontend/src/data/laguna-datasets.json"
OSM_ASSET_DIR = ROOT / "frontend/public/assets/osm"
OSM_NORMALIZED = OSM_ASSET_DIR / "osm-clinics-normalized.json"
OSM_PROVENANCE = OSM_ASSET_DIR / "osm-clinics-provenance.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
import osm_clinics  # noqa: E402

LOCATION_METHODS = ("node", "overpass-center", "unavailable")
OSM_TYPES = ("node", "way", "relation")
ASSIGNMENT_STATUSES = ("assigned", "ambiguous", "outside", "unlocated")
STRING_FIELDS = ("attribution", "license")
NULLABLE_STRING_FIELDS = ("retrievedAt", "osmBaseTimestamp", "endpoint", "query", "rawSha256", "boundarySha256")


def normalize(value):
    value = value.lower().replace("city of ", "").replace(" city", "")
    return "".join(c for c in unicodedata.normalize("NFD", value) if c.isalnum())


def key(municipality, name):
    # Explicit spelling differences between the supplied CSV and the PSGC snapshot.
    aliases = {("liliw", "cabuyew"): "cabuyao", ("santarosa", "pooc"): "pook"}
    town, barangay = normalize(municipality), normalize(name)
    return town, aliases.get((town, barangay), barangay)


def read_csv(name):
    with (ROOT / "datasets" / name).open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def number(value, integer=False):
    return (int(value) if integer else float(value)) if value.strip() else None


class ClinicSnapshotError(ValueError):
    """The stored OSM clinic snapshot does not conform to the shared types."""


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and not (
        isinstance(value, float) and (value != value or value in (float("inf"), float("-inf")))
    )


def validate_clinic(record, index):
    """Validate one ``OsmClinic`` record as written by the clinic importer."""
    where = f"clinics[{index}]"
    if not isinstance(record, dict):
        raise ClinicSnapshotError(f"{where} is not an object")
    expected = {
        "id", "osmType", "osmId", "name", "lat", "lng", "locationMethod", "tags",
        "active", "inProvince", "barangayPsgc", "municipalityPsgc", "assignmentStatus", "warnings",
    }
    if set(record) != expected:
        raise ClinicSnapshotError(f"{where} keys do not match the OsmClinic type: {sorted(set(record) ^ expected)}")
    for key in ("id", "name"):
        if not isinstance(record[key], str):
            raise ClinicSnapshotError(f"{where}.{key} must be a string")
    if record["osmType"] not in OSM_TYPES:
        raise ClinicSnapshotError(f"{where}.osmType is not a supported OSM type")
    if not isinstance(record["osmId"], int) or isinstance(record["osmId"], bool) or record["osmId"] <= 0:
        raise ClinicSnapshotError(f"{where}.osmId must be a positive integer")
    if record["id"] != f"{record['osmType']}/{record['osmId']}":
        raise ClinicSnapshotError(f"{where}.id does not match its OSM identity")
    if record["locationMethod"] not in LOCATION_METHODS:
        raise ClinicSnapshotError(f"{where}.locationMethod is not supported")
    if record["assignmentStatus"] not in ASSIGNMENT_STATUSES:
        raise ClinicSnapshotError(f"{where}.assignmentStatus is not supported")
    if not isinstance(record["active"], bool) or not isinstance(record["inProvince"], bool):
        raise ClinicSnapshotError(f"{where} has a non-boolean flag")
    if not isinstance(record["tags"], dict) or not all(
        isinstance(k, str) and isinstance(v, str) for k, v in record["tags"].items()
    ):
        raise ClinicSnapshotError(f"{where}.tags must map strings to strings")
    if not isinstance(record["warnings"], list) or not all(isinstance(w, str) for w in record["warnings"]):
        raise ClinicSnapshotError(f"{where}.warnings must be a list of strings")
    for key in ("barangayPsgc", "municipalityPsgc"):
        if record[key] is not None and not (isinstance(record[key], str) and record[key]):
            raise ClinicSnapshotError(f"{where}.{key} must be null or a non-empty string")
    for key in ("lat", "lng"):
        value = record[key]
        if value is not None and not _is_number(value):
            raise ClinicSnapshotError(f"{where}.{key} must be a number or null")
    if (record["lat"] is None) != (record["lng"] is None):
        raise ClinicSnapshotError(f"{where} has only one of lat/lng")
    if record["lat"] is None:
        if record["locationMethod"] != "unavailable" or record["assignmentStatus"] != "unlocated":
            raise ClinicSnapshotError(f"{where} has no location but is not unlocated")
        if record["inProvince"] or record["barangayPsgc"] is not None or record["municipalityPsgc"] is not None:
            raise ClinicSnapshotError(f"{where} is unlocated but carries spatial assignment fields")
    else:
        if record["locationMethod"] == "unavailable":
            raise ClinicSnapshotError(f"{where} has a location but an unavailable locationMethod")
        if not (-90 <= record["lat"] <= 90) or not (-180 <= record["lng"] <= 180):
            raise ClinicSnapshotError(f"{where} has coordinates outside WGS84 bounds")
    if record["assignmentStatus"] == "assigned":
        if not record["inProvince"]:
            raise ClinicSnapshotError(f"{where} is assigned but outside the province")
        if not record["barangayPsgc"] or not record["municipalityPsgc"]:
            raise ClinicSnapshotError(f"{where} is assigned without barangay and municipality PSGCs")
    if record["assignmentStatus"] != "assigned" and record["barangayPsgc"] is not None:
        # An ambiguous record may name the municipality but never a guessed barangay.
        raise ClinicSnapshotError(f"{where} carries a barangay PSGC while not assigned")
    if record["assignmentStatus"] == "outside":
        if record["inProvince"]:
            raise ClinicSnapshotError(f"{where} is outside the province but flagged inProvince")
        if record["municipalityPsgc"] is not None:
            raise ClinicSnapshotError(f"{where} is outside the province but carries a municipality PSGC")
    if record["assignmentStatus"] == "ambiguous" and not record["inProvince"]:
        raise ClinicSnapshotError(f"{where} is ambiguous but outside the province")
    return record


def validate_clinic_snapshot(snapshot, clinics):
    """Validate ``ClinicSnapshot`` and cross-check its counts against the records."""
    if not isinstance(snapshot, dict):
        raise ClinicSnapshotError("clinicSnapshot is not an object")
    expected = {
        "valid", "retrievedAt", "osmBaseTimestamp", "endpoint", "query", "attribution",
        "license", "rawSha256", "boundarySha256", "counts", "warnings",
    }
    if set(snapshot) != expected:
        raise ClinicSnapshotError(
            f"clinicSnapshot keys do not match the ClinicSnapshot type: {sorted(set(snapshot) ^ expected)}"
        )
    if not isinstance(snapshot["valid"], bool):
        raise ClinicSnapshotError("clinicSnapshot.valid must be a boolean")
    for key in STRING_FIELDS:
        if not isinstance(snapshot[key], str) or not snapshot[key].strip():
            raise ClinicSnapshotError(f"clinicSnapshot.{key} must be a non-empty string")
    for key in NULLABLE_STRING_FIELDS:
        value = snapshot[key]
        if value is not None and (not isinstance(value, str) or not value.strip()):
            raise ClinicSnapshotError(f"clinicSnapshot.{key} must be null or a non-empty string")
    if not isinstance(snapshot["counts"], dict) or not all(
        isinstance(k, str) and isinstance(v, int) and not isinstance(v, bool) and v >= 0
        for k, v in snapshot["counts"].items()
    ):
        raise ClinicSnapshotError("clinicSnapshot.counts must map names to non-negative integers")
    if not isinstance(snapshot["warnings"], list) or not all(isinstance(w, str) for w in snapshot["warnings"]):
        raise ClinicSnapshotError("clinicSnapshot.warnings must be a list of strings")
    if not snapshot["valid"]:
        if clinics:
            raise ClinicSnapshotError("an invalid clinicSnapshot must not carry clinics")
        return snapshot
    for key in ("retrievedAt", "endpoint", "query", "rawSha256", "boundarySha256"):
        if snapshot[key] is None:
            raise ClinicSnapshotError(f"a valid clinicSnapshot needs {key}")
    active = [c for c in clinics if c["active"]]
    expected_counts = {
        "records": len(clinics),
        "active": len(active),
        "inactive": len(clinics) - len(active),
        "activeAssigned": sum(1 for c in active if c["assignmentStatus"] == "assigned"),
        "activeInProvince": sum(1 for c in active if c["inProvince"]),
        "activeLocatedInProvince": sum(1 for c in active if c["inProvince"] and c["lat"] is not None),
        "activeAmbiguous": sum(1 for c in active if c["assignmentStatus"] == "ambiguous"),
        "activeOutside": sum(1 for c in active if c["assignmentStatus"] == "outside"),
        "activeUnlocated": sum(1 for c in active if c["lat"] is None),
        "activeOverpassCenters": sum(1 for c in active if c["locationMethod"] == "overpass-center"),
        "distanceEligible": sum(
            1 for c in active if c["lat"] is not None and c["assignmentStatus"] != "outside"
        ),
    }
    counts = snapshot["counts"]
    for key, want in expected_counts.items():
        if counts.get(key) != want:
            raise ClinicSnapshotError(
                f"clinicSnapshot.counts.{key} is {counts.get(key)!r} but the records imply {want}"
            )
    if counts.get("candidates", 0) < len(clinics):
        raise ClinicSnapshotError("clinicSnapshot.counts.candidates is smaller than the retained records")
    return snapshot


def load_clinics():
    """Load and validate the stored snapshot; return (clinics, clinicSnapshot)."""
    if not OSM_NORMALIZED.exists():
        return [], osm_clinics.invalid_clinic_snapshot(
            "OSM clinic snapshot is not installed; clinic factors are unavailable (not zero)."
        )
    try:
        document = json.loads(OSM_NORMALIZED.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ClinicSnapshotError(f"{OSM_NORMALIZED.name} is not valid UTF-8 JSON: {error}") from None
    if not isinstance(document, dict) or document.get("format") != osm_clinics.DATA_FORMAT:
        raise ClinicSnapshotError(f"{OSM_NORMALIZED.name} has an unexpected format")
    raw_clinics = document.get("clinics")
    if not isinstance(raw_clinics, list):
        raise ClinicSnapshotError("clinics must be a list")
    clinics = [validate_clinic(record, index) for index, record in enumerate(raw_clinics)]
    if len({clinic["id"] for clinic in clinics}) != len(clinics):
        raise ClinicSnapshotError("clinic ids must be unique")
    snapshot = validate_clinic_snapshot(document.get("clinicSnapshot"), clinics)
    if not snapshot["valid"]:
        return [], snapshot

    raw_bytes = OSM_NORMALIZED.parent / osm_clinics.RAW_PATH.name
    if not raw_bytes.exists():
        raise ClinicSnapshotError("raw Overpass response is missing beside the normalized snapshot")
    if osm_clinics.sha256_file(raw_bytes) != snapshot["rawSha256"]:
        raise ClinicSnapshotError("normalized snapshot rawSha256 does not match the stored raw response")
    provenance = None
    if OSM_PROVENANCE.exists():
        provenance = json.loads(OSM_PROVENANCE.read_text(encoding="utf-8"))
        if provenance.get("query") != snapshot["query"] or provenance.get("retrievedAt") != snapshot["retrievedAt"]:
            raise ClinicSnapshotError("provenance and normalized snapshot describe different acquisitions")
        if provenance.get("rawSha256") != snapshot["rawSha256"]:
            raise ClinicSnapshotError("provenance rawSha256 does not match the normalized snapshot")
        boundary = provenance.get("boundary") or {}
        if boundary.get("barangaysSha256") != osm_clinics.sha256_file(osm_clinics.BARANGAY_GEOJSON):
            raise ClinicSnapshotError(
                "barangay geometry changed since the snapshot was built; re-run import-osm-clinics.py"
            )
        if boundary.get("municipalitiesSha256") != osm_clinics.sha256_file(osm_clinics.MUNICIPALITY_GEOJSON):
            raise ClinicSnapshotError(
                "municipality geometry changed since the snapshot was built; re-run import-osm-clinics.py"
            )
    else:
        raise ClinicSnapshotError("provenance document is missing; the snapshot cannot be verified offline")

    # Offline rebuild from the stored raw response must reproduce the stored
    # documents byte for byte; otherwise the assignment geometry or the pipeline
    # changed and the bundle must not be generated from a stale normalisation.
    rebuilt = osm_clinics.build_snapshot(raw_bytes.read_bytes(), {
        "endpoint": provenance.get("endpoint"),
        "query": provenance.get("query"),
        "retrievedAt": provenance.get("retrievedAt"),
        "bbox": provenance.get("bbox"),
    }, allow_empty=snapshot.get("counts", {}).get("records") == 0)
    documents = rebuilt.documents()
    if documents[osm_clinics.NORMALIZED_PATH.name] != OSM_NORMALIZED.read_bytes():
        raise ClinicSnapshotError(
            "normalized snapshot is not reproducible from the stored raw response; "
            "re-run import-osm-clinics.py"
        )
    if documents[osm_clinics.PROVENANCE_PATH.name] != OSM_PROVENANCE.read_bytes():
        raise ClinicSnapshotError(
            "provenance document is not reproducible from the stored raw response; "
            "re-run import-osm-clinics.py"
        )
    seen = set()
    for record in clinics:
        identity = (record["osmType"], record["osmId"])
        if identity in seen:
            raise ClinicSnapshotError(f"duplicate clinic identity {record['id']} in the snapshot")
        seen.add(identity)
    return clinics, snapshot


def build():
    geometry = json.loads(
        (ROOT / "frontend/public/assets/geo/laguna_barangays.geojson").read_text(encoding="utf-8")
    )
    boundaries = {key(f["properties"]["municipality"], f["properties"]["adm4_en"]): f["properties"] for f in geometry["features"]}
    risk_rows = read_csv("laguna_barangay_risk_index.csv")
    risks = {key(r["municipality"], r["name"]): r for r in risk_rows}
    rows = read_csv("laguna_barangays.csv")
    assert len(boundaries) == len(risks) == len(rows) == 681, "Duplicate or missing barangay identifiers"
    barangays = []
    for row in rows:
        identifier = key(row["municipality"], row["name"])
        boundary, risk = boundaries[identifier], risks[identifier]
        assert row["population"] == risk["population"], f"Population mismatch: {identifier}"
        area = boundary["area_crs"] / 1_000_000
        barangays.append(dict(
            psgc=str(boundary["adm4_psgc"]), municipalityPsgc=str(boundary["adm3_psgc"]),
            name=row["name"], boundaryName=boundary["adm4_en"], municipality=row["municipality"],
            lat=number(row["latitude"]), lng=number(row["longitude"]),
            population=number(row["population"], True), households=number(row["households"], True),
            urbanRural=row["urban_rural"], incomeClass=row["city_municipality_income_class"],
            morbidity=number(row["synthetic_morbidity_rate"]), areaKm2=area,
            density=round(int(row["population"]) / area),
            adjacentBarangays=row["adjacent_barangays"].split(" | ") if row["adjacent_barangays"] else [],
            disasterRisk=number(risk["disaster_risk_index"]),
            riskLower=number(risk["index_lower_bound"]), riskUpper=number(risk["index_upper_bound"]),
            riskRank=number(risk["risk_rank"], True), hazardLevel=risk["hazard_level"],
            indexStatus=risk["index_status"], coverageStatus=risk["coverage_status"],
            spatialBasis=risk["spatial_basis"], methodVersion=risk["method_version"],
            unclassifiedCodes=risk["unclassified_codes"],
            hazards={k.removesuffix("_score"): number(v) for k, v in risk.items() if k.endswith("_score")},
        ))
    assert len({b["psgc"] for b in barangays}) == 681, "Multiple CSV rows matched one boundary"
    hospitals = []
    for index, row in enumerate(read_csv("laguna_hospitals.csv")):
        hospitals.append(dict(
            id=f"H-DATA-{index + 1:03}", name=row["name"], municipality=row["municipality"],
            municipalityKey=normalize(row["municipality"]), barangay=row["barangay"],
            lat=number(row["latitude"]), lng=number(row["longitude"]),
            type=row["facility_type"], classification=row["classification"],
            capacity=number(row["capacity_beds"], True),
            verificationStatus=row["verification_status"], capacityAsOf=row["capacity_as_of"],
            capacityDefinition=row["capacity_definition"], capacityStatus=row["capacity_status"],
            completeness=row["record_completeness"], notes=row["notes"],
            verified=row["verification_status"].startswith(("DOH hospital register", "PhilHealth")),
            services=[],
        ))
    clinics, clinic_snapshot = load_clinics()
    bundle = dict(barangays=barangays, hospitals=hospitals, clinics=clinics, clinicSnapshot=clinic_snapshot)
    return json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    try:
        content = build()
    except ClinicSnapshotError as error:
        raise SystemExit(
            f"Invalid OSM clinic snapshot: {error}\n"
            "Regenerate it with frontend/scripts/import-osm-clinics.py (or remove it to bundle no clinics)."
        ) from None
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != content:
            raise SystemExit("Dataset bundle is stale; run frontend/scripts/import-laguna-datasets.py")
        bundle = json.loads(content)
        print(
            f"All 681 barangay joins, 66 hospital records and {len(bundle['clinics'])} OSM clinic records "
            f"(snapshot valid={str(bundle['clinicSnapshot']['valid']).lower()}) match the sources."
        )
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(content, encoding="utf-8", newline="\n")
        bundle = json.loads(content)
        print(
            f"Wrote {OUTPUT.relative_to(ROOT)} with {len(bundle['clinics'])} OSM clinic records "
            f"(snapshot valid={str(bundle['clinicSnapshot']['valid']).lower()})"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
