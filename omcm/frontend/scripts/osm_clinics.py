"""Validate raw Overpass clinic responses and build the offline OSM clinic snapshot.

Standard library only. The persistent snapshot is written under
``frontend/public/assets/osm`` as three byte-stable JSON documents:

``osm-clinics-raw.json``
    The Overpass response body exactly as received (never rewritten).
``osm-clinics-provenance.json``
    Acquisition metadata: endpoint, canonical query, bounding box, retrieval
    time, OSM base timestamp, checksums and summary counts.
``osm-clinics-normalized.json``
    One record per unique OSM element (``clinics``) plus a ``clinicSnapshot``
    object matching ``frontend/src/types/osmClinic.ts``.

Rules enforced here (see module constants):

* Only nodes, ways and relations tagged exactly ``amenity=clinic`` or
  ``healthcare=clinic`` are clinic candidates. Records whose clinic tag was
  moved to a lifecycle prefix (``disused:``, ``abandoned:``, ...) are kept for
  provenance only and marked inactive. No name matching, no broader healthcare
  values and no guessed assignments.
* Element identity is ``(type, id)``. Coordinates come from the element itself
  (node) or the Overpass ``center`` of a way/relation, which is a bounding-box
  centre, not an entrance. Unlocated elements stay ``unlocated``.
* Province scope is the union of the bundled municipality polygons.
  Barangay assignment is Polygon/MultiPolygon/hole aware with no tolerance
  band: a point strictly inside exactly one barangay is ``assigned``; a point on
  a boundary vertex or edge, inside more than one barangay, or inside the
  province polygon union but in no barangay polygon is ``ambiguous`` with no
  barangay (never a guessed assignment); a point outside the province is
  ``outside``. Nothing else is produced.
* ``assignmentStatus`` is exactly ``assigned | ambiguous | outside | unlocated``.
  A located record is ``outside`` only when its coordinate is outside the
  province polygon union; a *unit* without a location is ``unlocated``.
* Eligibility used by the scorer: distance uses every active record with a
  usable location whose status is not ``outside`` (i.e. ``assigned`` and
  ``ambiguous``). ``inProvince`` is true for ``assigned``/``ambiguous`` and
  false for ``outside``/``unlocated``; it is therefore a scope label, not by
  itself the whole distance rule -- the rule is status plus location.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import math
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GEO_DIR = ROOT / "frontend/public/assets/geo"
BARANGAY_GEOJSON = GEO_DIR / "laguna_barangays.geojson"
MUNICIPALITY_GEOJSON = GEO_DIR / "laguna_municipalities.geojson"
ASSET_DIR = ROOT / "frontend/public/assets/osm"
RAW_PATH = ASSET_DIR / "osm-clinics-raw.json"
PROVENANCE_PATH = ASSET_DIR / "osm-clinics-provenance.json"
NORMALIZED_PATH = ASSET_DIR / "osm-clinics-normalized.json"
AUDIT_PATH = ASSET_DIR / "acquisition-audit.md"
SNAPSHOT_FILES = (RAW_PATH, PROVENANCE_PATH, NORMALIZED_PATH)

OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT = 180
HTTP_TIMEOUT = 240
USER_AGENT = "OMCM-clinic-dataset-refresh/1.0 (Laguna planning snapshot; research use)"
ATTRIBUTION = "© OpenStreetMap contributors"
LICENSE = "ODbL-1.0"
OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright"
DATA_FORMAT = "omcm-osm-clinics/1"

ACTIVE_CLINIC_KEYS = ("amenity", "healthcare")
LIFECYCLE_PREFIXES = (
    "disused",
    "abandoned",
    "demolished",
    "construction",
    "proposed",
    "was",
    "planned",
    "removed",
    "razed",
    "destroyed",
    "closed",
)
CLINIC_VALUE = "clinic"
LIFECYCLE_KEYS = tuple(
    f"{prefix}:{key}" for prefix in LIFECYCLE_PREFIXES for key in ACTIVE_CLINIC_KEYS
)
QUERY_KEYS = ACTIVE_CLINIC_KEYS + LIFECYCLE_KEYS
OSM_TYPES = ("node", "way", "relation")

# No tolerance band: an assigned point must be strictly inside. Boundary
# propagation of floating-point error is at most ~1e-12 degrees here.
ON_BOUNDARY_EPSILON_DEG = 0.0
EARTH_RADIUS_KM = 6371.0
EARTH_CIRCUMFERENCE_M = 12742000.0  # 2 * 6_371_000 m, cross-checked in tests
# Distinct elements with the same normalized name within this radius are
# reported as suspected duplicates (never merged).
SUSPECTED_DUPLICATE_METERS = 50.0

# Guards against clobbering a good snapshot with a broken refresh.
LARGE_DROP_FRACTION = 0.5


class ResponseError(ValueError):
    """The Overpass payload is not a valid, complete clinic response."""


class SnapshotError(ValueError):
    """The persistent snapshot is missing, inconsistent or unsafe to replace."""


# --------------------------------------------------------------------------- #
# JSON helpers


def dump_json(value) -> str:
    """Deterministic, UTF-8 safe JSON text with a trailing newline."""
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(Path(path).read_bytes())


def read_json(path: Path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SnapshotError(f"Missing file: {Path(path).as_posix()}") from None
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise SnapshotError(f"Invalid JSON in {Path(path).as_posix()}: {error}") from None


def utc_now() -> str:
    """Retrieval timestamp with the same shape as the staged acquisition."""
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def is_finite_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


# --------------------------------------------------------------------------- #
# Canonical Overpass query


def _coordinate_features() -> list[tuple[str, dict]]:
    barangays = read_json(BARANGAY_GEOJSON)
    municipalities = read_json(MUNICIPALITY_GEOJSON)
    return [
        ("laguna_barangays.geojson", barangays),
        ("laguna_municipalities.geojson", municipalities),
    ]


def _walk_positions(coords, sink):
    if (
        isinstance(coords, (list, tuple))
        and len(coords) >= 2
        and is_finite_number(coords[0])
        and is_finite_number(coords[1])
    ):
        sink(coords)
        return
    if isinstance(coords, (list, tuple)):
        for item in coords:
            _walk_positions(item, sink)


def province_bbox() -> tuple[float, float, float, float]:
    """(south, west, north, east) from the bundled Laguna geometry, rounded to 1e-7."""
    lats: list[float] = []
    lngs: list[float] = []
    for name, collection in _coordinate_features():
        features = collection.get("features") or []
        if not features:
            raise SnapshotError(f"{name} has no features; cannot derive a query bbox")
        for feature in features:
            _walk_positions((feature.get("geometry") or {}).get("coordinates", []), lambda p: (lats.append(p[1]), lngs.append(p[0])))
    if not lats:
        raise SnapshotError("Bundled Laguna geometry has no coordinates")
    return (min(lats), min(lngs), max(lats), max(lngs))


def canonical_query(bbox: tuple[float, float, float, float]) -> str:
    bounds = ",".join(str(round(value, 7)) for value in bbox)
    selectors = "".join(f'nwr["{key}"="{CLINIC_VALUE}"]({bounds});' for key in QUERY_KEYS)
    return f"[out:json][timeout:{OVERPASS_TIMEOUT}];({selectors});out meta center;"


# --------------------------------------------------------------------------- #
# Geometry


Point = tuple[float, float]  # (lng, lat)


def _ring_area(ring: list[Point]) -> float:
    area = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        area += x1 * y2 - x2 * y1
    return area / 2.0


def prepare_polygon(rings) -> list[list[Point]]:
    """Normalize GeoJSON rings: drop duplicate closing vertices, outer CCW, holes CW."""
    if not isinstance(rings, (list, tuple)) or not rings:
        raise ValueError("Polygon has no rings")
    prepared: list[list[Point]] = []
    for index, ring in enumerate(rings):
        points: list[Point] = []
        for position in ring or []:
            if not (isinstance(position, (list, tuple)) and len(position) >= 2):
                raise ValueError("Polygon ring has an invalid position")
            x, y = position[0], position[1]
            if not (is_finite_number(x) and is_finite_number(y)):
                raise ValueError("Polygon ring has a non-finite coordinate")
            point = (float(x), float(y))
            if points and points[-1] == point:
                continue
            points.append(point)
        if len(points) >= 2 and points[0] == points[-1]:
            points.pop()
        if len(points) < 3:
            raise ValueError("Polygon ring has fewer than three distinct vertices")
        area = _ring_area(points)
        if area == 0:
            raise ValueError("Polygon ring has zero area")
        want_positive = index == 0
        if (area < 0) == want_positive:
            points.reverse()
        prepared.append(points)
    return prepared


def _distance_to_segment(point: Point, a: Point, b: Point) -> float:
    px, py = point
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def point_on_ring(point: Point, ring: list[Point], epsilon: float) -> bool:
    for a, b in zip(ring, ring[1:] + ring[:1]):
        if _distance_to_segment(point, a, b) <= epsilon:
            return True
    return False


def point_in_ring(point: Point, ring: list[Point]) -> bool:
    """Even-odd ray cast; the caller handles boundary points separately."""
    x, y = point
    inside = False
    count = len(ring)
    for index in range(count):
        x1, y1 = ring[index]
        x2, y2 = ring[(index + 1) % count]
        if (y1 > y) != (y2 > y):
            if x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                inside = not inside
    return inside


def classify_point(point: Point, polygon: list[list[Point]],
                   epsilon: float = ON_BOUNDARY_EPSILON_DEG) -> str:
    """Return 'inside', 'boundary' or 'outside' for a hole-aware polygon.

    A point in a hole is outside the polygon. A point exactly on either the
    outer or a hole edge is a boundary hit, so assignment remains ambiguous
    rather than counting it in a barangay.
    """
    in_outer = point_in_ring(point, polygon[0])
    in_hole = any(point_in_ring(point, hole) for hole in polygon[1:])
    if any(point_on_ring(point, ring, epsilon) for ring in polygon):
        return "boundary"
    if in_outer and not in_hole:
        return "inside"
    return "outside"


def contains_point(polygon: list[list[Point]], point: Point) -> bool:
    """Interior or outer edge belongs to the province; hole interiors/edges do not."""
    if any(point_on_ring(point, hole, ON_BOUNDARY_EPSILON_DEG) for hole in polygon[1:]):
        return False
    return classify_point(point, polygon, ON_BOUNDARY_EPSILON_DEG) in ("inside", "boundary")


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    # Great-circle distance in km: R * 2 * asin(sqrt(a)) with R = 6371 km.
    # Written with an explicit radius and no division by math.pi so the result
    # cannot drift with how an interpreter rounds pi.
    return EARTH_RADIUS_KM * 2.0 * math.asin(min(1.0, math.sqrt(a)))


# --------------------------------------------------------------------------- #
# Boundaries


@dataclass(frozen=True)
class BarangayBoundary:
    psgc: str
    municipality_psgc: str
    name: str
    municipality: str
    polygons: tuple[tuple[tuple[Point, ...], ...], ...]


@dataclass(frozen=True)
class ProvinceBoundary:
    municipalities: dict[str, tuple[tuple[tuple[Point, ...], ...], ...]]
    municipality_names: dict[str, str]


def _text(value) -> str:
    return "" if value is None else str(value)


def load_barangays(collection: dict | None = None) -> list[BarangayBoundary]:
    if collection is None:
        collection = read_json(BARANGAY_GEOJSON)
    boundaries: list[BarangayBoundary] = []
    seen: set[str] = set()
    for feature in collection.get("features") or []:
        properties = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        # Keep the identifier exactly as published by the boundary snapshot;
        # the generated bundle also stores it as str(...) without stripping.
        psgc = _text(properties.get("adm4_psgc"))
        if not psgc:
            raise SnapshotError("Barangay boundary without adm4_psgc")
        if psgc in seen:
            raise SnapshotError(f"Duplicate barangay PSGC {psgc} in bundled geometry")
        seen.add(psgc)
        coordinates = geometry.get("coordinates")
        kind = geometry.get("type")
        raw_polygons = [coordinates] if kind == "Polygon" else coordinates if kind == "MultiPolygon" else None
        if not raw_polygons:
            raise SnapshotError(f"Barangay {psgc} is not a Polygon or MultiPolygon")
        try:
            polygons = tuple(tuple(tuple(ring) for ring in prepare_polygon(raw)) for raw in raw_polygons)
        except ValueError as error:
            raise SnapshotError(f"Barangay {psgc}: {error}") from None
        boundaries.append(BarangayBoundary(
            psgc=psgc,
            municipality_psgc=_text(properties.get("adm3_psgc")),

            name=_text(properties.get("adm4_en")),
            municipality=_text(properties.get("municipality")),
            polygons=polygons,
        ))
    if not boundaries:
        raise SnapshotError("Bundled barangay geometry is empty")
    return boundaries


def load_province(collection: dict | None = None) -> ProvinceBoundary:
    """Province scope is the union of the bundled municipality polygons."""
    if collection is None:
        collection = read_json(MUNICIPALITY_GEOJSON)
    municipalities: dict[str, tuple[tuple[tuple[Point, ...], ...], ...]] = {}
    names: dict[str, str] = {}
    for feature in collection.get("features") or []:
        properties = feature.get("properties") or {}
        code = _text(properties.get("adm3_psgc")) or _text(feature.get("id"))
        if not code:
            raise SnapshotError("Municipality boundary without an identifier")
        if code in municipalities:
            raise SnapshotError(f"Duplicate municipality {code} in bundled geometry")
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates")
        kind = geometry.get("type")
        raw_polygons = [coordinates] if kind == "Polygon" else coordinates if kind == "MultiPolygon" else None
        if not raw_polygons:
            raise SnapshotError(f"Municipality {code} is not a Polygon or MultiPolygon")
        try:
            municipalities[code] = tuple(
                tuple(tuple(ring) for ring in prepare_polygon(raw)) for raw in raw_polygons
            )
        except ValueError as error:
            raise SnapshotError(f"Municipality {code}: {error}") from None
        names[code] = _text(properties.get("adm3_en"))
    if not municipalities:
        raise SnapshotError("Bundled municipality geometry is empty")
    return ProvinceBoundary(municipalities=municipalities, municipality_names=names)


def load_boundaries_from_geojson(barangays_geojson: dict,
                                 municipalities_geojson: dict) -> tuple[list[BarangayBoundary], ProvinceBoundary]:
    """Load handcrafted/alternate boundary collections instead of the bundled files."""
    return load_barangays(barangays_geojson), load_province(municipalities_geojson)


def point_in_province(province: ProvinceBoundary, point: Point) -> bool:
    return any(
        contains_point(polygon, point)
        for polygons in province.municipalities.values()
        for polygon in polygons
    )


def barangays_containing(barangays: list[BarangayBoundary],
                         point: Point) -> tuple[list[BarangayBoundary], bool]:
    """Containing barangays and whether the point lies exactly on a boundary edge.

    A point on a shared edge is inside neither polygon (it is classified
    ``boundary``), so interior hits are unioned with the polygons whose edge
    carries the point; the caller then reports ambiguity without guessing.
    """
    matches: list[BarangayBoundary] = []
    on_boundary = False
    for barangay in barangays:
        statuses = [classify_point(point, polygon) for polygon in barangay.polygons]
        if "inside" in statuses or "boundary" in statuses:
            matches.append(barangay)
        if "boundary" in statuses:
            on_boundary = True
    return matches, on_boundary


# --------------------------------------------------------------------------- #
# Response validation


@dataclass
class ClinicRecord:
    osm_type: str
    osm_id: int
    tags: dict
    lat: float | None
    lng: float | None
    location_method: str
    active: bool
    version: int | None = None
    timestamp: str | None = None
    changeset: int | None = None
    user: str | None = None
    uid: int | None = None
    source: str = "overpass"

    def to_dict(self) -> dict:
        return {
            "osmType": self.osm_type,
            "osmId": self.osm_id,
            "tags": dict(sorted(self.tags.items())),
            "lat": self.lat,
            "lng": self.lng,
            "locationMethod": self.location_method,
            "active": self.active,
            "version": self.version,
            "timestamp": self.timestamp,
            "changeset": self.changeset,
            "user": self.user,
            "uid": self.uid,
            "source": self.source,
        }


@dataclass
class NormRecord:
    """A normalized clinic plus its assignment results."""

    id: str
    osm_type: str
    osm_id: int
    name: str
    lat: float | None
    lng: float | None
    location_method: str
    tags: dict
    active: bool
    in_province: bool
    barangay_psgc: str | None
    municipality_psgc: str | None
    assignment_status: str
    warnings: list[str] = field(default_factory=list)

    def to_type(self) -> dict:
        return {
            "id": self.id,
            "osmType": self.osm_type,
            "osmId": self.osm_id,
            "name": self.name,
            "lat": self.lat,
            "lng": self.lng,
            "locationMethod": self.location_method,
            "tags": dict(sorted(self.tags.items())),
            "active": self.active,
            "inProvince": self.in_province,
            "barangayPsgc": self.barangay_psgc,
            "municipalityPsgc": self.municipality_psgc,
            "assignmentStatus": self.assignment_status,
            "warnings": list(self.warnings),
        }


def clinic_id(osm_type: str, osm_id: int) -> str:
    return f"{osm_type}/{osm_id}"


def _validate_tags(tags, what: str) -> dict:
    if tags is None:
        return {}
    if not isinstance(tags, dict):
        raise ResponseError(f"{what} has a non-object tags member")
    clean: dict[str, str] = {}
    for key, value in tags.items():
        if not isinstance(key, str) or not isinstance(value, str) or not key:
            raise ResponseError(f"{what} has a non-string tag entry")
        clean[key] = value
    return clean


def _validate_optional_int(element: dict, key: str, what: str) -> int | None:
    value = element.get(key)
    if value is None:
        return None
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ResponseError(f"{what} has an invalid {key}")
    return value


def _validate_optional_text(element: dict, key: str, what: str) -> str | None:
    value = element.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise ResponseError(f"{what} has an invalid {key}")
    return value


def normalize_name(value) -> str:
    """Case/accent/punctuation-insensitive name key used only to flag suspected duplicates."""
    import unicodedata

    if not isinstance(value, str):
        return ""
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return "".join(c for c in stripped if c.isalnum())


def lifecycle_tag_keys(tags: dict) -> list[str]:
    """Lifecycle evidence on an element regardless of whether the base tag is still clinic.

    Recognized forms: ``<state>:amenity=clinic`` / ``<state>:healthcare=clinic``
    and boolean ``<state>=yes`` on an element that also has a base clinic tag.
    """
    keys = [key for key in LIFECYCLE_KEYS if tags.get(key) == CLINIC_VALUE]
    base_clinic = any(tags.get(key) == CLINIC_VALUE for key in ACTIVE_CLINIC_KEYS)
    if base_clinic:
        keys.extend(prefix for prefix in LIFECYCLE_PREFIXES if tags.get(prefix) == "yes")
    return sorted(keys)


def is_active_clinic(tags: dict) -> bool:
    """An active clinic must carry an exact base clinic tag and no lifecycle evidence."""
    base = any(tags.get(key) == CLINIC_VALUE for key in ACTIVE_CLINIC_KEYS)
    return base and not lifecycle_tag_keys(tags)


def is_lifecycle_clinic(tags: dict) -> bool:
    return bool(lifecycle_tag_keys(tags))


def parse_element(element) -> ClinicRecord | None:
    """Validate one Overpass element; return None when it is not a clinic record."""
    if not isinstance(element, dict):
        raise ResponseError("Element is not an object")
    osm_type = element.get("type")
    if osm_type not in OSM_TYPES:
        raise ResponseError(f"Element has an unsupported type {osm_type!r}")
    osm_id = element.get("id")
    if not isinstance(osm_id, int) or isinstance(osm_id, bool) or osm_id <= 0:
        raise ResponseError(f"{osm_type} has a missing or invalid id {osm_id!r}")
    what = f"{osm_type} {osm_id}"
    tags = _validate_tags(element.get("tags"), what)
    active = is_active_clinic(tags)
    if not active and not is_lifecycle_clinic(tags):
        return None

    if osm_type == "node":
        lat, lng = element.get("lat"), element.get("lon")
        if lat is None and lng is None:
            # Missing location is retained as unlocated, never invented.
            return ClinicRecord(
                osm_type=osm_type, osm_id=osm_id, tags=tags, lat=None, lng=None,
                location_method="unavailable", active=active,
                version=_validate_optional_int(element, "version", what),
                timestamp=_validate_optional_text(element, "timestamp", what),
                changeset=_validate_optional_int(element, "changeset", what),
                user=_validate_optional_text(element, "user", what),
                uid=_validate_optional_int(element, "uid", what),
            )
        if lat is None or lng is None:
            raise ResponseError(f"node {osm_id} has only one coordinate")
        if not (is_finite_number(lat) and is_finite_number(lng)):
            raise ResponseError(f"node {osm_id} has non-finite coordinates")
        lat, lng = float(lat), float(lng)
        location_method = "node"
    else:
        lat = lng = None
        location_method = "unavailable"
        center = element.get("center")
        if center is not None:
            if not isinstance(center, dict):
                raise ResponseError(f"{what} has a non-object center")
            c_lat, c_lng = center.get("lat"), center.get("lon")
            if c_lat is None or c_lng is None:
                raise ResponseError(f"{what} has an incomplete center")
            if not (is_finite_number(c_lat) and is_finite_number(c_lng)):
                raise ResponseError(f"{what} has a non-finite center")
            # Documented Overpass bounding-box centre, not a surveyed entrance.
            lat, lng = float(c_lat), float(c_lng)
            location_method = "overpass-center"
    if lat is not None and not (-90.0 <= lat <= 90.0):
        raise ResponseError(f"{what} has a latitude outside [-90, 90]")
    if lng is not None and not (-180.0 <= lng <= 180.0):
        raise ResponseError(f"{what} has a longitude outside [-180, 180]")

    version = _validate_optional_int(element, "version", what)
    changeset = _validate_optional_int(element, "changeset", what)
    uid = _validate_optional_int(element, "uid", what)
    timestamp = _validate_optional_text(element, "timestamp", what)
    if timestamp is not None:
        try:
            datetime.datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            raise ResponseError(f"{what} has an invalid timestamp") from None
    return ClinicRecord(
        osm_type=osm_type,
        osm_id=osm_id,
        tags=tags,
        lat=lat,
        lng=lng,
        location_method=location_method,
        active=active,
        version=version,
        timestamp=timestamp,
        changeset=changeset,
        user=_validate_optional_text(element, "user", what),
        uid=uid,
    )


@dataclass
class ParsedResponse:
    elements_total: int
    records: list[ClinicRecord]
    osm_base: str | None
    overpass_version: str | None


def parse_response(payload, *, allow_empty: bool = False) -> ParsedResponse:
    if not isinstance(payload, dict):
        raise ResponseError("Response is not a JSON object")
    if "remark" in payload:
        raise ResponseError(f"Overpass returned an incomplete response: {payload['remark']}")
    for error_key in ("error", "errors"):
        if error_key in payload:
            raise ResponseError(f"Overpass returned an error response ({error_key})")
    if payload.get("partial"):
        raise ResponseError("Overpass returned a partial response")
    elements = payload.get("elements")
    if not isinstance(elements, list):
        raise ResponseError("Response has no elements list")
    if not elements and not allow_empty:
        raise ResponseError("Response has no clinic candidates; pass --allow-empty to confirm an observation of zero")
    if not elements and allow_empty:
        osm3s = payload.get("osm3s")
        version = payload.get("version")
        if not isinstance(osm3s, dict) or not isinstance(osm3s.get("timestamp_osm_base"), str):
            raise ResponseError("Empty response is incomplete; missing osm3s.timestamp_osm_base")
        if not (
            (isinstance(version, str) and version)
            or (is_finite_number(version) and float(version) >= 0)
        ):
            raise ResponseError("Empty response is incomplete; missing Overpass version")
    records: list[ClinicRecord] = []
    for element in elements:
        record = parse_element(element)
        if record is not None:
            records.append(record)
    if elements and not records:
        # Overpass returned elements, but none carries an exact clinic tag.
        raise ResponseError(
            f"Response has no element with an exact clinic tag ({len(elements)} non-clinic element(s))"
        )
    osm3s = payload.get("osm3s") or {}
    if not isinstance(osm3s, dict):
        raise ResponseError("Response has a non-object osm3s member")
    osm_base = osm3s.get("timestamp_osm_base")
    if osm_base is not None and not isinstance(osm_base, str):
        raise ResponseError("Response has an invalid osm3s.timestamp_osm_base")
    version = payload.get("version")
    if not (
        version is None
        or (isinstance(version, str) and version)
        or (is_finite_number(version) and float(version) >= 0)
    ):
        raise ResponseError("Response has an invalid version member")
    return ParsedResponse(
        elements_total=len(elements),
        records=records,
        osm_base=osm_base,
        overpass_version=None if version is None else str(version),
    )


def query_lifecycle_keys(query: str) -> list[str]:
    """Lifecycle clinic keys actually requested by an Overpass query string."""
    import re

    requested = set(re.findall(r'"([A-Za-z0-9_:]+)"\s*=\s*"clinic"', query))
    return sorted(key for key in LIFECYCLE_KEYS if key in requested)


def query_omitted_lifecycle(query: str) -> list[str]:
    requested = set(query_lifecycle_keys(query))
    return [key for key in LIFECYCLE_KEYS if key not in requested]


def expected_query_hash(query: str) -> str:
    return sha256_bytes(query.encode("utf-8"))


# --------------------------------------------------------------------------- #
# Deduplication


@dataclass
class DedupResult:
    unique: list[ClinicRecord]
    duplicate_ids: list[dict]
    suspected: list[dict]


def deduplicate(records: list[ClinicRecord]) -> DedupResult:
    """Deduplicate by (type, id) only; flag distinct elements that look identical."""
    unique: list[ClinicRecord] = []
    by_identity: dict[tuple[str, int], ClinicRecord] = {}
    duplicate_ids: list[dict] = []
    suspected: list[dict] = []
    seen_pairs: set[tuple[str, str]] = set()
    for record in records:
        identity = (record.osm_type, record.osm_id)
        previous = by_identity.get(identity)
        if previous is None:
            by_identity[identity] = record
            unique.append(record)
            continue
        if previous.tags != record.tags or (previous.lat, previous.lng) != (record.lat, record.lng):
            raise ResponseError(
                f"Conflicting duplicate definitions for {record.osm_type} {record.osm_id}"
            )
        duplicate_ids.append({"id": clinic_id(*identity)})

    # Suspected duplicates: distinct elements with the same normalized
    # non-empty name whose centres lie within SUSPECTED_DUPLICATE_METERS.
    # Reported only; nothing is merged or dropped.
    located = [r for r in unique if r.lat is not None and r.lng is not None]
    for index, record in enumerate(located):
        for other in located[index + 1:]:
            name = normalize_name(record.tags.get("name"))
            if not name or name != normalize_name(other.tags.get("name")):
                continue
            distance = haversine_km(record.lat, record.lng, other.lat, other.lng)
            if distance > SUSPECTED_DUPLICATE_METERS / 1000.0:
                continue
            ids = sorted([clinic_id(record.osm_type, record.osm_id),
                          clinic_id(other.osm_type, other.osm_id)])
            pair = (ids[0], ids[1])
            if pair not in seen_pairs:
                seen_pairs.add(pair)
                suspected.append({
                    "name": record.tags.get("name", ""),
                    "normalizedName": name,
                    "ids": ids,
                    "distanceMeters": round(distance * 1000.0, 1),
                })
    return DedupResult(
        unique=unique,
        duplicate_ids=sorted(duplicate_ids, key=lambda item: item["id"]),
        suspected=sorted(suspected, key=lambda item: (item["ids"], item["distanceMeters"])),
    )


# --------------------------------------------------------------------------- #
# Normalization and assignment


def check_clinic_invariants(clinic: dict) -> list[str]:
    """Cross-field invariants required by the frozen TypeScript contract."""
    problems: list[str] = []
    identifier = clinic.get("id")
    status = clinic.get("assignmentStatus")
    lat, lng = clinic.get("lat"), clinic.get("lng")
    in_province = clinic.get("inProvince")
    if (lat is None) != (lng is None):
        problems.append(f"{identifier}: lat/lng must be both set or both null")
    if lat is None:
        if status != "unlocated":
            problems.append(f"{identifier}: no location but assignmentStatus is {status!r}")
        if in_province:
            problems.append(f"{identifier}: unlocated record claims inProvince")
        if clinic.get("barangayPsgc") or clinic.get("municipalityPsgc"):
            problems.append(f"{identifier}: unlocated record carries a barangay/municipality")
        if clinic.get("locationMethod") != "unavailable":
            problems.append(f"{identifier}: no location but locationMethod is not 'unavailable'")
        return problems
    if status == "unlocated":
        problems.append(f"{identifier}: located record marked unlocated")
    if status == "outside":
        if in_province:
            problems.append(f"{identifier}: outside assignment claims inProvince")
        if clinic.get("barangayPsgc") or clinic.get("municipalityPsgc"):
            problems.append(f"{identifier}: outside assignment carries a barangay/municipality")
    elif status == "ambiguous":
        if not in_province:
            problems.append(f"{identifier}: ambiguous assignment outside the province")
        if clinic.get("barangayPsgc"):
            problems.append(f"{identifier}: ambiguous assignment names a barangay (must not guess)")
    elif status == "assigned":
        if not in_province:
            problems.append(f"{identifier}: assigned clinic outside the province")
        if not clinic.get("barangayPsgc"):
            problems.append(f"{identifier}: assigned clinic has no barangay")
        if not clinic.get("municipalityPsgc"):
            problems.append(f"{identifier}: assigned clinic has no municipality")
    else:
        problems.append(f"{identifier}: unknown assignmentStatus {status!r}")
    if clinic.get("locationMethod") not in ("node", "overpass-center"):
        problems.append(
            f"{identifier}: located record has locationMethod {clinic.get('locationMethod')!r}"
        )
    return problems


def check_clinic_snapshot_invariants(clinics: list[dict]) -> list[str]:
    """Every clinic plus id uniqueness across the whole snapshot."""
    problems: list[str] = []
    seen: set[str] = set()
    for clinic in clinics:
        identifier = clinic.get("id")
        if identifier in seen:
            problems.append(f"{identifier}: duplicate clinic id in the snapshot")
        seen.add(identifier)
        problems.extend(check_clinic_invariants(clinic))
    return problems


def assign(record: ClinicRecord, barangays: list[BarangayBoundary], province: ProvinceBoundary,
           suspected_ids: set[str]) -> NormRecord:
    warnings: list[str] = []
    identifier = clinic_id(record.osm_type, record.osm_id)
    if not record.active:
        keys = ", ".join(lifecycle_tag_keys(record.tags))
        warnings.append(f"Inactive: clinic lifecycle tags {keys}; excluded from clinic counts and factors.")
    if record.osm_type != "node":
        if record.location_method == "overpass-center":
            warnings.append("Location is the Overpass bounding-box centre of the element, not an entrance.")
        else:
            warnings.append("No location available in the Overpass response; record kept unlocated.")
    if identifier in suspected_ids:
        warnings.append("Suspected duplicate of another distinct OSM element at the same location and name.")

    name = record.tags.get("name", "")
    lat, lng = record.lat, record.lng
    if lat is None or lng is None:
        return NormRecord(identifier, record.osm_type, record.osm_id, name, None, None,
                          "unavailable", record.tags, record.active, False, None, None,
                          "unlocated", warnings)

    point: Point = (lng, lat)
    in_province = point_in_province(province, point)
    if not in_province:
        return NormRecord(identifier, record.osm_type, record.osm_id, name, lat, lng,
                          record.location_method, record.tags, record.active, False, None, None,
                          "outside", warnings)

    matches, on_boundary = barangays_containing(barangays, point)
    if on_boundary or len(matches) > 1:
        candidates = ", ".join(sorted(b.psgc for b in matches))
        detail = "lies on a barangay boundary" if on_boundary else "falls inside more than one barangay"
        if candidates:
            detail += f" ({candidates})"
        warnings.append(
            f"Ambiguous barangay assignment: location {detail}; excluded from barangay clinic counts "
            "but kept eligible for clinic distance."
        )
        municipality = matches[0].municipality_psgc if len(matches) == 1 else None
        return NormRecord(identifier, record.osm_type, record.osm_id, name, lat, lng,
                          record.location_method, record.tags, record.active, True, None, municipality,
                          "ambiguous", warnings)

    if not matches:
        # Inside the province polygon union but outside every barangay polygon
        # (for example unmodeled enclaves). The join is unknown, so it stays
        # ambiguous rather than being labelled outside the province.
        warnings.append(
            "Located inside the Laguna polygon union but in no barangay polygon; assignment is "
            "unknown, no barangay was guessed, and the record stays eligible for clinic distance."
        )
        return NormRecord(identifier, record.osm_type, record.osm_id, name, lat, lng,
                          record.location_method, record.tags, record.active, True, None, None,
                          "ambiguous", warnings)

    only = matches[0]
    return NormRecord(identifier, record.osm_type, record.osm_id, name, lat, lng,
                      record.location_method, record.tags, record.active, True, only.psgc,
                      only.municipality_psgc, "assigned", warnings)


def build_counts(records: list[ClinicRecord], clinics: list[NormRecord],
                 dedup: DedupResult, parsed: ParsedResponse) -> dict[str, int]:
    by_id = {c.id: c for c in clinics}
    active_records = [by_id[clinic_id(r.osm_type, r.osm_id)] for r in records if r.active]
    inactive_records = [by_id[clinic_id(r.osm_type, r.osm_id)] for r in records if not r.active]
    active = active_records

    def count_active(predicate) -> int:
        return sum(1 for c in active if predicate(c))

    counts = {
        # Raw candidates = returned elements. Non-clinic elements are ignored
        # rather than rejected, so records + nonClinicElements + duplicates
        # reconciles with candidates exactly.
        "candidates": parsed.elements_total,
        "nonClinicElements": parsed.elements_total - len(records) - len(dedup.duplicate_ids),
        "records": len(records),
        "locatedRecords": sum(1 for r in records if r.lat is not None),
        "active": len(active_records),
        "inactive": len(inactive_records),
        "duplicates": len(dedup.duplicate_ids),
        "suspectedDuplicates": len(dedup.suspected),
        "nodeRecords": sum(1 for r in records if r.osm_type == "node"),
        "wayRecords": sum(1 for r in records if r.osm_type == "way"),
        "relationRecords": sum(1 for r in records if r.osm_type == "relation"),
        "activeNodes": sum(1 for r in active if r.osm_type == "node"),
        "activeWays": sum(1 for r in active if r.osm_type == "way"),
        "activeRelations": sum(1 for r in active if r.osm_type == "relation"),
        "activeAssigned": count_active(lambda c: c.assignment_status == "assigned"),
        "activeInProvince": count_active(lambda c: c.in_province),
        "activeLocatedInProvince": count_active(lambda c: c.in_province and c.lat is not None),
        "activeOverpassCenters": count_active(lambda c: c.location_method == "overpass-center"),
        "activeUnlocated": count_active(lambda c: c.location_method == "unavailable"),
        "activeAmbiguous": count_active(lambda c: c.assignment_status == "ambiguous"),
        "activeOutside": count_active(lambda c: c.assignment_status == "outside"),
        "activeUnassignedInsideProvince": count_active(
            lambda c: c.assignment_status == "ambiguous" and c.barangay_psgc is None
            and c.in_province and c.lat is not None
            and any("in no barangay polygon" in w for w in c.warnings)
        ),
        "inactiveLocatedInProvince": sum(1 for c in inactive_records if c.in_province and c.lat is not None),
        "inactiveAssigned": sum(1 for c in inactive_records if c.assignment_status == "assigned"),
        "distanceEligible": sum(
            1 for c in active_records if c.lat is not None and c.assignment_status != "outside"
        ),
        "assignedMunicipalities": len({c.municipality_psgc for c in active_records if c.barangay_psgc}),
    }
    return counts


# --------------------------------------------------------------------------- #
# Snapshot assembly


@dataclass
class Snapshot:
    normalized: dict
    clinics: list[dict]
    clinic_snapshot: dict
    provenance: dict
    normalized_bytes: bytes
    raw_bytes: bytes
    provenance_bytes: bytes

    def documents(self) -> dict[str, bytes]:
        """Byte-identical payloads of the three snapshot files (keyed by file name)."""
        return {
            RAW_PATH.name: self.raw_bytes,
            PROVENANCE_PATH.name: self.provenance_bytes,
            NORMALIZED_PATH.name: self.normalized_bytes,
        }


def build_snapshot(raw_bytes: bytes, provenance: dict, *, allow_empty: bool = False,
                   barangays: list[BarangayBoundary] | None = None,
                   province: ProvinceBoundary | None = None) -> Snapshot:
    """Validate a raw response and produce the three snapshot documents."""
    try:
        text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise ResponseError("Response is not valid UTF-8") from None
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as error:
        raise ResponseError(f"Response is not valid JSON: {error}") from None
    parsed = parse_response(payload, allow_empty=allow_empty)
    dedup = deduplicate(parsed.records)
    if barangays is None:
        barangays = load_barangays()
    if province is None:
        province = load_province()

    suspected_ids = {extra for group in dedup.suspected for extra in group["ids"]}
    clinics = [assign(record, barangays, province, suspected_ids) for record in dedup.unique]
    clinics.sort(key=lambda c: (c.osm_type, c.osm_id))
    counts = build_counts(dedup.unique, clinics, dedup, parsed)
    clinic_documents = [c.to_type() for c in clinics]
    invariant_problems = check_clinic_snapshot_invariants(clinic_documents)
    if invariant_problems:
        raise ResponseError(
            "Assignment produced a clinic record that violates the contract: "
            + "; ".join(invariant_problems[:5])
            + (f" (and {len(invariant_problems) - 5} more)" if len(invariant_problems) > 5 else "")
        )
    query = provenance.get("query")

    warnings: list[str] = []
    if dedup.duplicate_ids:
        warnings.append(
            f"{len(dedup.duplicate_ids)} repeated Overpass element(s) were collapsed by (type, id)."
        )
    if dedup.suspected:
        warnings.append(
            f"{len(dedup.suspected)} pair(s) of distinct OSM elements share a normalized name within "
            f"{SUSPECTED_DUPLICATE_METERS:g} m; they are flagged in provenance, not merged."
        )
    if counts["activeLocatedInProvince"] == 0:
        warnings.append("No active located clinic falls inside Laguna; distance scoring is unavailable.")
    if counts["activeUnlocated"]:
        warnings.append(f"{counts['activeUnlocated']} active candidate(s) had no location and stay unlocated.")
    if counts["activeOverpassCenters"]:
        warnings.append(
            f"{counts['activeOverpassCenters']} active clinic(s) use the Overpass bounding-box centre "
            "of a way/relation rather than an entrance."
        )
    if counts["activeAmbiguous"]:
        warnings.append(
            f"{counts['activeAmbiguous']} active clinic(s) have an ambiguous barangay assignment and are "
            "excluded from barangay counts."
        )
    if counts["activeUnassignedInsideProvince"]:
        warnings.append(
            f"{counts['activeUnassignedInsideProvince']} active clinic(s) lie inside the province polygon "
            "union but outside every barangay polygon; they are ambiguous, stay distance-eligible and "
            "are not counted for any barangay."
        )
    if isinstance(query, str):
        missing = query_omitted_lifecycle(query)
        if missing:
            warnings.append(
                "The acquisition query did not request these lifecycle selectors, so related records "
                f"may be absent rather than inactive: {', '.join(missing)}."
            )

    raw_sha = sha256_bytes(raw_bytes)
    retrieved_at = provenance.get("retrievedAt")
    # Assignment depends on both boundary files, so hash their combination.
    boundary_sha = sha256_bytes(
        (sha256_file(BARANGAY_GEOJSON) + ":" + sha256_file(MUNICIPALITY_GEOJSON)).encode("ascii")
    )

    clinic_snapshot = {
        "valid": True,
        "retrievedAt": retrieved_at,
        "osmBaseTimestamp": parsed.osm_base,
        "endpoint": provenance.get("endpoint"),
        "query": query,
        "attribution": ATTRIBUTION,
        "license": LICENSE,
        "rawSha256": raw_sha,
        "boundarySha256": boundary_sha,
        "counts": dict(sorted(counts.items())),
        "warnings": warnings,
    }
    normalized = {
        "format": DATA_FORMAT,
        "clinics": clinic_documents,
        "clinicSnapshot": clinic_snapshot,
        "provenance": {
            "bbox": provenance.get("bbox"),
            "querySha256": expected_query_hash(query) if isinstance(query, str) else None,
            "overpassVersion": parsed.overpass_version,
            "duplicateIds": dedup.duplicate_ids,
            "suspectedDuplicates": dedup.suspected,
            "records": [record.to_dict() | {"id": clinic_id(record.osm_type, record.osm_id)}
                        for record in dedup.unique],
        },
    }
    provenance_document = build_provenance_document(
        raw_bytes,
        endpoint=provenance.get("endpoint"),
        query=query,
        retrieved_at=retrieved_at,
        bbox=provenance.get("bbox"),
        osm_base=parsed.osm_base,
        overpass_version=parsed.overpass_version,
        counts=clinic_snapshot["counts"],
        warnings=warnings,
        duplicate_ids=dedup.duplicate_ids,
        suspected=dedup.suspected,
    )
    return Snapshot(
        normalized=normalized,
        clinics=normalized["clinics"],
        clinic_snapshot=clinic_snapshot,
        provenance=provenance_document,
        normalized_bytes=dump_json(normalized).encode("utf-8"),
        raw_bytes=raw_bytes,
        provenance_bytes=dump_json(provenance_document).encode("utf-8"),
    )


def invalid_clinic_snapshot(reason: str) -> dict:
    return {
        "valid": False,
        "retrievedAt": None,
        "osmBaseTimestamp": None,
        "endpoint": None,
        "query": None,
        "attribution": ATTRIBUTION,
        "license": LICENSE,
        "rawSha256": None,
        "boundarySha256": None,
        "counts": {},
        "warnings": [reason],
    }


def build_provenance_document(raw_bytes: bytes, *, endpoint, query, retrieved_at, bbox,
                              osm_base, overpass_version, counts, warnings,
                              duplicate_ids, suspected) -> dict:
    """Provenance document: actual acquisition inputs plus boundary and readiness hashes.

    ``query`` is stored verbatim as it was sent/imported; it is never rewritten
    to the canonical form, so an authentic staged acquisition keeps its own text.
    """
    return {
        "format": DATA_FORMAT,
        "endpoint": endpoint,
        "query": query,
        "querySha256": expected_query_hash(query) if isinstance(query, str) else None,
        "retrievedAt": retrieved_at,
        "osmBaseTimestamp": osm_base,
        "overpassVersion": overpass_version,
        "bbox": list(bbox) if bbox is not None else None,
        "license": LICENSE,
        "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
        "attribution": ATTRIBUTION,
        "copyright": OSM_COPYRIGHT,
        "rawFile": RAW_PATH.name,
        "rawBytes": len(raw_bytes),
        "rawSha256": sha256_bytes(raw_bytes),
        "normalizedFile": NORMALIZED_PATH.name,
        "boundary": {
            "barangaysFile": "frontend/public/assets/geo/laguna_barangays.geojson",
            "barangaysSha256": sha256_file(BARANGAY_GEOJSON),
            # Province scope is the municipality polygon union, so record it too.
            "municipalitiesFile": "frontend/public/assets/geo/laguna_municipalities.geojson",
            "municipalitiesSha256": sha256_file(MUNICIPALITY_GEOJSON),
        },
        "counts": counts,
        "warnings": warnings,
        "duplicateIds": duplicate_ids,
        "suspectedDuplicates": suspected,
    }


# --------------------------------------------------------------------------- #
# Guard rails


@dataclass
class Guard:
    ok: bool
    messages: list[str]


def guard_replacement(current_counts: dict | None, candidate_counts: dict,
                      old_raw_sha: str | None, new_raw_sha: str,
                      allow_empty: bool = False, allow_large_drop: bool = False) -> Guard:
    """Decide whether a validated candidate may replace the current snapshot.

    Empty and large-drop confirmations are independent: ``allow_empty`` alone
    accepts a complete zero-clinic observation, while ``allow_large_drop`` can
    never authorize an empty snapshot. For non-empty updates, compare retained
    unique clinic records and warn when active/in-province coverage also falls.
    """
    messages: list[str] = []
    before_records = (current_counts or {}).get("records", 0)
    after_records = candidate_counts.get("records", 0)
    empty = after_records <= 0
    if empty and not allow_empty:
        return Guard(False, ["Replacement would contain zero retained clinics; pass --allow-empty to confirm."])
    if current_counts is not None and old_raw_sha != new_raw_sha and before_records > 0:
        if empty:
            messages.append("Replacement records a valid observation of zero retained clinics (--allow-empty).")
        else:
            declines = []
            for key, label in (
                ("records", "retained clinic records"),
                ("active", "active clinics"),
                ("activeLocatedInProvince", "active located in-province clinics"),
            ):
                before = current_counts.get(key, 0)
                after = candidate_counts.get(key, 0)
                if before > 0 and after < before:
                    drop = (before - after) / before
                    declines.append((key, label, before, after, drop))
            retained = next((item for item in declines if item[0] == "records"), None)
            if retained and retained[4] > LARGE_DROP_FRACTION and not allow_large_drop:
                _, label, before, after, drop = retained
                return Guard(False, [
                    f"{label.capitalize()} would drop from {before} to {after} "
                    f"({drop:.0%}); pass --allow-large-drop to confirm."
                ])
            for _, label, before, after, drop in declines:
                note = f"{label.capitalize()} dropped from {before} to {after} ({drop:.0%})."
                if label == "retained clinic records" and drop > LARGE_DROP_FRACTION:
                    note = note[:-1] + " and was explicitly allowed with --allow-large-drop."
                messages.append(note)
    if empty:
        messages.append("Replacement has zero retained clinics and was explicitly allowed with --allow-empty.")
    return Guard(True, messages)


# --------------------------------------------------------------------------- #
# Snapshot consistency


@dataclass
class SnapshotDiagnosis:
    present: bool
    issues: list[str]
    raw_bytes: bytes | None = None
    provenance: dict | None = None
    normalized: dict | None = None

    @property
    def consistent(self) -> bool:
        return self.present and not self.issues


def diagnose_snapshot(asset_dir: Path = ASSET_DIR) -> SnapshotDiagnosis:
    """Check the persistent raw/provenance/normalized triple for internal consistency."""
    paths = {
        "raw": Path(asset_dir) / RAW_PATH.name,
        "provenance": Path(asset_dir) / PROVENANCE_PATH.name,
        "normalized": Path(asset_dir) / NORMALIZED_PATH.name,
    }
    existing = {name: path for name, path in paths.items() if path.exists()}
    if not existing:
        return SnapshotDiagnosis(False, ["No clinic snapshot is installed."])
    issues: list[str] = []
    missing = sorted(set(paths) - set(existing))
    if missing:
        issues.append(f"Snapshot is incomplete; missing {', '.join(paths[n].name for n in missing)}.")

    def load(name):
        try:
            return read_json(paths[name])
        except SnapshotError as error:
            issues.append(str(error))
            return None

    raw_bytes = existing["raw"].read_bytes() if "raw" in existing else None
    provenance = load("provenance") if "provenance" in existing else None
    normalized = load("normalized") if "normalized" in existing else None
    if raw_bytes is not None and provenance is not None:
        if provenance.get("rawSha256") != sha256_bytes(raw_bytes):
            issues.append("Raw file checksum does not match the provenance rawSha256.")
        if provenance.get("rawBytes") not in (None, len(raw_bytes)):
            issues.append("Raw file size does not match the provenance rawBytes.")
    if normalized is not None and raw_bytes is not None:
        snapshot = normalized.get("clinicSnapshot") or {}
        if snapshot.get("rawSha256") != sha256_bytes(raw_bytes):
            issues.append("Normalized clinicSnapshot.rawSha256 does not match the raw file.")
    if normalized is not None and provenance is not None:
        snapshot = normalized.get("clinicSnapshot") or {}
        if snapshot.get("retrievedAt") != provenance.get("retrievedAt"):
            issues.append("Normalized and provenance retrieval times differ.")
        if snapshot.get("query") != provenance.get("query"):
            issues.append("Normalized and provenance queries differ.")
        if (snapshot.get("counts") or {}) != (provenance.get("counts") or {}):
            issues.append("Normalized and provenance counts differ.")
    if normalized is not None and normalized.get("format") != DATA_FORMAT:
        issues.append(f"Normalized snapshot format is not {DATA_FORMAT}.")
    return SnapshotDiagnosis(True, issues, raw_bytes=raw_bytes, provenance=provenance,
                             normalized=normalized)


def acquire(query: str, endpoint: str = OVERPASS_ENDPOINT, timeout: int = HTTP_TIMEOUT) -> bytes:
    """Perform the single explicit network request. Never called by --check."""
    import urllib.error
    import urllib.parse
    import urllib.request

    request = urllib.request.Request(
        endpoint,
        data=urllib.parse.urlencode({"data": query}).encode("utf-8"),
        headers={"User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = response.read()
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise ResponseError(f"Overpass request failed: {error}") from None
    return payload


def new_provenance_inputs(*, endpoint: str, query: str, retrieved_at: str | None = None) -> dict:
    """Inputs for build_snapshot when the raw payload has just been acquired."""
    return {
        "endpoint": endpoint,
        "query": query,
        "retrievedAt": retrieved_at or utc_now(),
        "bbox": list(province_bbox()),
    }
