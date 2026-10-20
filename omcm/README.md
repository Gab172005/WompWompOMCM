# OMCM — Optimized Mobile Clinic Mapper

A React + TypeScript map workspace and Python + FastAPI planning service for
Laguna. A full-screen map uses a floating search box, tool buttons, a Layers
control and corner zoom controls, with contextual panels for planning tools.

Select a municipality, compare heatmaps, adjust clinic placements, test flood,
morbidity and road-closure scenarios, and play simulated clinic movements.
The server-backed optimizer, analytics, settings and read-only public dashboard
remain available. Deployment review and publication live inside optimization.

## Run the frontend

Requires Node.js 22+ and npm. OpenStreetMap needs no API key.

```powershell
cd omcm/frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. The map workspace works without the backend.
The upstream administrative map is also available at **http://127.0.0.1:5173/workspace**.
It retains server-backed planning, municipal scenarios, road blocking and grounded
chat from `origin/main`; the existing map and detailed `/driver` routes remain available.
Run `npm run test:e2e:upstream` to check its connected desktop/mobile workflows.
Basemap tiles require internet. Copy `frontend/.env.example` to `frontend/.env`
for optional API, Google Maps or Firebase configuration. Google Maps is optional;
the map settings dialog also accepts a browser-restricted key. Firebase remains
an optional configuration adapter; it does not replace schedule storage.

## Run the backend

From another terminal, with Python 3.13 installed:

```powershell
cd omcm/backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
Copy-Item ../.env.example .env
# Set OMCM_ADMIN_USERNAME and a 12+ character OMCM_ADMIN_PASSWORD in .env.
.venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

API docs: **http://127.0.0.1:8000/docs**. On macOS/Linux use `.venv/bin/python`.
The existing `setup.ps1` and `start.ps1` are also available from `omcm/`.
Keep `OMCM_DATASET=pilot` for the server-backed Los Baños–Bay fleet pilot.
API mutations require the configured demo administrator; public schedules are
read-only. SQLite stores connected drafts, approved schedules and audit events.

## Project structure

```text
omcm/
├── frontend/                         React + TypeScript + Vite
│   ├── public/assets/
│   │   ├── geo/                      Boundaries, province mask, source/license
│   │   └── pilot/                    Browser copy of the road pilot fixtures
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx               Application composition
│   │   │   ├── AppProviders.tsx      Router and error boundary
│   │   │   └── routes.tsx            Workspace, admin tools and public access
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx
│   │   │   │   ├── MapControls.tsx
│   │   │   │   ├── MapNavigation.tsx
│   │   │   │   ├── SidePanel.tsx
│   │   │   │   ├── FloatingControls.tsx
│   │   │   │   └── LegacyLayout.tsx  Main's supporting-page navigation
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Card.tsx
│   │   │       ├── Modal.tsx         Native dialog with focus/escape handling
│   │   │       └── LegacyUI.tsx      Shared metrics for retained pages
│   │   ├── features/
│   │   │   ├── map/
│   │   │   │   ├── components/
│   │   │   │   │   ├── LagunaMap.tsx
│   │   │   │   │   ├── LagunaLeafletMap.tsx
│   │   │   │   │   ├── LagunaGoogleMap.tsx
│   │   │   │   │   ├── HeatmapLayer.tsx
│   │   │   │   │   ├── MunicipalityLayer.tsx
│   │   │   │   │   ├── HospitalMarkers.tsx
│   │   │   │   │   ├── ClinicMarkers.tsx
│   │   │   │   │   ├── RouteLayer.tsx
│   │   │   │   │   └── MapLegend.tsx
│   │   │   │   └── hooks/useMapInteraction.ts
│   │   │   ├── municipalities/
│   │   │   │   ├── MunicipalitySearch.tsx
│   │   │   │   ├── MunicipalityPanel.tsx
│   │   │   │   ├── MunicipalityMetrics.tsx
│   │   │   │   └── MunicipalityRanking.tsx
│   │   │   ├── filters/
│   │   │   │   ├── FilterControls.tsx
│   │   │   │   ├── HeatmapSelector.tsx
│   │   │   │   └── LayerToggles.tsx
│   │   │   ├── optimization/
│   │   │   │   ├── OptimizationPanel.tsx
│   │   │   │   ├── ClinicCountInput.tsx
│   │   │   │   ├── PlacementRecommendations.tsx
│   │   │   │   ├── ManualPlacement.tsx
│   │   │   │   ├── DeploymentApproval.tsx
│   │   │   │   └── usePlanningResults.ts
│   │   │   ├── simulation/
│   │   │   │   ├── SimulationPanel.tsx
│   │   │   │   ├── ScenarioBuilder.tsx
│   │   │   │   ├── FloodControls.tsx
│   │   │   │   ├── MorbidityControls.tsx
│   │   │   │   ├── RoadBlockageTool.tsx
│   │   │   │   ├── SimulationPlayback.tsx
│   │   │   │   └── SimulationResults.tsx
│   │   │   ├── tracking/
│   │   │   │   ├── ClinicTracker.tsx
│   │   │   │   ├── ClinicDetails.tsx
│   │   │   │   ├── ClinicStatus.tsx
│   │   │   │   └── useClinicAnimation.ts
│   │   │   ├── chatbot/
│   │   │   │   ├── ChatbotPanel.tsx
│   │   │   │   └── ChatMessage.tsx
│   │   │   └── analytics/, settings/, public/
│   │   ├── store/
│   │   │   ├── useAppStore.ts        Zustand workspace state
│   │   │   └── LegacyProvider.tsx    API/auth/schedules for retained pages
│   │   ├── services/                API, maps, Firebase and planning adapters
│   │   ├── types/                   municipality.ts, clinic.ts, simulation.ts
│   │   ├── hooks/                   Retained pilot hooks
│   │   ├── styles/globals.css       Main's design plus workspace layout rules
│   │   └── main.tsx                 React entry point
│   ├── scripts/                     Geographic/pilot import tools
│   └── package.json
├── backend/
│   ├── main.py                      App creation, middleware and router mounting
│   ├── config.py                    Environment and demo authentication
│   ├── routers/
│   │   ├── municipalities.py
│   │   ├── optimization.py
│   │   ├── simulation.py
│   │   └── clinics.py
│   ├── services/
│   │   ├── risk_scoring.py
│   │   ├── clinic_optimizer.py
│   │   ├── route_service.py
│   │   ├── flood_analysis.py
│   │   ├── simulation_engine.py
│   │   ├── data.py                  Fixture loading and reference validation
│   │   ├── pilot.py                 Directed road evidence
│   │   └── repository.py            SQLite persistence
│   ├── models/                      municipality.py, clinic.py, scenario.py,
│   │                                results.py (validated API responses)
│   ├── data/                        Runtime pilot and provincial seed inputs
│   ├── export_datasets.py
│   └── requirements.txt
├── datasets/
│   ├── laguna_municipalities.geojson
│   ├── population.csv
│   ├── disease_cases.csv
│   ├── flood_hazards.geojson
│   ├── hospitals.csv
│   ├── candidate_sites.csv
│   ├── barangays.geojson            Additional geometry for the server pilot
│   └── SOURCES.md
├── tests/
│   ├── frontend/                    Unit tests and both browser suites
│   └── backend/                     API/engine/export tests and small fixtures
├── docs/
├── .env.example
└── README.md
```

