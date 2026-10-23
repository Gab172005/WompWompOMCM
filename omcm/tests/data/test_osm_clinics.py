"""Tests for the offline OSM clinic snapshot pipeline.

Run from ``omcm/``:

    python -m unittest discover -s tests/data -t . -v

Everything here is offline: the fixtures are handcrafted, so no Overpass call,
no network access and no real Laguna geometry is involved.
"""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "frontend/scripts"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
sys.path.insert(0, str(SCRIPTS))

import osm_clinics as oc  # noqa: E402
IMPORT_SCRIPT_PATH = SCRIPTS / "import-osm-clinics.py"
_SPEC = importlib.util.spec_from_file_location("import_osm_clinics", IMPORT_SCRIPT_PATH)
IMPORTER = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = IMPORTER
_SPEC.loader.exec_module(IMPORTER)
_DATASET_SPEC = importlib.util.spec_from_file_location(
    "import_laguna_datasets", SCRIPTS / "import-laguna-datasets.py"
)
DATASET_IMPORTER = importlib.util.module_from_spec(_DATASET_SPEC)
sys.modules[_DATASET_SPEC.name] = DATASET_IMPORTER
_DATASET_SPEC.loader.exec_module(DATASET_IMPORTER)

BOUNDARIES = json.loads((FIXTURES / "boundaries.geojson").read_text(encoding="utf-8"))
VALID_RAW = (FIXTURES / "clinics-valid.json").read_bytes()

PROVENANCE = {
    "endpoint": "https://overpass.example/api/interpreter",
    "query": '[out:json];nwr["amenity"="clinic"](0,0,1,1);nwr["healthcare"="clinic"](0,0,1,1);'
             'out meta center;',
    "retrievedAt": "2026-10-23T17:32:47.575509+00:00",
    "bbox": [0.0, 0.0, 1.0, 1.0],
}


def boundaries():
    """Load the handcrafted barangay/province geometry."""
    return oc.load_boundaries_from_geojson(BOUNDARIES["barangays"], BOUNDARIES["municipalities"])


def build(raw=VALID_RAW, provenance=None, *, allow_empty=False):
    barangays, province = boundaries()
    return oc.build_snapshot(
        raw, dict(provenance or PROVENANCE), allow_empty=allow_empty,
        barangays=barangays, province=province,
    )


def clinics_by_id(snapshot):
    return {clinic["id"]: clinic for clinic in snapshot.clinics}


class GeometryTests(unittest.TestCase):
    def setUp(self):
        self.barangays, self.province = boundaries()

    def containing(self, lon, lat):
        """Containing barangays for a point given as (lon, lat), like the GeoJSON fixture."""
        matches, on_boundary = oc.barangays_containing(self.barangays, (lon, lat))
        return sorted(m.psgc for m in matches), on_boundary

    def test_containment_respects_holes(self):
        # Inside a hole of barangay 403401001: not contained and not a boundary.
        self.assertEqual(self.containing(0.03, 0.03), ([], False))
        # Inside the outer ring and outside the hole.
        self.assertEqual(self.containing(0.01, 0.01), (["403401001"], False))

    def test_multipolygon_parts_and_holes(self):
        # Both parts of a MultiPolygon are interiors (coordinates are lon, lat).
        self.assertEqual(self.containing(0.25, 0.05), (["403402001"], False))
        # Exact hole edge is ambiguous like any polygon edge, never counted.
        self.assertEqual(self.containing(0.45, 0.05), (["403402001"], True))
        # ... and the hole inside the second part is not, and is not a boundary either.
        self.assertEqual(self.containing(0.43, 0.03), ([], False))

    def test_boundary_and_outside_points(self):
        # On barangay A's outer edge (lon 0.1) — an edge hit is reported as a
        # boundary and never silently assigned to a neighbouring polygon.
        self.assertEqual(self.containing(0.1, 0.05), (["403401001"], True))
        # On the edge shared by A (lat 0..0.1) and B (lat 0.1..0.2) both touch it.
        self.assertEqual(self.containing(0.05, 0.1), (["403401001", "403401002"], True))
        self.assertFalse(oc.point_in_province(self.province, (1.5, 1.5)))
        self.assertTrue(oc.point_in_province(self.province, (0.05, 0.05)))

    def test_municipality_hole_is_outside_the_municipality_union(self):
        # Municipality ring hole at lon 0.06-0.09, lat 0.10-0.13 is outside the province.
        self.assertFalse(oc.point_in_province(self.province, (0.08, 0.12)))

    def test_haversine_scale(self):
        kilometres = oc.haversine_km(0.0, 0.0, 0.0, 1.0)
        # 1 degree of longitude at the equator is about 111.195 km.
        self.assertAlmostEqual(kilometres, 111.195, delta=0.01)
        self.assertAlmostEqual(oc.haversine_km(0.0, 0.0, 0.0, 0.0), 0.0)

    def test_duplicate_radius_threshold_is_49m_but_not_51m(self):
        metres_per_degree = 111195.0
        def record(osm_id, longitude):
            return oc.ClinicRecord("node", osm_id, {"amenity": "clinic", "name": "Same Clinic"},
                                   0.0, longitude, "node", True)
        just_inside = oc.deduplicate([record(1, 0), record(2, 49 / metres_per_degree)])
        just_outside = oc.deduplicate([record(1, 0), record(3, 51 / metres_per_degree)])
        self.assertEqual(len(just_inside.suspected), 1)
        self.assertAlmostEqual(just_inside.suspected[0]["distanceMeters"], 49.0, delta=0.1)
        self.assertEqual(just_outside.suspected, [])


