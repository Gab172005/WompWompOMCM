<p align="center">
  <img src="omcm/frontend/public/omcm-icon.svg" width="72" height="72" alt="OMCM" />
</p>

# OMCM — Optimized Mobile Clinic Mapper

A map-based application for planning mobile healthcare in Laguna, Philippines.
Local government teams can compare community needs, choose clinic locations,
and publish approved visits. Residents can find nearby facilities and clinic
schedules through Public View.

OMCM is a research prototype using public geographic and facility data alongside
synthetic health, weather, and demand records. It contains no real patient records.

## Features

- Search 681 barangays across 30 cities and municipalities on an interactive map.
- Compare communities using a transparent Healthcare Need Index (HNI).
- Generate capacity-aware clinic plans using XGBoost predictions and optimization.
- Compare no intervention, manual placement, and optimized placement over 30 days.
- Reopen saved plans and publish clinic dates, hours, services, and emergency notices.
- Find places and use map tools through an optional AI assistant.

Admin tools open on the same map. Public View shows approved visits and public
facility information; planning and publication require administrator sign-in.

## Quick start

Requirements: **Node.js 22.18+**, npm, and **Python 3.12–3.14**. Clone the
repository and install the backend dependencies:

```sh
git clone https://github.com/Gab172005/WompWompOMCM.git
cd WompWompOMCM/omcm/backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

If you use nvm, run `nvm use` from the cloned repository root before starting
the frontend. Copy `omcm/.env.example` to `omcm/backend/.env` if it does not exist. Set your
local administrator username and a password of at least 12 characters, then run
from `omcm/backend/`:

```sh
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

In another terminal, from the repository root:

```sh
cd omcm/frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. Both servers are required for planning and sign-in.
On Windows, use `.venv/Scripts/python.exe`; PowerShell setup/start scripts are
also available. See the [development guide](omcm/README.md) for configuration,
testing, and troubleshooting. Ask the deployment owner for hosted access.

## Project structure

```text
omcm/
├── frontend/   React, TypeScript, and Vite map interface
├── backend/    FastAPI, forecasting, optimization, and storage
├── datasets/   Source data and attribution
├── docs/       User and developer guides
└── tests/      Frontend and backend tests
```

The frontend uses React, Zustand, and Leaflet, with an optional Google Maps
renderer. The backend uses FastAPI, XGBoost, OR-Tools, and SQLite or PostgreSQL.

## Documentation

- [Setup and development](omcm/README.md)
- [Using the app](omcm/docs/user-guide.md)
- [Architecture](omcm/docs/architecture.md)
- [Scoring, forecasting, and simulation](omcm/docs/methodology.md)
- [API reference](omcm/docs/api.md)
- [Deployment](omcm/docs/deployment.md)
- [Data sources and attribution](omcm/datasets/SOURCES.md)

## Scope

Predictions and clinic effects are demonstration estimates, not validated clinical
forecasts. Travel follows estimated community links rather than a complete road
network. Facility records do not establish current operating status or available
beds. Shared records across hosted instances require a persistent database.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, code/data
conventions, and pull request guidance. Report reproducible problems through
[GitHub Issues](https://github.com/Gab172005/WompWompOMCM/issues).
