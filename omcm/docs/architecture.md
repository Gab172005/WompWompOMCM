# Architecture

OMCM is a React single-page application backed by a FastAPI service. Admin tools
open in panels on the existing map; Public View exposes published care information.

## Components

| Location | Responsibility |
| --- | --- |
| `frontend/src/features/` | Map layers, place details, authentication, planning, simulation, and assistant UI |
| `frontend/src/store/` | Zustand stores for workspace state, current plan, simulation, assistant, and confirmed schedules |
| `frontend/src/services/` | API transport, geographic data, HNI calculations, and validated assistant actions |
| `backend/routers/` | HTTP endpoints and authentication dependencies |
| `backend/models/` | Request validation and response contracts |
| `backend/services/` | Data loading, forecasts, optimization, simulation, and storage |
| `backend/data/` | Bundled planning fixtures and trained XGBoost artifacts |
| `datasets/` | Source inputs and provenance documentation |
| `tests/` | Frontend integration and backend tests; additional frontend tests sit beside source files |

Paths above are relative to `omcm/`.

## Planning flow

1. The browser loads bundled geography and community records for the map.
2. An authenticated planning request sends fleet and access constraints to FastAPI.
3. XGBoost estimates illness and appointment demand; OR-Tools selects clinic sites
   and assignments within capacity and modeled travel limits.
4. The repository stores a private draft. Authenticated reads can reopen its
   exact inputs and result without rerunning the solver.
5. Explicit approval creates a published schedule. Public clients receive the
   approved snapshot, operating hours, services, and notices.

The 30-day simulator has separate transient evaluation/proposal endpoints. It
uses the common HNI definition and identical clinic-effect rules for manual and
optimized plans. Its optimization objective differs from ordinary appointment
planning; see [methodology](methodology.md).

## Storage and access

`DATABASE_URL` selects PostgreSQL through Psycopg. Without it, SQLite uses
`OMCM_DATABASE_PATH`. The same repository tables store plans, schedules, notices,
audit events, and uploaded boundaries. Publication is transactional; concurrent
ordinary approvals cannot overwrite the same date. Configured PostgreSQL errors
never silently fall back to SQLite. Switching adapters does not migrate records.

Vercel's scratch SQLite is temporary and not shared across instances. Persistent
hosting or PostgreSQL is required for shared records across restarts/devices.

Planning reads and mutations use server-verified HTTP Basic authentication.
Credentials are kept in memory; reload requires sign-in again. Public schedule
snapshots refresh from the backend in both views. Private plans do not enter the
public schedule store. Bundled synthetic data is browser-visible, so the prototype
must not be treated as a confidential patient-record system.

The optional Gemini assistant returns text and tool requests; the browser validates
supported actions and view permissions. Publication remains a separate admin action.
Provider keys stay on the backend. Local commands avoid external model calls.

## Geographic scope

The provincial planner covers 681 barangays in 30 Laguna LGUs. A separate
Los Baños–Bay road pilot supports retained comparison/routing endpoints. Keep
`OMCM_DATASET=pilot`; that setting does not restrict the provincial planning API
to those two towns. Existing pilot models and the provincial HNI have different
inputs and should not be presented as interchangeable scores.
