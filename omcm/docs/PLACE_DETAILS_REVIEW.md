# Place details and search presentation

Date: 2026-10-24. Branch: `layout/refine-place-details`, based on `06ee323`.
Scope: the user's requested visual, text and context improvements to place
details and search suggestions. Existing scoring, datasets, auth, routes,
optimization, simulation and publication behavior are retained.

## Presentation changes

- Place headers distinguish province, city, municipality and barangay context,
  with a geographic subtitle and a clear return action.
- The need card emphasizes the actual index value, province-wide rank, available
  input weight and provisional status. It explains that higher scores mean
  greater relative planning need; complete input weight does not imply clinical
  validation. A null score never receives a zero-valued need meter.
- Population, density, households and mock morbidity use compact icon cards.
  Existing displayed source precision is preserved for barangay morbidity and
  municipal disaster risk.
- The three largest existing contributions are shown as point values with
  comparison bars and short factor explanations. Bars compare contributions
  against the largest displayed contribution; they are not percentages or
  predictions. No weights or factor values are recomputed.
- Nearby care uses the same verified/located hospital eligibility and stable
  distance ordering established in Step A. Cards distinguish the closest record,
  municipality, straight-line distance, source bed count and expandable source
  record/date. Empty municipal registers remain explicitly dataset gaps, not
  claims that care does not exist. Capacity is not presented as live availability.
- Detailed factor inputs, OSM records/provenance, hazard screening, hospital
  registers, adjacency and geographic/source references remain available through
  native expandable sections. The separate allocation heuristic stays labeled.
- Public place details reuse the geographic header and nearby-care cards but
  never render the admin HNI score card or contributor bars. Existing approved
  schedule and advisory behavior remains unchanged.
- Search suggestions distinguish cities, municipalities and barangays using
  icons/type tags, population and municipal context. The results scroll
  independently of the result count and keyboard guide. Existing keyboard
  selection, repeated searches, normalized matching and stable search positioning
  are preserved. Accessible city labels now correctly identify a city.
- On phones, the details panel can expand for reading and collapse to restore
  map context. Expansion is local presentation state and makes room by hiding
  the redundant selected-place card until the panel collapses.

All visuals use existing plain CSS, React and lucide-react. No dependency, data
model, database or source dataset changes were made. This is a presentation
refinement, not completion of the pending optimizer/XGBoost or clinic-impact work.

## Exact file inventory

Paths are relative to `omcm/`. Existing groupmates' components are refined rather
than replaced with a new application or library.

| File | What changed and why |
| --- | --- |
| `frontend/src/features/municipalities/PlaceDetails.tsx` | Add reusable place headers, score/status cards, key facts, top contributor bars, nearby-care/source cards and the mobile expand control. |
| `frontend/src/features/municipalities/MunicipalityPanel.tsx` | Present city/municipality context and a styled province-return header; retain barangay selection and planning actions. |
| `frontend/src/features/municipalities/MunicipalityMetrics.tsx` | Present the existing rollup in the shared score/fact/driver/care layout and move all seven contribution details into an expander. |
| `frontend/src/features/municipalities/BarangayPanel.tsx` | Reorganize existing content around overview and nearby care; preserve detailed inputs, clinic evidence, hazard screening, registers and sources in labeled expanders. |
| `frontend/src/features/municipalities/BarangayRanking.tsx` | Improve ranking copy and row hierarchy with separate province-rank and HNI labels, preserving ranks, filters, pagination and actions. |
| `frontend/src/features/municipalities/MunicipalitySearch.tsx` | Add typed place suggestions, population context, a result count, a separate scrolling options group, clearer empty-state copy and keyboard guidance. |
| `frontend/src/features/municipalities/MapSelectionStatus.tsx` | Align the selected-place type label with cities as well as municipalities/barangays. |
| `frontend/src/features/municipalities/HealthcareNeedMethod.tsx` | Apply the shared disclosure appearance to the unchanged scoring-method explanation. |
| `frontend/src/components/layout/SidePanel.tsx` | Use descriptive panel titles and add local mobile expand/collapse state. |
| `frontend/src/features/public/PublicSidePanel.tsx` | Reuse geographic/nearby-care presentation and mobile expansion, keeping HNI/planning UI out of the public view. |
| `frontend/src/styles/map-workspace.css` | Style headers, cards, bars, disclosures, ranking rows, search suggestions and mobile expansion; maintain fixed search and map layout. |
| `tests/frontend/barangayRanking.test.tsx` | Adapt existing provenance-access checks to the new expander and nearby-care heading while retaining scoring/evidence assertions. |
| `frontend/scripts/hospital-hni-browser.mjs` | Verify typed suggestions, public HNI isolation, source/factor expansion, contributor meters, mobile expansion and existing HNI/map flows; capture visual artifacts. |
| `docs/PLACE_DETAILS_REVIEW.md` | Record the design, exact changed-file/logic inventory, validation and scope. |

## Verification

- `npm run lint`: passed.
- `npm test`: 71 tests passed across seven suites.
- `npm run build`: TypeScript and Vite passed, with the existing bundle-size advisory.
- `OMCM_DATASET=pilot .venv/bin/python -m pytest -q` from `backend/`: 39 passed,
  with the existing Starlette/httpx deprecation warning.
- `npm run test:hni`: desktop and mobile browser flow passed: actual 681
  barangay polygons, 56 hospital markers, unchanged HNI values/colors/ranks,
  fixed search, refocusing, preserved source/factor access, three displayed
  contributor meters, public HNI isolation and mobile expand/collapse.
- `npm run test:simulation`: existing simulation browser regression passed,
  including Day 30 and mobile layout.
- `git diff --check`: clean.

Visual review used the ignored artifacts under `frontend/test-results/`:
`place-search-dropdown.png`, `place-barangay-details.png`,
`place-public-details.png`, `place-details-mobile-expanded.png`, and
`hospital-hni-desktop.png` / `hospital-hni-mobile.png`. The browser uses actual
bundled geometry and excludes external street tiles; live Google Maps was not
part of this visual verification.

Review in the browser: search **Pangil** or **Dambo Pangil**, inspect the need
card and nearby-care section, and expand **All seven factor inputs** or **OSM
clinic records and provenance**. On a phone, use the up/down chevron beside the
panel close button. Public View displays the care guide and published schedule,
without admin need metrics.
