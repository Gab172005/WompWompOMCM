# Search position, place selection and hospital feedback

Date: 2026-10-24. Branch: `fix/search-selection-feedback`, based on Step A
commit `76e1728`. This follow-up addresses the user's Dambo screenshot and
clarification that both search position and search behavior need repair.

## Verified hospital answer

The supplied register has **zero hospital records assigned to Pangil**. That
does not prove a real-world absence. Across Laguna, 56 source-verified, located
hospital records are eligible for the map. Dambo's nearest eligible record is
Siniloan Pioneer General Hospital in Siniloan, approximately **4.56 km straight
line** from the supplied barangay point; it can fall outside a zoomed-in view.
The selected-place card now explains the municipal register's scope, reports
the nearest distance, and offers **Show all 56 hospitals**. That action enables
the hospital layer and fits the province while preserving the selected place.
For municipalities with unverified or unlocated records, the card distinguishes
total register records from verified, located records. No hospital was added,
deleted or reclassified; no dataset or scoring formula changed.

## Behavior repaired

- Search is fixed to the viewport's top-left on desktop and mobile.
- Enter submits a nonempty search, including after Escape closes suggestions.
  Matching tolerates accents, case, spaces and punctuation, so `Dambo Pangil`
  matches `Dambo, Pangil`. Empty or punctuation-only submission opens suggestions
  without silently selecting the first municipality. Invalid searches announce
  that no match was found.
- Clearing search removes both municipality and barangay selection and restores
  the province view. The recenter control also clears both selection levels.
- Searching a municipality closes an open tool panel and reveals its details,
  matching the existing barangay-selection behavior. Repeating the same search
  refits bounds after a manual pan or the province-wide hospital view.
- Leaflet draws the selected municipality with a blue border and white halo
  above barangay shading. Google Maps uses a distinct blue border above the
  barangay layer. The selected barangay remains yellow; HNI colors are preserved.
- A persistent selected-place card remains after the detail panel is closed.
  Its Details button reopens and refocuses the place. The legend identifies the
  selected municipality. On small screens the card gives way to open tool panels.
- Desktop details sit below the selection card. On mobile, panel height and
  map fitting preserve visible geography between controls and details. The
  legend compacts while details are open, avoiding the previously observed
  legend/panel overlap. Full facility keys and attribution return when details
  close; provenance also remains available in the existing barangay details.

The new selection revision counter is transient UI state, excluded from the
existing persistence whitelist. No API, stored dataset, database schema,
authentication or publication contract changes were made. Steps B and C
optimization/simulation algorithms remain untouched.

## Exact changed files

Paths are relative to `omcm/`; these refine existing groupmates' components
and add one selected-place component and focused regression coverage.

| File | Change and reason |
| --- | --- |
| `frontend/src/features/municipalities/MunicipalitySearch.tsx` | Submit searches through a form, normalize punctuation/spacing, announce no matches, and reset viewport when clearing. |
| `frontend/src/features/municipalities/MapSelectionStatus.tsx` | Add selected-place identity, scoped register counts, nearest hospital distance, Details and province-wide hospital actions. |
| `frontend/src/features/municipalities/BarangayPanel.tsx` | Clarify that an empty municipal register refers to the supplied dataset and nearby hospitals can be in other municipalities. |
| `frontend/src/store/useAppStore.ts` | Add transient refocus revisions and align municipality selection with barangay details/tool behavior. |
| `frontend/src/components/layout/AppLayout.tsx` | Expose selection layout state and forward refocus revisions to map renderers. |
| `frontend/src/components/layout/MapControls.tsx` | Mount selected-place feedback next to existing map/search controls. |
| `frontend/src/components/layout/MapNavigation.tsx` | Clear stale barangay selection when recentering Laguna. |
| `frontend/src/features/map/components/mapTypes.ts` | Add an optional internal refocus revision to the map view props. |
| `frontend/src/features/map/components/LagunaLeafletMap.tsx` | Forward refocus revisions to existing map interactions. |
| `frontend/src/features/map/hooks/useMapInteraction.ts` | Refit repeated selections; reserve mobile control/panel space with bounded padding. |
| `frontend/src/features/map/components/MunicipalityLayer.tsx` | Add the blue selected boundary and white halo without changing heatmap fills. |
| `frontend/src/features/map/components/LagunaGoogleMap.tsx` | Match selected-boundary emphasis, repeat-search refitting and mobile padding. |
| `frontend/src/features/map/components/MapLegend.tsx` | Label the selected municipality in public/admin legends. |
| `frontend/src/styles/map-workspace.css` | Anchor search; style and position selection feedback; balance mobile details and map space; compact the mobile legend. |
| `tests/frontend/searchSelection.test.tsx` | Cover keyboard/punctuation search, repeat submission, clearing, no-match feedback, scoped counts and hospital/details actions. |
| `tests/frontend/googleClinicLayer.test.tsx` | Add mocked selected-municipality style/layer-order regression coverage. |
| `frontend/scripts/hospital-hni-browser.mjs` | Extend the browser flow with fixed positioning, blue selection, repeated refocus, hospital reveal, closing/reopening details and mobile overlap checks. |
| `docs/SEARCH_SELECTION_REVIEW.md` | Record the user's hospital answer, verified behavior, exact file inventory and validation. |

## Validation

- `npm run lint`: passed.
- `npm test`: 71 frontend tests passed, including the existing simulation tests.
- `npm run build`: TypeScript/Vite passed; existing large-bundle advisory remains.
- `OMCM_DATASET=pilot .venv/bin/python -m pytest -q` from `backend/`: 39 tests passed; existing Starlette/httpx deprecation warning remains.
- `npm run test:hni`: passed on desktop (1440×1000) and mobile (390×844), with
  681 barangay polygons, 56 hospital markers, no page JavaScript errors,
  matching HNI colors/details, visible selection, stable search placement,
  repeat-search refocus, and no selection-card/panel or legend/panel overlap.
- `npm run test:simulation`: the retained full simulation browser regression
  passed, including Day 30 playback and mobile layout. The hospital/search
  browser flow also verifies that the selection card gives way to the mobile
  simulation panel.
- Google Maps styling is verified with mocks; no live Google key was used.
  Browser checks use actual bundled geometry and Leaflet, excluding street tiles.
- Screenshots: ignored `frontend/test-results/hospital-hni-desktop.png` and
  `hospital-hni-mobile.png`, visually inspected.
- `git diff --check`: clean.

Browser review: open **Admin View**, search **Pangil**, then select **Dambo**.
Close the details panel to see the selection card stay visible. Use **Show all
56 hospitals**, then submit the same search again to return to the place. Clear
search to return to Laguna. The existing search and public-view controls remain
on the same map screen.
