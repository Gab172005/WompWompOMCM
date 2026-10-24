# OMCM audit and proposed build plan

> **Global review — 2026-10-24:** [Global audit](GLOBAL_AUDIT.md) and
> [current verification](VERIFICATION.md) supersede the historical branch names,
> push commands, test counts and pilot-only limitations in older sections below.
> The active admin UI stays on `/admin`; connected planning covers all 681
> barangays and requires backend authentication. The agreed HNI percentages and
> both trained XGBoost artifacts are preserved.

## Google API preparation — 2026-10-16

The user requested readiness for Google Maps and Google Routes after the map-first
implementation. This first reviewable build step adds an optional official Maps
SDK loader, a standard-library server Routes adapter, authenticated readiness and
route endpoints, a typed frontend route client, environment examples and tests.
No dependencies or existing data schemas change. Google loading/routing is opt-in;
Leaflet, OSRM pilot evidence and the optimizer remain active as before. No key,
Google response or route is persisted into the pilot or published plans.

Live Google verification is blocked by absent credentials. The Google renderer
and integration of Google travel times into the optimizer are not implemented.
After review, the next step is an optional Google renderer that preserves Laguna
masking/bounds and all existing map/tracking interactions, then credential-backed
validation. Existing road closures cannot be claimed to affect arbitrary Google
routes. See [GOOGLE-APIS.md](GOOGLE-APIS.md) for configuration and exact interfaces.

## Current map-first implementation — 2026-10-16

The latest one-shot user request supersedes the earlier step-by-step stops and
the earlier Google Maps migration requirement. React Leaflet and the existing
stack are retained. Read [INTERFACE-SCOPE.md](INTERFACE-SCOPE.md) for the current
requirement-by-requirement acceptance table, exact browser paths and limits;
older sections below are historical audits.

Implemented: complete bundled Laguna municipality footprint and inverse mask,
locked bounds, municipality search/selection/zoom and details, four choropleth
metrics, facility visibility, a single admin map workspace, in-place optimization
and approval/publication review, preserved weights/sensitivity/baseline, independent
municipal scenario controls, general supplied-road-segment blocking, existing
fleet animation/details, and grounded conversational chat with no-key templates.
The existing maximal-covering solver is preserved. Public read-only view remains
on `/public`. No dependencies were added. The only request-model field addition,
`municipality_outbreak_multipliers`, was explicitly approved by the user. No bundled
JSON schema or boundary coordinates changed. Existing uncommitted work is retained.

Scenario calculations and recommendation changes use Python. Simulation results
are local workspace state and never mutate the shared draft or publication.
General segment IDs reuse `closed_roads`; all affected fixture routes are excluded.
Unsupported diversions are disclosed. Independent town flood values apply to all
available barangay scores; travel exclusions use existing synthetic footprints.
Remote chat uses standard-library HTTPS transport and server-only environment
settings; fallback templates remain usable without credentials. Requests include
server-recomputed scenario evidence and chat history; the assistant cannot publish.

Validation: frontend lint, 40 unit tests and production build/type check pass;
backend 43 tests pass (one existing Starlette/httpx deprecation warning). Headless
Chromium workflow passes at desktop and mobile sizes, including pointer polygon
and road clicks, heatmap scenario changes, proposal/manual/approval flow,
publication isolation, route playback/details, chat history/no-key fallback,
public read-only access, and explicit missing-geography failure. Screenshots are
in ignored `frontend/test-results/map-first-*.png` and were visually inspected.
The e2e script now targets the single-screen workflow; legacy multi-page e2e
source remains preserved in `tests/e2e.mjs`.

Remaining data limits: health and road coverage is the existing 20-barangay
Bay/Los Baños pilot, with eight synthetic sites and 168 route legs. The other
28 LGUs have authentic geometry and explicit missing-data messages. No province-
wide clinical inputs, complete road network, or arbitrary diversions were invented.
Live external AI is not verified because provider credentials were not supplied;
template chat and stubbed provider transport pass. Tracking remains simulated.

### Map-first build plan and completion record

The implementation followed the requested milestone order. Completed work is
recorded here so it is not mistakenly rebuilt from the historical plans below.

| Milestone | Status | Implementation and validation |
| --- | --- | --- |
| 1. Laguna boundaries, bounds and mask | Complete | Reused all 30 authentic municipal geometries from the MIT-licensed `philippines-json-maps` 2023 snapshot. Verified the recorded SHA256; used their combined footprint for the provincial mask and bounds. Missing geometry stops planning explicitly. |
| 2. Map-first layout | Complete | One administrative map, left municipality details, floating controls, legend and collapsible panels. Public view remains a separate route. |
| 3. Map interactions and filters | Complete | Municipality-only search, pointer selection, zoom/highlight, four metrics and matching legend, and a combined hospital/medical-facility visibility control. |
| 4. Optimization wiring | Complete | Reused the Python optimizer, K configuration and candidate-site manual placement. Kept baseline comparison, recommendation acceptance/review, weights/sensitivity, and authenticated approval/publication in the map workspace. |
| 5. Simulation | Complete for supplied pilot; province-wide coverage blocked | Independent municipal flood/morbidity controls, resets, general supplied-road-segment blocking with undo/clear, Python recomputation, route animation and clinic details. Turning simulation off restores the planning baseline. No publication mutation. |
| 6. Chatbot | Template mode complete; live provider unverified | Conversational history, collapse/reopen, server-recomputed evidence, standard-library provider transport and template fallback. Provider/model/key/HTTPS URL stay server-side. |
| 7. Verification | Complete for implemented scope | Frontend lint, build/type check, 40 frontend tests, 43 backend tests, and desktop/mobile Chromium workflows passed. Full acceptance paths and limitations are in `INTERFACE-SCOPE.md`; command results are in `VERIFICATION.md`. |

### Remaining build plan

1. Obtain documented, permitted barangay health inputs, candidate facilities and
   road evidence for the other 28 LGUs before extending simulation coverage.
   Review provenance and completeness first; ask before any schema change or
   dependency addition. Preserve synthetic/estimated labels where applicable.
2. Once those inputs exist, extend the existing import and validation workflow,
   then verify municipal joins, facility containment, closure exclusions,
   capacity constraints and publication isolation. Do not fabricate missing roads,
   travel times, health values or diversions.
