# Saved-work persistence and timeline refinement — 2026-10-26

- Frontend lint, 173 tests across 22 files and production build pass.
- Backend: 120 tests pass with `OMCM_TEST_DATABASE_URL` pointing at an isolated
  PostgreSQL 17 server. This includes both SQLite and PostgreSQL saved-work cases;
  no PostgreSQL cases were skipped in that run.
- Private reads enforce authentication/no-store, return exact allocations and
  settings, paginate summaries and reject missing IDs. Records survive a new
  application lifespan. Concurrent ordinary approvals yield 200/409; configured
  PostgreSQL failure does not fall back to scratch SQLite.
- Connected optimizer browser passes on SQLite and PostgreSQL. The PostgreSQL
  run includes actual FastAPI restarts before reopening a draft and after
  publication, a fresh browser public read, saved deployment review, original
  plan restoration, date-labeled map popups and 320px layout checks. Real
  XGBoost/CP-SAT is used; allocations are not mocked.
- Connected simulation browser passes with the existing HNI results and reset flow.
- Workspace browser passes desktop/tablet/phone/landscape alignment, caption,
  slider/control center lines, sheet/playback non-overlap, public isolation,
  reduced-motion and existing map interactions.
- A temporary local PostgreSQL cluster was used for verification. No hosted Neon
  resource or deployment was created. Connecting `DATABASE_URL` and redeploying
  the backend remains a hosted setup step, documented in
  [deployment](VERCEL_DEPLOYMENT.md#shared-plans-and-schedules-with-neon-postgresql).
- Existing build chunk-size and Starlette/httpx advisories remain non-blocking.
  HNI weights/models, patient-data boundaries and authentication are unchanged.

Artifacts (ignored): `frontend/test-results/saved-work-desktop.png`,
`saved-work-mobile.png`, `saved-deployment-mobile.png` and the workspace suite's
responsive screenshots. See [saved work](SAVED_WORK.md) for the file inventory.

---

# Verification record

## Simulation reset review — 2026-10-26

- Frontend lint, **171 tests across 22 files**, production build and **113 backend
  tests** pass. Existing bundle-size and Starlette/httpx advisories remain.
- Connected simulation and full workspace browser suites pass with Playwright
  Chromium. The reset test uses actually applied manual and optimized clinics.
- Cancel keeps current days, reached history and three deployed optimizer
  markers. Confirm clears all three histories, drafts, proposals, busy/playing
  flags and clinic markers, restores Day 1/reached Day 1, and keeps settings.
  Every reset snapshot has zero service deduction and baseline HNI.
- The reset dialog is centered within 1 px and fits 1440/390/320/844 px viewports.
  Short screens scroll the native dialog body; phone actions stack at 320 px.
  Captures: `/tmp/omcm-simulation-reset-1440.png`,
  `/tmp/omcm-simulation-reset-320.png` and
  `/tmp/omcm-simulation-reset-complete.png`.
- Completion feedback disappears when a run advances again. Existing unit tests
  still reject a late evaluation after reset. No reset endpoint or formula was
  added: the interface invokes the existing forecast-store reset/cancellation.
- The workspace suite retains public privacy, three scenario choices fitting
  phone sheets, one map instance, aligned playback/legend and touch controls.
- Both README guides and simulation methodology describe reset versus rewind;
  30 local README links/anchors/image references resolve.

See [file/behavior inventory](UI_REFINEMENT.md#simulation-reset-and-rewind).

## Public alignment and frontend interaction review — 2026-10-26

This follows merged PR #11, with remaining changes on
`feat/omcm-maps-experience-polish` for a new pull request into `main`.

- Frontend lint, **171 tests across 22 files**, production build and **113 backend
  tests** pass. The existing large-bundle and Starlette/httpx advisories remain.
- The connected workspace suite measures public heading/refresh alignment,
  calendar/check symbol centering and the shared title/body text edge within
  1.5 px, including empty and published states at desktop/phone sizes.
- Pointer hints for administrator entry, sign-out and zoom appear within the
  viewport; Escape dismisses them. Keyboard Enter still opens the real sign-in
  dialog. A separate coarse-pointer phone context opens sign-in by tap without
  displaying a hover hint, and retains existing assistant/facility checks.
- A complete 30-day run through the real Next day control produces **25 earlier
  activity rows**. The native compact disclosure opens/closes with Enter, retains
  its actual count/day range and fits 1440/390/320 px. No simulation arithmetic
  or history generation changes are involved.
- The workspace suite passes with Playwright Chromium. One earlier Chrome run
  closed its context during verification; the identical full Chromium run
  completed. Captures include `ui-earlier-updates-320.png`,
  `ui-view-switch-hint-desktop.png` and `ui-public-casile-empty-320.png`.
- Connected optimizer and simulation suites pass real backend allocation,
  manual replan, publication/public refresh, outage handling and host/neighbor
  service impacts. Simulation retains Manual HNI **43.67060777020463** and
  Optimized HNI **43.60322274720275**.
- All five browser suites pass: workspace UI, connected optimization, connected
  simulation, hospital/HNI and assistant. Hospital checks retain 681 polygons
  and 56 mapped hospitals.
- Assistant checks pass local tools, provider-action fixtures, reading-position
  preservation, failure/retry and mobile behavior. Live external inference is
  not claimed.
- Both READMEs describe the current icon, public/admin controls, provider setup,
  responsive sheets, assistant behavior, shared timeline and activity history.
  **30 local links, anchors and image references** resolve.

Authentication, model artifacts, weights, datasets and publication permissions
are unchanged. No push or deployment is performed by this pass. See the
[exact file/behavior inventory](UI_REFINEMENT.md#public-panel-alignment-and-consistent-actions).

## Map experience finishing pass — 2026-10-26

Branch: `feat/omcm-maps-experience-polish`, based on local `aa800a2`. The
previous unpushed legend/simulation and public-care/discovery commits remain
included; no separate push of the earlier branch is necessary.

- Frontend lint, **171 tests across 22 files**, production build and **113 backend
  tests** pass. The existing large-bundle advisory and Starlette/httpx deprecation
  warning remain; no dependencies were added.
- All five browser suites pass: workspace UI, connected optimization, connected
  simulation, hospital/HNI and assistant. Optimization uses Playwright Chromium;
  the remaining suites use Chrome.
- The workspace suite measures play, reset, range, day/week, next-day and speed
  centers within 1.5 px across desktop, tablet, phone and landscape. A focused
  inspection measured identical centers at 1440/1024/768/390/320 px. The compact
  legend’s title/actions align, and its desktop gap above playback is at least
  8 px. Screenshot: `ui-compact-legend-playback-desktop.png`.
- Provider selection works by visible label and native radio arrow keys. The
  optional key disclosure and disabled save guard remain functional. Dialogs
  fit 1440/390/320/844 px viewports. No live Google Maps key is supplied, and
  switching actual keyed Google rendering is not claimed.
- A separate touch-enabled 390 px browser context confirms coarse-pointer
  behavior, public assistant opening/closing, an unscrolled empty conversation,
  and facility visibility controls. It is emulation, not a physical-device test.
  Screenshot: `ui-assistant-touch-phone.png`.
- Connected optimization verifies the existing keyboard fleet range, real
  XGBoost/CP-SAT requests, manual replanning, saved draft publication, public
  refresh and service-outage behavior without fabricated allocations.
- Connected simulation retains Manual HNI **43.67060777020463** and Optimized HNI
  **43.60322274720275**, host/neighbor service effects, clinic markers and the
  shared timeline. Hospital checks retain 681 polygons and 56 mapped hospitals.
- Assistant checks preserve reading position and jump-to-latest for existing
  conversations, common local commands, provider-error recovery and responsive
  behavior. External model responses are fixtures; live inference is not claimed.
- The same map instance persists through public/admin tools and dialogs. Scoring,
  model artifacts, data, authentication and publication permissions are unchanged.
  No push or deployment has been performed.

All screenshot artifacts are ignored under `frontend/test-results/` and can be
regenerated with `npm run test:ui`. See the [exact file/behavior inventory](UI_REFINEMENT.md#map-experience-finishing-pass).

## Transparent icons and map discovery — 2026-10-26

- Frontend lint, **171 tests across 22 files**, production build and **113
  backend tests** pass. Existing build/deprecation advisories remain.
- New tests cover actual assistant-button state, metric/visibility changes,
  Public View restrictions, simulation-aware controls, retained/cleared drafts
  and the search shortcut’s editor guard.
- Website icons use transparent PNG/SVG canvases with visible artwork. The ICO
  contains four valid PNG frames at 16/32/48/96 px. Browser checks inspect alpha
  values as well as successful decoding, so an empty image cannot pass.
- Layout verification checks every mobile planning tool and layer chip against
  the viewport, native radio selection and keyboard changes, local Escape/focus
  behavior, and omission of private radio choices in the public layer picker.
- Public community checks cover the reported Casile layout at 1440/390/320/844
  px, readable facts (4,661 residents / 2,229 households), one empty-state message,
  truthful checking status, selection reset and continued hospital access.
- All five browser suites pass: workspace UI, hospital/HNI, connected
  optimization, connected simulation and assistant. Optimization uses Playwright
  Chromium; the others use Chrome. The connected simulation retains Manual HNI
  43.67060777020463 and Optimized HNI 43.60322274720275. Assistant provider
  replies use fixtures; live external inference is not claimed.
- The final screenshot review removes duplicate public section dividers and
  restores regular-weight map-layer descriptions. Source data, scoring weights,
  model artifacts and backend behavior are unchanged.
- Hosted Google Search appearance is not claimed: the deployed icon must be
  recrawled/processed by Google. No deployment, indexing request or credential
  change is performed by this refinement.

See [file/behavior inventory](UI_REFINEMENT.md#transparent-identity-and-map-discovery).


## Legend and simulation interactions — 2026-10-25

- Frontend lint, **161 tests across 20 files**, production build and **113
  backend tests** pass. Existing bundle-size and Starlette/httpx advisories remain.
- New restriction tests verify accent-insensitive municipality search, retained
  selections, excluded-only filtering and clearing the exclusion/filter state.
- The workspace browser suite checks aligned scenario rows, all three choices
  visible in the normal 320 px phone sheet, legend symbol/data controls, friendly
  snapshot dates, source credit, keyboard scrolling, dragged-content clamping,
  reset/minimize/restore, viewport-safe guidance and timeline content bounds.
- Captured viewport sizes include 1440 px desktop, tablets, 390/320 px phones and
  short landscape layouts. Basemap tiles are suppressed for deterministic capture.
- All five browser suites pass: workspace, hospital/HNI, connected optimization,
  connected simulation and assistant. The optimizer uses installed Playwright
  Chromium; the other suites use Chrome. Simulation retains the same real
  Manual HNI 43.67060777020463 / Optimized HNI 43.60322274720275 comparison.
- Provincial planning-export and sensitivity consistency checks pass.
- Calculations, datasets, model artifacts, authentication and publication remain
  unchanged. Public legend content retains its existing privacy boundary.

See the [file/behavior inventory](UI_REFINEMENT.md#legend-scenario-selection-and-playback).


## Public care and chatbot experience — 2026-10-25

This refinement continues on `feat/omcm-interface-and-repository-guide`. The
public experience uses actual published schedules and the existing clinic visit
dialog. Private scoring, optimization explanations and approval controls remain
outside Public View. Existing authentication and model settings are unchanged.

- Frontend lint, **159 tests across 19 files**, production build and **113 backend
  tests** pass. Existing bundle-size and Starlette/httpx advisories remain.
- Public visit tests cover all published dates, selection of an approved clinic,
  omission of private planner explanations and retention of confirmed schedules
  during outages. Dates use Philippine time independently of the viewer’s zone.
- Chat tests cover selected-community hospital shortcuts through actual local
  tools, absence of public need-score leakage, retry restrictions and clipboard
  success/failure feedback. Clipboard APIs are stubbed for deterministic checks.
- The connected workspace browser suite exercises real publication, the public
  clinic card and visit dialog, source disclosures and 390/320 px/landscape
  layouts. No production database or configured user credentials are changed.
- The assistant browser suite holds a provider response while the reader scrolls
  through a long earlier answer, verifies that position is retained and the
  latest-message button works, and retries a failed request successfully. These
  provider responses are fixtures; live external inference is not claimed.
- Hospital/HNI browser checks pass for all 681 polygons, 56 located hospitals,
  scoped counts, search/refocus, selection and phone layout.
- The connected simulation suite passes host/neighbor map deductions and the
  real manual/optimized population-weighted comparison. No HNI or model change
  was needed for the interface revision.
- The project owner’s Vercel demo credentials are documented in both READMEs.
  This does not modify the backend environment or verify the remote sign-in.

The connected optimizer suite passes with installed Playwright Chromium,
including real XGBoost/CP-SAT allocation, flood overlays, replanning, public
approval/emergency refresh and service-outage handling. Two Chrome runs lost
browser pages late in the suite; the browser fallback completes the same checks.
Public layout and assistant browser checks use Chrome.

See [file and behavior inventory](UI_REFINEMENT.md#public-care-and-conversation-experience).

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
