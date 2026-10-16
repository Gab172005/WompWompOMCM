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
  "weights": {"population":10,"disease":30,"vulnerability":20,"accessibility":20,"poverty":15,"flood":15},
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

### Build Step 1 need index

`Weights` now includes `population` (default 10, range 0–100). Existing defaults
for the other five weights remain unchanged; all six weights are normalized
by their total. Population uses average-rank percentile within the active dataset.
Disease uses cases per resident, vulnerability uses children/elderly shares,
poverty and flood use proportions, and inaccessibility uses travel minutes / 60.
Inputs are clipped to 0–1; the existing API exposes factors, contributions and
need scores on the 0–100 display scale. Population outliers cannot increase
the population term beyond its normalized weight; clinical and vulnerability
terms use rates so small communities retain their risk signal. No data files changed.

Authenticated `POST /api/risk/sensitivity?top_k=3` accepts the same weights body.
It returns `baseline_ids`, `top_k` (capped to available records), `delta` (5),
`membership_stable`, `order_stable`, and `trials`. Each trial changes one weight
by ±5 points, clamps to 0–100 and renormalizes; unchanged or all-zero trials
are skipped. Trials expose factor, actual change, top IDs, membership and order
changes. Ties use rounded need score then stable ID, matching the scorer.
This evaluates barangay rankings, not optimal clinic locations or allocations.

The Settings panel reuses existing sliders and displays this backend check.
Browser demo scoring mirrors the added population percentile for compatibility;
sensitivity is explicitly unavailable without Python. Map density is estimated
represented population per square kilometre of the existing municipal polygon,
not a complete census density. Its colour scale uses a fixed dataset maximum
across municipality searches. Other metrics retain the 0–100 scale.

### Build Step 3 allocation additions

Pilot site and clinic records include optional `facility_type`: `school`,
`barangay_hall`, or `health_center`. These categories are synthetic and facility
suitability is unverified. Legacy datasets can omit this field.

New Python allocations include `metrics.unserved_population`: represented
population minus residents allocated a daily appointment, floored at zero.
This is a synthetic daily estimate, not an estimate of unmet clinical need.
`unserved_demand` continues to mean unfilled daily appointment demand. Older
persisted allocations may omit `unserved_population` (response default: null).
`flood_safe_accessibility_pct` is now served daily demand divided by total daily
demand, times 100, using only scenario-safe sites/routes; zero demand returns 0.
This is modeled accessibility, not verified real-world flood safety.

The existing clinic `reason` includes suggested preventive services, reused
from Python scoring recommendations for the barangays actually allocated to
that clinic. `clinic_count` remains an upper limit on useful sites; manual
placements fix the chosen candidates subject to existing eligibility and safety
validation. Baseline placements select the most populated eligible barangays
and fill daily demand in population order under identical restrictions.

### Build Step 5 municipal simulation settings

`PlacementRequest` now accepts optional `municipality_flood_levels`, a dictionary
of existing dataset municipality names to `none`, `moderate`, or `severe`.
It defaults to `{}` for existing callers and saved plans. A municipal value
supersedes `flood_level` for that municipality, including explicit `none`.
Unknown municipality names and unsupported severity values are rejected.
Pilot coverage is Bay and Los Baños. Hazard membership uses existing hazard
barangay references; active hazards consistently affect site exclusions, route
exclusions, and returned flood factors/need scores.

Use authenticated `POST /api/simulate` with `{original, scenario}` placement
requests for previews. It returns Python `before`/`after` plans and changes,
without persisting a draft or publishing a schedule. Simulation Mode holds the
preview locally. Scenario alternatives use tomorrow’s date and a fixed Timugan
depot origin, matching Python depot-access exclusions. Existing multi-day
rehearsals remain separate. Apply simulation to draft calls the existing `/api/optimize`
to persist a reviewable draft. Publication still requires the existing schedule
approval or confirmed emergency workflow. Changed inputs invalidate application
until recomputed; unsupported relocation routes also prevent application.