3. If a live chat provider is desired, configure the existing server-only
   environment settings and verify a real conversation plus failure fallback.
   No additional model, provider library or frontend credential is needed.
4. Rerun frontend lint/unit tests/build, backend tests and the current
   `tests/map-first.mjs` browser workflow after any implementation changes.
   Capture desktop/mobile screenshots and update the acceptance report with
   actual results and any remaining gaps.

These remaining items are conditional on missing data or provider configuration;
this saved plan does not add features beyond the requested interface. No further
application changes were made while saving this audit and plan. Final deployment
decisions remain with LGU health officers.


## Build Step 5 — simulation audit and build plan (2026-10-16)

The user authorized only Simulation Mode: municipality-specific flood severity,
a 100-year flood preset, morbidity spike, clickable road blocking, fewer clinics,
Python recomputation of safe alternative sites and heatmap results, route playback,
clinic inspection, and explicit application without automatic publication. This
section records the initial source inspection and build plan. The implementation
and validation record below tracks subsequent work. Read earlier steps as history.

### Source findings

- `DriverTracking.tsx` already has a scenario builder, global none/moderate/severe
  flood selection, outbreak barangay selection/multiplier, road-closure checkbox,
  clinic count, playback/play/pause/reset/speed, and day-to-day origins. Preserve
  these working controls. There is no explicit Simulation Mode toggle or
  municipality flood selector and no 100-year preset.
- `ClinicTracker.tsx` already animates route geometry, highlights selected vehicles
  and routes, and displays ETA. Fleet cards already show origin/destination and
  appointments versus capacity. Extend selected-clinic details with assigned
  barangays and suggested services; do not replace the tracking implementation.
- `simulation.py` compares two Python optimizations without publishing. The
  current simulator instead calls `/optimize` and writes its result into the shared
  draft with `setDraft`. Published schedules remain separate, but preview results
  are not isolated from the planner draft. Signed-out/browser paths also use local
  scoring and optimization; the new Python simulation path must not extend these.
- The map currently previews `scorePilot` results. Step 5 should display Python
  scenario results after recomputation and clearly mark stale results after edits.
- `PlacementRequest` supports only global `flood_level`, existing closure IDs,
  outbreak IDs/multiplier, and clinic count. Municipality-specific flood values
  require an agreed request-model extension. Existing strict models reject extra
  fields. Pilot reference validation accepts only the prepared closure IDs.
- `road_evidence` excludes unsafe sites and prepared routes, and the optimizer can
  choose other supported candidates. The pilot has 168 directed route legs and
  one prepared closure; it cannot establish arbitrary real-world diversion paths.
- Existing hazard footprints and health inputs are synthetic. There is no
  calibrated 100-year flood surface. A 100-year preset must be labeled a synthetic
  stress-test assumption, not a validated return-period hazard estimate.
- The working tree already contains prior-step edits. Preserve them and restrict
  new implementation to Step 5. No tests were run for this source audit.

### Step 5 request-model addition

Add optional `municipality_flood_levels` to `PlacementRequest` and frontend
`Config`: a dictionary of existing municipality names to `none`, `moderate`, or
`severe`, defaulting to an empty dictionary. An explicit municipal value overrides
the existing global level for that municipality; omitted municipalities retain
the global level. Reject unknown municipality names. Preserve existing saved
plans through the empty default. Use the existing hazard barangay references to
resolve municipalities. Do not change bundled JSON schemas or add dependencies.

Keep the 100-year preset as UI metadata mapping to severe synthetic flooding for
selected municipalities; its label must explain that no calibrated 100-year
depth/extent data exists. Click-to-block initially targets the existing prepared
closure geometry and uses existing `closed_roads` IDs. Arbitrary road-segment
blocking would need a separately approved model/data extension.

### Build plan

1. Present the exact request-model addition above before implementation, as
   required by the repository rule. The user subsequently reaffirmed Step 5;
   implementation uses that documented addition.
2. Add Simulation Mode and municipal flood controls to the existing simulator;
   retain morbidity, clinic count and playback controls. Show the synthetic
   100-year preset assumption beside the control and permit toggling the prepared
   closure by clicking its visible map geometry.
3. Extend Python hazard selection and scenario scoring to honor municipal flood
   settings consistently in safe-site selection, route exclusion, and returned
   heatmap factors. Reuse existing optimization and scoring engines. Require the
   Python API for the new scenario workflow; preserve existing labeled offline
   rehearsals without introducing another calculation implementation.
4. Store scenario results locally in the simulation workspace. Recompute through
   `/simulate`, update the heatmap from returned scenario barangays, and pause/mark
   results stale when controls change. An explicit Apply simulation to draft action
   transfers a current result into planner review. Publication continues through
   the existing authenticated review/approval and same-day emergency safeguards.
5. Extend clinic inspection with route, ETA, assigned barangays, suggested services,
   and appointments/capacity. Retain route selection, play/pause/speed, and supported
   route geometry; report unavailable safe routes rather than invent diversions.
6. Verify municipal isolation, preset mapping, closure exclusions, reduced fleet,
   Python heatmap results, playback/selection, stale-result handling, and that
   simulation leaves both the shared draft and published schedule unchanged until
   explicit application. Test publication isolation at the API and browser levels.
   Run backend tests, frontend lint/unit tests/build, and pilot browser workflows;
   capture and inspect desktop/mobile screenshots and record actual results here
   and in `VERIFICATION.md`. Stop for user review after Step 5.

No later feature, dependency addition, or broader data correction is included.
Final deployment decisions remain with LGU health officers.


### Build Step 5 implementation and validation

Implemented only Step 5. Simulation Mode adds municipal severity overrides and
an explicitly synthetic 100-year preset, click-to-toggle blocking on the prepared
closure geometry, and zero-to-five available clinics. Existing morbidity surge,
play/pause/speed, timeline, trails, and selection behavior were retained. Selected
clinic cards now include served barangays, suggested services, and appointment
load/capacity, alongside route origin/destination and ETA.

New scenario previews use authenticated Python `/simulate`. Heatmap records come
from the returned Python scenario, not browser rescoring. Edits pause playback,
mark results stale, and prevent application until recomputed. Preview results stay
in the simulator's local state. Only Apply simulation to draft calls `/optimize`
and replaces the planner draft; that action does not publish. Existing Schedules
approval and emergency safeguards still govern publication. Existing offline and
day-to-day rehearsal workflows remain available with Simulation Mode off.

