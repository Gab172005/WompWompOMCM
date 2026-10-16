# Verification record

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
