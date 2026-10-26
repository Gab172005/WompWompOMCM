# Architecture

## One map shell

`frontend/src/main.tsx` renders `app/App.tsx` with the existing router and error
boundary. The active UI is `components/layout/AppLayout.tsx` for Public View
(`/`, `/public`) and Admin View (`/admin`). Legacy URLs redirect to this shell;
no legacy dashboard/layout provider is mounted. Legacy modules remain in source.
Internal tool changes update Zustand panel state and retain the map canvas.

`useAppStore` owns view, sign-in state, search selection, layer toggles and public
schedule selection. Backend credentials stay in memory. Connected startup does
not restore an administrator login or approved schedules from local storage.
`useOptimizationStore` owns the current authenticated backend plan, saved-work reopening, cancellation,
constraints and candidate catalogs. `useForecastStore` owns the three independent
simulation histories and shared viewing/reached day. `usePublicScheduleStore`
fetches confirmed published visits, cancels stale requests and retains the last
confirmed snapshot on outages. Assistant history is cleared on identity/view
changes, and public tool results omit private planning fields.

## Data and HNI

`providedData.ts` joins the bundled geography, hospital register and offline OSM
clinic snapshot. `healthcareNeed.ts` defines the agreed six-factor Balanced
35/30/15/10/5/5 policy. Missing factors rescale available weights and flag
provisional scores; municipality summaries are population-weighted rollups.
Hospital map markers and distance evidence use the same verified, finite,
located records. Unknown clinic provision is distinct from verified zero.
See [sources](../datasets/SOURCES.md) and [HNI policy](BALANCED_HNI.md).

`backend/data/laguna-planning.json` is an exported snapshot of the same 681
barangays and HNI inputs across 30 LGUs. `prepare-laguna-planning.mjs --check`
checks it without rewriting data. Backend and frontend have matching Paete
restriction geometry; the server never reads a sibling frontend directory.
`OMCM_DATASET=pilot` retains the separate 20-barangay Los Baños–Bay road fixture
for legacy APIs. It does not restrict the provincial `/api/planning/*` workflow.

## Prediction, placement and simulation

Authenticated planning loads validated native `illness-forecast-v2` and
`appointment-demand-v1` XGBoost artifacts. Dated synthetic history ends on the
Manila issue date. Tomorrow's illness input feeds the fixed provincial HNI and
appointment model. CP-SAT maximizes priority-weighted appointments, then favors
shorter modeled travel and fewer open sites, subject to capacity, fleet,
travel, restricted land, flood and explicit link constraints. Results carry
solver status, saved draft ID and model provenance. Failed inference never
substitutes browser-generated placements. Search is bounded; FEASIBLE is not a
claim of proven global optimality.

The 30-day rehearsal retains its deterministic Balanced HNI baseline. New
`models/hni_simulation.py`, `services/hni_simulation.py` and authenticated
simulation routes own dated XGBoost appointment demand, capacity-scaled service,
per-barangay deductions and full timeline metrics. Manual Apply requests backend
evaluation. Optimized generation minimizes population-weighted HNI rather than
the ordinary planner's appointment objective. A feasible manual comparison and
a marginal-gain plan provide solver incumbents; unrounded evaluation retains
the better plan on the requested day. Held locations can rank differently later.

`useForecastStore` stores these transient results, cancels stale requests and
verifies the rendered map average against backend HNI. Optimized locations are
read-only. Service uses the existing 3 km taper, now limited by capacity and safe
modeled access. Both renderers use consistent fill opacity. No database migration
or model retraining is needed. The additive API contract was explicitly approved
for this correction. See [simulation](SIMULATION_MODE.md) and [API](API.md).

The ordinary optimization map preview retains its geographic illustration and
is labeled separately from the capacity-aware simulation. Its saved draft,
appointment objective and publication workflow are unchanged.

## Map rendering and UI

Leaflet/OpenStreetMap is the default renderer; Google Maps is optional. Both
render shared scores, selection, proposed clinics, facility layers and flood
outlines. Only the simulation adds deployed/draft distinctions and 3 km circles.
`map-workspace.css` owns shared map surfaces, buttons, chips, forms, responsive
side sheets, legend and reduced-motion transitions; existing plain CSS and
Lucide icons are reused. `Modal` uses native dialog focus management and unique
accessible titles. The assistant remains a separate floating card.

## Backend and publication

`main.py` initializes FastAPI, SQLite and the pilot, then mounts routers for
municipalities, optimization, simulation, clinics, integrations and assistant.
`config.py` owns the existing Basic authentication and Manila date helpers.
Read-only planning scores/analytics/catalogs now require authentication alongside
all planning mutations. Public health, hospitals, geography and approved schedules
remain available; public notices identify the office rather than a login name.

`repository.py` persists drafts and approved schedules separately. Ordinary
publication accepts tomorrow through Day 7 with a fresh next-day forecast draft;
the booking date is distinct from the forecast date. Today's revisions require a
confirmed emergency override and a trimmed notice of at least 10 characters. Publication is transactional. Neither a new draft nor a
simulation mutates a public deployment. `DATABASE_URL` selects shared PostgreSQL
through Psycopg; absent that value, local SQLite or Vercel scratch SQLite is used.
Scratch storage is temporary and unshared. PostgreSQL publication uses a
transaction-scoped advisory lock to serialize duplicate approval checks. Both
adapters use the same five-table structure and bound SQL parameters. A failed
configured PostgreSQL connection never falls back to SQLite.

The authenticated `GET /api/planning/plans` endpoint returns paginated summaries;
`GET /api/planning/plans/{plan_id}` reopens the exact stored allocation and inputs.
The admin map panel lists drafts and published deployments separately. Selecting
a deployment maps its published snapshot, not a newly generated recommendation.
Schedule synchronization runs in both views; only published schedules enter the
public store. Administrator identity/credentials and private plan payloads are not
restored from browser local storage. Reauthentication is expected after reload.
The simulator remains transient; it never creates deployment records.

## Evidence boundaries

All clinical history and model evaluation is synthetic. Provincial travel uses
adjacency estimates, while the legacy pilot retains its prepared OSRM legs.
No live traffic, patient feed, weather feed, disease-specific validated model,
nightly unattended job, or GPS tracking is claimed. Google Maps rendering has
unit coverage but live key-dependent verification must be reported separately.
Historical architecture/acceptance records describe older builds; the current
[audit](GLOBAL_AUDIT.md) and [verification record](VERIFICATION.md) take precedence.