Municipal severity is implemented through the documented optional
`municipality_flood_levels` request field, with empty defaults for older plans.
The Python engine applies it consistently to site/route exclusions and flood score
factors. No dependency or bundled JSON input changed in Step 5.

Scenario alternatives use a fixed Timugan depot origin and tomorrow's date,
explicitly disclosed in the UI. Browser testing exposed that inheriting legacy
next-day origins could strand a vehicle even when Python had checked depot
access; resetting each new-mode alternative to the depot aligns playback with
the engine's evidence. The legacy multi-day rehearsal remains unchanged.

Validation:

- Backend `.venv/bin/python -m pytest -q`: **35 passed**, with the existing
  upstream Starlette/httpx deprecation warning. New pilot tests cover municipal
  isolation, Python flood heatmap values, unsafe-site exclusion, morbidity surge,
  fewer/zero clinics, invalid municipality rejection, and unchanged published
  schedules through both preview and explicit draft creation.
- Frontend `npm run lint`, `npm test` (**38 passed**), and `npm run build` passed.
- Full `npm run test:e2e` passed with `OMCM_DATASET=pilot`. New checks cover preset
  values, independent municipal severity, road-geometry click blocking, Python
  preview responses, reduced fleet, selected clinic details/highlight, stale
  application prevention, explicit draft application, and unchanged publication.
  The browser recorded zero `/optimize` calls during new-mode preview and one
  during explicit application. Existing playback, consecutive-day, approval,
  public and offline rehearsal checks passed with no uncaught browser errors.
- Captured and inspected `frontend/test-results/step5-simulation-desktop.png`
  and `frontend/test-results/step5-simulation-mobile.png` (1440px and 390px).
  Browser checks confirmed no mobile horizontal overflow. Basemap availability
  still depends on external tiles.
- Intermediate browser runs identified a missing road selector class and the
  inherited next-day-origin mismatch described above. Both were corrected before
  the successful full run. A subsequent text-only adjustment clarifies stale
  scenario guidance for the fixed-depot mode.

Limits: only Bay and Los Baños have pilot health inputs; the existing data has one
prepared clickable closure, not a general interactive road network. Alternatives
use existing safe candidate sites and supported route geometry, with no invented
diversions. The 100-year preset activates severe synthetic footprints in both
pilot municipalities; it is not a calibrated return-period flood surface. New
Simulation Mode requires Python/admin sign-in. Estimates are synthetic daily
appointments, not real patient loads or operational safety certification.

### Current review and remaining build plan after Step 5

1. Review Simulation Mode with the Python API and administrator sign-in. Change
   Bay and Los Baños severity independently, try the synthetic 100-year preset,
   select a morbidity surge, click the prepared road closure, and reduce clinics.
2. Recompute and inspect the updated heatmap, supported alternative sites, route
   animation, play/pause/speed, and selected clinic details. Confirm changed
   controls mark the previous result stale and prevent applying it.
3. Confirm previewing leaves the planner draft and published schedules unchanged.
   Use Apply simulation to draft explicitly, then review in Schedules. Publishing
   still requires the existing approval or confirmed emergency workflow.
4. Review the desktop/mobile screenshots and the documented pilot, fixed-depot,
   synthetic-flood, and prepared-road limitations above.
5. Stop for user review. General road blocking, calibrated flood surfaces, broader
   health coverage, earlier audit corrections, and later features require separate
   authorization; this saved plan authorizes no additional implementation.

Step 5 is ready for user review. No later build step started. Earlier audit
corrections remain outside this step. Final deployment decisions belong to LGU
health officers.

Audit date: 2026-10-16.

This audit inspected source code and bundled data. No application code or data was changed during the audit. The app, tests, and build were not run; “fully” means implemented in source, not runtime-certified. Implementation awaits user approval.

## Folder structure

```text
omcm/
├── frontend/
│   ├── src/
│   │   ├── pages/        Public, risk, optimization, simulator,
│   │   │                schedules, analytics, settings
│   │   ├── components/  Maps, choropleth, tracking, charts, controls
│   │   ├── hooks/       Geography aggregation and simulation clock
│   │   ├── services/    API, shared state, browser demo, fleet logic
│   │   ├── types/       TypeScript contracts
│   │   └── styles/      Existing app.css
│   ├── public/data/     Bundled geography and road-pilot fixtures
│   ├── scripts/         Geographic download/import tools
│   └── tests/           Browser workflows
├── backend/
│   ├── main.py          FastAPI routes and administrator authentication
│   ├── risk_scoring.py  Need scoring and explanations
│   ├── optimization.py  OR-Tools allocation and population baseline
│   ├── simulation.py    Before/after scenario comparison
│   ├── app/
│   │   ├── models/      Request/response schemas
│   │   ├── services/    Dataset loading and road/hazard adapters
│   │   └── database/    SQLite repository
│   ├── data/            Pilot JSON, older network, geographic CSV
│   └── tests/           API, engine, geography and export tests
├── datasets/            Exported CSV/GeoJSON and SOURCES.md
└── docs/                Architecture, API, verification and demo guides
```

Frontend unit tests also sit beside source files.

## Frontend–backend communication

[`api.ts`](../frontend/src/services/api.ts) uses `fetch` with JSON over HTTP:

- Base URL: `VITE_API_URL`, otherwise same origin.
- Development: Vite proxies `/api` to `http://127.0.0.1:8000`.
- Reads include `/barangays`, `/clinics`, `/hospitals`, `/boundaries`, `/schedules`, and `/analytics`, all under `/api`.
- Calculations use POST `/risk/calculate`, `/optimize`, and `/simulate`.
- Approval uses POST `/schedules/approve`; emergency revisions have a separate endpoint.
- Administrator actions require server-verified HTTP Basic demo credentials.
- Python stores drafts, published schedules, notices, boundaries, and audit events in SQLite.

The frontend also contains scoring and optimization implementations. It automatically switches to browser demo mode if the backend health check fails, storing rehearsal results locally. The simulator can also calculate locally while signed out. The current code therefore does not fully follow the repository rule that Python performs all calculations.

## Map library