class ParsingTests(unittest.TestCase):
    def test_accepts_numeric_overpass_version(self):
        payload = json.loads(VALID_RAW)
        self.assertEqual(payload["version"], 0.6)
        parsed = oc.parse_response(payload)
        self.assertEqual(parsed.osm_base, "2026-10-23T17:31:38Z")

    def test_rejects_remark(self):
        payload = json.loads(VALID_RAW)
        payload["remark"] = "runtime error: Query timed out"
        with self.assertRaisesRegex(oc.ResponseError, "incomplete response"):
            oc.parse_response(payload)

    def test_rejects_malformed_documents(self):
        for payload in ([], {"elements": "nope"}, {"elements": []}, {"elements": [1, 2]},
                        {"elements": [{"type": "node", "id": 1, "lat": "0.1", "lon": 0.1}]}):
            with self.subTest(payload=payload), self.assertRaises(oc.ResponseError):
                oc.parse_response(payload)

    def test_explicit_allow_empty_accepts_complete_zero_observation(self):
        payload = {"version": 0.6, "osm3s": {"timestamp_osm_base": "2026-10-23T17:31:38Z"},
                   "elements": []}
        with self.assertRaises(oc.ResponseError):
            oc.parse_response(payload)
        parsed = oc.parse_response(payload, allow_empty=True)
        self.assertEqual(parsed.elements_total, 0)
        self.assertEqual(parsed.records, [])
        self.assertTrue(build(json.dumps(payload).encode(), allow_empty=True).clinic_snapshot["valid"])
        for broken in (dict(payload, remark="timeout"), dict(payload, error="timeout"),
                       dict(payload, errors=["timeout"]), dict(payload, partial=True),
                       {"elements": [], "version": 0.6}):
            with self.subTest(broken=broken), self.assertRaises(oc.ResponseError):
                oc.parse_response(broken, allow_empty=True)

    def test_allow_empty_never_overrides_nonempty_nonclinic_response(self):
        payload = {"elements": [{"type": "node", "id": 7, "tags": {"amenity": "hospital"}}]}
        with self.assertRaisesRegex(oc.ResponseError, "no element with an exact clinic tag"):
            oc.parse_response(payload, allow_empty=True)

    def test_valid_empty_snapshot_passes_generated_bundle_contract(self):
        payload = {"version": 0.6, "osm3s": {"timestamp_osm_base": "2026-10-23T17:31:38Z"}, "elements": []}
        empty_snapshot = build(json.dumps(payload).encode(), allow_empty=True)
        validated = DATASET_IMPORTER.validate_clinic_snapshot(empty_snapshot.clinic_snapshot, [])
        self.assertTrue(validated["valid"])
        self.assertEqual(validated["counts"]["records"], 0)

    def test_rejects_response_without_clinics(self):
        payload = json.loads(VALID_RAW)
        for element in payload["elements"]:
            element["tags"] = {"amenity": "hospital"}
        with self.assertRaisesRegex(oc.ResponseError, "no element with an exact clinic tag"):
            oc.parse_response(payload)

    def test_rejects_bad_identity_and_coordinates(self):
        payload = json.loads(VALID_RAW)
        payload["elements"] = [{"type": "node", "id": "x", "lat": 0.1, "lon": 0.1,
                                "tags": {"amenity": "clinic"}}]
        with self.assertRaises(oc.ResponseError):
            oc.parse_response(payload)

    def test_rejects_nonfinite_and_partial_coordinates(self):
        payload = json.loads(VALID_RAW)
        base = {"type": "node", "id": 42, "tags": {"amenity": "clinic"}}
        for lat, lon in ((float("nan"), 0.1), (0.1, float("inf")), (0.1, None), (95.0, 0.1)):
            element = dict(base, lat=lat, lon=lon)
            with self.subTest(lat=lat, lon=lon):
                payload["elements"] = [element]
                with self.assertRaises(oc.ResponseError):
                    oc.parse_response(payload)

    def test_way_without_center_is_unavailable_not_invented(self):
        payload = json.loads(VALID_RAW)
        payload["elements"] = [{"type": "way", "id": 9, "nodes": [1, 2, 3],
                                "tags": {"amenity": "clinic", "name": "No centre"}}]
        parsed = oc.parse_response(payload)
        self.assertIsNone(parsed.records[0].lat)
        self.assertEqual(parsed.records[0].location_method, "unavailable")

    def test_node_without_coordinates_is_retained_as_unlocated(self):
        payload = json.loads(VALID_RAW)
        payload["elements"] = [{"type": "node", "id": 9, "tags": {"amenity": "clinic"}}]
        parsed = oc.parse_response(payload)
        self.assertEqual(len(parsed.records), 1)
        self.assertIsNone(parsed.records[0].lat)


