# Implementation audit and plan

Audit: 2026-10-15. Existing stack: Vite/React 19/TypeScript, Leaflet,
Recharts, FastAPI/Pydantic, OR-Tools, NetworkX, SQLite, npm lockfile and a
Python virtual environment. No Google integration or client map key exists.
HTTP Basic demo authentication and server-owned draft approval already work.
The working tree initially contained only the untracked implementation prompt.

## Gaps found before implementation

- `/simulator` is a static scenario comparison, with no moving fleet or clock.
- Authentic bundled 681-barangay PSGC boundaries exist, but planning maps omit
  the street basemap. Two legacy name joins remain unresolved.
- The optimizer computes real capacity-constrained allocations, but its road
  model consists of estimated adjacency links. No driving polylines exist.
- There is no frontend-only mode; loss of the API blocks all planning screens.
- Existing approvals, emergency confirmation, public schedule separation,
  scoring, navigation and tests are useful and will be retained.
- No lint command, source manifest for a road pilot, implementation docs or
  prepared fleet demo script exists.

## P0 — functional vertical slice

1. Keep the current stack and introduce a bounded, PSGC-joined Laguna road pilot
   using authentic existing polygons and explicitly synthetic health inputs.
2. Obtain attributed OSM/OSRM road geometries and modeled travel costs, validate
   them and bundle fixtures. Reuse them in the backend and browser demo.
3. Add deterministic capacity-aware browser fallback, preserve backend OR-Tools,
   evaluate a fair population baseline, and expose missing/unsafe routes.
4. Replace the static simulator with a real tiled map, shared simulation clock,
   independent road-following vehicles, timeline, scenario controls, inspection,
   layer controls, comparison and the existing approval workflow.
5. Model flood/closure/surge constraints explicitly; invalidate and reset proposed
   playback on replanning. Never mutate approved schedules during simulation.
6. Provide explicitly labeled browser-only approval persistence when offline;
   preserve authenticated server publication when connected.
7. Run install/build/lint/unit/API/browser checks, including 1440px and 390px
   screenshots, playback determinism and public schedule isolation.

## P1

Source/date badges, unserved explanations, reproducible import validation,
scenario deltas, audit/export metadata, accessibility and responsive layout.

## P2 — deferred

Live GPS, production identity management, realtime infrastructure, forecasting,
push notifications and 3D. These require operational services and validated data.

## Acceptance evidence

Record only executed checks and actual limitations in `docs/VERIFICATION.md`.
Keep setup, architecture/API contracts, sources and a three-minute walkthrough
in repository documentation. No deployment or external publication is requested.