The UI's 100-year preset maps both pilot municipalities to severe synthetic
flooding. It is a stress-test assumption, not a calibrated 100-year flood model.
Clickable blocking uses existing prepared closure IDs in `closed_roads`; it does
not invent arbitrary road segments or diversion geometry. No bundled input JSON
or dependency changes were needed. New Simulation Mode requires Python and admin
sign-in; existing separately labeled offline rehearsals remain available.

### Step 6: read-only explanation assistant

`POST /api/explanations` requires administrator authentication. It accepts the
existing `SimulationRequest` (`original` and `scenario` placement inputs),
recomputes both through Python without saving either, and returns
`{"provider": "deterministic", "text": "..."}`. For an ordinary recommendation,
pass identical original/scenario inputs. It explains the model's weighted factors,
allocated appointments, capacity, travel, exclusions, and before/after changes.
It cannot publish, save drafts, or override optimization constraints.

`OMCM_EXPLANATION_PROVIDER=deterministic` is the default. The Python
`ExplanationProvider` interface accepts computed evidence and returns text.
No LLM adapter or external call is installed; unsupported values fail explicitly.
Future adapters require server-side configuration. No API keys reach the browser.

Run nightly optimization is a manual frontend action using authenticated
`/risk/calculate` then `/optimize` with current parameters. The returned scenario
scores and saved draft replace the current planner results only after success.
Schedules defaults that draft to tomorrow, using its existing Philippine-date
logic and explicit publication workflow. This adds no background scheduler,
job schema, or automatic publication. Last updated uses the successful draft's
server `created_at`, displayed in Philippine time, and records runs in the current
session only. Failed runs retain the preceding result and timestamp.

## Map-first interface additions (2026-10-16)

`PlacementRequest.municipality_outbreak_multipliers` is an optional dictionary
of existing municipality names to finite multipliers from 1 through 5. It defaults
to `{}` for older saved inputs. The user approved this request-model addition.
It overrides the legacy single outbreak multiplier for all available barangays in
that municipality. Unknown municipalities and out-of-range values return 422.
Bundled input JSON schemas are unchanged.

Existing `closed_roads` additionally accepts undirected segment identifiers derived
from the existing OSRM coordinate pairs: `segment:<rounded endpoint>:<rounded endpoint>`.
Endpoints use positive WGS84 coordinates multiplied by 100000, rounded with
floor(value + 0.5), then sorted lexically. The geometry itself is unchanged.
The backend validates every identifier against the pilot routes, excludes all
routes sharing that segment, and excludes sites without a supported depot route.
The frontend route feasibility check uses the same identifiers. No inferred
road shortcuts or fabricated diversions are added.

Municipal flood overrides now apply a synthetic exposure floor (50 for moderate,
100 for severe) to every available barangay in the named municipality. Road and
site flood exclusions still use only the existing synthetic hazard footprints.
None restores each barangay's baseline exposure. These values are scenario
assumptions rather than depth, return period, or official hazard observations.

`POST /api/chat` reuses existing administrator authentication. Body:

```json
{
  "original": {},
  "scenario": {"municipality_outbreak_multipliers": {"Bay": 2}},
  "messages": [{"role": "user", "content": "What changed in capacity and travel?"}]
}
```

The server accepts 1–40 user/assistant messages, at most 4000 characters each,
and requires a final user message. It recomputes grounded evidence using the
existing Python engine without saving or publishing. Response: `{ "text": "…",
"provider": "template" }`, or provider `openai-compatible` when configured.
Provider transport uses only `urllib.request` and other standard-library modules.
Configure `OMCM_CHAT_PROVIDER`, `OMCM_CHAT_MODEL`, `OMCM_CHAT_API_KEY`, and
`OMCM_CHAT_URL` in gitignored `backend/.env`; the URL must use HTTPS. The provider
must implement chat-completions messages and choices/message/content responses.
Unset credentials, missing configuration, or provider failures use a grounded
server template. Signed-out/browser-only sessions have a visibly labeled local
template from displayed app data. Remote-provider network behavior is unit-tested
with a stub; live credentials are not included or required for template chat.
