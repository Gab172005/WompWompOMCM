# OMCM · Optimized Mobile Clinic Mapper

OMCM is a decision-support prototype for mobile healthcare planning in Laguna,
Philippines. It brings community search, healthcare need, clinic planning and
published visits together on one map.

A **barangay** is a local community within a city or municipality. An **LGU** is a
local government unit. These are the geographic units used throughout the app.

## Using the map

| View | What it is for |
| --- | --- |
| Public View | Find communities and nearby facilities; see approved clinic dates, hours, services and emergency notices. |
| Admin View | Inspect healthcare need, generate and review clinic plans, publish visits and rehearse alternative allocations. |

Search for a place in the floating search bar. Open a result to see its details.
Map layers and the legend explain the information shown. On smaller screens,
details open in a bottom sheet that can be expanded or reduced.

Administrators use **Plan clinics**, **30-day simulation** and **Planning help**
without leaving the map. Selecting a tool changes the panel, not the page. The
assistant offers shortcuts for the current view and selected community, with
copyable replies, failure recovery and a control to return to the latest message.

### Planning and publishing visits

1. Sign in with the administrator credentials configured on the backend.
2. Open **Plan clinics** and set the fleet, capacity and access constraints.
3. Generate recommendations, inspect suggested sites and adjust the draft if needed.
4. Approve the visit with its date, hours and services. Only approval publishes it.

The planner considers **681 barangays across 30 Laguna LGUs**. It requests actual
backend allocations and displays a failure if the service cannot complete the
request. A failed request never creates substitute browser allocations.

A freshly generated plan can be booked from tomorrow through seven days from
today. Later bookings reuse the next-day estimate, rather than claiming a
forecast for the booked date. Same-day publication requires an emergency notice
of at least 10 characters and explicit confirmation. See [scheduling](docs/SCHEDULING.md).
Public schedules refresh while the page is visible and when connectivity returns;
the last confirmed visits remain visible with stale feedback during an outage.

### Comparing clinic scenarios

**30-day simulation** is a rehearsal with one shared clock:

- **No intervention:** sample illness pressure increases over time without clinic service.
- **Manual:** choose clinic sites and see the effect on their host barangays and reachable neighbors.
- **Optimized:** ask the backend to choose locations that minimize population-weighted remaining healthcare need for the selected day.

Clinic markers show placements. Lighter red indicates lower estimated need in
served areas; areas outside their reach retain the shared baseline. Scenario
cards, a trend chart, comparisons and deployment history explain the changes.
Simulation placements do not publish community schedules.

More areas reached does not necessarily mean a larger reduction in need.
Population, existing need, reach and capacity all matter. The simulation solver
retains a feasible manual comparison if it performs better on the selected day.
Ties are possible; held locations can perform differently on later days.

## Hosted demo sign-in

For the Vercel demonstration, choose **Admin View** and enter:

- **Username:** `admin`
- **Password:** `laguna-admin-2026`

These credentials are for the hosted demo. Local sign-in uses the credentials
configured in `backend/.env`.

## What the models mean

The **Healthcare Need Index (HNI)** is a relative planning score out of 100.
Higher values mean greater estimated need. It is not a count of patients or
confirmed illness. The fixed Balanced policy uses:

| Factor | Weight |
| --- | ---: |
| Sample morbidity | 35% |
| Distance to a hospital | 30% |
| Population density | 15% |
| Municipal income class | 10% |
| Distance to a mapped clinic | 5% |
| Mapped clinic provision deficit | 5% |

Missing factors are excluded and the remaining weights are rescaled. Incomplete
scores are marked provisional; municipal summaries weight barangays by population.
Flood scenarios and travel limits constrain allocation; they do not add HNI weights.

**XGBoost predicts; the solver allocates.** The connected planner uses next-day
illness and appointment predictions from dated synthetic history and weather.
Its CP-SAT solver chooses sites and assignments to maximize priority-weighted
appointments within capacity and access limits.

The simulator uses the same fixed HNI policy with illustrative daily illness
growth. Dated XGBoost demand limits the service a clinic can provide each day.
A clinic can reduce need within 3 km where a safe modeled path takes at most
25 minutes. The maximum reduction is 35% at the host, tapering to 17.5% at the
edge; demand above capacity scales it down. Overlapping clinics retain the
strongest reservation rather than deducting twice. The simulator optimizes the
population-weighted HNI displayed on the map, separately from the ordinary
planner's appointment objective. See [simulation formulas](docs/SIMULATION_MODE.md).

## Run locally

Use **Node.js 22+** and **Python 3.12 or 3.14**. Local tests use Python 3.14;
the deployment packaging was also checked on Python 3.12. Run the
frontend and backend in separate terminals. From this `omcm/` directory:

```sh
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp -n ../.env.example .env
```