class LifecycleTests(unittest.TestCase):
    def test_prefixed_and_boolean_forms_are_inactive(self):
        self.assertFalse(oc.is_active_clinic({"disused:amenity": "clinic"}))
        self.assertFalse(oc.is_active_clinic({"amenity": "clinic", "disused": "yes"}))
        self.assertFalse(oc.is_active_clinic({"amenity": "clinic", "abandoned:amenity": "clinic"}))
        self.assertFalse(oc.is_active_clinic({"amenity": "clinic", "closed": "yes"}))
        self.assertTrue(oc.is_active_clinic({"amenity": "clinic", "disused": "no"}))

    def test_other_amenity_values_are_not_candidates(self):
        self.assertFalse(oc.is_lifecycle_clinic({"amenity": "hospital"}))
        self.assertFalse(oc.is_active_clinic({"healthcare": "centre"}))
        self.assertFalse(oc.is_active_clinic({"amenity": "Clinic"}))


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = build()
        self.clinics = clinics_by_id(self.snapshot)

    def test_assignment_statuses(self):
        expected = {
            "node/1001": ("assigned", "403401001", "403401000"),  # interior of barangay A
            "node/1002": ("ambiguous", None, None),          # inside barangay A's hole
            "node/1003": ("assigned", "403401002", "403401000"),
            "node/1004": ("ambiguous", None, None),          # shared barangay edge
            "node/1005": ("ambiguous", None, "403402000"),   # in province, in no barangay
            "node/1006": ("outside", None, None),
            "node/1007": ("unlocated", None, None),
            "way/2001": ("assigned", "403402001", "403402000"),
            "way/2002": ("ambiguous", None, None),           # MultiPolygon part hole
            "node/1008": ("assigned", "403401001", "403401000"),
            "node/1009": ("assigned", "403401002", "403401000"),
            "node/1100": ("assigned", "403401001", "403401000"),
            "node/1101": ("assigned", "403401001", "403401000"),
        }
        for identity, (status, barangay, municipality) in expected.items():
            with self.subTest(identity=identity):
                clinic = self.clinics[identity]
                self.assertEqual(clinic["assignmentStatus"], status)
                self.assertEqual(clinic["barangayPsgc"], barangay)
                self.assertEqual(clinic["municipalityPsgc"], municipality)

    def test_never_invents_a_barangay(self):
        for clinic in self.snapshot.clinics:
            if clinic["assignmentStatus"] != "assigned":
                self.assertIsNone(clinic["barangayPsgc"], clinic["id"])
            if clinic["assignmentStatus"] == "outside":
                self.assertFalse(clinic["inProvince"], clinic["id"])
            if clinic["assignmentStatus"] == "unlocated":
                self.assertIsNone(clinic["lat"], clinic["id"])

    def test_in_province_and_distance_eligibility(self):
        inside = {c["id"] for c in self.snapshot.clinics if c["inProvince"]}
        self.assertEqual(inside, {
            "node/1001", "node/1002", "node/1003", "node/1004", "node/1005",
            "way/2001", "way/2002", "node/1008", "node/1009",
            "node/1010", "node/1011", "node/1012", "node/1013",
            "node/1100", "node/1101",
        })
        # Distance eligibility is independent of activity and of the assignment label.
        eligible = {c["id"] for c in self.snapshot.clinics
                    if c["active"] and c["lat"] is not None and c["assignmentStatus"] != "outside"}
        self.assertEqual(eligible, {
            "node/1001", "node/1002", "node/1003", "node/1004", "node/1005",
            "way/2001", "way/2002", "node/1008", "node/1009", "node/1100", "node/1101",
        })
        self.assertEqual(self.snapshot.clinic_snapshot["counts"]["distanceEligible"], len(eligible))
        # An inactive record still carries its province location for provenance.
        self.assertTrue(self.clinics["node/1010"]["inProvince"])
        self.assertFalse(self.clinics["node/1010"]["active"])

    def test_location_methods(self):
        self.assertEqual(self.clinics["node/1001"]["locationMethod"], "node")
        self.assertEqual(self.clinics["way/2001"]["locationMethod"], "overpass-center")
        self.assertEqual(self.clinics["node/1007"]["locationMethod"], "unavailable")
        self.assertIn("Overpass bounding-box centre", " ".join(self.snapshot.clinic_snapshot["warnings"]))

    def test_lifecycle_records_are_retained_but_inactive(self):
        for identity in ("node/1010", "node/1011", "node/1012", "node/1013"):
            clinic = self.clinics[identity]
            self.assertFalse(clinic["active"], identity)
            self.assertTrue(clinic["warnings"], identity)
            self.assertIsNotNone(clinic["lat"], identity)
        self.assertEqual(self.snapshot.clinic_snapshot["counts"]["inactive"], 4)

    def test_tags_are_preserved(self):
        self.assertEqual(
            self.clinics["way/2001"]["tags"],
            {"amenity": "clinic", "building": "yes", "name": "MultiPolygon Part Clinic"},
        )

    def test_duplicate_identity_is_collapsed(self):
        ids = [clinic["id"] for clinic in self.snapshot.clinics]
        self.assertEqual(len(ids), len(set(ids)))
        counts = self.snapshot.clinic_snapshot["counts"]
        self.assertEqual(counts["duplicates"], 1)
        self.assertEqual(self.snapshot.normalized["provenance"]["duplicateIds"], [{"id": "node/1001"}])

    def test_conflicting_duplicates_are_rejected(self):
        payload = json.loads(VALID_RAW)
        clone = dict(payload["elements"][0], lat=0.09)
        payload["elements"].append(clone)
        with self.assertRaises(oc.ResponseError):
            build(json.dumps(payload).encode("utf-8"))

    def test_suspected_duplicates_are_flagged_not_merged(self):
        suspected = self.snapshot.normalized["provenance"]["suspectedDuplicates"]
        self.assertEqual(len(suspected), 1, suspected)
        self.assertEqual(set(suspected[0]["ids"]), {"node/1100", "node/1101"})
        self.assertLessEqual(suspected[0]["distanceMeters"], oc.SUSPECTED_DUPLICATE_METERS)
        self.assertTrue(self.clinics["node/1100"]["warnings"])
        self.assertTrue(self.clinics["node/1101"]["warnings"])
        self.assertIn("node/1100", clinics_by_id(self.snapshot))

    def test_snapshot_metadata(self):
        snapshot = self.snapshot.clinic_snapshot
        self.assertTrue(snapshot["valid"])
        self.assertEqual(snapshot["license"], "ODbL-1.0")
        self.assertEqual(snapshot["attribution"], "© OpenStreetMap contributors")
        self.assertEqual(snapshot["osmBaseTimestamp"], "2026-10-23T17:31:38Z")
        self.assertEqual(snapshot["rawSha256"], oc.sha256_bytes(VALID_RAW))
        self.assertEqual(snapshot["query"], PROVENANCE["query"])
        counts = snapshot["counts"]
        for key in ("candidates", "records", "active", "inactive", "activeAssigned",
                    "activeLocatedInProvince", "activeAmbiguous", "activeOutside",
                    "activeUnlocated", "duplicates", "distanceEligible"):
            self.assertIsInstance(counts[key], int, key)
        self.assertEqual(counts["candidates"], 22)
        self.assertEqual(counts["records"], len(self.snapshot.clinics))
        self.assertEqual(counts["nonClinicElements"], 4)
        # candidates == retained records + non-clinic elements + collapsed duplicates
        self.assertEqual(
            counts["candidates"],
            counts["records"] + counts["nonClinicElements"] + counts["duplicates"],
        )
        self.assertEqual(counts["duplicates"], 1)

    def test_query_without_lifecycle_selectors_is_kept_and_warned(self):
        provenance = dict(PROVENANCE)
        self.assertEqual(self.snapshot.clinic_snapshot["query"], provenance["query"])
        self.assertIn("lifecycle selectors", " ".join(self.snapshot.clinic_snapshot["warnings"]))


