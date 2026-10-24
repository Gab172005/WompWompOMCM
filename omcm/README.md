# OMCM — Optimized Mobile Clinic Mapper

OMCM is a React/TypeScript and FastAPI decision-support prototype for Laguna.
One full-screen map supports community search, healthcare need assessment,
mobile clinic placement, scenario comparison and approved public visits.

## Current workflows

- **Public View:** search communities, find mapped facilities, and inspect approved
  clinic visits, operating hours, services and emergency advisories.
- **Admin View:** inspect HNI and rankings, generate a real backend allocation,
  review or replan sites, and explicitly publish a stored draft.
- **30-day simulation:** compare No intervention, Manual and Optimized on one
  clock. Clinic markers and lighter red areas show illustrative host/neighbor
  service impacts. Rehearsals do not publish schedules.
- **Map controls:** floating search and filter chips, in-place sliding panels,
  compact expandable legend, map settings, keyboard focus and reduced motion.

The connected planner considers **681 barangays across 30 Laguna LGUs**. XGBoost
predicts synthetic next-day illness and appointment demand; capacity-aware
CP-SAT selects sites and assignments. Browser-generated allocations never replace
failed connected requests. The older Los Baños–Bay road pilot is a separate API.

## Run locally

Use Node.js 22+ and the existing Python backend environment. From `omcm/`:

```sh
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp ../.env.example .env
# Configure OMCM_DEMO_AUTH=true, OMCM_ADMIN_USERNAME and
# OMCM_ADMIN_PASSWORD (12+ characters) in the backend .env.
# Keep OMCM_DATASET=pilot.
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. The local Vite proxy targets port 8000 when
`VITE_API_URL` is empty. OpenStreetMap requires internet but no API key. Google
Maps is an optional renderer configured in Map settings. On Windows use
`.venv/Scripts/python.exe`; `setup.ps1` and `start.ps1` are also available.
FastAPI schemas are at **http://127.0.0.1:8000/docs**.

Use the administrator credentials already configured on the backend. Example
credentials and the fill shortcut belong only to explicit `VITE_DEMO_MODE=true`
browser demonstrations. Demo mode does not enable connected server access.

## Healthcare Need Index

The agreed Balanced policy is fixed:

| Factor | Weight |
| --- | ---: |
| Sample morbidity | 35% |
| Distance to a hospital | 30% |
| Population density | 15% |
| Municipal income class | 10% |
| Distance to a mapped clinic | 5% |
| Mapped clinic provision deficit | 5% |

Missing factors are excluded and available weights are rescaled; incomplete
scores are marked provisional. Municipality scores use population-weighted
barangay rollups. Rankings use the same one-decimal scores as the baseline map.
Disaster risk has no HNI weight. Flood exclusions and maximum modeled travel
minutes are operational planning constraints.

After a plan succeeds, the map previews the simulator's illustrative service
adjustment around the proposed sites. The baseline factors and percentages stay
fixed. The score reduction is at most 35% at a host, tapering to 17.5% at 3 km;
overlapping clinics use the strongest single effect. This visual rehearsal is
separate from the backend's appointment and modeled-travel results.

## Views, routes and publication

`/` and `/public` show Public View. `/admin` hosts all administrator tools.
Selecting planning, simulation, details or the assistant changes panel state in
place. Older `/optimization`, `/simulator`, `/driver`, `/analytics`, `/settings`,
`/admin/legacy` and `/workspace` links redirect into the same map. Comparison
metrics and methodology are inside clinic planning; adjustable legacy weight
screens are no longer mounted. Their source modules remain for reference.

Only authenticated FastAPI approval publishes a connected schedule. Ordinary
approval can book any date from tomorrow through the next seven days using a
freshly generated plan. Later bookings reuse its next-day estimate; they do not
claim a forecast for the booked date. Today's changes require a confirmed
emergency notice. See [scheduling rules](docs/SCHEDULING.md). Public sessions refresh confirmed
schedules every 30 seconds while visible and on focus/connectivity return.
During an outage, the last confirmed visits stay visible with stale feedback.

Detailed scoring, analytics, candidate catalogs, optimization and audit endpoints
require backend authentication. Public tools omit planning scores and drafts;
changing views clears the assistant conversation. Bundled synthetic datasets
are still inspectable in the JavaScript application: they are demo data, not a
confidential record system. No real patient records are used.

## Verification

```sh
cd frontend
npm run lint
npm test
npm run build
npm run test:hni
npm run test:optimization
npm run test:simulation
npm run test:assistant
node scripts/prepare-laguna-planning.mjs --check
node scripts/clinic-sensitivity.mjs --check
cd ../backend
.venv/bin/python -m pytest -q
```

Browser suites use isolated servers and installed Chrome. On Windows use
`OMCM_BROWSER_CHANNEL=msedge`. Run browser suites sequentially because some share
port 5178. Screenshots are written to ignored `frontend/test-results/` or `/tmp`.
Historical `test:e2e*`/`test:barangays` scripts refer to absent or superseded suites;
use the commands above for the active map. See [verification](docs/VERIFICATION.md).

## Scope and deployment limits

Clinical/weather histories, demand and service effects are synthetic. Province
travel uses barangay adjacency at 20 km/h, at least 3 minutes per link; these are
not verified roads or live traffic. Planning points need LGU verification. Flood
options select 25-year/100-year point layers, not water depths; outlines identify
flagged barangays rather than exact inundation boundaries. The 30-day rehearsal
uses deterministic morbidity growth, not thirty XGBoost forecasts. Nightly
unattended optimization, disease-specific validated predictions and live GPS
are not implemented.

Vercel frontend root is `omcm/frontend`; backend root is `omcm/backend`.
Set frontend `VITE_API_URL` to the stable backend HTTPS base, configure backend
CORS and administrator variables, and redeploy each project. The backend includes
its own restriction geometry and uses CPU XGBoost on Linux. Vercel `/tmp` SQLite
is temporary and unshared: durable publication needs persistent hosting/storage.
See [deployment instructions](docs/VERCEL_DEPLOYMENT.md).

## Documentation and source layout

- [Current audit and exact file changes](docs/GLOBAL_AUDIT.md)
- [Balanced HNI policy](docs/BALANCED_HNI.md) and [hospital audit](docs/HOSPITAL_HNI_AUDIT.md)
- [XGBoost and allocation](docs/OPTIMIZATION_ALLOCATION.md), [forecast evidence](docs/TEMPORAL_FORECAST.md)
- [Three simulation scenarios and formulas](docs/SIMULATION_MODE.md)
- [Public visits](docs/PUBLIC_VISITS.md), [view acceptance](docs/INTERFACE-SCOPE.md)
- [Architecture](docs/ARCHITECTURE.md), [API](docs/API.md), [data sources](datasets/SOURCES.md)

The frontend lives in `frontend/src/` (`app`, `components`, `features`, `services`,
`store`, `styles`). FastAPI entrypoint is `backend/main.py`; domain code lives in
`backend/routers`, `backend/services` and `backend/models`. Fixtures and native
models are in `backend/data`; source inputs are in `datasets/`. Tests live in
`tests/` and beside the relevant frontend services.
