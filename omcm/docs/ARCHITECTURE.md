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

The Leaflet renderer composes municipality heatmap styling, hospital and clinic
markers, road disruptions and routes. Geographic assets live in
`public/assets/geo`. Map interaction and sizing are in `useMapInteraction`.
Google Maps is an optional renderer; no configured key means Leaflet/OSM.
`Modal` uses a native dialog for keyboard focus and Escape handling.

Main's supporting pages remain in their relevant feature folders.
`store/LegacyProvider.tsx` manages their existing API, credentials, drafts,
boundary uploads and public schedules. This provider is mounted only for those
routes; the municipality workspace does not need backend initialization.

## Two explicit planning datasets

The municipality workspace retains testing's 30-municipality illustrative data
and browser priority heuristic (`services/lagunaData.ts`). Its four-factor score
and example route waypoints are separate from the server pilot.

The server-backed fleet pilot retains main's 20 Los Baños–Bay barangay inputs,
eight staging candidates, directed OSRM route fixtures, five-factor risk score,
capacity constraints and Python allocation. Its fixtures are mirrored under
`backend/data` and `frontend/public/assets/pilot` for standalone deployments.
Do not translate a workspace proposal into an approved server schedule: the
identifiers, inputs, routes and scoring contracts differ.

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
[SOURCES.md](../datasets/SOURCES.md). None of the example medical indicators or
deployment recommendations is a live operational feed.
