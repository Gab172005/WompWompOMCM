# Architecture

The application has a feature-organized React frontend and a FastAPI backend.
The [README](../README.md) is the current directory and route reference.

## Frontend

`main.tsx` renders `app/App.tsx`. `AppProviders` owns the router and error boundary;
`routes.tsx` distinguishes workspace, supporting admin pages and public routes.

`components/layout/AppLayout.tsx` composes the full map canvas, top bar,
municipality intelligence panel, map filters, legend and a mutually exclusive
optimization, simulation or assistant panel. `styles/globals.css` preserves
main's original design and appends responsive workspace rules.

Workspace state lives in Zustand (`store/useAppStore.ts`). The shared
`features/optimization/usePlanningResults.ts` hook derives municipality scores,
fleet recommendations and road disruptions. Transient selection, layers, panels,
manual placements and playback remain in memory. Only the locally accepted
proposal snapshot is persisted to localStorage. Plan input changes invalidate
approval and reset playback. Closing simulation returns the map to baseline;
the configured conditions remain available when simulation reopens.

The Leaflet renderer composes municipality and barangay heatmap styling,
hospital markers, fixed OSM clinic markers, simulated mobile-clinic markers,
road disruptions and routes. The three facility layers have independent toggles.
Fixed OSM facilities never enter mobile clinic selection or approved schedules. Geographic assets live in
`public/assets/geo`. Map interaction and sizing are in `useMapInteraction`.
Google Maps is an optional renderer; no configured key means Leaflet/OSM.
`Modal` uses a native dialog for keyboard focus and Escape handling.

Main's supporting pages remain in their relevant feature folders.
`store/LegacyProvider.tsx` manages their existing API, credentials, drafts,
boundary uploads and public schedules. This provider is mounted only for those
routes; the municipality workspace does not need backend initialization.

## Explicit planning datasets and scoring boundaries

The province-wide barangay layer joins all 681 demographic/hazard records to
PSGC geometry. [The importer](../frontend/scripts/import-laguna-datasets.py)
embeds a validated offline clinic snapshot; [the clinic importer](../frontend/scripts/import-osm-clinics.py)
refreshes it explicitly, not at browser runtime. [The shared scorer](../frontend/src/services/healthcareNeed.ts)
calculates six-factor Balanced HNI with weights 35% morbidity, 30% hospital
distance, 15% density, 10% municipal income class, 5% clinic distance and 5%
clinic provision deficit. Disaster risk and urban/rural are context only.
The 30-day HNI projection reads this same shared weight definition.
Both map engines, barangay details and ranking consume the same records from
[providedData](../frontend/src/services/providedData.ts). Missing factors use
available-weight rescaling; scores are rounded to one decimal before competition
ranking. Clinic counts are mapped observations, not verified absence.

Hospital markers, nearby lists and HNI share one verified/finite-WGS84 eligibility
rule and raw-ID distance tie ordering. All source hospital records remain in the
register, including unverified, reported closed and unlocated facilities.
Municipality headline scores, contributions and rankings are population-weighted
rollups of the same barangay HNI records; incomplete barangays remain provisional.
These are derived display values, with no new dataset or API schema.

The municipality workspace retains testing's 30-municipality illustrative data
and browser priority heuristic (`services/lagunaData.ts`). Its four-factor allocation score
and example route waypoints are separate from the server pilot. The allocation
score is explicitly labeled as a separate heuristic in municipality details,
optimization and assistant explanations; it is not the six-factor Balanced map HNI.

The server-backed fleet pilot retains main's 20 Los Baños–Bay barangay inputs,
eight staging candidates, directed OSRM route fixtures, five-factor risk score,
capacity constraints and Python allocation. Its fixtures are mirrored under
`backend/data` and `frontend/public/assets/pilot` for standalone deployments.
Do not translate a workspace proposal into an approved server schedule: the
identifiers, inputs, routes and scoring contracts differ.

The map's connected **Plan clinics** workflow adds separate province-wide
`/api/planning/*` endpoints. Those use all 681 barangay centroids and adjacency
links derived from shared province data, the agreed Balanced HNI and XGBoost
forecasts with CP-SAT allocation. Links are modeled estimates, not verified
roads, and candidate points are not confirmed clinics. The legacy `/api/*`
pilot endpoints and their route evidence remain available independently.

The new workspace's approval is labeled a local rehearsal. Server publication
requires a server-generated draft and authenticated approval via the retained
schedule workflow. Public routes read approved snapshots, never simulated
positions. The assistant is local and rule-based; it does not call an AI API.

## Backend

`main.py` creates the application, starts the repository and loads data, adds
CORS/compression middleware, and mounts four routers:

| Router | Responsibility |
| --- | --- |
| municipalities | Risk calculations, community/hospital data, analytics, boundaries |
| optimization | Authenticated draft generation |
| simulation | Before/after scenario comparison |
| clinics | Fleet data, auth/health status, schedules, publication and audit |

`config.py` loads the environment and provides shared authentication/date
dependencies. `models/municipality.py`, `clinic.py`, `scenario.py` and `results.py`
contain the existing strict request/response contracts.

Services own scoring, allocation, route graphs, flood selection, scenario
comparison, fixture loading and SQLite persistence. The optimizer uses a fixed
seed, one worker and a deterministic search-work budget for repeatable results.
Directed road evidence excludes hazard-intersecting fixtures; it does not invent
safe diversions. Simulations leave approved schedules unchanged. Publication
retains authenticated, transactional draft review and audit behavior.

## Tests and datasets

All test sources are under `tests/frontend` and `tests/backend`. Vite and
TypeScript resolve the external test directory using frontend dependencies.
Pytest config supports running from either `omcm` or `omcm/backend`.
Browser suites launch isolated servers and avoid the application's database.

`datasets/` contains inspectable exports with the requested canonical filenames.
`backend/export_datasets.py --check` verifies them against runtime fixtures.
Source attribution and synthetic-data limitations are in
[dataset documentation](../datasets/README.md) and [OSM clinic provenance](OSM_CLINICS.md).
None of the example medical indicators or deployment recommendations is a live
operational feed. OSM acquisition is reproducible offline from the committed
raw snapshot; external refresh and live basemap tiles are separate dependencies.
