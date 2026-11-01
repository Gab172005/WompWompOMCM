# OMCM development guide

OMCM combines a React map interface with a FastAPI planning service. For the
project overview, see the [repository README](../README.md). For everyday use,
see the [user guide](docs/user-guide.md).

## Local setup

Requirements: Node.js 22.18+, npm, and Python 3.12–3.14. Commands below start from
this `omcm/` directory. Run the backend and frontend in separate terminals.

### Backend

```sh
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

If `omcm/backend/.env` does not exist, copy `omcm/.env.example` to that path.
Keep an existing configuration. Set these values in `backend/.env`:

```dotenv
OMCM_DATASET=pilot
OMCM_DEMO_AUTH=true
OMCM_ADMIN_USERNAME=your-local-username
OMCM_ADMIN_PASSWORD=choose-a-password-of-at-least-12-characters
OMCM_DATABASE_PATH=omcm.db
```

Start the API from `backend/`:

```sh
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend

In another terminal, from `omcm/`:

```sh
cd frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. API documentation is at
**http://127.0.0.1:8000/docs**. Leave `VITE_API_URL` empty for the local Vite proxy;
leave `VITE_DEMO_MODE` false/unset to use the connected backend. OpenStreetMap
needs no key. Basemap tiles require an internet connection.

On Windows, use `.venv/Scripts/python.exe` instead of `.venv/bin/python`.
The existing `setup.ps1` and `start.ps1` scripts also configure and start the app.

## Configuration

Examples are in [.env.example](.env.example) and
[frontend/.env.example](frontend/.env.example). Local environment files are
ignored by Git. Do not place passwords, database URLs, or private API keys in
frontend variables: every `VITE_` value is visible to the browser.

SQLite stores local plans and schedules in `backend/omcm.db` by default. Keep
that file to retain records between restarts. Set the backend's `DATABASE_URL`
to use shared PostgreSQL instead; this does not copy existing SQLite rows.
Sign in again after a page reload, then reopen work under **Plan clinics →
Saved plans & deployments**. Simulation runs are temporary practice sessions.

See [deployment](docs/deployment.md) for hosted configuration and optional services.

## Tests and data checks

From `frontend/`:

```sh
npm run lint
npm test
npm run build
npm run test:e2e
```

`test:e2e` runs the responsive workspace browser checks. Connected feature checks
are available as `test:hni`, `test:optimization`, `test:simulation`, and
`test:assistant`. They launch isolated local servers and use Chrome by default;
set `OMCM_BROWSER_CHANNEL=chromium` for an installed Playwright Chromium, or
`msedge` for Edge. Run suites sequentially. Screenshots are ignored by Git.

From `backend/`:

```sh
.venv/bin/python -m pytest -q
```

PostgreSQL integration tests are optional: provide `OMCM_TEST_DATABASE_URL` for a
dedicated test database. They create and remove disposable schemas. Ordinary
tests discard an inherited `DATABASE_URL` to avoid writing to a live database.

After changing source data, follow the [dataset guide](datasets/README.md) and
run its offline checks. Do not edit generated data or model files by hand.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Planning service unavailable | Start FastAPI as well as Vite; inspect `/api/health`. |
| Administrator sign-in fails | Use the backend's configured account. Enable `OMCM_DEMO_AUTH` and use a password of at least 12 characters. |
| Hosted records disappear | Configure persistent PostgreSQL; Vercel scratch SQLite is temporary and unshared. |
| Gray map area | No usable displayed value, or land excluded from clinic placement; gray is not zero need. |
| Assistant provider unavailable | Check backend chat settings; supported local commands remain available. |

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for branch, review, and code/data
conventions. The repository's PR template prompts for a summary, validation, and
screenshots or setup notes where relevant.
