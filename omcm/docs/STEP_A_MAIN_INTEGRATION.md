# Step A integration with main

Date: 2026-10-24. Integration branch: `fix/merge-main-step-a`.

The completed Step A and UI branch, `layout/refine-hospital-source-details`
at `789309a`, was confirmed published before integration. This merge incorporates
main at `9f7d6ee`, including `0d485d4` (Paete forest-land restrictions) and
`9f7d6ee` (shared facility SVG markers). Main itself is not changed by publishing
this review branch.

## Conflict resolution and compatibility changes

Paths below are relative to `omcm/`.

| File | Logic changed during integration |
| --- | --- |
| `frontend/src/features/map/components/HospitalMarkers.tsx` | Resolve both conflict sections by retaining Step A's `isEligibleHospital` filtering and main's shared hospital SVG, 32-pixel dimensions, marker title and alt text. This keeps historical/unverified facilities off the care-location layer. |
| `frontend/src/features/map/components/MapLegend.tsx` | Retain the incoming SVG keys and restore explicit OSM fixed-facility and numbered mobile-clinic descriptions. Keep the verified-hospital label preserved by the automatic merge. |
| `tests/frontend/googleClinicLayer.test.tsx` | Add Google Size/Point mocks required by the incoming icons; identify hospital and OSM layers by their artwork rather than title punctuation; account for the independent forest marker/listener; preserve eligibility, safe-popup, toggle and cleanup coverage. Match main's facility-name titles and replace a vacuous resize assertion with a check that loading fixed-clinic data does not open a popup. |
| `frontend/scripts/hospital-hni-browser.mjs` | Also require 56 hospital SVG icons and the gray Paete forest polygon/landmark alongside the existing full desktop/mobile Step A browser checks. |
| `docs/STEP_A_MAIN_INTEGRATION.md` | Record the complete file inventory, merge decisions, validation and remaining scope. |

## Files brought in from main

These are groupmates' existing changes, incorporated rather than newly designed
in this integration. HospitalMarkers and MapLegend are also covered above.

| File | Incoming behavior retained |
| --- | --- |
| `.env.example` | Main's comment cleanup for the optional Google Routes settings. |
| `frontend/public/assets/geo/README.md` | Explain the approximate Paete planning exclusion and its generation. |
| `frontend/scripts/build-paete-forest-land.py` | Offline generation of the approximate forest-land exclusion geometry. |
| `frontend/src/data/paete-forest-land.json` | Bundled Paete exclusion geometry. |
| `frontend/src/features/filters/LayerToggles.tsx` | Incoming fixed-clinic toggle wording. |
| `frontend/src/features/map/components/ClinicMarkers.tsx` | Numbered shared mobile-clinic SVG markers. |
| `frontend/src/features/map/components/ForestLandMarker.tsx` | Gray forest overlay, landmark, explanatory tooltip and popup. |
| `frontend/src/features/map/components/HospitalMarkers.tsx` | Shared hospital icons and accessible marker labels, combined with Step A eligibility. |
| `frontend/src/features/map/components/LagunaGoogleMap.tsx` | Shared facility icons and the Paete overlay/landmark; preserve Step A hospital filtering and selection behavior. |
| `frontend/src/features/map/components/LagunaLeafletMap.tsx` | Mount the forest overlay alongside the existing map and selection layers. |
| `frontend/src/features/map/components/MapLegend.tsx` | Shared SVG facility keys, combined with explicit fixed/mobile descriptions. |
| `frontend/src/features/map/components/OsmClinicMarkers.tsx` | Shared fixed-clinic SVG markers and facility-name titles. |
| `frontend/src/features/map/components/SimulationLayers.tsx` | Shared active/recommended mobile-clinic SVG markers. |
| `frontend/src/features/map/components/facilityIcons.ts` | Shared SVG artwork and data URL helpers. |
| `frontend/src/features/optimization/ManualPlacement.tsx` | Explain unavailable staging sites in the dropdown. |
| `frontend/src/features/simulation/SimulationPanel.tsx` | Disable geographically unavailable deployment options and explain them. |
| `frontend/src/services/forecasting/interventions.ts` | Exclude restricted locations from frontend simulation deployment candidates. |
| `frontend/src/services/lagunaData.ts` | Exclude restricted browser-optimizer sites and replace obsolete manual overrides with eligible recommendations. |
| `frontend/src/services/mapLandmarks.test.ts` | Retain three forest-exclusion geography, browser allocation and simulation tests. |
| `frontend/src/services/mapLandmarks.ts` | Shared frontend point-in-exclusion checks and landmark metadata. |
| `frontend/src/services/maps.ts` | Permit polygon and multipolygon feature collections for point containment. |
| `frontend/src/styles/map-workspace.css` | Incoming forest and SVG marker styles alongside retained search/details styles. |
| `frontend/src/types/google.maps.d.ts` | Google marker icon label-origin and label-class declarations. |

## Validation

- Frontend `npm run lint`: passed.
- Frontend `npm test`: 74 tests passed, including the incoming forest tests and retained Step A regressions.
- Frontend `npm run build`: passed; the existing large-chunk advisory remains.
- Backend `.venv/bin/python -m pytest -q`: 39 tests passed; the existing Starlette/httpx deprecation warning remains.
- Frontend `npm run test:hni`: passed against an isolated Vite server and headless Chrome; 681 barangay polygons, 56 eligible hospital SVG markers, gray forest overlay/landmark, desktop/mobile search alignment, place details, public detail restrictions and no page errors.
- Browser screenshots are generated under `frontend/test-results/` and are not committed.

The browser suite uses the existing demo-mode input fixtures and blocks external
map tiles. Google-specific layer behavior is covered with a mocked Maps SDK;
this is not a live Google API verification. Backend API/solver checks run against
the existing isolated test fixtures.

## Scope retained for Step B

No hospital source data, canonical HNI calculation, backend solver, model,
database schema or dependency was changed here. Keep `OMCM_DATASET=pilot`.
The current map optimizer still runs in the browser and XGBoost is absent.
Main's forest restrictions are currently enforced in frontend planning, not the
backend optimizer. These remain part of the proposed Step B work and are not
claimed as completed by this merge.

## Browser review

Start the existing frontend with `npm run dev` and open `http://127.0.0.1:5173/`.
Inspect the hospital icons and nearby-care source details in the public view;
in Admin View, search Pangil/Dambo to inspect the blue municipality selection,
HNI details and aligned search. Inspect Paete's gray Sierra Madre overlay and
the fixed/mobile facility legend. All interactions stay on the map screen.
