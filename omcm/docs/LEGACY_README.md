# Archived pre-upgrade README (not current setup guidance)

# OMCM — Optimized Mobile Clinic Mapper

A working local mobile healthcare planning prototype for a **synthetic Laguna pilot**. It uses 681 sourced Laguna barangays, 30 illustrative staging hubs, 30 synthetic hospitals, an estimated adjacency network, adjustable need scoring, OR-Tools capacity-aware allocation, a population-first baseline, four combined disaster scenarios, approved schedules, emergency notices, and a separate resident dashboard.

**Barangay names and coordinates come from the supplied PhilAtlas CSV; population, health statistics, facilities, demand, and travel estimates are synthetic demonstration data.** Planning maps use real Laguna barangay boundaries from a bundled 2023 PSGC-based snapshot, with real municipality boundaries as fallback. Records match boundaries by municipality-qualified name, ignoring the optional (Poblacion) suffix. Cabuyew/Cabuyao in Liliw and Pooc/Pook in Santa Rosa remain unmatched pending verification and appear gray. See `frontend/public/data/geo/README.md` for provenance and matching instructions. The public deployment map uses OpenStreetMap for context. No live traffic, weather, disease surveillance, or emergency advisory service is connected. Final deployment decisions belong to authorized LGU administrators.

## Run on Windows

Requires Python 3.13 and Node.js 24 (Node 22 also supports the frontend; the system certificate workaround is for Node 24).

