# OMCM — Optimized Mobile Clinic Mapper

A working Laguna mobile-clinic planning and fleet-simulation demo. The default
pilot contains **20 real Los Baños–Bay barangay polygons**, eight illustrative
staging sites, **168 attributed OSRM road-route fixtures**, capacity-aware
allocation, disaster scenarios, three independently moving clinic vehicles,
and a separate approved public schedule.

**Illustrative synthetic data — not reported disease cases.** Population,
health, poverty, hospital-access indicators, capacities, flood conditions and
closures are synthetic. Boundaries and road geometries have real geographic
sources. Staging points are explicitly illustrative, not verified facilities.
No live traffic, driver GPS or disease surveillance is connected.

## Run the browser demo immediately

Requires Node.js 22+ and npm. No map/API key is needed.

```powershell
cd omcm/frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/simulator** and click **Demo tour · 3 clinics**.
If the backend is unavailable, an explicit browser-only banner appears.
Calculations and local approval rehearsal work from bundled data; the street
basemap needs internet. `frontend/.env.example` documents optional configuration.
Set `VITE_DEMO_MODE=true` in `frontend/.env` for an explicitly standalone demo.

Browser schedules are isolated in localStorage for this browser and origin.
They do not publish an LGU service or reach other devices. Public View shows
only locally approved schedules and never simulation markers as live GPS.

## Run with the Python optimizer and persistent shared schedules

On Windows with Python 3.13 and Node.js installed:

```powershell
cd omcm
powershell -ExecutionPolicy Bypass -File .\setup.ps1
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Setup preserves an existing `backend/.env`; otherwise it asks for local demo
credentials. Credentials stay server-side. Open the same simulator URL. The
read-only tour works without signing in; server draft generation and publication
require the configured administrator. Review the generated server draft before
approving it. API documentation: **http://127.0.0.1:8000/docs**.

Manual backend setup:

```powershell
cd omcm/backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
Copy-Item ../.env.example .env
# Edit .env: enable demo auth and choose a username and 12+ character password.
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

On macOS/Linux use `.venv/bin/python` and `cp ../.env.example .env`. Start the
frontend in another terminal. Keep `OMCM_DATASET=pilot` for the fleet demo.
Reload the frontend to reconnect after starting a previously unavailable API.

## What works

- Real OSM basemap, red need polygons, matching PSGC inspection, score breakdown,
  source/confidence labels, facility/site layers, route fit and recenter controls.
- Configurable weights, fleet size, clinic capacity and road-access threshold.
- Python OR-Tools MCLP-style allocation with site and vehicle capacity limits;
  deterministic browser reference heuristic when explicitly in demo mode.
- Population-first baseline using the same constraints, unserved communities,
  and before/after scenario metrics. Demand is daily appointments, not all residents.
- Play/pause/resume/reset, 1×/5×/20×/60×, reversible seeking, per-vehicle departure,
  ETA, heading, remaining distance, trails, selection and follow controls.
- Moderate/severe synthetic flood footprints, a map-visible synthetic closure,
  disease surge and fleet shortage. Intersecting fixture routes are excluded;
  no unverified safe reroute is claimed.
- Separate draft and published snapshots, explicit next-day approval, confirmed
  emergency revisions and notices. Connected publication is authenticated and
  transactional; local demo approval is visibly labeled as a rehearsal.
- Existing routes remain: `/`, `/risk`, `/optimization`, `/simulator`,
  `/schedules`, `/analytics`, `/settings`, `/public`; aliases include `/admin`,
  `/dashboard`, `/dashboard/admin`, `/clinics`.

## Checks

```powershell
cd omcm/frontend
npm run lint
npm test
npm run build
npm run test:e2e
cd ../backend
.venv/Scripts/python.exe -m pytest -q
```

The browser suite launches isolated API/Vite servers on 8001/5174 and a temporary
SQLite database, using headless Microsoft Edge on Windows. On other platforms
install Chromium with `npx playwright install chromium`. It exercises connected
and browser-only workflows and saves 1440px/390px screenshots under
`frontend/test-results`. It never uses your application's database or password.

See [verification results](docs/VERIFICATION.md), [three-minute demo script](docs/DEMO_SCRIPT.md),
[implementation audit](docs/IMPLEMENTATION_PLAN.md), [architecture and assumptions](docs/ARCHITECTURE.md),
[API contracts](docs/API.md), and [data sources/import instructions](datasets/SOURCES.md).

## Deployment checklist

1. Run the checks above. Preview `/simulator`, reset scenarios, and verify tiles.
2. For Vercel use root `omcm/frontend`, build `npm run build`, output `dist`.
   Existing `vercel.json` supports deep links. Static browser demo needs no API key.
3. For connected mode set `VITE_API_URL` to the backend HTTPS base without `/api`.
   Set `VITE_DEMO_MODE=false`; changes to Vite variables require rebuilding.
4. Deploy Python from `omcm/backend`, install `requirements.txt`, start
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Keep `OMCM_DATASET=pilot`.
5. Set exact frontend origins in `OMCM_CORS_ORIGINS`; set demo credentials only
   on the server. Use HTTPS. Point `OMCM_DATABASE_PATH` at persistent storage.
6. Verify authenticated approval, published schedules after restart, and explicit
   fallback messaging when the API is unavailable. Never treat local demo approval
   as server publication. No external deployment was performed by this upgrade.

No production identity system, operational site validation, live GPS, actual
hazard/health feeds or traffic service is included. Production use requires those
inputs and operational review. The original provincial data and historical README
are retained in [the archive](docs/LEGACY_README.md); their adjacency estimates
are not the new fleet simulator's road model.