Leaflet 1.9.4 with React Leaflet 5, using OpenStreetMap tiles. The “heatmap” is a polygon choropleth with discrete color bands and a legend, rather than a point-density heat layer.

## Data files and shape

The default backend dataset is `OMCM_DATASET=pilot`. Consult [`datasets/SOURCES.md`](../datasets/SOURCES.md) before changing data.

| Files | Shape and contents |
| --- | --- |
| `backend/data/pilot.json` and `frontend/public/data/pilot/pilot.json` | Identical copies. Top-level keys: `version`, `metadata`, `barangays`, `sites`, `hospitals`, `depot`, `routes`, `closures`, `hazards`, `provenance`. |
| Pilot `barangays` | 20 records in Bay and Los Baños. Fields include PSGC/ID, name, municipality, geography level, coordinates, population, children/elderly counts, combined disease cases, poverty percentage, flood exposure, demand rate, hospital-access minutes, `estimated`, source/date/confidence, and geography source. |
| Pilot `sites` | 8 candidates: ID, barangay ID, name, coordinates, capacity, eligibility, verification flag, hazard references, and source. Illustrative locations, not verified schools, barangay halls, or health centers. |
| Pilot `hospitals` | 1 illustrative care reference, with ID, name, barangay, coordinates, services, and verification flag. No hospital capacity field. |
| Pilot `routes` | 168 directed road legs: `id`, `origin_id`, `site_id`, `[longitude, latitude]` coordinates, `duration_seconds`, `distance_meters`, `source`, and `blocked_by` hazard/closure IDs. |
| Pilot hazards/closures | 4 synthetic flood Polygon/MultiPolygon features in a GeoJSON FeatureCollection; 1 closure represented by a coordinate segment. Hazard properties include ID, level, name, barangay ID, and synthetic flag. |
| `frontend/public/data/geo/laguna_municipalities.geojson` | 30 municipal/city Polygon/MultiPolygon features with PSGC codes and names. |
| `frontend/public/data/geo/laguna_barangays.geojson` | 681 barangay features with PSGC codes, names, and municipality. |
| `frontend/public/data/pilot/barangays.geojson` | The 20 pilot barangay polygons. |
| `frontend/public/data/geo/source.json`, `LICENSE.txt`, `README.md` | Boundary provenance, snapshot, and licensing. `laguna_record_mapping.json` is currently empty. |
| `datasets/population.csv` | 20 rows: IDs, geography, population/age counts, poverty, flood exposure, access minutes, demand rate, and provenance. |
| `datasets/disease_cases.csv` | 20 rows: IDs, names, municipality, combined disease count, date, and confidence. |
| `datasets/clinic_sites.csv` | 8 rows: IDs, coordinates, capacity, eligibility, verification, hazards, and source. |
| `datasets/municipalities.geojson`, `barangays.geojson`, `flood_hazards.geojson` | Exported municipality boundaries, pilot barangays, and synthetic flood footprints. |
| `backend/data/barangays.csv` | 681 geographic records: names, municipality/province, coordinates, adjacency labels/counts, boundary-information fields, source URLs, and retrieval time. The non-pilot loader generates synthetic indicators. |
| `backend/data/network.json`, `metadata.json` | Older demonstration network: 29 road links, 8 sites, 3 hospitals; source/travel metadata. These are not the default pilot inputs. |

### Data gaps relative to requirements

- Raw inputs use counts, percentages, and minutes; calculated factors and need scores use 0–100, rather than storing every indicator as 0–1.
- Morbidity is one combined count; dengue and leptospirosis are not separate.
- Hospital capacity is absent.
- Pilot records carry `estimated: true`, but that field does not consistently survive into scored API records and map details.
- All 30 municipalities have boundaries, but default health inputs cover only two municipalities. Others show no data.
- Health, capacity, and hazard values are synthetic, not PSA/GeoRiskPH observations. No patient-level records are used.

## Feature coverage

| Requested feature | Status | Findings |
| --- | --- | --- |
| Public view: today’s fixed clinic map and schedule | Fully | `/public` defaults to today and displays approved destinations, hours, and services. Drafts do not appear. Ordinary approval is tomorrow onward; changing today requires an explicit emergency override and notice. |
| Admin map: Laguna-only, heatmap/legend, hospitals, simulated clinics | Partly | Laguna polygons, metric shading, legend, hospital/site markers, and clinic positions exist. The map initially fits Laguna but has no hard pan bounds. Pilot health coverage is limited to Bay/Los Baños. |
| Click municipality: zoom, highlight, population/need/rank panel, barangay layer | Partly | Click opens population/need details; rank appears in tooltips/register. No selection-driven zoom or rank in the side panel. Selection highlighting is incomplete: styling reads selection but is not reliably reapplied immediately. No municipality drill-down barangay layer; simulator hazard polygons do exist. |
| Filters: municipality search, hospital toggle, population density/flood/morbidity/overall need | Partly | Municipality dropdown exists, but no text search. “Facilities” toggles hospitals, candidates, and clinic markers together. Overall need, disease burden, and flood exposure exist. Population density is missing; vulnerable population is a different metric. |
| Composite Need Index, adjustable weights, sensitivity check | Partly | Python calculates normalized weighted disease, vulnerability, accessibility, poverty, and flood factors. Sliders, ranks, and contribution explanations exist. No dedicated weight-perturbation sensitivity/stability check. |
| Optimization: K, manual placement, maximal covering, draft/approve/publish, baseline | Fully | Workflow spans Optimization and Schedules. K, capacity, travel limit, eligible sites, and manual candidate selection exist. Python uses OR-Tools for capacity-constrained priority-weighted demand coverage. Draft → approve/publish and calculated population-baseline comparison exist. Approval and publication are one action; manual placement selects existing sites rather than arbitrary coordinates. |
| Simulation: flood severity, morbidity spike, road closures, fewer clinics, route animation | Fully | All requested controls exist, including moderate/severe flood scenarios, disease surge, closure, clinic count, animated vehicles, playback, trails, and ETA. Uses prepared pilot routes; blocked routes are excluded without inventing diversions. |
| AI assistant explaining recommendations | Not at all | Deterministic score explanations, site reasons, and service suggestions exist. No conversational AI assistant or model integration. |
| Nightly optimization run button | Not at all | “Optimize tomorrow” exists, but no nightly-job button, scheduled execution, or job history. |

