# Datasets and generated assets

The application uses bundled Laguna geography and facility evidence, with
synthetic morbidity, weather, demand, and service effects. See
[SOURCES.md](SOURCES.md) for provenance and licenses and
[methodology](../docs/methodology.md) for scoring and model assumptions.

## Source inputs

| File | Contents |
| --- | --- |
| `laguna_barangays.csv` | 681 demographic and synthetic morbidity records |
| `laguna_barangay_risk_index.csv` | 681 barangay hazard-screening records |
| `laguna_hospitals.csv` | 66 facility source records, including verification and capacity notes |

Source names join to the bundled 2023 PSGC boundary snapshot. PSGC identifiers
keep repeated community names distinct. The importer validates unique joins,
coordinates, capacities, and metadata. Boundary area, rather than rounded source
area, is used for density. Explicit name aliases handle Cabuyao/Cabuyew in Liliw
and Pook/Pooc in Santa Rosa.

Of the 66 hospital records, 56 are both verified and located; these support map
markers, nearest-hospital lists, and HNI distance calculations. Other records
remain in source registers. Missing bed counts stay unavailable. Verification
labels and bed counts describe source evidence, not live availability.

Hazard screening uses `noah-point-maximum-v1` with unverified coverage. Zero is
not verified safety. Four unresolved barangay indices stay missing; they are
not imputed. Hazard context is separate from HNI.

## Fixed OpenStreetMap clinics

The offline snapshot in `frontend/public/assets/osm/` retains raw observations,
normalized records, and acquisition metadata. It contains 385 retrieved elements,
including 98 active, located clinics inside Laguna. Outside-province and inactive
records remain inspectable but are excluded from active map/scoring use.

Candidates require `amenity=clinic` or `healthcare=clinic`. Element IDs remove
exact duplicates; nearby distinct records are flagged rather than merged.
Way/relation locations use Overpass bounding-box centers, not verified entrances.
Barangay assignment uses polygons; ambiguous assignments are not guessed. Counts
reflect mapping observations, not verified capacity or absence of healthcare.

## Regeneration and checks

Run from `omcm/` after reviewing source changes:

```sh
python3 frontend/scripts/import-laguna-datasets.py
python3 frontend/scripts/import-laguna-datasets.py --check
python3 frontend/scripts/import-osm-clinics.py --check
cd frontend
node scripts/prepare-laguna-planning.mjs
node scripts/prepare-laguna-planning.mjs --check
node scripts/clinic-sensitivity.mjs
node scripts/clinic-sensitivity.mjs --check
```

The browser bundle is `frontend/src/data/laguna-datasets.json`; the provincial
planning export is `backend/data/laguna-planning.json`. Keep generated outputs
consistent with their sources. Ordinary import checks and tests do not refresh
OSM data. An explicit network refresh is separate:

```sh
python3 frontend/scripts/import-osm-clinics.py --refresh
python3 frontend/scripts/import-laguna-datasets.py
```

Review the importer's diagnostics before confirming an empty snapshot or a large
record drop. A failed refresh must not replace the previous valid snapshot.
After refreshing, regenerate the provincial export and sensitivity report, then
run the checks and application tests.

The separate Los Baños–Bay road fixture is in `backend/data/pilot.json` with its
browser copy in `frontend/public/assets/pilot/`. It does not limit provincial
planning coverage. Keep `OMCM_DATASET=pilot` for the existing backend adapter.
