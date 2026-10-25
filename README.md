<p align="center">
  <img src="omcm/frontend/public/omcm-icon.svg" width="76" height="76" alt="OMCM mobile clinic and community route icon" />
</p>

# OMCM · Optimized Mobile Clinic Mapper

**A map-based workspace for planning mobile healthcare in Laguna, Philippines.**

OMCM helps local government teams compare community healthcare needs, choose
mobile clinic locations and publish approved visits. Residents can use the same
map to find nearby facilities and confirmed clinic schedules.

This is a research and demonstration prototype. It combines public geography and
facility sources with synthetic health, weather and demand records. It contains
no real patient records and is not a clinical diagnosis or live emergency system.

## What you can do

- **Explore Laguna:** search municipalities and barangays, inspect local details
  and find mapped hospitals and fixed clinics.
- **Understand need:** compare communities using a Healthcare Need Index that
  accounts for illness, facility access and community conditions.
- **Plan mobile clinics:** set fleet size, appointment capacity, travel limits and
  access restrictions, then review locations selected by the backend solver.
- **Compare three scenarios:** rehearse 30 days with no intervention, manual
  placement or optimized placement. Watch clinic markers, service areas and need
  colors change on the map.
- **Publish community visits:** administrators approve clinic schedules; Public
  View shows confirmed visits, services, hours and emergency notices.
- **Ask for help:** find places and open map tools through the assistant.

Administrator tools open inside a single map workspace. Public View separates
published care information from private planning scores and drafts.

## Hosted demo sign-in

For the Vercel demonstration, choose **Admin View** and enter:

- **Username:** `admin`
- **Password:** `laguna-admin-2026`

These credentials are for the hosted demo. Local sign-in uses the credentials
configured in `backend/.env`.

## How it works

1. A fixed, transparent weighted index describes relative healthcare need.
2. XGBoost estimates next-day illness and appointment demand using sample history
   and weather. It predicts demand; it does not choose clinic locations itself.
3. A capacity-aware optimization solver selects clinic sites and service
   assignments under the chosen constraints.
4. A separate simulation compares capacity-limited clinic effects on host
   communities and reachable neighbors using the same calculation for manual
   and optimized placements.

The connected planner considers **681 barangays across 30 Laguna cities and
municipalities**. Travel follows estimated barangay connections; it is not a
verified provincial road network. Planning points, forecasts and service effects
need validation before operational use.

## Run the project

You need **Node.js 22+**, **Python 3.12 or 3.14**, and two
terminals: one for FastAPI and one for Vite. Administrator access also requires
backend credentials configured locally. The frontend alone cannot run the
connected optimizer.

Follow the [installation and configuration guide](omcm/README.md#run-locally).
The local application opens at **http://127.0.0.1:5173/**.

## Repository guide

```text
omcm/
├── frontend/     React, TypeScript, Vite and map interface
├── backend/      FastAPI, XGBoost inference, optimization and simulation
├── datasets/     Source inputs and provenance
├── docs/         Methodology, API, deployment and verification guides
└── tests/        Additional project tests
```

- [Project guide and developer setup](omcm/README.md)
- [Architecture](omcm/docs/ARCHITECTURE.md)
- [Healthcare Need Index](omcm/docs/BALANCED_HNI.md)
- [Prediction and clinic allocation](omcm/docs/OPTIMIZATION_ALLOCATION.md)
- [Simulation scenarios and formulas](omcm/docs/SIMULATION_MODE.md)
- [Data sources and limitations](omcm/datasets/SOURCES.md)
- [Verification](omcm/docs/VERIFICATION.md) and [deployment](omcm/docs/VERCEL_DEPLOYMENT.md)

## Contributing

Use a feature branch, inspect existing work and preserve the single-map layout.
Keep health records synthetic and document any methodology changes. Run frontend
lint, tests and production build, plus the backend test suite, before committing.
The [project guide](omcm/README.md#development-and-checks) lists the commands and
browser checks.