Primary implementation references:

- [`MapView.tsx`](../frontend/src/features/map/components/MapView.tsx) and [`Heatmap.tsx`](../frontend/src/features/map/components/Heatmap.tsx)
- [`PublicDashboard.tsx`](../frontend/src/features/public/PublicDashboard.tsx)
- [`Settings.tsx`](../frontend/src/features/settings/Settings.tsx) and [`risk_scoring.py`](../backend/services/risk_scoring.py)
- [`AdminDashboard.tsx`](../frontend/src/features/optimization/AdminDashboard.tsx) and [`optimization.py`](../backend/services/clinic_optimizer.py)
- [`Schedules.tsx`](../frontend/src/features/optimization/DeploymentApproval.tsx) and [`repository.py`](../backend/services/repository.py)
- [`DriverTracking.tsx`](../frontend/src/features/simulation/DriverTracking.tsx) and [`ClinicTracker.tsx`](../frontend/src/features/tracking/ClinicTracker.tsx)

## Original proposed build plan — historical

The user subsequently authorized a specific Build Step 1 covering the Composite
Need Index, weight sliders, top-K sensitivity, and floating map filters. That
explicit scope takes precedence over the numbering below. The verification and
correction plan following this historical plan describes the current state.

Reuse the existing application. Finish one step at a time and stop for user review after each step.

1. **Complete municipality interaction.** Extend `MapView`/`Heatmap` with click-to-zoom, reliable selection highlighting, side-panel rank, text search, and a barangay drill-down using bundled polygons.
2. **Complete map filters.** Separate hospital visibility from clinic/site visibility, add population density with a documented area calculation, and decide whether Laguna-only means hard navigation bounds.
3. **Consolidate calculations in Python.** Reuse existing scoring/optimization engines; replace frontend calculation paths with API results. Preserve clear browser rehearsal labeling while agreeing how offline behavior should work.
4. **Resolve data gaps.** Propose exact schema changes for separate disease indicators, hospital capacity, facility categories, and propagated estimate flags. Obtain user approval before changing any schema.
5. **Add sensitivity checks.** Reuse Python scoring and optimization to compare weight perturbations, rank shifts, and placement stability.
6. **Add nightly-run workflow.** Reuse optimization and draft persistence; add a manual nightly-run action and run status/history. Automated scheduling requires an agreed hosting approach. Runs create drafts for officer review.
7. **Add the AI explanation assistant.** Reuse scores, contributions, constraints, and baseline results as evidence. Agree provider, server-side configuration, and any dependency additions first.

Retain the existing public schedule, optimization, approval, and simulator implementations. Validate each approved step with relevant tests, lint/build, and browser checks for workflow changes. Do not add dependencies or change the data model without approval. Keep `OMCM_DATASET=pilot` for fleet-demo work.

OMCM remains decision support only. Final deployment decisions belong to LGU health officers.

## Build Step 1 verification — 2026-10-16

This follow-up inspected the actual changes against this audit and the user's
authorized scope. The earlier claim that Build Step 1 was fully complete was too
broad. No implementation files were changed during verification.

### Verified implementation

- Preserved the five existing scoring factors and weight sliders; added the
  approved population weight and slider. Python uses average-rank population
  percentile to limit outlier influence, while disease and vulnerability use
  rates/shares. Inputs are normalized to 0–1; existing factors, contributions,
  and scores retain their 0–100 API/display scale. The six default weight values
  total 110 and are normalized by that total.
- Added authenticated `POST /api/risk/sensitivity?top_k=3` and its Settings
  display. Each weight is independently perturbed by ±5 points, clamped to
  0–100, and renormalized. Results distinguish top-K membership and order changes.
  All 12 default-weight trials matched independent full Python rescoring.
- Added the floating municipality text search, independent hospital toggle,
  population density, flood risk, morbidity, and overall need metrics. Heatmap
  shading and legends follow the active metric.
- Density uses represented population divided by spherical municipal polygon
  area, subtracting holes. It is labeled estimated represented density because
  available health records do not cover all residents or municipalities.
- No existing JSON input files or dependencies were added or changed. The user
  explicitly approved the population weights-model addition and sensitivity API.

### Findings requiring correction

1. **Existing map metrics were removed.** The vulnerability and hospital-access
   layers worked before this change but disappeared from the metric selector and
   its type. This violates the instruction to preserve working features.
   References: [`MapView.tsx`](../frontend/src/features/map/components/MapView.tsx),
   [`mapMetrics.ts`](../frontend/src/components/mapMetrics.ts), and
   [`Heatmap.tsx`](../frontend/src/features/map/components/Heatmap.tsx).
2. **Estimate provenance still disappears from backend scores.** All 20 pilot
   inputs carry `estimated: true`; verification found zero scored backend
   records retaining that field and zero with an explicit estimated warning.
   The added warning only handles municipality-level rows or missing values,
   so it does not cover these pilot barangay records. The Build Step 1 entry in
   `VERIFICATION.md` overstates completion of estimate labeling.
   References: [`risk_scoring.py`](../backend/services/risk_scoring.py),
   [`results.py`](../backend/models/results.py), and
   [`VERIFICATION.md`](VERIFICATION.md).
3. **Python-only calculations remain unresolved.** The change extended
   `scorePilot` with population percentile calculation. This preserves browser
   demo compatibility but extends the duplicated calculation path already
   identified above; it does not satisfy the repository rule that Python owns
   scoring and scenario calculations. Sensitivity itself correctly requires the
   Python backend and is explicitly unavailable in browser demo mode.
   Reference: [`pilot.ts`](../frontend/src/services/pilot.ts).

### Validation evidence and limits

- Fresh backend verification: `.venv/bin/python -m pytest -q` — **30 passed**,
  with one upstream Starlette/httpx deprecation warning.
- Fresh frontend verification: `npm run lint`, `npm test`, and `npm run build`
  — **passed**, including **37 frontend tests**.
- An independent pilot-data check compared all 12 sensitivity trials with full
  Python rescoring and confirmed identical top-three IDs.
