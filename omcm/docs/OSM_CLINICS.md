# OSM clinic snapshot: scope, provenance and limitations

## What qualifies

A fixed clinic candidate is an OpenStreetMap **node, way or relation** with exactly
`amenity=clinic` **or** `healthcare=clinic`. Public, private and specialty clinics
are included when those tags match. A clinic-like name alone does not qualify;
other healthcare facility types are not silently included. Lifecycle-prefixed
clinic tags are retained for audit, but closed/disused/abandoned/demolished,
construction, proposed and other explicitly inactive lifecycle records are
excluded from active mapping and scoring.

Records are deduplicated only by OSM element identity `(type, id)`. Nearby
same-name distinct elements are flagged as suspected duplicates, not automatically
merged: they could represent distinct services, entrances or duplicated mapping.
Facility capacity, opening hours, services, operating status, ownership and
access are **not independently verified**.

## Geometry and joins

- Nodes use their mapped coordinates. Ways and relations use the documented
  Overpass `center` (bounding-box center), **not an entrance or road-access point**.
  Missing locations remain missing; coordinates are never invented.
- Laguna scope uses the union of bundled municipality polygons. Acquisition's
  bounding box is only a retrieval window, not province membership.
- Barangay joins use bundled PSGC polygons, including MultiPolygons and holes.
  Ambiguous boundary/overlap assignments never receive a guessed PSGC and do not
  enter barangay clinic counts.
- Located candidates inside Laguna can support nearest-clinic distance even
  when their barangay assignment is unresolved; this limitation is flagged.
- Nearest clinics can be in another barangay but must remain inside Laguna.
  Clinics across the province border are excluded. This can overstate access
  gaps near the border (**province-edge bias**).

## Offline data and reproducibility

The [clinic importer](../frontend/scripts/import-osm-clinics.py) validates the raw
Overpass response and writes an inspectable raw response, normalized records and
acquisition provenance under the browser's static assets. Checksums bind raw data
and geometry to the derived snapshot; [.gitattributes](../../.gitattributes)
preserves byte-pinned evidence against Windows line-ending conversion. Acquisition query, endpoint, retrieval
time, OSM database base time, assignment counts and warnings are retained.
The [CSV/bundle importer](../frontend/scripts/import-laguna-datasets.py) embeds
validated records and snapshot metadata in the browser bundle. It never fetches
Overpass. Browsing, scoring, ordinary import checks and tests are offline with
respect to clinic acquisition; basemap tiles are a separate optional network
resource.

Only an explicit refresh may contact Overpass. A timeout, malformed or partial
response must preserve the previous snapshot. Unexpectedly empty replacement
requires an explicit empty confirmation; a large candidate drop also requires
confirmation. Refresh uses staged replacement with rollback rather than silently
mixing raw data from one acquisition with normalized/provenance from another.
Never describe an unavailable or invalid snapshot as a verified zero clinics.

## Snapshot currently included

The [recorded provenance](../frontend/public/assets/osm/osm-clinics-provenance.json)
retains the actual acquisition query and endpoint, retrieved
**2026-10-23T17:32:47.575509+00:00** with OSM database base
**2026-10-23T17:31:38Z**. It is an inspectable historical snapshot, not a live
clinic registry. The [raw response](../frontend/public/assets/osm/osm-clinics-raw.json)
and [normalized records](../frontend/public/assets/osm/osm-clinics-normalized.json)
are retained alongside it.

- 385 retrieved and retained OSM elements; 382 base-active candidates and 3 inactive lifecycle records.
- 98 active located clinics inside Laguna, each assigned to one barangay, across 19 municipalities.
- 284 active candidates outside Laguna are retained for audit but excluded from mapping and scoring.
- No in-province ambiguous or unlocated active record in this snapshot; those states remain supported.
- 103 active candidates across the entire retrieval window use way/relation bounding-box centers, not entrances.

These counts describe OSM observations. Neither a missing mapped clinic nor a
municipality absent from the clinic list establishes real-world absence.
The acquisition did not request every lifecycle selector now supported by the
importer; its provenance explicitly lists the omitted selectors rather than
rewriting the true query.

### Reproduce and validate offline

From `omcm/frontend` (use the available Python executable):

```powershell
python scripts/import-laguna-datasets.py
python scripts/import-laguna-datasets.py --check
python scripts/import-osm-clinics.py --check
python -m unittest discover -s ../tests/data -p 'test_*.py'
node scripts/clinic-sensitivity.mjs
node scripts/clinic-sensitivity.mjs --check
```

Explicit network refresh only:

```powershell
python scripts/import-osm-clinics.py --refresh
python scripts/import-laguna-datasets.py
```

For a previously acquired local response, use `--provenance PATH` with its
acquisition document; raw-only import requires a verified matching sidecar.
Inspect diagnostics before using `--allow-empty` or `--allow-large-drop`.
Neither confirmation authorizes malformed/error responses or fabricated metadata.

## Healthcare need policy

[The Balanced scorer](../frontend/src/services/healthcareNeed.ts) uses:

| Factor | Production weight |
| --- | --- |
| Synthetic morbidity | 35% |
| Nearest verified hospital distance | 30% |
| Population density | 15% |
| Municipality income class | 10% |
| Nearest active located OSM clinic distance | 5% |
| OSM clinic provision deficit | 5% |

Distance factors are province-wide tied percentiles of straight-line Haversine
kilometers. More distance adds estimated need. Provision is
`100 − percentile(clinicCount / population × 10,000)`; more mapped clinics per
resident lowers estimated need. Tied rates share average percentile; all equal
rates (including all zeros), or a single valid rate, receive neutral 50.

Urban/rural and disaster risk remain context, outside HNI. Missing hazard data
therefore excludes no HNI weight. An unavailable/invalid snapshot excludes both
clinic weights. Invalid population excludes provision; no eligible clinic location
excludes distance. Remaining weights are rescaled and the score/rank labeled
provisional. A valid zero count is **zero OSM observations**, not verified absence.

These are policy assumptions, not fitted clinical coefficients. Hospital and
clinic terms overlap as proxies for access. OSM completeness varies, centers and
barangay points may be imprecise, and straight-line distances are not travel time.
Morbidity is synthetic and hazard coverage is unverified. The separate municipal
browser heuristic and server pilot retain their own formulas; fixed OSM clinics
never become simulated mobile clinics, approved sites or published schedules.

## Attribution and license

Clinic source: **© OpenStreetMap contributors**, available under
[Open Data Commons Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
See [OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright).
Keep attribution and acquisition provenance with redistributed clinic data.
Boundary sources/licensing and supplied CSV limitations are documented separately
in [dataset documentation](../datasets/README.md).

Reference semantics: [amenity=clinic](https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dclinic),
[healthcare=clinic](https://wiki.openstreetmap.org/wiki/Tag:healthcare%3Dclinic),
and [Overpass output/center documentation](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#out).
