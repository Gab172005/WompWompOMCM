# Verification record

## Planning panels, assistant and repository guides — 2026-10-25

**Story:** Public and administrator users open contextual map panels, understand
planning choices, inspect backend results and use the assistant without leaving
the map. New repository readers can find the purpose, setup and methodology
without knowing the development conversation.

| Boundary | Result and evidence |
| --- | --- |
| Interface | Expanded explanations, access search/reset and three scenario comparison cards fit 390/320 px. Native disclosures respond to Enter. |
| Client → API | Connected optimization suite passes actual FastAPI/XGBoost/CP-SAT generation, replanning and flood constraints. Failed service requests create no fallback placements. |
| API → data → map | Simulation suite reports Manual HNI 43.67060777020463 and Optimized HNI 43.60322274720275 on its fixed comparison. Host/neighbor deductions, markers and map averages pass. |
| Publication → public | Connected optimizer approval and a fresh public session pass. UI suite also checks real published visits using isolated credentials and storage. |
| Assistant | Common commands use zero external model requests; provider-selected action/failure tests use stubbed responses. Public welcome shortcuts omit private planning tasks. |
| Responsive behavior | Workspace suite covers desktop, tablet, phone and landscape, composer growth and simulated visual-viewport keyboard geometry. |
| Documentation and icon | Local links in both READMEs and the UI guide resolve. SVG, 32 px PNG and 180 px touch icon return successfully. |