class SnapshotFileTests(unittest.TestCase):
    def test_documents_are_valid_utf8_json(self):
        snapshot = build()
        for name, payload in snapshot.documents().items():
            self.assertTrue(name.endswith(".json"))
            decoded = json.loads(payload.decode("utf-8"))
            self.assertIsInstance(decoded, dict)

    def test_output_matches_the_shared_types(self):
        snapshot = build()
        clinic_keys = {
            "id", "osmType", "osmId", "name", "lat", "lng", "locationMethod", "tags",
            "active", "inProvince", "barangayPsgc", "municipalityPsgc", "assignmentStatus", "warnings",
        }
        for clinic in snapshot.clinics:
            self.assertEqual(set(clinic), clinic_keys, clinic["id"])
        self.assertEqual(set(snapshot.clinic_snapshot), {
            "valid", "retrievedAt", "osmBaseTimestamp", "endpoint", "query", "attribution",
            "license", "rawSha256", "boundarySha256", "counts", "warnings",
        })

    def test_rebuild_is_byte_identical(self):
        first = build().documents()
        second = build().documents()
        self.assertEqual(first, second)

    def test_invalid_clinic_snapshot_is_marked_invalid(self):
        document = oc.invalid_clinic_snapshot("snapshot missing")
        self.assertFalse(document["valid"])
        self.assertEqual(document["counts"], {})
        self.assertEqual(document["license"], "ODbL-1.0")

    def test_utf8_names_round_trip(self):
        payload = json.loads(VALID_RAW)
        payload["elements"] = [{"type": "node", "id": 1, "lat": 0.05, "lon": 0.05,
                                "tags": {"amenity": "clinic", "name": "Clínica Niña"}}]
        snapshot = build(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
        normalized = json.loads(snapshot.normalized_bytes.decode("utf-8"))
        self.assertEqual(normalized["clinics"][0]["name"], "Clínica Niña")
        self.assertIn("Clínica Niña", snapshot.normalized_bytes.decode("utf-8"))


class ImporterTests(unittest.TestCase):
    def test_failed_swap_restores_original_bytes(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            target_a = Path(directory) / "a.json"
            target_b = Path(directory) / "b.json"
            target_a.write_bytes(b"old-a")
            target_b.write_bytes(b"old-b")
            real_replace = IMPORTER.os.replace
            calls = 0
            rollback = False
            def fail_on_second_target(source, target):
                nonlocal calls, rollback
                calls += 1
                # a->backup, temp-a->a, b->backup, then fail temp-b->b;
                # also fail restoring a to verify that its backup is kept.
                if calls == 4:
                    rollback = True
                    raise OSError("injected replace failure")
                if rollback and str(source).endswith(".bak"):
                    raise OSError("injected rollback failure")
                real_replace(source, target)
            with mock.patch.object(IMPORTER.os, "replace", side_effect=fail_on_second_target):
                with self.assertRaisesRegex(OSError, "injected"):
                    IMPORTER.replace_atomically({target_a: b"new-a", target_b: b"new-b"})
            self.assertEqual(target_b.read_bytes(), b"old-b")
            backups = list(Path(directory).glob(".*.bak"))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), b"old-a")

    def test_staging_failure_preserves_target_and_lock_rejects_conflict(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            target = Path(directory) / "a.json"
            target.write_bytes(b"old")
            with mock.patch.object(IMPORTER, "_fsync_write", side_effect=OSError("stage failed")):
                with self.assertRaisesRegex(OSError, "stage failed"):
                    IMPORTER.replace_atomically({target: b"new"})
            self.assertEqual(target.read_bytes(), b"old")
            with IMPORTER.snapshot_lock(Path(directory)):
                with self.assertRaisesRegex(IMPORTER.ImportFailure, "another clinic snapshot import"):
                    with IMPORTER.snapshot_lock(Path(directory)):
                        pass


class GuardTests(unittest.TestCase):
    current = {"candidates": 100, "records": 100}
    old_sha = "a" * 64

    def test_unchanged_payload_is_allowed(self):
        guard = oc.guard_replacement(self.current, dict(self.current), self.old_sha, self.old_sha)
        self.assertTrue(guard.ok)

    def test_empty_replacement_requires_only_its_own_flag(self):
        empty = dict(self.current, candidates=0, records=0, active=0, activeLocatedInProvince=0)
        self.assertFalse(oc.guard_replacement(self.current, empty, self.old_sha, "b" * 64).ok)
        self.assertTrue(oc.guard_replacement(self.current, empty, self.old_sha, "b" * 64,
                                             allow_empty=True).ok)
        # --allow-large-drop alone never permits a valid zero observation.
        self.assertFalse(oc.guard_replacement(self.current, empty, self.old_sha, "b" * 64,
                                              allow_large_drop=True).ok)
        self.assertIn("--allow-empty", " ".join(
            oc.guard_replacement(self.current, empty, self.old_sha, "b" * 64).messages))

    def test_large_drop_uses_retained_records_not_raw_elements(self):
        # Unrelated elements plus duplicates can preserve the raw count while
        # nearly all meaningful clinics disappear.
        dropped = dict(self.current, candidates=100, records=1, active=1, activeLocatedInProvince=1)
        current = dict(self.current, candidates=100, records=100, active=100, activeLocatedInProvince=80)
        blocked = oc.guard_replacement(current, dropped, self.old_sha, "b" * 64)
        self.assertFalse(blocked.ok)
        self.assertIn("retained clinic records", " ".join(blocked.messages).lower())
        allowed = oc.guard_replacement(current, dropped, self.old_sha, "b" * 64, allow_large_drop=True)
        self.assertTrue(allowed.ok)
        self.assertIn("Retained clinic records", " ".join(allowed.messages))
        self.assertIn("Active located in-province clinics", " ".join(allowed.messages))

    def test_large_drop_requires_flag(self):
        dropped = dict(self.current, candidates=20, records=20)
        self.assertFalse(oc.guard_replacement(self.current, dropped, self.old_sha, "b" * 64).ok)
        self.assertTrue(oc.guard_replacement(self.current, dropped, self.old_sha, "b" * 64,
                                             allow_large_drop=True).ok)

    def test_growth_is_always_allowed(self):
        bigger = dict(self.current, candidates=200, records=200)
        self.assertTrue(oc.guard_replacement(self.current, bigger, self.old_sha, "c" * 64).ok)


if __name__ == "__main__":
    unittest.main()
