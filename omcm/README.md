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

The map's Optimize panel now calls FastAPI using the configured backend sign-in.
Choose fleet size, appointment capacity, road-time limit and optional exclusions,
then select **Generate recommendations**. XGBoost estimates synthetic appointment
demand and CP-SAT chooses capacity-constrained placements. No recommendation is
generated automatically or substituted locally if the backend fails. Approval
publishes the stored server draft; fresh public sessions read its approved schedule.
This allocation remains scoped to the Los Baños–Bay road pilot, while the map's
province-wide HNI retains its existing formula. See the
[optimization implementation and exact change inventory](docs/OPTIMIZATION_ALLOCATION.md).

The separate [dated illness forecast](docs/TEMPORAL_FORECAST.md) now uses fictional
case/weather histories to supply next-day illness inputs while preserving the
existing appointment model and factor coefficients. These are synthetic planning
demonstrations, not clinically validated forecasts. In Public View, the
[approved-visits summary](docs/PUBLIC_VISITS.md) shows today and the next published
clinic day, with actual service areas and automatically refreshed schedules.
The latter document includes the exact public file inventory and combined-branch
push/PR instructions.

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
[data sources and limitations](datasets/README.md), [OSM clinic provenance](docs/OSM_CLINICS.md),
and [architecture](docs/ARCHITECTURE.md).

### Barangay healthcare need and fixed clinics

The default heatmap and searchable ranking use separate scores for all 681
barangays. Production policy weights are morbidity **25%**, hospital distance
**30%**, disaster risk **15%**, population density **10%**, municipality income
class **10%**, OSM clinic distance **5%**, and clinic provision deficit **5%**.
Urban/rural remains visible context but has no scoring weight. Missing factors
are excluded with available-weight rescaling and provisional scores/ranks.

Fixed **OSM clinics**, **Hospitals**, and simulated **Mobile clinics** have
independent layer toggles; fixed facilities do not change schedules or mobile
clinic selection. Clinic tags, location methods and acquisition provenance are
bundled offline. OSM mapping is incomplete; clinic counts do not establish
absence, capacity, or operating status. Distances are straight-line and
Laguna-only, with potential province-edge bias. Weights are policy assumptions,
not clinical coefficients. See [weight sensitivity](docs/CLINIC_SENSITIVITY.md).

Refresh clinics explicitly using [the clinic importer](frontend/scripts/import-osm-clinics.py);
ordinary dataset generation, tests and browser runtime require no Overpass access.

## Checks

```powershell
cd omcm/frontend
npm run lint
npm test
npm run build
$env:OMCM_BROWSER_CHANNEL = "msedge"  # Windows; defaults to Chrome elsewhere
npm run test:hni
npm run test:optimization
python scripts/import-osm-clinics.py --check
python scripts/import-laguna-datasets.py --check
node --experimental-strip-types scripts/clinic-sensitivity.mjs --check
cd ../backend
.venv/Scripts/python.exe -m pytest -q
```

The hospital/HNI browser suite runs an isolated Vite instance on port 5177. On
Windows select headless Edge with `OMCM_BROWSER_CHANNEL=msedge`; elsewhere it
defaults to installed Chrome. Screenshots go to
[the test-results directory](frontend/test-results/). Test sources live under
[tests](tests/); frontend dependencies remain installed once. Historical package
scripts `test:barangays`, `test:e2e`, `test:e2e:legacy` and `test:e2e:upstream`
refer to suites not present in this checkout. The historical Python OSM importer
suite and dataset export targets also remain absent; do not treat those commands
as successful verification.
Step A recovered the hospital/HNI frontend regression suites and the backend
API, risk-engine and road-pilot suites, plus added hospital importer tests.
`npm run test:hni` checks the current hospital/HNI flow on desktop and mobile;
it starts an isolated Vite server on port 5177 and defaults to installed Chrome.
See [the audit and validation record](docs/HOSPITAL_HNI_AUDIT.md) for scope,
the exact changed files, results, and the remaining simulation/model differences.

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
