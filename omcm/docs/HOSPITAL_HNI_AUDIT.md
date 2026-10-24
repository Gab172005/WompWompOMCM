# Step A — hospital dataset and HNI map audit

> **Current hospital/HNI evidence — 2026-10-24:** [Global audit](GLOBAL_AUDIT.md) and
> [current verification](VERIFICATION.md) supersede the historical branch names,
> push commands, test counts and pilot-only limitations in older sections below.
> The active admin UI stays on `/admin`; connected planning covers all 681
> barangays and requires backend authentication. The agreed HNI percentages and
> both trained XGBoost artifacts are preserved.

Current policy update: [the agreed Balanced HNI](BALANCED_HNI.md) supersedes
historical v3/seven-factor weights in this record. Active HNI uses six factors
with no disaster-risk contribution; the earlier audit details below are history.

Date: 2026-10-24. Review branch: `feat/omcm-refinements`.
Baseline: `a850cef`. Scope: hospital evidence, baseline HNI consistency,
municipality map summaries and the regression checks needed to validate them.

## Hospital evidence

The source CSV and generated JSON bundle have not been changed. Source labels
describe verification in the supplied snapshot; no live licensing, operational
status, patient records or bed availability was checked or invented.

| Check | Result |
| --- | ---: |
| Full hospital register | 66 |
| Source DOH/PhilHealth verification labels | 57 |
| Supplied coordinate pairs | 61 |
| Verified and located — HNI/map eligible | 56 |
| Located but unverified or historical | 5 |
| Unlocated records retained | 5 |
| Missing bed counts retained as null | 9 |
| Duplicate normalized municipality/name identities | 0 |
| Duplicate supplied coordinate pairs | 0 |
| Invalid or incomplete coordinate pairs | 0 |
| Located records outside their recorded municipal polygons | 0 |

Previously, hospital HNI distances used 56 verified, located records, while the
map plotted all 61 located records. Its public legend called all of them
verified, including the reported closed San Jose Hospital in Calamba. The map,
nearby lists and HNI now share verified/finite-WGS84 eligibility. All 66 records
remain inspectable in the municipal hospital register. The importer rejects
duplicate identities, incomplete/invalid coordinates and negative bed counts.
Bed counts, definitions, dates and notes remain unchanged.

## HNI findings and corrections

The existing seven-factor `barangay-healthcare-need-v3` model is retained:
morbidity 25%, hospital distance 30%, disaster risk 15%, density 10%, municipal
income class 10%, OSM clinic distance 5%, and OSM clinic provision deficit 5%.
Missing factors are omitted with available-weight rescaling. The four unresolved
disaster indices remain provisional at 85% input weight, rather than zero risk.
Distance candidates permit access across barangay and municipality boundaries
within Laguna. Raw code-point IDs break exact distance ties consistently.

Municipality headline scores and rankings formerly used the separate four-factor
allocation heuristic, which could disagree with the barangay HNI heatmap. They
now roll up the displayed barangay scores using population weights, rounded to
one decimal. Contributions use the same population denominator, with an omitted
factor contributing no term for its barangay; the input is not imputed as zero.
All-missing factor contributions remain unavailable. Coverage is the
population-weighted average of barangay coverage. Municipality scores/ranks are
provisional if any constituent barangay is provisional; equal rounded scores
share competition ranks. Density in these details uses combined boundary area.

The existing municipal allocation algorithm and backend road pilot are preserved.
Their separate formula is clearly labeled in the allocation panel, assistant,
and expandable municipal details. Missing municipality heatmap inputs now use
the unavailable gray palette instead of being colored as zero need.

## Exact file and logic changes

All paths below are relative to `omcm/`. Existing implementation changes refine
groupmates' code; recovered tests are identified with their source revisions.