```powershell
cd omcm
powershell -ExecutionPolicy Bypass -File .\setup.ps1
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Setup installs dependencies and asks you to choose local demo credentials; it never puts passwords in frontend files. Existing backend/.env is preserved. Start keeps both servers running until Ctrl+C. Open **http://127.0.0.1:5173**. The resident dashboard is **http://127.0.0.1:5173/public**, and OpenAPI documentation is **http://127.0.0.1:8000/docs**.

Dependencies have already been installed in the delivered workspace. An ignored `backend/.env` contains username `demo-admin` and a randomly generated local password; open that file to find the password, or change it and restart the backend. On a fresh checkout, setup.ps1 asks you to create credentials. Credentials are required for optimization, simulations, weight changes, boundary imports, approvals, and audit access. Viewing default scores and published schedules works without administrator credentials. No credentials are built into the frontend or tracked source.

### Manual setup / macOS / Linux

```sh
cd omcm/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
# Edit .env: enable OMCM_DEMO_AUTH and enter your username and a 12+ character password.
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
cd omcm/frontend
npm ci
npm run dev
```

Windows manual backend invocation: `.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`.

If npm reports `UNABLE_TO_VERIFY_LEAF_SIGNATURE` on a Windows machine with trusted enterprise certificates, Node 24 can use `$env:NODE_USE_SYSTEM_CA='1'` before npm. TLS validation remains enabled.

## Demonstration workflow

1. Open Overview or Healthcare Risk Map. Click a barangay area to inspect need, normalized contributors, disease burden, hospital travel, warnings, and services.
2. Sign in using the username/password in your server environment. Settings lets you adjust weights; the backend immediately recalculates scores after a short debounce. Changes invalidate the current draft.
3. Clinic Optimization: set fleet size, capacity, travel limit, and eligible hubs. Generate Optimal Placement. Review assigned appointments, staging reasons, solver status, unserved demand, travel, utilization, and baseline comparison.
4. Disaster Simulator: select flooded hubs, close roads, reduce fleet size, or increase disease burden/demand. Scenarios can be combined. Run to compare the original and revised plans. Road closures remove the selected estimated adjacency links; shared borders do not prove road access.
5. Clinic Schedules: optionally choose manual staging hubs and regenerate; review the draft, select tomorrow or a later date, hours, and services, then approve. Publication uses the backend-stored draft, not a client-supplied allocation.
6. Open the public dashboard and choose the approved date. Only published schedules appear. Today has no deployment until an administrator explicitly publishes a confirmed emergency revision for today.
7. To replace a published date or revise today's schedule, enable Emergency schedule override, enter a public notice, and check the explicit confirmation. The backend enforces this and writes a separate audit event and public notice.

## Scoring and allocation

Initial weights: disease 30, vulnerability 25, hospital inaccessibility 20, poverty 15, flood 10. Weights are normalized to sum to one. Each indicator is clipped to [0,1]:

| Indicator | Demo normalization |
| --- | --- |
| Disease | `(cases / population × 1,000) / 100` |
| Vulnerability | `min(children + elderly, population) / population / 0.60` |
| Inaccessibility | shortest-path hospital minutes / 60; unreachable = 1 |
| Poverty | percentage / 100 |
| Flood | synthetic exposure index / 100 |

Need is `100 × sum(indicator × normalized weight)`. These are explicit fixed demo reference scales, **not calibrated clinical thresholds**. Missing nonessential indicators use visible conservative assumptions; missing/invalid population fails loading. The demo assumes children and elderly groups do not overlap. Daily demand is rounded population × synthetic demand rate; outbreaks multiply both case burden and demand, with demand capped at population.

The CP-SAT model has binary staging variables and integer barangay-to-clinic appointment allocations. It limits opened clinics, each selected clinic's daily capacity, total allocated demand per barangay, travel time, eligible sites, and flood exclusions. NetworkX removes closed road edges before computing shortest paths. Total weighted appointments are the primary objective; shorter travel and fewer sites break ties. The solver uses one deterministic worker and a 15-second limit, and reports whether optimality was proven.

The baseline chooses staging hubs in descending host-barangay population and greedily fills them by barangay population within the **same constraints**. Improvement is computed from actual priority-weighted demand served. A zero baseline yields N/A. Total population is not presented as the number receiving care: coverage counts allocated daily appointments. No individual patient records are modeled. Simulation gains/losses measure differences in each barangay's aggregate allocated appointments and cannot identify particular residents gaining or losing access. Flood-safe accessibility means no allocation uses a demo-excluded staging site or closed road; it is not real hazard verification.

## Data and optional real geography

- `backend/data/barangays.csv`: supplied 681-row PhilAtlas geography, coordinates, neighbor lists and provenance. The loader preserves this file and derives stable name-based IDs and clearly labeled synthetic planning indicators. External or unmatched neighbor labels are excluded; no polygon is fabricated from adjacency.
- `backend/data/network.json`: legacy demo network, used only with the legacy health-input CSV schema. The supplied geographic schema derives estimated links and illustrative facilities at load time.
- `backend/data/metadata.json`: explicit provenance and generation date.
- `python backend/data/generate_demo.py`: writes legacy demo files under `backend/data/demo/`, preserving the supplied CSV.
- Real GeoJSON lives in `frontend/public/data/geo/laguna_barangays.geojson` (preferred) and `laguna_municipalities.geojson` (temporary fallback). Provenance, license, a reproducible download script and matching instructions are included. Both files are bundled; no runtime third-party boundary service is required. Missing/invalid files show an error, never invented geometry.
- Settings accepts real Laguna Polygon/MultiPolygon uploads with Laguna PSGC codes and names. Coordinates must be finite WGS84 longitude/latitude; rings must close. Legacy pilot-ID uploads remain stored but cannot replace the real map. Uploads do not certify provenance or geometric topology.
- Planning maps use solid polygon fills with five red risk levels, thin white borders, hover scores, and clickable real-area details. Colors follow matched backend scores and the selected risk factor. PSGC, municipality-qualified names and explicit aliases link real areas to records; ambiguous/unmatched areas are gray. Barangay labels appear when zoomed in, with overlapping labels hidden. The Facilities toggle reveals hospital and staging markers; the public deployment map retains its OpenStreetMap base map.
- To adopt actual population or facility data, replace the CSV/network/metadata together, preserving unique node IDs and valid population. Update coordinates and road costs coherently and restart the backend. The prototype remains labeled as a demonstration until the product and methodology have been validated.
- `requirements-routing.txt` installs optional OSMnx. `read_osm_graph()` loads a local GraphML network and derives travel-time attributes. Real routing requires snapping official demand/staging locations and integrating the graph; it is not connected automatically.
- SQLite access is isolated in `app/database/repository.py`, so a PostgreSQL/Supabase adapter can replace it later. Plans, published schedules, boundary uploads, notices, and audit events are persisted. Simulations are computed without database writes to schedules.

## Tests and build

```powershell
cd omcm/backend
.\.venv\Scripts\python.exe -m pytest -q
cd ../frontend
npm test
npm run build
npm run test:e2e
```

Tests cover scoring range, adjustable weights, population-adjusted disease burden, missing input warnings, fleet and capacity constraints, unique demand, reachability, flooded sites, road disruptions, outbreak demand, manual-site validation, API authentication, date/time validation, approval/public retrieval, simulation isolation, emergency confirmation/audit, boundary input validation, API error propagation, frontend request contracts, and date rollover.

The browser test starts isolated API/Vite servers on ports 8001/5174 and uses a temporary SQLite database. On Windows it runs headless Microsoft Edge; on Linux/macOS install Chromium with `npx playwright install chromium` first. It saves screenshots under `frontend/test-results` and shuts its servers down after running. The main application's database and credentials are not used.

## Deployment

**Frontend / Vercel:** set project root to `omcm/frontend`, build `npm run build`, output `dist`. Set `VITE_API_URL` to your HTTPS backend URL before building; do not include a trailing `/api`. `vercel.json` supports React Router deep links.

**Backend / Render:** `omcm/render.yaml` is a blueprint template. If deploying from a repository whose root is above omcm, set rootDir to `omcm/backend`. Build with `pip install -r requirements.txt`; launch `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Configure `OMCM_CORS_ORIGINS` to the exact frontend origin and set server-side demo credentials. The Python runtime shown reflects the local interpreter; choose a supported Python 3.13 patch release in the hosting service if needed.

SQLite on ephemeral hosting is **not durable across restarts/redeploys**. For a durable demo, attach a persistent disk and point `OMCM_DATABASE_PATH` to that disk, or implement the PostgreSQL adapter. Persistent hosting availability/cost depends on the provider; no paid service is needed for local use. This project has not been published to an external service.

Demo auth uses server-enforced HTTP Basic with environment-configured credentials and constant-time comparison. The browser keeps credentials in memory only and clears them on sign-out/reload. Use HTTPS for hosted demonstrations. This is **demo-only authentication**, not production identity management. Production requires authenticated LGU roles, managed secrets, rate limits, audit retention, privacy review, validated geographic/health data, and clinical methodology review.

## Project organization

`frontend/src/components` contains maps, charts, planning controls, and common UI; `pages` has the seven planning screens and separate public view; `services` has the typed API client and application state. The FastAPI application is in `backend/app/main.py`; scoring and placement are in `algorithms`; road/data adapters are in `services`; validation models are in `models`; SQLite persistence is in `database`.
