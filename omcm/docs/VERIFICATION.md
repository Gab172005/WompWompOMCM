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
