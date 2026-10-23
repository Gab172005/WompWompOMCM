"""Join the supplied CSVs to bundled PSGC geometry without guessing missing values."""
import argparse
import csv
import json
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "frontend/src/data/laguna-datasets.json"


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


def build():
    geometry = json.loads((ROOT / "frontend/public/assets/geo/laguna_barangays.geojson").read_text())
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
    return json.dumps(dict(barangays=barangays, hospitals=hospitals), ensure_ascii=False, separators=(",", ":")) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    content = build()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != content:
            raise SystemExit("Dataset bundle is stale; run frontend/scripts/import-laguna-datasets.py")
        print("All 681 barangay joins and 66 hospital records match the supplied CSVs.")
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(content)
        print(f"Wrote {OUTPUT.relative_to(ROOT)}")