Edit `backend/.env` for your local environment. Keep `OMCM_DATASET=pilot`, enable
`OMCM_DEMO_AUTH=true` for the existing prototype sign-in, and set
`OMCM_ADMIN_USERNAME` and `OMCM_ADMIN_PASSWORD` (at least 12 characters). Keep an
existing `.env` and credentials if they are already configured. Do not commit secrets.
Then start the API:

```sh
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

In a second terminal, from `omcm/`:

```sh
cd frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. API documentation is at
**http://127.0.0.1:8000/docs**. The frontend development proxy uses port 8000 when
`VITE_API_URL` is empty. The separate historical Los Baños–Bay road fixture stays
under `OMCM_DATASET=pilot`; it does not limit the province-wide planning API.

On Windows, use `.venv/Scripts/python.exe` in place of `.venv/bin/python`.
`setup.ps1` and `start.ps1` are also available. OpenStreetMap requires internet
but no API key. Google Maps is an optional renderer in Map settings.

### Configuration and common issues

| Setting or symptom | What to check |
| --- | --- |
| Cannot connect to the planning service | Start FastAPI as well as Vite. For separate hosting, set `VITE_API_URL` to the backend HTTPS base and allow the frontend origin in backend CORS. |
| Administrator sign-in fails | Use the backend's configured username/password. A browser demo fill button does not configure server credentials. |
| `VITE_DEMO_MODE` | Leave false/unset for connected use. Explicit browser demonstrations have sample credentials, but clinic optimization always requires FastAPI. |
| Assistant without an external model | Grounded local/template commands remain available. Optional chat keys belong only on the server. |
| Gray map area | A displayed value is unavailable; gray does not mean zero need. Restricted forest land cannot host a clinic. |
| Zero hospitals in a place | Local hospital counts differ from nearby hospital access. Inspect the facility list and source evidence. |

## Development and checks

The frontend uses React, TypeScript, Vite, Zustand, Leaflet, Recharts, Lucide and
plain CSS. FastAPI, XGBoost and OR-Tools power the backend. No new UI library is
required. Existing modules are extended rather than rebuilt.

```sh
cd frontend
npm run lint
npm test
npm run build
cd ../backend
.venv/bin/python -m pytest -q
```

Browser checks use isolated servers, temporary test storage and installed Chrome:

```sh
cd frontend
npm run test:ui
npm run test:hni
npm run test:optimization
npm run test:simulation
npm run test:assistant
node scripts/prepare-laguna-planning.mjs --check
node scripts/clinic-sensitivity.mjs --check
```

Run browser suites sequentially to limit resource contention. On Windows, set
`OMCM_BROWSER_CHANNEL=msedge` if using Edge. Screenshots go to ignored
`frontend/test-results/` or `/tmp`. Historical `test:e2e*` and `test:barangays`
commands target absent or superseded suites; use the active checks above.

## Data, access and limitations

Geography and facility evidence come from the documented public sources;
clinical/weather histories, demand and service effects are synthetic. No real
patient records are used. Hospital source bed counts do not indicate current
availability. OpenStreetMap clinic records are fixed facilities, not mobile clinics.

Travel uses estimated barangay adjacency at 20 km/h with a minimum of three
minutes per link, not live routing or a verified provincial road matrix. Flood
options select 25-year/100-year mapped point layers, not water depths. Flagged
barangay outlines are not exact inundation boundaries. Planning points and
capacities need LGU verification. Disease-specific validated forecasts, live GPS
and unattended nightly optimization are outside the implemented scope.

Backend authentication protects detailed scores, analytics, candidate catalogs,
optimization and approval. Public tools omit private planning fields and drafts;
assistant history clears when identity or view changes. Bundled synthetic data
can still be inspected in browser assets: this prototype is not a confidential
record system.

## Deployment and project guide

Deploy the frontend from `omcm/frontend` and backend from `omcm/backend`. Set the
frontend API base and backend CORS/authentication settings, then rebuild each
project. Vercel `/tmp` SQLite is temporary and unshared; durable publication
requires persistent hosting/storage. See [deployment](docs/VERCEL_DEPLOYMENT.md).

| Directory | Contents |
| --- | --- |
| `frontend/src/` | Map components, feature panels, services, state and styles |
| `backend/` | FastAPI entrypoint, routers, domain models and services |
| `backend/data/` | Planning fixtures and native model artifacts |
| `datasets/` | Source inputs and provenance |
| `docs/` | Methodology, API, deployment and verification |
| `tests/` | Additional project test suites |

Further reading: [architecture](docs/ARCHITECTURE.md), [API](docs/API.md),
[HNI policy](docs/BALANCED_HNI.md), [hospital evidence](docs/HOSPITAL_HNI_AUDIT.md),
[allocation](docs/OPTIMIZATION_ALLOCATION.md), [forecast evidence](docs/TEMPORAL_FORECAST.md),
[simulation](docs/SIMULATION_MODE.md), [public visits](docs/PUBLIC_VISITS.md),
[UI design and checks](docs/UI_REFINEMENT.md), [verification](docs/VERIFICATION.md)
and [data sources](datasets/SOURCES.md).