Additional map and fleet components inside the feature folders support main's
retained pages. `Legacy` identifies those existing adapters; the new workspace
uses `useAppStore.ts` and the feature panels listed above.

## Routes and data flow

| URL | Purpose |
| --- | --- |
| `/`, `/risk` | Laguna map workspace |
| `/optimization` | Workspace with optimization panel open |
| `/simulator` | Workspace with scenario builder and playback open |
| `/admin`, `/dashboard/admin` | Server-backed placement optimizer and deployment review |
| `/driver` | Main's detailed road-fixture fleet simulator |
| `/analytics`, `/settings` | Existing analytics and data/method settings |
| `/public`, `/clinics` | Read-only approved public schedules |

Workspace interactions update Zustand. `usePlanningResults` derives municipality
scores, recommendations and disruptions from testing's browser heuristic.
Changing one manual site keeps the other clinics; occupied sites cannot be
selected twice. Scenario conditions apply while the simulator is open and revert
to baseline when it closes. Reopening restores the configured scenario.

**Workspace approval is a local rehearsal.** It saves a snapshot in this browser,
and changing plan inputs invalidates it. It does not publish to the public
dashboard. For publication, generate a server-backed plan on `/admin` or
`/workspace`, then use its deployment review controls. These tools use the existing API and
SQLite workflow. The municipality workspace and the 20-barangay server pilot
have different inputs and scoring formulas; they are intentionally identified
in the interface and are not interchangeable deployments.

The assistant provides deterministic explanations from current workspace data.
No external AI service, live GPS, surveillance, traffic or hazard feed is connected.
Barangay and municipal population counts come from the 2024 PSA Census of Population
(`datasets/population_per_barangay.csv`, as of 01 July 2024); health, routing and
deployment fixtures are illustrative. See
[data sources and limitations](datasets/SOURCES.md) and [architecture](docs/ARCHITECTURE.md).

## Checks

```powershell
cd omcm/frontend
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:e2e:legacy
cd ../backend
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe export_datasets.py --check
```

The new workspace browser suite runs an isolated Vite instance on port 5175.
The retained connected-workflow suite uses ports 8001/5174 and a temporary
database. On Windows the suites use headless Edge; elsewhere install Chromium
with `npx playwright install chromium`. Screenshots go to
`frontend/test-results/`. Test sources live under `tests/`; frontend dependencies
remain installed once in `frontend/node_modules`.

Regenerate the inspectable dataset exports with
`backend/.venv/Scripts/python.exe backend/export_datasets.py` from `omcm/`.
Exports mirror the server pilot and bundled boundary assets; they are not live
data downloads. See [API contracts](docs/API.md) for the unchanged `/api` endpoints.

## Deployment

For Vercel use root `omcm/frontend`, build `npm run build`, output `dist`.
For FastAPI use root `omcm/backend`, install `requirements.txt`, and start
`uvicorn main:app --host 0.0.0.0 --port $PORT`. Set `VITE_API_URL` to the HTTPS
backend base, configure exact `OMCM_CORS_ORIGINS`, and keep the SQLite database on
persistent storage. Existing `vercel.json` and `render.yaml` remain available.
