# Map-first interface acceptance report

Implemented in the existing application with React Leaflet, plain CSS and the
existing Python optimizer. No dependencies added. The only request-field addition
is the user-approved optional `municipality_outbreak_multipliers`; bundled JSON
schemas and geographic coordinates are unchanged.

## Geography and sources

All 30 LGUs (24 municipalities, 6 cities) come from the repository's
[philippines-json-maps](https://github.com/faeldon/philippines-json-maps) snapshot,
commit `8eeead560246863c8c820c31ca6fbca81a279477`, under MIT. Source manifest and
license: `frontend/public/data/geo/source.json` and `LICENSE.txt`. The municipality
file matches its recorded SHA256. These are authentic simplified 2023 upstream
boundaries, not a new approximation or a cadastral survey. The provincial footprint
is the combined coverage of all 30 municipal geometries; the inverse mask uses
their actual rings, including islands and holes. No rectangular province substitute
or fallback geography is generated. Navigation uses the real footprint's bounds,
and the mask hides everything outside its polygon coverage. Only the bundled
verified geometry controls navigation/masking; uploaded overrides cannot expand it.
A missing/invalid/non-30-feature dataset stops the administrative planner with an
explicit error. Road geometry is existing OSRM/OSM evidence, © OSM contributors,
ODbL, with provenance in `datasets/SOURCES.md`.

## Browser acceptance

All paths below start at `/` unless stated. “Yes” refers to headless Chromium,
1440×1080 desktop and 390×844 mobile, not an external AI provider or real GPS feed.
Source paths are relative to `omcm/`.

| Requirement | Status | Files | Exact click path | Browser-verified |
| --- | --- | --- | --- | --- |
| Real Laguna boundaries, locked navigation and outside mask | DONE | `frontend/src/components/LagunaMask.tsx`, `Heatmap.tsx`, `services/maps.ts` | Open `/` → drag map → repeatedly zoom out; source/license in map caption. Missing-file failure also tested. | Yes |
| Map, left detail panel, floating cards and legend | DONE | `frontend/src/components/AdminWorkspace.tsx`, `styles/app.css` | Click municipality → close details; open/collapse floating panels. | Yes |
| Municipality search, direct selection, highlight and zoom | DONE | `frontend/src/components/MapView.tsx`, `Heatmap.tsx` | Search “Los Baños” → click result; or click municipality polygon. Search “Manila” returns no matches. | Yes |
| Four heatmaps and matching legend | DONE | `frontend/src/components/MapView.tsx`, `mapMetrics.ts` | Population density / Flood risk / Morbidity / Overall need chips. | Yes |
| Hospital/medical facility toggle | DONE | `frontend/src/components/MapView.tsx` | Hospitals & medical facilities checkbox. | Yes |
| Clinic locations and simulated tracking status | DONE | `frontend/src/components/ClinicTracker.tsx`, `AdminWorkspace.tsx` | Clinic Optimization → set K → Generate recommendation → clinic markers show SIMULATED. | Yes |
| Optimization K, recommend, accept and manual override | DONE | `frontend/src/components/PlanningControls.tsx`, `pages/AdminDashboard.tsx`, `pages/Schedules.tsx` | Clinic Optimization → K → Generate recommendation → Accept recommendation & review. For overrides: Place clinics manually at candidate sites → choose sites → Generate recommendation. | Yes |
| Municipal flood/morbidity, roads, animation and clinic details | PARTIAL | `frontend/src/components/AdminWorkspace.tsx`, `services/roadSegments.ts`, `backend/app/services/road_segments.py`, `backend/optimization.py`, `risk_scoring.py` | Simulation Mode: Off → On → choose Bay/Los Baños → sliders → Apply municipality conditions. Click a visible road segment; Undo/Clear. Play deployment → Pause → speed → click a vehicle or fleet card → details. Reset municipality/all; switch Off to restore planning baseline. | Yes, all implemented interactions; pilot coverage only |
| Grounded conversational chatbot, history, collapse and no-key fallback | DONE | `frontend/src/components/ExplanationAssistant.tsx`, `backend/app/services/chat.py`, `backend/main.py` | AI chatbot: Closed → type message → Send message → follow-up → Collapse chatbot → reopen retains history. | Yes, template mode; live provider not verified |
| Need weights/sensitivity, maximal-covering optimizer, baseline, approve/publish and public view preserved | DONE | `frontend/src/components/NeedWeights.tsx`, `pages/AdminDashboard.tsx`, `pages/Schedules.tsx`, `pages/PublicDashboard.tsx`, `backend/optimization.py` | Clinic Optimization → scroll to Healthcare need weights / Top-K sensitivity; generate → baseline card → Accept recommendation & review → Approve and publish. Public View → select approved deployment date. | Yes |
| No unrelated features/pages added | DONE | `frontend/src/components/AdminWorkspace.tsx`, `main.tsx` | Only map controls and in-place proposal/scenario/chat panels in admin. Public View keeps `/public`. | Yes |

## Limits and blocked portions

- Only Bay and Los Baños have the existing 20 barangay health records, eight
  synthetic candidate sites and 168 OSRM route legs. Other municipalities remain
  selectable with real boundaries and explicit “No data”/unsupported simulation
  messages. Province-wide populated heatmaps and simulation are blocked by absent
  inputs. No data was invented to fill these gaps.
- General blocking covers every displayed segment of this supplied road network,
  not every road in Laguna. Blocked segments invalidate affected modeled routes;
  safe existing sites/routes are recomputed. The pilot cannot supply arbitrary
  diversions, and the UI explicitly warns rather than inventing routes.
- Flood sliders are synthetic exposure assumptions; route exclusions use the
  supplied synthetic footprints, not official inundation extents.
- External AI requests need server provider/model/HTTPS URL/API credentials.
  No live-provider call was made. Standard-library transport is stub-tested;
  no-key template conversations are browser-verified. No key reaches the client.
- Existing authenticated publication is preserved. Scenario recomputation requires
  the Python API and existing administrator sign-in. Browser-only mode reports
  this limitation; its chatbot can still use the local template.
- Basemap tiles require internet. Tracking is simulated; no GPS source exists.

## Validation

The e2e entry point now runs `tests/map-first.mjs`; `tests/e2e.mjs` is retained as
historical coverage for the superseded multi-page simulator. New browser coverage
includes proposal generation, manual overrides, authenticated publication,
sensitivity, independent municipality changes/reset, actual pointer road blocking,
undo, route playback/pause/speed, clinic inspection, chat turns/history/template,
publication isolation, mobile map visibility, public read-only view and missing
geographic data failure. Screenshots are under ignored `frontend/test-results/`.
Final command results are recorded in `docs/VERIFICATION.md`.

Final deployment decisions belong to LGU health officers.
