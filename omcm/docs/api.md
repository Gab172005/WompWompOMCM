# API reference

Run FastAPI locally and open **http://127.0.0.1:8000/docs** for the complete
OpenAPI schemas and interactive requests. The machine-readable specification is
at `/openapi.json`. The routes below summarize the active application contract.

Administrator endpoints require HTTP Basic authentication using the backend's
configured account. Do not put credentials in URLs or source files. Invalid
credentials return 401; incomplete server sign-in configuration returns 503.

## Public endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service readiness, administrator configuration checks, and storage type |
| GET | `/api/schedules` | Published schedules and notices; no private drafts |
| GET | `/api/hospitals` | Hospitals from the configured backend dataset |
| GET | `/api/boundaries` | Uploaded boundaries or bundled source information |
| GET | `/api/assistant/status` | Optional external assistant configuration status |
| POST | `/api/assistant` | External assistant conversation/tool exchange; client actions enforce view permissions |

The province-wide map also uses bundled static geography and facility records.
`/api/hospitals` describes the selected backend dataset, which may be the separate
road pilot. Public notices identify the office rather than a private login name.

## Provincial planning

All these endpoints require administrator authentication.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/planning/clinics` | Provincial candidate sites and modeled connections |
| POST | `/api/planning/optimize` | Generate and save a provincial clinic draft |
| GET | `/api/planning/plans?limit=20&offset=0` | Paginated saved-plan summaries and storage information |
| GET | `/api/planning/plans/{plan_id}` | Reopen the exact stored allocation and inputs |
| POST | `/api/planning/simulation/evaluate` | Evaluate manual placement history across 30 days |
| POST | `/api/planning/simulation/optimize` | Propose simulation locations and return their evaluation |

A basic planning request is:

```json
{
  "clinic_count": 3,
  "capacity": 180,
  "max_travel_minutes": 25,
  "flood_level": "none",
  "closed_roads": []
}
```

The result includes `plan_id`, `created_at`, `status`, `inputs`, `optimized`,
`baseline`, `barangays`, model notes, and metadata. Reading a plan does not
recompute or publish it. List limits are 1–50; missing plan IDs return 404.
Plan reads and public schedule reads return `Cache-Control: no-store`.

Simulation requests use `clinic_count`, `conditions`, and `history`; optimization
also accepts `day` and `comparison_sites`. Histories contain one distinct eligible
location per clinic and at most one placement per weekly window. Results contain
per-day metrics and affected-barangay patches. Proposal IDs are transient and
cannot be used for schedule approval. Model failures return errors rather than
substitute allocations.

## Publication

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/schedules/approve` | Administrator |
| POST | `/api/schedules/emergency-override` | Administrator |
| GET | `/api/audit` | Administrator |

Approval accepts `plan_id`, `deployment_date`, `start_time`, `end_time`, and
`services`. The plan must exist and contain clinics; forecasts must still be
current. Normal booking allows tomorrow through seven days from today. A date
already published returns 409 for ordinary approval.

Emergency override adds a trimmed `notice` of at least ten characters and
`confirmed: true`. It permits same-day publication and replacement of an existing
schedule, never a past date. Opening time must precede closing time. Dates use
Philippine time. Approval writes the schedule, plan status, notice (if any), and
audit event transactionally.

## Supporting endpoints

The retained road pilot and supporting tools expose authenticated `/api/barangays`,
`/api/risk/calculate`, `/api/analytics`, `/api/clinics`, `/api/optimize`,
`/api/simulate`, `/api/risk/sensitivity`, `/api/explanations`, `/api/chat`, and
`POST /api/boundaries`. Their inputs and scoring differ from the provincial map;
inspect OpenAPI before using them as a client integration.

Optional authenticated `/api/integrations/google` reports Routes configuration;
`/api/routes/google?origin_id=...&site_id=...` requests a route for supported pilot
identifiers. These routes are not the provincial allocation matrix, and Google
route geometry is not displayed on an OpenStreetMap basemap.
