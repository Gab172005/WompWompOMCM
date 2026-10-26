# Saved plans and published deployments

Open **Admin → Plan clinics → Saved plans & deployments** to return to earlier
work without leaving the map.

- **Plans** lists backend allocations, newest first. Opening one reads the stored
  result and restores its fleet and constraints. It never reruns optimization or
  publishes a visit. The label identifies draft/previously published plans.
- **Deployments** lists upcoming dates first, followed by past schedules. Select
  a date to see hours, services, clinic locations and map markers. **Review
  original plan** opens its allocation without changing the published snapshot.
  A past record does not prove that a clinic actually visited.

Plans are saved automatically when recommendations return. Publication still
requires explicit approval. Existing safeguards require a fresh forecast before
publishing an old plan. Simulation runs remain temporary practice.

Refresh reloads server records. Published schedules synchronize in both views on
focus, reconnection and the refresh interval. A selected deployment updates when
a newer confirmed snapshot arrives. Public View receives published visits only;
private plans require authentication. After reloading, sign in again to reopen
work. Credentials/private plans are not restored from browser local storage.

## Shared storage

The backend uses PostgreSQL when `DATABASE_URL` is configured; otherwise it keeps
SQLite. Vercel scratch SQLite is temporary and unshared; the card identifies
that configuration. PostgreSQL preserves the existing five-table structure and
uses transactions for approval. A configured PostgreSQL failure never silently
falls back to SQLite. Switching adapters does not copy old SQLite rows.

Follow [Neon setup](VERCEL_DEPLOYMENT.md#shared-plans-and-schedules-with-neon-postgresql)
to connect the backend database and redeploy. This change does not provision a
hosted database or deploy the app.

## Changed files and behavior

| File | Change |
| --- | --- |
| `backend/services/repository.py` | PostgreSQL/SQLite selection, stored-plan summaries, transactional publication. |
| `backend/routers/optimization.py` | Private paginated summaries and full-plan reads with no-store responses. |
| `backend/requirements.txt`, `backend/requirements.lock.txt`, `.env.example` | Approved Psycopg dependency and backend-only URL configuration. |
| `frontend/src/features/optimization/SavedPlanningWork.tsx` | Lists, selected states, pagination, loading/retry and deployment details. |
| `frontend/src/features/optimization/OptimizationPanel.tsx` | Integrate saved work into the existing map panel. |
| `frontend/src/store/useOptimizationStore.ts` | Exact plan restoration, cancellation protection and deployment selection. |
| `frontend/src/features/optimization/usePlanningResults.ts`, `frontend/src/services/optimization.ts` | Map the recorded deployment snapshot using the same public schedule converter. |
| `frontend/src/features/optimization/DeploymentApproval.tsx` | Refresh confirmed schedules after publication. |
| `frontend/src/features/public/useScheduleSync.ts` | Synchronize published visits in both views. |
| `frontend/src/components/layout/AppLayout.tsx`, `frontend/src/features/map/components/ClinicMarkers.tsx` | Label published deployments correctly in marker popups. |
| `frontend/src/styles/map-workspace.css` | Responsive rows, selected cues, scrolling, timeline alignment and sheet spacing. |
| `tests/backend/conftest.py`, `tests/backend/test_saved_plans.py` | Isolate tests from live databases; verify reads, persistence, concurrency and failure behavior on both adapters. |
| `tests/frontend/optimization.test.tsx` | Verify restored constraints and rejected late responses. |
| `frontend/scripts/optimization-browser.mjs` | Verify reload/restart recovery, published markers, mobile layout and public isolation. |

## PostgreSQL verification

Use an isolated test server, never a production connection:

```bash
cd backend
OMCM_TEST_DATABASE_URL='postgresql://test-user@localhost/test-db' .venv/bin/python -m pytest -q
```

These cases create/remove a unique schema per test. Without the opt-in URL they
are skipped; SQLite cases still run. Ordinary tests remove inherited
`DATABASE_URL` to prevent accidental writes to a configured shared database.
The optimizer browser script also accepts a dedicated test `DATABASE_URL` and
checks recovery after restarting its FastAPI process.