Required checks: frontend lint, 153 tests across 17 files, production build and
113 backend tests pass. Planning-export and sensitivity checks pass. Existing
bundle-size and Starlette/httpx advisories remain. No weights, model artifacts,
source datasets, administrator credentials or backend behavior change in this
interface revision. See [exact UI changes](UI_REFINEMENT.md#planning-explanations-and-assistant-redesign).

Screenshots are ignored local artifacts under `frontend/test-results/`. Basemap
tiles are suppressed for deterministic capture. No physical phone keyboard,
live Google key, production deployment or live external chat provider is claimed.

## Map workspace UI refinement — 2026-10-25

Branch: `layout/maps-workspace-refinement`, based on the completed HNI fix.
[UI_REFINEMENT.md](UI_REFINEMENT.md) documents the exact files, design references,
presentation behavior and review steps. This pass does not change backend code,
HNI calculations, trained artifacts, datasets or administrator credentials.

| Check | Result |
| --- | --- |
| Frontend `npm run lint` | Passed |
| Frontend `npm test` | 153 passed across 17 files |
| Frontend `npm run build` | Passed; existing bundle-size advisory |
| Backend `.venv/bin/python -m pytest -q` | 113 passed; existing Starlette/httpx deprecation warning |
| `npm run test:ui` | Passed; real connected public visits/auth, search, hospital source details, barangay view, aligned planner fields, preselected and empty pickers, keyboard/pointer selection, tap/swipe resize, modal/settings/layers, assistant focus, reduced motion and one retained map |
| `npm run test:hni` | Passed; retained source counts/HNI/search and selected-place mobile sheet geometry |
| `npm run test:simulation` | Passed; real shared-backend manual/optimized comparison, markers and revised responsive controls |
| `npm run test:optimization` | Passed; real allocation, picker replanning, approval/public refresh, flood outlines and unavailable-service handling |
| `npm run test:assistant` | Passed; local commands, provider-stubbed actions/failure, retained conversation and visible mobile reopen control |
| `git diff --check` | Passed |

The new UI suite inspects 1440×1000, 1024×768, 768×1024, 760×1024, 390×844,
320×740 and 844×390 viewports. It checks that dropdowns and sheets settle inside
the viewport, paired controls align, playback contents fit their own card,
the launcher does not cover playback, and mobile legend/sheet/playback bands do
not overlap. Short landscape tool sheets have a reading expansion. The original
Leaflet map DOM node remains mounted across administrator tool changes.

Screenshots were inspected, including tablet playback, small-screen picker,
public care/visits/source records, barangay details, sign-in, assistant and map
settings. Ignored artifacts are `frontend/test-results/ui-*.png`, plus the
existing connected-suite images. The tablet review caught a compact-card content
overflow/launcher collision; the responsive timeline now covers tablet widths,
not just phones. The focus ring remains opaque blue for visibility.

Browser verification uses Chrome/Leaflet. Google live-key rendering, physical
mobile keyboards and live provider responses were not newly verified. Basemap
tiles are suppressed for deterministic capture. Demo suites can log expected
catalog connection errors without a backend; connected UI/optimizer/simulation
suites use isolated real FastAPI processes and temporary credentials/databases.
No production data, hosted schedules or deployment was changed.

## Backend-owned simulation HNI — 2026-10-25

Branch: `fix/simulation-hni-objective`, including the preceding audit/UI and
seven-day scheduling work. Exact file/logic inventory and browser steps:
[SIMULATION_HNI_FIX.md](SIMULATION_HNI_FIX.md). The new simulation API contract
was explicitly approved; no storage migration, model retraining, source-data,
HNI-factor or credential change was made.

| Check | Result |
| --- | --- |
| Frontend `npm run lint` | Passed |
| Frontend `npm test` | 148 passed across 16 files |
| Frontend `npm run build` | Passed; existing bundle-size advisory |
| Backend `.venv/bin/python -m pytest -q` | 113 passed; existing Starlette/httpx deprecation warning |
| Connected `npm run test:simulation` | Passed with real FastAPI, existing XGBoost models, CP-SAT, isolated credentials and temporary SQLite |
| Connected `npm run test:optimization` | Passed; ordinary planning, flood overlay, manual replan, seven-day publication and fresh public session remain functional |
| `git diff --check` | Passed |

Backend checks cover hand-computed population-weighted deductions, capacity and
overlap, exhaustive small-instance optima, bounded-solver incumbent retention,
identical manual/optimized evaluation, dated-history prefix parity, fixed group
weights, flood restrictions, invalid histories, authentication/model errors,
and inability to publish a transient simulation proposal. The real API test
compares five-clinic Manual/Optimized HNI on Day 15.

The browser uses three clinics on Day 1: Manual **43.6706077702**, Optimized
**43.6032227472**. It verifies the same day/fleet/manual incumbent, returned HNI
matching the map's population-weighted values, unchanged outside areas, lower
host/neighbor HNI, explicit Apply, immutable optimized locations, mobile layout,
markers and shared playback. Screenshots: `/tmp/omcm-simulation-hni-comparison.png`
and `/tmp/omcm-simulation-mobile.png`.

These are local results, not a production deployment. Leaflet/Chrome was used;
Google renderer changes retain existing unit coverage but no live-key session.
The guarantee is no worse than a feasible manual comparison on the requested
optimization day. Held locations may rank differently on later dates. The
ordinary Plan clinics geographic preview remains separately labeled; its
appointment objective and public publication workflow are unchanged.

## Seven-day booking and emergency guidance — 2026-10-24

Branch: `feat/seven-day-clinic-scheduling`, including the preceding audit/UI
commits. [SCHEDULING.md](SCHEDULING.md) contains the exact changed-file inventory,
policy reasoning and browser steps. No request/response schema, storage schema,
trained model, HNI weight or administrator credential changed.

| Check | Result |
| --- | --- |
| Frontend lint | Passed |
| Frontend unit tests | 145 passed across 16 files |
| Frontend production build | Passed; existing chunk-size advisory |
| Backend pytest | 100 passed; existing Starlette/httpx deprecation warning |
| Connected optimization/publication browser suite | Passed against real FastAPI/XGBoost/CP-SAT with isolated temporary storage |

Backend tests approve bookings on Days 1, 2 and 7, reject Day 8, reject expired
forecasts for both ordinary and emergency publication, and reject padded short
notices. Frontend tests verify min/max dates, original next-day estimate wording,
expiry guidance, the character counter and confirmation gate. The browser suite
fills `hello` and observes the disabled button, then supplies a valid notice and
confirmation and observes the enabled button. It then performs ordinary Day 7
publication and verifies the fresh public session shows the approved deployment.
This is a booking window, not validation of a seven-day disease forecast.

Source data and both existing trained model artifacts were not edited. Tests
used existing temporary credentials; no hosted schedule was changed or deployed.

## Global audit, protected views and UI polish — 2026-10-24

Branch: `audit/omcm-features-and-views`, based on fetched main `a7f5b7f`.
All results below are local verification of the reviewed tree; they do not
claim a new production deployment. Exact changes and proposal gaps:
[GLOBAL_AUDIT.md](GLOBAL_AUDIT.md).

| Check | Result | What it establishes |
| --- | --- | --- |
| Frontend `npm run lint` | Passed | Existing lint rules, no warnings |
| Frontend `npm test` | 142 passed, 16 files | HNI, public refresh, authentication, model adapters, scenario guards, seven legacy map links, assistant boundary |
| Frontend `npm run build` | Passed | TypeScript and Vite production build |
| Backend `.venv/bin/python -m pytest -q` | 98 passed | Authenticated catalogs/analytics, publication, models, capacity/access, sources and Vercel startup |
| `npm run test:hni` | Passed | 681 polygons, 56 hospital markers, search alignment, HNI consistency, desktop and 390/320px details/legend layout |
| `npm run test:optimization` | Passed | Real FastAPI/XGBoost/CP-SAT request, stable `/admin` tools, service-impact preview, flood outlines, replan, public approval/revision, failure without fake fallback |
| `npm run test:simulation` | Passed | Three same-day runs, local host/neighbor impact, real optimized draft, mobile panel/playback/legend separation, collapse with markers/timeline retained |
| `npm run test:assistant` | Passed | Local commands, mocked provider actions/failure, in-place tools and responsive UI; external Gemini access is not verified |
| `prepare-laguna-planning.mjs --check` | Passed | Shared policy/export matches 681 source records |
| `clinic-sensitivity.mjs --check` | Passed | Committed offline sensitivity evidence matches current policy/data |
| `import-laguna-datasets.py --check` | Passed | 681 joins, 66 hospital records and 385 OSM candidates match the bundled source |
| `import-osm-clinics.py --check` | Passed | Snapshot valid; 382 active, 98 active located in province; 2 suspected duplicate pairs remain flagged |
| Both native model SHA256 checks | Passed | Existing artifacts match manifests; no retraining |
| `git diff --check` | Passed | No whitespace errors |

The mobile browser checks caught and drove fixes for an expanded-sheet/filter
collision and a panel/playback overlap. Assertions retain those checks. Screenshots
were inspected for the compact desktop legend, blue actions, chips, mobile fields
and visible map. Animation screenshots settle before capture.

### Artifacts

Generated browser images are ignored files and are not committed:

- `frontend/test-results/optimization-connected-desktop.png`
- `frontend/test-results/optimization-connected-mobile.png`
- `frontend/test-results/optimization-flood-impact.png`
- `frontend/test-results/public-visits-desktop.png`
- `frontend/test-results/public-visits-mobile.png`
- `frontend/test-results/hospital-hni-mobile.png`
- `frontend/test-results/place-details-mobile-expanded.png`
- `frontend/test-results/assistant-desktop.png`
- `frontend/test-results/assistant-mobile.png`
- `/tmp/omcm-simulation-desktop.png`
- `/tmp/omcm-simulation-mobile.png`

### Limits of the evidence

Browser suites use installed Chrome and Leaflet. Google rendering has existing
unit coverage; no live-key Google session or live Gemini provider was verified.
The assistant suite intentionally stubs provider replies. HNI/assistant browser
suites use explicit demo mode; connected optimizer/simulation suites start real
FastAPI processes with isolated credentials and temporary databases. Demo-only
planning catalog errors with no backend are expected and do not become fake
allocations. Basemap tiles are stubbed/aborted in browser tests.

Vite still reports a >500 kB chunk advisory; build succeeds. Pytest reports the
existing Starlette/httpx deprecation warning. Model results remain synthetic.
Backend 30-day deduction ownership, automatic nightly jobs, verified provincial
roads, calibrated clinical forecasts and durable Vercel storage are not claimed.
No data-model migration or credential change was performed.

## Historical verification records

The dated reports below remain as prior-build evidence. Their command counts,
routes, provider status and pilot-only scope are not the current acceptance record.

## Floating map controls, 2026-10-16

Removed the Overview and Schedules pages and their routes/navigation. The map
uses floating search and planning buttons, an expandable Layers control and
corner zoom/recenter controls. Contextual tools share one side sheet, with a
bottom sheet on mobile. Deployment review now belongs to Clinic Optimization.

Verified frontend lint, production build, 59 unit tests and all three browser
suites. Browser checks cover removed routes, keyboard search, layer controls,
zoom, desktop/mobile planning, connected approval and the retained fleet flows.

## Integration of origin/main, 2026-10-16

Merged the upstream changes into the reorganized application. New Python services
use `services/`, API additions use `routers/integrations.py`, and frontend imports
follow the feature directories. The upstream administrative interface is retained
at `/workspace`; the primary map and detailed `/driver` interface keep their routes.

Verified after integration: 49 backend tests, 59 frontend tests in 14 files,
frontend lint, production build, dataset exports, and all three browser suites
passed: primary workspace, upstream administrative desktop/mobile workflows,
and retained connected/browser-only fleet workflows (`test:e2e:legacy`).

## Original architecture verification

Local verification on Windows, Python 3.13, Node.js 24 and headless Microsoft
Edge, 2026-10-16. Commands run from `frontend` or `backend` as indicated.

| Check | Command | Result |
| --- | --- | --- |
| Frontend lint | `npm run lint` | Passed |
| Frontend unit tests | `npm test` | 50 tests in 9 files passed |
| TypeScript / production bundle | `npm run build` | Passed |
| Backend tests | `.venv/Scripts/python.exe -m pytest -q` | 27 passed |
| Dataset export consistency | `.venv/Scripts/python.exe export_datasets.py --check` | Passed |
| Workspace browser suite | `npm run test:e2e` | Passed at desktop and mobile sizes |
| Connected-workflow browser suite | `npm run test:e2e:legacy` | Passed connected and browser-only workflows |

The workspace suite checks geographic rendering, municipality selection,
heatmap switching and legend updates, marker visibility, keyboard clinic
selection, native dialogs and Escape dismissal, fleet size changes, manual
placement retaining the fleet, local approval and reload persistence, flood and
morbidity scenarios, road closures, playback and seeking, panel reopening,
contextual assistant responses, direct optimization/simulator URLs and retained
public/schedule routes. It rejects uncaught page errors and horizontal mobile
overflow. Screenshots are saved to `frontend/test-results/workspace-desktop.png`
and `workspace-mobile.png`.

The retained connected-workflow regression suite is
`npm run test:e2e:legacy`. It starts isolated API/Vite servers and a temporary
SQLite database, exercises the detailed `/driver` fleet simulator, authenticated
publication, public schedules and browser-only fallback. It uses in-app navigation
between retained pages so drafts and consecutive-day fleet history survive.

The backend suite covers authentication, schedule approval and emergency
revision, boundary validation, risk/allocation constraints, scenario isolation,
directed road evidence, deterministic pilot allocation, provincial inputs and
canonical dataset exports. The fixed-seed, single-worker solver now uses a
deterministic work budget rather than a wall-clock cutoff that varied under load.

Google Maps integration is retained but was not exercised with a billable API
key. Leaflet/OpenStreetMap is the verified default. No live medical, hazard,
traffic or GPS integration was added. Workspace approvals are local rehearsals;
the connected publication workflow uses the existing server pilot and API.

Pytest reports an upstream FastAPI/Starlette warning about its httpx test client;
all backend assertions pass. Historical dependency-install and data-import audit
claims are not repeated here as new verification.


## Upstream verification before the architecture merge

# Verification record

Executed locally on Windows with Python 3.13, Node.js 24.19.0 and headless
Microsoft Edge. Final verification date: **2026-10-16, Asia/Manila**.

| Check | Executed command / evidence | Result |
| --- | --- | --- |
| Clean frontend installation | `npm ci` | Passed; 299 packages audited, zero reported vulnerabilities at execution time |
| Python runtime dependencies | `.venv/Scripts/python.exe -m pip install -r requirements.txt` | Passed |
| Python dependency consistency | `.venv/Scripts/python.exe -m pip check` | No broken requirements |
| Road import | `backend/.venv/Scripts/python.exe frontend/scripts/build-road-pilot.py` | 20 validated PSGC joins, 8 contained candidate endpoints, 168 real directed route legs |
| Frontend lint | `npm run lint` | Passed, zero warnings/errors |
| Frontend unit tests | `npm test` | **30 passed** in 6 files |
| TypeScript + production bundle | `npm run build` | Passed |
| Python score/optimizer/API tests | `.venv/Scripts/python.exe -m pytest -q` | **26 passed** |
| Browser walkthrough | `npm run test:e2e` | Passed connected and browser-only workflows, no uncaught page errors |
| Whitespace/diff check | `git diff --check` | Passed |
| Secret hygiene | Tracked `.env` file listing and known key/private-key pattern scan; values never printed | No tracked secret `.env` files or matching keys found |

## What the browser suite actually exercises

- Real OSM tiles load and all 20 pilot polygons render. Batong Malake opens
  matching PSGC details and score contributions.
- Credential-free tour creates a three-clinic proposed plan. Three road markers
  render. Global time changes position, ETA, distance, progress and status.
- Pause freezes positions; resume advances; reset returns to origin. Seeking
  backward and back to a timestamp restores identical positions. Changing speed
  does not change the position at a fixed simulation timestamp. Arrival clamps
  to the route endpoint and displays Deployed.
- Reoptimization advances consecutive day numbers and dates, automatically plays,
  and retains each clinic's previous final position as its next starting position.
  Changed assignments travel from retained sites; unchanged assignments stay put.
  Baseline previews do not alter the carried fleet history. Reset returns to the
  current day's origin, and app navigation retains the current day. A failed
  server optimization preserves the day and paused positions. These day-transition
  flows run in both connected and browser-only modes.
- Server sign-in generates a persisted solver draft; explicit approval creates
  a dated schedule. Severe flood changes recommended sites. Two-clinic input
  limits the fleet. Scenario reset restores prepared inputs.
- Server schedules remain byte-for-byte unchanged during scenario replanning.
  Public View contains approved destinations and last-updated timestamps, with
  no simulation markers presented as GPS.
- Weight adjustment triggers an actual API score recalculation.
- At 390px, the page has no horizontal overflow. Desktop and mobile captures
  are saved. The final map captures were visually inspected.
- In a separate browser context, every API request is deliberately failed.
  The labeled browser demo still optimizes, plays, seeks, resets, locally approves
  and displays that approved schedule after page navigation.

## Unit/API coverage

Allocation tests check K limits, unique sites, site/vehicle capacities, no repeated
demand, threshold compliance, deterministic output, flood/closure route exclusion,
surge effects and empty feasibility. Interpolation tests check actual segment
membership, reverse seeking and no arrival overshoot. Consecutive-day tests cover
stable vehicle IDs, exact road endpoints for every staging-site pair, stationary
assignments, temporarily unavailable/new vehicles, blocked or missing routes,
baseline isolation, empty fleets and calendar rollover. Browser storage tests check
approved snapshot isolation, duplicate-date rejection, today's emergency
confirmation and public notice creation. Server tests check authentication,
concurrent approval conflicts, stored publication status/timestamp, emergency
validation, schedule isolation and boundary validation. Legacy provincial data
retains its own 681-record regression tests.

An intermittent Leaflet zoom-transition teardown error was detected during a
repeat browser run. Map zoom transitions and programmatic fit animations were
disabled; subsequent walkthroughs passed. Vehicle motion and follow panning
remain animated. Screenshots wait after scrolling to avoid capturing tiles before
they render.

## Artifacts

Generated under `frontend/test-results/` (ignored by Git):

- `simulator-desktop.png` — 1440px-wide connected simulator.
- `simulator-mobile.png` — 390px-wide simulator.
- `simulator-severe-flood.png` — actual recomputed scenario.
- `simulator-browser-demo.png` — API-disabled fallback.
- `simulator-next-day.png` — retained fleet positions on simulated day 4.
- `public-mobile.png` — approved public schedule.

The fixture and source manifest are committed-source candidates, not runtime
downloads. The supplied implementation prompt and existing secret environment
files were not changed. Test servers used random test credentials and temporary
SQLite storage, and were stopped after execution.

## Limits and non-failing diagnostics

- No external deployment was performed. The supplied live URL was fetched as
  an audit reference; visual verification was performed against the local app.
- No Google credentials, production auth, live GPS, traffic or official medical/
  hazard feeds were available or claimed to be tested. OSM was the tested provider.
- Health and hazard values remain synthetic; candidate facilities remain
  unverified. There is no safe-diversion claim when the fixture route is blocked.
- Basemap tiles need an internet connection. Browser-only approval is local to
  a browser/origin; persistent shared schedules require the authenticated backend.
- Pytest emits a dependency deprecation notice about Starlette's httpx test
  integration. npm reports a deprecated transitive encoding package and an
  install-script policy notice; installation and the actual build both succeed.
- Basic secret scanning is not a comprehensive credential audit.

### Build Step 1 — Composite Need Index and map filters (2026-10-16)

Preserved existing five-factor scoring and sliders. Added the approved population
weight (average-rank percentile), authenticated Python top-K sensitivity endpoint,
and Settings display for ±5-point one-at-a-time weight changes. Existing JSON
inputs are unchanged. Browser fallback mirrors the population factor; sensitivity
requires the backend. Missing fallback values and municipal indicators are labeled
estimated. Need factors remain 0–100 in the existing response/display contract,
with normalized 0–1 inputs used in the weighted calculation.

Executed checks:
- Backend `.venv/bin/python -m pytest -q`: 30 passed; one upstream Starlette
  deprecation warning. Includes small high-risk priority, sensitivity membership
  and order, authentication and invalid-K cases.
- Frontend `npm run lint`: passed; `npm test`: 37 passed; `npm run build`: passed.
- `npm run test:e2e`: passed with pilot dataset. Added municipality search/no-match,
  independent hospital toggle, all four metric legends, population slider and
  backend sensitivity checks. Existing fleet and publication isolation flows pass.
- Inspected mobile map screenshot; filter card remains within the map at 390px.
  Screenshots: `frontend/test-results/step1-filters-desktop.png`,
  `step1-filters-mobile.png`, and `step1-sensitivity.png`.

Density is estimated represented population divided by municipal polygon area;
it is not a complete census density. Sensitivity tests barangay rankings rather
than optimal clinic placement. Final decisions remain with LGU health officers.
No subsequent build step started.

## Build Step 2 — municipality interaction (2026-10-16)

- Municipality selection fits its polygon and immediately highlights it above
  the barangay layer. The right panel shows represented population, need score,
  rank among municipalities with data, and the three largest contributions.
  All contributions remain available in expandable details.
- Bundled barangay boundaries appear at zoom 12+. Existing scored barangay
  records supply the values, with existing population-weighted municipality
  rollups. Missing health inputs remain No data.
- Navigation uses full Laguna bounds regardless of search, full drag viscosity,
  and a viewport-aware minimum zoom. Bounds are a geographic rectangle, so
  neighboring basemap context may appear; this is not a polygon clipping mask.
- `npm run lint`, `npm run build`: passed. `npm test`: 38 passed, including
  matching the 20 pilot results to the 681-polygon layer and rollup consistency.
- `npm run test:e2e`: final run passed, including selection zoom/highlight,
  panel fields, barangay visibility, recenter, zoom/pan bounds, and existing
  workflows. An intermediate run hit a simulator Reset timeout; the full rerun
  passed. No simulator code changed.
- Inspected screenshots: `frontend/test-results/step2-municipality-desktop.png`
  and `frontend/test-results/step2-municipality-mobile.png`.
- Input JSON, API models, dependencies, and scoring engines unchanged by this
  step. Backend tests not rerun. Existing Step 1 findings remain as documented
  in `AUDIT.md`. Stop here for user review.

## Build Step 3 — 2026-10-16

Reused the existing Python OR-Tools maximal covering model and population-first
baseline. Added collapsible controls, manual candidate selection, flood/closure
controls, per-site Python service suggestions, synthetic facility categories,
and per-metric comparison percentages. The user approved `facility_type` on
sites and `unserved_population` on allocation metrics. Input health data,
coordinates, capacities, and route evidence were preserved. No dependencies
were added. The optimization panel requires Python; existing browser simulator
rehearsals were preserved.

Unserved population means represented population minus daily allocated
residents; unserved daily demand remains a separate metric. Flood-safe
accessibility measures the percentage of daily demand allocated using
scenario-safe evidence. Both are illustrative, not clinical or field-verified
coverage. Percentage improvements use the baseline denominator; lower travel
and unserved counts are improvements, and an unequal zero baseline is N/A.

Validation: 32 backend tests, including exhaustive enumeration of a small
weighted-capacity allocation, frontend lint, 38 frontend unit tests, production
build, and full pilot browser workflows passed. Browser checks cover manual
placement, K limits, collapse/expand, service/category display, comparison
fields, and existing fleet/publication/offline behaviors. Screenshots:
`frontend/test-results/step3-optimization-desktop.png` and
`frontend/test-results/step3-optimization-mobile.png` (1440px and 390px).
The browser reports no uncaught errors and verifies no mobile page overflow.
One upstream Starlette/httpx deprecation warning remains in backend tests.

## Build Step 4 — 2026-10-16

- Reused existing authenticated draft publication and emergency revision APIs;
  no data/API schema or dependency changes.
- Frontend lint, 38 unit tests, and production build passed.
- Backend: 33 tests passed, with the existing upstream Starlette/httpx
  deprecation warning. Added a regression for unpublished manual drafts,
  today's lock, and tomorrow's publication preserving today's active schedule.
- Public advisories are static demo information, not a connected official feed.
- Full pilot Playwright workflow passed, including draft override initialization,
  disabled approval until regeneration, confirmed emergency publication, today's
  default date, anonymous public access, alert banner, and advisory visibility.
  Existing fleet, publication, sensitivity, and offline rehearsal workflows passed
  with no uncaught browser errors. The initial Step 4 test attempted desktop
  navigation at mobile width; corrected the test viewport and reran successfully.
- Captured and inspected `frontend/test-results/step4-public-desktop.png` and
  `frontend/test-results/step4-public-mobile.png` (1440px and 390px).
- Build Step 4 is ready for user review. No subsequent build step started.

## Build Step 5 — simulation mode (2026-10-16)

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

Step 5 is ready for user review. No later build step started. Earlier audit
corrections remain outside this step. Final deployment decisions belong to LGU
health officers.

## Build Step 6 — explanation assistant and manual nightly optimization

2026-10-16. Only Step 6 was implemented, preserving prior working-tree changes.
The user approved a standard-library deterministic explanation provider and
server-only endpoint, with no external LLM configured.

- Backend `.venv/bin/python -m pytest -q`: **38 passed**, one existing upstream
  Starlette/httpx deprecation warning. New tests verify authentication, no saved
  plans/publication from explanations, top-factor/capacity/travel text, scenario
  changes, empty/manual placements, unknown municipality rejection, unsupported
  provider rejection, and unproven-optimum wording.
- Frontend `npm run lint`, `npm test` (**38 passed**), and `npm run build`: passed.
- Full `npm run test:e2e`: passed with the isolated pilot API and Vite servers.
  New assertions exercise show/hide, explanatory factors and footer, nightly
  `/risk/calculate` followed by a saved `/optimize` draft with a server timestamp,
  unchanged published schedules, scenario explanation changes, and suppression
  after edits. Existing publication, public, playback, municipal interaction,
  sensitivity, and offline rehearsal checks passed without uncaught browser errors.
- Captured and inspected `frontend/test-results/step6-assistant-desktop.png` and
  `frontend/test-results/step6-assistant-mobile.png` at 1440px and 390px. Mobile
  browser assertion confirmed no horizontal overflow. Explanations are long but
  remain within the page and can be hidden.
- `git diff --check`: passed.

Limits: explanations are deterministic summaries of recomputed model evidence,
not conversational AI or counterfactual proof of why another site lost. Synthetic
inputs and fixture-based route/hazard limits remain. No external calls or frontend
keys were introduced. The nightly button is a manual run, not scheduled execution;
its last-updated timestamp covers successful runs in the current session. Draft
publication remains an explicit officer action. No later build step started.

## Current one-shot map-first implementation — 2026-10-16

- `npm run lint`: passed, zero warnings.
- `npm test`: **40 passed** across 10 files.
- `npm run build`: passed; includes `tsc -b` type checking and Vite production build.
- Backend `.venv/bin/python -m pytest -q`: **43 passed**, with one existing
  Starlette/httpx upstream deprecation warning. Added tests for independent
  municipality morbidity values, all-barangay municipal flood scoring, general
  road-segment exclusions, chat history/validation/publication isolation, optional
  standard-library provider transport, and provider-failure fallback.
- `npm run test:e2e`: passed using isolated pilot Python/Vite servers and headless
  Chromium. Desktop 1440×1080 and mobile 390×844. Tests cover all 30 boundaries,
  polygon mask presence, bounded dragging/zoom-out, real pointer municipality
  selection, search focus/zoom/no out-of-province results, four metrics/legend,
  facility toggle, clinic count/recommendation/manual override, accept/review/
  authenticated publication, baseline and sensitivity, per-town flood/morbidity
  and reset, visible heatmap changes, real pointer general-road blocking/red
  styling/undo, animation/pause/speed/details, chat turns/history/no-key server
  templates, unchanged published schedules during simulation and after disabling
  it, mobile map visibility/no overflow, public view, and missing-boundary failure.
- No uncaught browser errors. Screenshots captured and visually inspected:
  `map-first-selection-desktop.png`, `map-first-simulation-desktop.png`,
  `map-first-chat-desktop.png`, `map-first-mobile.png`,
  `map-first-mobile-panel.png`, `map-first-public.png` in ignored
  `frontend/test-results/`.

Intermediate checks caught an outdated legend text assertion and route overlays
intercepting road clicks. Corrected both; interactive road segments now occupy a
separate Leaflet pane above the choropleth, while animated route lines pass pointer
events through. A later source-caption change required preserving the tested
“city and municipality” wording. Final checks pass. Local-port restrictions needed
approved execution outside the sandbox for browser tests; no production service
or real schedule was changed (the browser suite uses a temporary database).

The e2e entry point uses `tests/map-first.mjs`. The prior multi-page suite remains
preserved in `tests/e2e.mjs` for historical workflows; its obsolete UI selectors
are not the current acceptance contract. All current unit/backend suites ran.

No live external AI-provider call or GPS tracking was verified. Only Bay and
Los Baños have pilot health/road inputs. See `INTERFACE-SCOPE.md` for the full
acceptance table, geographic provenance, exact click paths and blocked data.

### Verification of the commit sequence

Each logical commit was type-checked and production-built from an isolated export
of the staged index, rather than relying on unrelated uncommitted files. The
complete staged application also passed frontend lint, all 40 frontend unit tests,
all 43 backend tests, and the desktop/mobile Chromium acceptance workflow from
that isolated export. This confirms the committed application builds and runs
without the remaining legacy-page and nightly-state edits in the working tree.
The user authorized including the prerequisite weights, optimization, and
simulation edits. Unrelated work and local instruction files remain uncommitted.

## Google Maps and Routes readiness step — 2026-10-16

- Frontend lint and build/type check passed; **45 frontend unit tests** passed.
- **49 backend tests** passed, with the existing Starlette/httpx warning.
- Added mocked SDK tests for explicit key requirements, single-script loading,
  library imports, timeout and retry; route-client tests check server transport
  and rejection of non-Google renderers.
- Added server tests for disabled readiness/authentication, unknown pilot IDs,
  request headers/field masks/GeoJSON encoding, response validation, provider
  errors, secret redaction and unchanged saved drafts/published schedules.
- No Google credentials were supplied and no live or billed Google requests
  were made. External API behavior was stub-tested, not browser-verified.
- No UI workflow changed: Leaflet and the existing OSRM pilot remain active.
  The optional Google renderer and live-key validation await the next reviewed
  build step. Setup and exact entry points are in `GOOGLE-APIS.md`.
