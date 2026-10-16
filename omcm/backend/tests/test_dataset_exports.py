import csv
import io
import json
from export_datasets import ROOT, dataset_exports


def test_dataset_exports_match_runtime_fixtures_and_join_by_psgc():
    exports = dataset_exports()
    for name, content in exports.items():
        assert (ROOT / "datasets" / name).read_bytes() == content, name
    population = list(csv.DictReader(io.StringIO(exports["population.csv"].decode("utf-8"))))
    disease = list(csv.DictReader(io.StringIO(exports["disease_cases.csv"].decode("utf-8"))))
    geometry = json.loads(exports["barangays.geojson"])
    ids = {row["psgc"] for row in population}
    assert len(ids) == 20
    assert ids == {row["psgc"] for row in disease}
    assert ids == {str(f["properties"]["adm4_psgc"]) for f in geometry["features"]}
    assert len(json.loads(exports["municipalities.geojson"])["features"]) == 30
