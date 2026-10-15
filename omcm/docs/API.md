# API contracts

FastAPI's generated `/docs` and `/openapi.json` provide the complete executable
Pydantic schemas. The existing route names are retained.

| Method and path | Purpose | Authorization |
| --- | --- | --- |
| GET `/api/health` | status, Manila date, demo-auth configuration state | Public |
| GET `/api/auth/me` | Verify configured demo administrator | Basic auth |
| GET `/api/barangays` | Scored default pilot, metadata/source labels | Public |
| GET `/api/clinics` | Candidate sites and documented closure segments | Public |
| GET `/api/hospitals` | Explicitly illustrative care reference | Public |
| POST `/api/risk/calculate` | Recalculate weighted scores | Basic auth |
| POST `/api/optimize` | Compute and persist a draft, return comparison | Basic auth |
| POST `/api/simulate` | Before/after allocation, no schedule mutation | Basic auth |
| GET `/api/schedules` | Published schedules, notices, current Manila day | Public |
| POST `/api/schedules/approve` | Approve and publish stored next-day draft | Basic auth |
| POST `/api/schedules/emergency-override` | Confirmed revision with public notice | Basic auth |
| GET `/api/analytics` | Rankings and synthetic population/demand totals | Public |
| GET/POST `/api/boundaries` | Read / validate uploaded boundaries | POST requires auth |
| GET `/api/audit` | Persisted approval/emergency events | Basic auth |

## PlacementRequest

```json
{
  "clinic_count": 3,
  "capacity": 180,
  "max_travel_minutes": 15,
  "weights": {"disease":30,"vulnerability":20,"accessibility":20,"poverty":15,"flood":15},
  "eligible_sites": null,
  "flooded_sites": [],
  "closed_roads": [],
  "outbreak_barangays": [],
  "outbreak_multiplier": 1,
  "manual_sites": null,
  "flood_level": "none"
}
```

`flood_level` is `none | moderate | severe`. Site IDs are `P01`–`P08`; road closure
ID is `demo-closure-1`. Community IDs are the nine-digit PSGC strings from the
bundled boundary snapshot. The UI supports 1–5 clinics; the retained API supports
0–10 to evaluate infeasibility and legacy experiments. Capacity is 1–5000, travel
0–120 minutes and surge 1–5×. Unknown fields, duplicates and unknown references
are rejected by the connected backend. An all-zero weight vector is invalid.

Response: `plan_id`, `status`, `created_at`, `inputs`, `barangays`, `metadata`,
`notes`, `optimized`, `baseline`, `improvement_pct`. Each allocation contains
`clinics`, `served_by_barangay`, `metrics`, `solver_status`, `optimal`. A clinic
includes its site coordinate, bounded capacity and integer allocations with
community IDs, daily appointment counts and modeled road minutes. Metrics
include served/high-priority/weighted demand, unserved demand, mean travel,
utilization and accessibility relative to synthetic hazard exclusions.

`POST /api/simulate` takes `{ "original": PlacementRequest, "scenario": PlacementRequest }`
and returns before/after plans plus gained/lost appointments and travel/utilization
deltas. No plan is automatically published.

## Approval

```json
{
  "plan_id": "server-returned-id",
  "deployment_date": "2026-10-24",
  "start_time": "08:00",
  "end_time": "17:00",
  "services": ["Primary care", "Child health"]
}
```

The date must be tomorrow or later in Manila. Existing dates return 409.
Emergency override also takes `notice` (10–500 characters) and `confirmed: true`;
it can revise today or a future date, never the past. An unknown draft returns
404; unauthenticated requests return 401, disabled demo auth 503, invalid inputs
422. Publishing reads the stored allocation, updates the plan to `published`,
and returns schedule timestamps. Drafts and simulations never appear in public
responses. There is no GPS upload endpoint.

## Frontend-only contract

`services/api.ts` selects browser demo only during initialization or explicit
configuration. `demoApi.ts` implements equivalent read, score, optimize,
simulation, analytics and local approval contracts with `local-` plan IDs and
the isolated `omcm-browser-demo-v1` storage key. It rejects unsupported actions
such as boundary uploads. It never turns backend 401/422 errors into successful
local publication. Browser-only records are not shared with the server.
