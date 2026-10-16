# Source manifest

No patient-level records are used. **Illustrative synthetic data — not reported
disease cases** applies to every population, age, health, poverty, hospital-access,
capacity, demand, surge and hazard value in the default pilot.

| Asset | Origin / date | License / resolution | Limitations |
| --- | --- | --- | --- |
| Laguna polygons | [philippines-json-maps](https://github.com/faeldon/philippines-json-maps), commit `8eeead560246863c8c820c31ca6fbca81a279477`, 2023 snapshot; already present at audit | Upstream MIT license copied under `frontend/public/assets/geo/LICENSE.txt`; barangay and municipality polygons | Simplified upstream geometry; not an official current cadastral survey. Original source metadata and SHA256 hashes retained. |
| Community seed points and names | Supplied `backend/data/barangays.csv`; [PhilAtlas Laguna list](https://www.philatlas.com/lists/barangays-laguna.html), recorded retrieval 2026-10-15 | Existing user-supplied geographic records; individual source URLs retained in pilot inputs | No population or disease counts were downloaded from this source. Redistribution rights for the supplied CSV were not independently established. Pilot matches exact municipality-qualified names and attaches PSGC from the boundary snapshot. |
| Road geometry and durations | [FOSSGIS OSRM car service](https://routing.openstreetmap.de/about.html), obtained 2026-10-15; exact URLs and response hashes in `pilot.json.provenance` | [OpenStreetMap ODbL 1.0](https://www.openstreetmap.org/copyright), attributed to OSM contributors and OSRM/FOSSGIS; directed road legs | Modeled free-flow routes, not traffic. Road age and real closures are not independently verified. Endpoints are road-snapped. No turn-by-turn operational navigation is promised. |
| Basemap | [OSM standard tiles](https://operations.osmfoundation.org/policies/tiles/), requested interactively at runtime | OSM attribution shown on every map | Requires internet. No bulk tile downloads, offline tile archive, proxy caching or prefetching. Use a suitable tile service/self-hosting if traffic grows. |
| Health / population / age / poverty / hospital access | Deterministic synthetic generator, reference date 2026-10-15 | Illustrative community aggregates, SHA256 seeded by PSGC | Not PSA/DOH reported data. Confidence is synthetic. Fixed normalization scales are not clinically validated. Missing real data is not concealed. |
| Staging sites / depot / capacities | Illustrative road locations, inside the named authentic polygon, snapped by OSRM | Eight candidate points and one illustrative depot | Not verified public facilities; eligibility and daily capacity are demo assumptions. Clinic services are assumed compatible. |
| Flood polygons | Selected authentic barangay boundaries, marked synthetic and assigned moderate/severe scenarios | Community-scale *assumed* inundation footprint | Not UP NOAH, GeoRiskPH, PAGASA or real flood extents. Intersection only establishes consistency with this hypothetical footprint. |
| Road closure | One segment extracted from a real OSRM depot-to-Batong Malake route, 2026-10-15 | Road-segment geometry, synthetic closure condition | No actual closure is asserted. All intersecting fixture routes are removed; no rerouting guarantee. |

## Bundled files and import

- `frontend/public/assets/pilot/pilot.json`: 20 community inputs with PSGC keys,
  source/date/confidence, eight sites, one care-reference example, depot, 168
  road legs, four synthetic flood footprints and one synthetic closure.
- `frontend/public/assets/pilot/barangays.geojson`: the 20 unchanged upstream
  features. The full 681-feature file is retained in `frontend/public/assets/geo`.
- `backend/data/pilot.json`: identical copy for self-contained Python deployment.
- `frontend/scripts/build-road-pilot.py`: reproducible join, validation and import.
- `backend/data/route-cache/`: ignored raw responses; request hashes are bundled.

Rebuild from `omcm` after installing `backend/requirements-import.txt`:

```powershell
backend/.venv/Scripts/python.exe frontend/scripts/build-road-pilot.py
```

The importer uses 21 requests at no more than one per second and reuses local
response files. Do not repeatedly rebuild against the community demonstration
server; set `OMCM_OSRM_URL` to your own compatible service for bulk work. The
[provider policy](https://routing.openstreetmap.de/about.html) requires attribution,
a valid application user agent, limited request rate and no heavy use. The
[OSRM API contract](https://project-osrm.org/docs/v5.24.0/api/) documents returned
geometry, waypoint snapping and duration units.

The route-derived data fixture is distributed under the OSM ODbL attribution
and share-alike obligations; preserve its source manifest on redistribution.
The unrelated synthetic indicators and application code are not OSM assertions.
No Google route content or server-secret map key is included.

## Validation and future real imports

The importer validates nonempty valid polygons, unique PSGC joins, geographic
bounds and candidate point containment. It rejects failed routing responses.
Runtime validation checks identifiers, positive population, coordinates,
route endpoint references and finite durations. Tests verify both fixture copies,
capacity constraints, route exclusions and no duplicate demand accounting.

Replace synthetic inputs only when the supplying LGU can document observation
date, geographic resolution, permitted use and completeness. Suitable sources to
evaluate include [PSA/PSGC](https://psa.gov.ph/classification/psgc),
[DOH](https://doh.gov.ph/), [Geoportal Philippines](https://www.geoportal.gov.ph/),
[GeoRiskPH](https://www.georisk.gov.ph/) and [PAGASA](https://www.pagasa.dost.gov.ph/).
None of those agencies supplied this demo's health/hazard values, and barangay-
level availability is not assumed. Revalidate travel and eligibility before
using any plan operationally.