- `npm run test:e2e` passed during implementation, including the new search,
  hospital visibility, metric legend, population slider, and sensitivity checks,
  plus existing fleet and publication workflows. It was not rerun during the
  follow-up verification. Desktop and 390px screenshots were captured; the mobile
  filter card and sensitivity screenshot were inspected.
- The small high-risk regression test demonstrates priority under a selected
  disease-heavy weight configuration. Percentile scaling bounds population
  influence; it does not guarantee small-area priority under every user-selected
  weighting, such as population-only scoring.
- Sensitivity evaluates barangay need rankings, not clinic placement stability
  or allocation changes. Separate disease counts, hospital capacity, municipal
  drill-down, hard map bounds, and broader geographic health coverage remain
  outside this authorized Build Step 1.

## Current correction and build plan

Complete only the authorized step, preserve working functionality, and stop for
user review before starting another build step. This document records the plan;
it does not authorize additional model changes or implementation work.

1. **Restore existing map layers.** Retain the four requested metrics and restore
   vulnerability and hospital accessibility, including their labels, heatmap
   values, legends, and browser checks. Reuse the existing factor data.
2. **Carry estimate provenance through scoring and display.** Reuse existing
   source flags and warnings. Propagate a clear estimated warning into scored
   records and municipal details; test the pilot case and municipal aggregation.
   If exposing a structured estimate field changes the response model, obtain
   approval for that exact addition first. Correct the overstatement in
   `VERIFICATION.md` alongside the implemented behavior.
3. **Resolve the browser calculation boundary.** Inventory scoring and scenario
   call paths, retain the Python engines, and define the offline demo behavior
   before replacing the browser calculation paths. A possible approach is to
   show bundled, clearly labeled read-only results offline and require the API
   for adjustable calculations. Agree that behavior with the user rather than
   silently removing an existing demo workflow. Any broader consolidation beyond
   Build Step 1 requires separate authorization.
4. **Close Build Step 1 verification.** Check restored layers, estimate labels,
   backend sensitivity against full rescoring, and the small high-risk case under
   representative defaults and adjusted weights. Run relevant backend/frontend
   tests, lint/build, and browser workflows; update verification evidence and
   capture revised UI screenshots. Stop for user review.
5. **Defer later features.** Do not start municipality drill-down, new data
   fields, clinic-placement sensitivity, nightly runs, or AI integration until
   separately authorized. Reuse the historical plan where still applicable and
   skip features already verified working.

## Build Step 2 — municipality interaction and barangay layer (2026-10-16)

The user explicitly authorized Build Step 2: municipality click-to-zoom and
highlight, a right-side population/need/rank/top-factors panel, barangay
boundaries when zoomed in, barangay scores rolled up to municipalities, and a
map locked to Laguna. This authorization supersedes the earlier deferral of
municipality drill-down and hard map bounds. Unrelated Build Step 1 corrections
and later features remain outside this step.

### Findings and build plan

`aggregateMunicipalities` already sums represented population, population-weights
existing barangay scores and contributions, and ranks municipalities with data.
The existing detail panel already displayed population, need, and contributions.
Preserve these calculations and extend the presentation rather than rewrite scoring.

1. Fit the selected municipal polygon, reserve space for the desktop panel, and
   immediately redraw its highlight above barangay polygons. Keep dropdown and
   polygon selection consistent; Recenter clears selection and fits Laguna.
2. Display municipal rank among areas with data and the three largest rolled-up
   factor contributions. Preserve the complete contribution list in expandable
   details and retain existing service and synthetic-data information.
3. Load the existing 681 barangay polygons, reveal them at zoom 12+, and match
   existing scored records using the established PSGC matching rules. Display
   missing health inputs as No data. Barangay clicks select their municipality.
4. Derive navigation bounds from all municipal boundaries, independently of
   search results. Set maximum bounds, full drag viscosity, and a viewport-aware
   minimum zoom. Refit on resize without changing the province bounds.
5. Verify record matching and rollup consistency, selection/highlighting, zoom
   layer transitions, recentering, bounded navigation, and existing workflows.
   Capture desktop/mobile screenshots and stop for user review.

### Implementation and limits

Implemented in `MapView.tsx`, `Heatmap.tsx`, and the new `BarangayLayer.tsx`.
Scoring engines, input JSON, API schemas, and dependencies were not changed.
Municipal rollups continue using existing scored barangay results; no new
frontend need-scoring algorithm was introduced. The pre-existing browser demo
calculation boundary remains unresolved and outside this step.

Navigation is constrained to Laguna's geographic bounding rectangle, not an
irregular polygon clip. Neighboring basemap context can remain visible around
Laguna. Barangay density uses the municipal legend's scale; the highest density
band is open-ended. Public views retain municipality-level presentation.

Only 20 pilot barangays in Bay and Los Baños have health inputs. Other polygons
remain visible as No data; represented population is not a full municipal census.
Final deployment decisions remain with LGU health officers.

### Build Step 2 validation

- `npm run lint` — passed.
- `npm test` — 38 passed. Added a check matching all 20 pilot scored records to
  the 681-polygon layer and verifying their municipal population and score rollups.
- `npm run build` — passed.
- `npm run test:e2e` — final run passed with `OMCM_DATASET=pilot`, including
  selection-driven zoom, immediate highlight, panel fields, 681 barangay paths,
  recenter/layer transitions, minimum zoom, repeated bounded drags, and existing
  fleet, approval, public, sensitivity, and browser-demo workflows. No uncaught
  browser errors. An intermediate run timed out on the existing simulator Reset
  action; a full rerun passed without changing simulator code.
- Browser testing exposed a stale zoom subscription on recenter. Replaced it
  with `useSyncExternalStore` so layer visibility follows Leaflet zoom changes.
- Inspected `frontend/test-results/step2-municipality-desktop.png` and
  `frontend/test-results/step2-municipality-mobile.png` (1440px and 390px).
- No backend implementation changed in this step; backend tests were not rerun.

Build Step 2 is ready for user review. No subsequent build step started.

## Build Step 3 — clinic optimization (2026-10-16)

The user authorized only clinic optimization and its comparison panel. Reused
Python's existing OR-Tools capacity-constrained maximal covering model, road
exclusions, manual-site validation, and population-first baseline. Added a
collapsible Clinic Optimization panel, manual candidate selection, flood and
closure controls, and Generate recommendation. The optimization panel requires
the Python API; pre-existing browser simulator rehearsals remain available.

