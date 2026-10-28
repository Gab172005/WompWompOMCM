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

## Getting started

You need Node.js 22.18+ and Python 3.12–3.14. Run the frontend and backend locally
using the [setup guide](omcm/README.md#local-setup). Administrator accounts are
configured on the backend; ask the deployment owner for hosted access.

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