| File | Change and reason |
| --- | --- |
| `frontend/scripts/import-laguna-datasets.py` | Extract hospital register conversion and validate identities, coordinate pairs and bed counts before bundling. Existing output is byte-identical. |
| `frontend/src/services/healthcareNeed.ts` | Share hospital eligibility, Haversine distance ordering and stable ID ties across HNI and care lists. All 681 complete HNI output records match pre-change HEAD exactly. |
| `frontend/src/services/providedData.ts` | Restrict map hospitals to HNI evidence; derive municipal HNI scores/contributions/coverage/ranks and boundary-area density from existing barangays. |
| `frontend/src/features/map/components/HospitalMarkers.tsx` | Apply shared eligibility defensively in Leaflet. |
| `frontend/src/features/map/components/LagunaGoogleMap.tsx` | Apply the same eligibility defensively in Google Maps. |
| `frontend/src/features/map/components/MapLegend.tsx` | Label the admin hospital layer as verified, matching the public legend and actual markers. |
| `frontend/src/features/map/components/HeatmapLayer.tsx` | Keep unavailable municipality data null so it renders gray. |
| `frontend/src/features/municipalities/BarangayPanel.tsx` | Share nearest-hospital evidence and tie handling; explain cross-municipality access; use matching distance precision. |
| `frontend/src/features/public/PublicSidePanel.tsx` | Use the same hospital ordering and straight-line distance precision in the public care list. |
| `frontend/src/features/municipalities/MunicipalityMetrics.tsx` | Display canonical HNI rollup, factor contributions, provisional status and coverage; retain separate allocation details under an explicit label. |
| `frontend/src/features/municipalities/MunicipalityRanking.tsx` | Rank and display canonical municipal HNI, including ties and provisional marks. |
| `frontend/src/features/municipalities/MunicipalityPanel.tsx` | Name the expandable ranking consistently. |
| `frontend/src/features/municipalities/HealthcareNeedMethod.tsx` | Explain shared hospital evidence and municipal HNI aggregation; distinguish dated hospital capacities from OSM limitations. |
| `frontend/src/features/optimization/OptimizationPanel.tsx` | Clarify that the existing allocation heuristic differs from map HNI; algorithm unchanged. |
| `frontend/src/features/chatbot/ChatbotPanel.tsx` | Label the assistant's existing municipal allocation score explicitly so it is not confused with map HNI. |
| `frontend/package.json` | Add `test:hni` using the existing Playwright dependency. |
| `frontend/scripts/hospital-hni-browser.mjs` | Verify the real map, care locations, HNI colors/details/rollups, provisional coverage, historical register and desktop/mobile rendering. |
| `tests/frontend/healthcareNeed.test.ts` | Recover from `a850cef^`; fix stale missing-factor, distance tie, floating-point and coverage assertions against the documented v3 formula. |
| `tests/frontend/providedData.test.ts` | Recover from `a850cef^`; correct the snapshot count key and assert 56 eligible markers while retaining all 66 records. |
| `tests/frontend/barangayRanking.test.tsx` | Recover from `a850cef^`; update the nearby-hospital description expectation. |
| `tests/frontend/googleClinicLayer.test.tsx` | Recover from `a850cef^`; add verified hospital marker, popup and toggle cleanup coverage alongside retained layer regressions. |
| `tests/frontend/hospitalHni.test.tsx` | Add shared eligibility, all-barangay nearest-hospital parity, public care list, Leaflet marker, legend, missing-color, and municipality rollup/ranking tests. |
| `tests/backend/conftest.py` | Recover isolated test data, temporary SQLite and authentication fixtures from `b98e727^`. |
| `tests/backend/fixtures/barangays.csv` | Recover the synthetic 20-barangay test fixture from `b98e727^`. |
| `tests/backend/fixtures/metadata.json` | Recover synthetic fixture metadata from `b98e727^`. |
| `tests/backend/fixtures/network.json` | Recover synthetic hospital/site/road test evidence from `b98e727^`. |
| `tests/backend/test_api.py` | Recover API validation, authentication and schedule isolation regressions from `b98e727^`. |
| `tests/backend/test_engines.py` | Recover risk scoring, capacity, exclusions and sensitivity regressions from `b98e727^`. |
| `tests/backend/test_pilot.py` | Recover directed-road constraints, fixture consistency and deterministic allocation checks from `b98e727^`. |
| `tests/backend/test_hospital_data.py` | Add hospital source/bundle parity, counts, municipality containment, importer rejection and offline bundle reproducibility tests. |
| `datasets/SOURCES.md` | Restore the required source-guide entry point, linking current provenance and limitations. |
| `datasets/README.md` | Document hospital eligibility, municipal rollups and current validation commands. |
| `docs/ARCHITECTURE.md` | Describe shared hospital evidence and derived HNI summaries without changing storage/API contracts. |
| `README.md` | Document current test availability and the new browser check. |
| `docs/HOSPITAL_HNI_AUDIT.md` | Record this audit, complete change inventory, validation and deferred scope. |

## Validation

- `npm run lint`: passed.
- `npm test`: 64 tests passed across six suites, including the existing 14 simulation tests.
- `npm run build`: TypeScript and Vite passed; existing large-bundle advisory remains.
- `OMCM_DATASET=pilot .venv/bin/python -m pytest -q` from `backend/`: 39 tests passed; existing Starlette/httpx deprecation warning remains.
- `python3 frontend/scripts/import-laguna-datasets.py --check` from `omcm/`: source/bundle parity and offline clinic provenance passed.
- `npm run test:hni`: desktop (1440×1000) and mobile (390×844) Leaflet browser checks passed, with 681 polygons, 56 verified hospital markers and no page JavaScript errors. Screenshots: `frontend/test-results/hospital-hni-{desktop,mobile}.png` (ignored artifacts).
- Direct comparison against pre-change `HEAD` scorer: all 681 full HNI records match exactly, including scores, factors, contributions, distances and ranks.
- Google Maps layer validation uses mocks; a live Google key was not used. Basemap tiles are excluded from the browser check; bundled geographic data is used.
- Visual inspection confirmed an existing mobile legend/detail-panel overlap. The Step A mobile check covers correct content and no horizontal document overflow, not collision-free layout. The broader layout repair remains Step D.
- `git diff --check`: clean.

The initial frontend install was incomplete (`zustand` could not resolve).
`npm ci --no-audit --no-fund` repaired local dependencies from the existing
lockfile, with no library/version or lockfile changes. The initial backend
pytest command collected no tests (exit 5); recovering existing regressions
and adding importer coverage restored meaningful verification.

## Browser review

Run the existing frontend with `npm run dev`. Public View shows the 56 verified
hospital markers. Open **Admin View**, sign in through the existing flow, and
search **Pangil**: its headline HNI is the barangay rollup, with two provisional
barangays. Select **Dambo** from the ranking to compare HNI, coverage and nearest
hospital with the map. Expand **Municipality HNI ranking** to compare towns.
Search **City of Calamba**, select a barangay, and expand its **Hospital
register**: the reported closed San Jose record remains there without a marker.

## Deferred to the requested later steps

Step B still needs optimizer review and XGBoost integration. Step C still needs
backend clinic-impact deductions: the current six-factor browser simulation
leaves HNI unchanged and reduces UHNI instead. Step D still needs the broader
public/admin access and layout review. Step E presentation materials should
describe only verified behavior. No simulation logic, authentication, routes,
database schemas, published schedules, source CSVs or generated data were changed
in Step A. Historical suites not recovered here are not claimed as passing.