The user approved a `facility_type` addition to the pilot sites and API/type
contract. The eight existing points now have synthetic school, barangay hall,
or health center categories; positions, route evidence and capacities are
unchanged. Categories remain unverified. The importer preserves these labels.
Python appends suggested services from actually served barangays to each site's
existing reason field. No dependency was added.

The baseline comparison adds high-risk appointments and per-metric percentage
improvement, with lower travel and unserved demand treated as improvements.
A zero baseline displays N/A when relative improvement is undefined. Flood-safe
accessibility now measures the fraction of daily demand served through
scenario-safe routes, rather than always reporting 100% for nonempty plans.
K remains the available-clinic ceiling: exclusions and reachable demand may
produce fewer than K useful placements. The baseline uses the same safety,
travel, and capacity restrictions and stages at the most populated eligible
barangays before filling appointments in population order.

Validation: frontend lint, 38 unit tests and production build passed; backend
32 tests passed (one upstream Starlette/httpx deprecation warning), including
an exhaustive small allocation oracle. Full Playwright workflows passed with
OMCM_DATASET=pilot, including panel collapse, manual K limit, Python generation,
service/category display and the comparison card. Desktop and 390px mobile
screenshots are in frontend/test-results/step3-optimization-*.png; mobile was
inspected and the browser test confirmed no horizontal overflow. Existing fleet,
publication, public and offline-demo checks also passed. No subsequent step
started. Final deployment decisions remain with LGU health officers.

The user also approved `unserved_population` on allocation metrics. Python
computes represented population minus daily allocated residents; the panel
shows this separately from unserved daily demand. Legacy saved allocations
can omit it and display Unavailable. It does not measure unmet clinical need.

### Final findings and remaining build plan

Build Step 3 is implemented and awaiting user review. The final validation run
included the approved unserved-population metric: 32 backend tests, 38 frontend
tests, lint, production build, and the full pilot browser workflow passed.
The refreshed mobile screenshot was inspected after that run. This entry records
implementation evidence, not independent certification for operational use.

1. **Review Build Step 3.** Check the collapsible panel, K, manual candidate
   selection, flood/closure controls, Python recommendations, service suggestions,
   and baseline comparison. Review screenshots at
   `frontend/test-results/step3-optimization-desktop.png` and
   `frontend/test-results/step3-optimization-mobile.png`.
2. **Retain the documented limits.** K is an upper bound, not a guarantee of
   exactly K placements. Candidate categories and health inputs are synthetic;
   facilities are unverified. Coverage counts daily allocated appointments.
   Unserved population covers represented records only, and flood-safe access
   relies on scenario fixtures rather than verified field conditions.
3. **Resolve earlier corrections only with authorization.** The Build Step 1
   findings concerning removed map metrics, estimate provenance, and duplicated
   browser calculations remain open in this audit. Step 3 did not independently
   re-audit or resolve them. Agree offline behavior before broader consolidation;
   preserve working browser rehearsals until that behavior is authorized.
4. **Defer later features.** Do not start clinic-placement sensitivity, nightly
   execution, AI integration, broader health-data coverage, or additional data
   model changes without separate authorization. Municipality interaction and
   barangay boundaries were already delivered in Step 2; preserve them.

No further implementation is authorized by this saved plan. Continue one
approved build step at a time, with user review between steps. Final deployment
decisions remain with LGU health officers.

## Build Step 4 — draft review and public schedule (2026-10-16)

Authorized scope: tomorrow's optimizer draft, planner acceptance/manual site
changes, Approve and publish, today's fixed active plan, an anonymous read-only
public map/schedule, health advisories, and emergency public banners.

Reused the existing Python draft persistence, manual-site validation, authenticated
publication, same-day approval lock, and atomic emergency revision/notice workflow.
The public route already worked without login and showed published destinations,
hours, services, and date-specific notices. No scoring engine, schema, JSON input,
or dependency changed.

Made tomorrow's DRAFT status and today's lock explicit in Schedules. Added
Override recommended sites to seed manual selection from the recommendation so
planners can retain other hubs while changing a site. Existing configuration
invalidation disables approval until the revised selection is regenerated through
the optimizer. Renamed the ordinary action Approve and publish. Safety, capacity,
and eligibility constraints still apply to manually selected sites.

Public view still defaults to today's Philippine date, with a Today’s schedule
shortcut after browsing another published date. Emergency notices now use alert
semantics. Added clearly labeled static demo health advisories about checking
hours, LGU flood announcements, and available health education. These are not a
live advisory feed or verified health alerts. Browser-only rehearsals retain their
existing local-only labels. Final deployment decisions belong to LGU health officers.

Validation results are recorded in VERIFICATION.md. Stop here for user review;
no later build step is authorized by this entry.

### Step 4 validation and findings

- Backend: `.venv/bin/python -m pytest -q` — 33 passed, with the existing
  upstream Starlette/httpx deprecation warning. The new regression verifies
  that an unpublished manual draft is absent from public schedules, ordinary
  same-day approval is rejected, and tomorrow's publication preserves today's
  active schedule.
- Frontend: `npm run lint`, `npm test` (38 tests), and `npm run build` passed.
- `npm run test:e2e` passed with `OMCM_DATASET=pilot`. Checks cover starting
  manual overrides from recommended sites, approval disabled until regeneration,
  confirmed emergency publication, anonymous public access, today's default
  date, the emergency alert banner, and advisory visibility. Existing fleet,
  publication, sensitivity, and offline rehearsal workflows also passed, with
  no uncaught browser errors. The first Step 4 browser attempt used desktop
  navigation at mobile width; correcting the test viewport resolved that failure.
- Captured and inspected
  `frontend/test-results/step4-public-desktop.png` and
  `frontend/test-results/step4-public-mobile.png` at 1440px and 390px. The mobile
  capture shows partially loaded basemap tiles after resize; schedule details
  and the emergency banner are visible. Tile completion after resize was not
  asserted by the browser test.
- Public advisories are static demonstration content. No live advisory feed or
  administrator advisory editor was added. Emergency notices appear when public
  data is loaded or refreshed; push updates were not implemented.
- This records implementation and test evidence, not independent operational
  certification. Existing synthetic-data and browser-rehearsal limits remain.

### Current review and remaining build plan

1. **Review Build Step 4.** Generate tomorrow's recommendation, accept it or
   select Override recommended sites, change the desired hubs, regenerate,
   and click Approve and publish. Confirm the anonymous public page shows the
   published location, hours, and services for the selected date.
2. **Review today's lock and emergency path.** Confirm a new draft leaves today's
   schedule unchanged. A confirmed administrator emergency revision must include
   a public notice; refresh the public page to review the revised map, schedule,
   and alert banner. Inspect the desktop/mobile screenshots above.
3. **Address remaining corrections only after authorization.** The earlier
   findings concerning removed map metrics, estimate provenance, and duplicated
   browser calculations remain open in this audit and were not independently
   re-audited in Step 4. Agree offline behavior before changing working browser
   rehearsals. If reproducible during review, investigate map tile completion
   after mobile resize within an explicitly approved correction scope.
4. **Defer later features.** Clinic-placement sensitivity, nightly execution,
   AI integration, live advisory management, broader health-data coverage, and
   further model changes require separate authorization. Preserve the existing
   municipality, optimization, fleet, and publication workflows.

Build Step 4 is implemented and awaiting user review. No subsequent build step
has started. This saved plan does not authorize additional implementation;
continue one approved step at a time. Final deployment decisions belong to LGU
health officers.

## Build Step 6 — explanation assistant and manual nightly action (2026-10-16)

Authorized only Step 6. The user explicitly approved the server-only explanation
endpoint using Python's standard library and deterministic model evidence, with a
small provider interface for future LLM configuration. No external AI provider,
new dependency, bundled JSON change, or persisted model change was introduced.

Added Show/Hide explanation assistant to Optimization and Simulator. It explains
each allocated site's existing reason, each served barangay's top three weighted
need-index contributions, allocated appointments, modeled travel, capacity,
population-baseline trade-offs, and flood/blocked-access exclusions. It reports
manual placement, empty allocations, solver limitations, and aggregate scenario
changes, without claiming causal attribution when multiple parameters change.
Changed simulator controls suppress explanations until recomputed. Requests are
cancelled when hidden or superseded. Failures expose retry; offline mode requires
the Python API rather than generating browser explanations.

Authenticated `/api/explanations` reuses the existing SimulationRequest contract,
recomputes model evidence without saving plans, and returns text/provider.
`OMCM_EXPLANATION_PROVIDER=deterministic` selects the small Python provider
interface; unsupported adapters fail explicitly. There is no conversational LLM
or external provider connected. The exact decision-support footer appears in the
assistant and application/public footers.

Run nightly optimization manually calls Python risk recomputation and draft
optimization using current controls. It updates the planner only on success and
shows the server creation timestamp in Philippine time. Schedules retains the
existing tomorrow default and explicit officer approval. The timestamp covers
successful runs in this session; no unattended scheduler or persistent job history
was added. Publishing remains a separate authenticated action.

Validation results are recorded in VERIFICATION.md. Stop after Step 6 for user
review; no later feature or earlier audit correction is authorized here.

Step 6 validation passed: 38 backend tests, 38 frontend tests, lint, production
build, and full pilot browser workflows. Desktop/mobile screenshots were captured
and inspected; no horizontal overflow or uncaught browser errors were observed.
See VERIFICATION.md for evidence and limits. Step 6 is ready for user review.

### Step 6 audit findings and limits

- The assistant explains recomputed Python results; it does not read an immutable
  saved allocation snapshot. Its inputs reproduce the planning/scenario request,
  and its endpoint neither persists drafts nor publishes schedules. Explanations
  describe model evidence, not proof that one factor caused a site to win.
- Top factors are reported per served barangay using existing weighted
  contributions. Coverage means estimated daily appointments, not population-wide
  healthcare access. Capacity, travel, and baseline comparisons retain that limit.
- Scenario summaries identify changed parameter names, added/removed sites, and
  before/after appointment and travel metrics. Multiple simultaneous changes do
  not establish individual causal effects. Stale simulator results require
  recomputation before explanation.
- The provider interface is ready for a separately implemented adapter, but only
  the deterministic provider exists. An environment variable alone cannot enable
  an LLM. No external provider, credentials, or conversational assistant was added.
- The nightly action is a manual sequence of existing risk and optimization API
  calls. It is not an atomic scheduled job. A failed sequence can complete risk
  calculation without creating a draft; the displayed planner result and last
  successful timestamp are retained on failure.
- Tomorrow is the existing Schedules default, not a new deployment-date field on
  the saved draft. Officers still choose/review the publication date. The last
  updated timestamp comes from the successful saved draft and resets with the
  browser session; persistent run history and unattended execution are absent.
- Earlier findings concerning removed map metrics, estimate provenance, and
  duplicated browser calculations were not independently re-audited or resolved
  during Step 6. Existing synthetic-data and prepared-road limitations remain.

### Current review and remaining build plan after Step 6

1. **Review the explanation assistant.** With Python/admin access, generate a
   recommendation and toggle the assistant. Compare its site reasons, top factors,
   assigned appointments, travel, capacity, and baseline statements with the
   displayed model results. Confirm the exact decision-support footer.
2. **Review scenario explanations.** Change municipality flooding, morbidity,
   prepared road closure, and clinic availability. Confirm edits suppress stale
   explanations; recompute and inspect site additions/removals and metric changes.
   Confirm explanation requests leave drafts and published schedules unchanged.
3. **Review the manual nightly run.** Run using current controls, inspect the
   successful timestamp, then review tomorrow's draft in Schedules. Confirm the
   public schedule changes only through explicit officer publication. Retain the
   documented session-only timestamp, date-default, and manual-run limits.
4. **Review validation artifacts.** See VERIFICATION.md and
   `frontend/test-results/step6-assistant-desktop.png` and
   `frontend/test-results/step6-assistant-mobile.png`. Recorded tests establish
   implementation evidence, not independent operational safety certification.
5. **Stop for user review.** Any persistent job history, scheduled execution,
   external LLM adapter, saved-snapshot explanations, broader data coverage, or
   earlier audit correction requires separate authorization. Agree exact model
   changes or dependencies before implementing them. Preserve existing workflows.

This saved plan authorizes no additional implementation. No later build step
started. Decision-support only. Final deployment is decided by LGU health officers.
