# OMCM architecture

## Retained stack and migration

React 19 / TypeScript / Vite, Leaflet, React Router and Recharts remain the
frontend. FastAPI, Pydantic, OR-Tools and SQLite remain the backend. No paid map
service or additional hosted database is needed. Google was not previously
integrated and no Google key is required; the existing legal OSM map provider
is retained. No Google-derived content is downloaded or cached.

The default dataset is now a bounded 20-barangay Los Baños–Bay road pilot.
The original 681-row geography and full provincial boundary files remain intact.
`OMCM_DATASET=province` retains the legacy provincial analysis for research;
its adjacency estimates are not driving routes and it is not the fleet-demo
configuration. Use `pilot` for the simulator and coordinated approval workflow.

## Data and routing

`frontend/scripts/build-road-pilot.py` joins the existing PhilAtlas seed locations
to the bundled 2023 PSGC polygons. It validates geometry, uses an interior point
when a seed is outside its polygon, and validates the snapped candidate endpoint
belongs to its named barangay. Sites are explicitly illustrative road locations,
not verified halls, schools, hospitals or operational facilities.

The importer obtains 168 directed OSRM legs in 21 throttled multi-waypoint
requests. Each origin is followed by a candidate and then the origin again;
only outbound legs are retained. `continue_straight=false` allows turns at
waypoints. Coordinates are assembled from real returned step geometries. A
request manifest and response hashes are included. No straight-line substitutes,
traffic data or Google cache are used. Importer dependencies are separate from
normal runtime dependencies.

The same `pilot.json` is copied to the frontend and backend; a test checks byte
equality. It contains inputs, sites, depot, road geometry/duration, synthetic
hazard polygons and precomputed geometry intersections. Frontend-only planning
and Python planning therefore use the same evidence and constraints. They use
different algorithms and may choose different feasible assignments.

Road-access time is `ceil(OSRM duration seconds / 60)` from a community point
to a site. It excludes walking to that point, queues and traffic. Hospital
access is a separate explicitly synthetic indicator: there is no verified
hospital inventory. Flood safety is relative to the demonstration overlays only.

## Scoring and allocation

Defaults: disease 30%, vulnerability 20%, access deficit 20%, poverty 15%, flood
15%. All sliders normalize by their sum; an all-zero configuration is rejected.
Clipped indicators are incidence per 1,000 divided by 100, vulnerable share
divided by 0.60, hospital-access minutes divided by 60, poverty / 100, and flood
index / 100. These are illustrative scales, not clinical thresholds. Population
determines synthetic daily appointment demand (2.5%), not the need score.

The Python model uses binary site selection and integer demand allocations.
Demand may split across sites, but each barangay's sum cannot exceed its demand.
Allocation is limited by both clinic and site capacity, the travel threshold,
eligibility, fleet size and scenario route accessibility. It maximizes need-
weighted appointments, then shorter travel and fewer sites. One solver worker
and fixed seed are used; the UI distinguishes proven optimality from feasibility.

The browser reference heuristic enumerates candidate subsets and allocates
descending-priority demand to the closest available selected site. It is
deterministic and labeled **Heuristic (demo)**; enumeration does not make the
greedy assignment stage globally optimal. The baseline selects feasible sites
in descending host population and fills them in descending community population
under the same restrictions. Neither mode treats total population as care delivered.

## Simulation and scenario state

The shared Provider owns the current input configuration and proposed Plan.
Simulator controls edit a pending scenario; the map reflects pending scores and
hazards, playback pauses, and the previous results are labeled stale until
reoptimization. A new plan explicitly restarts at the depot. It never teleports
an ongoing vehicle into an unrelated diversion.

`useSimulationClock` advances one requestAnimationFrame clock. Route lengths are
precomputed with cumulative haversine distances. `vehicleAt` locates the current
segment with binary search and interpolates on that segment. Departure offsets,
ETA, distance, heading, speed, trail, progress and status all derive from elapsed
time, making seeking reversible. Background-frame gaps are capped to avoid a
large jump when returning to a hidden tab. Duration is provider-modeled; constant
distance speed along the route is an animation assumption, not turn-by-turn GPS.

Moderate and severe floods use selected *real community polygons* as explicitly
synthetic inundation footprints. A closure uses an actual returned route segment
with a small approximately four-meter intersection buffer. Any intersecting
demand route is removed. A site with an affected depot route is excluded.
There is no inferred alternative route and no claim of arbitrary avoid-edge
support. Disease surges change incidence and demand; flooded communities also
increase their flood score contribution.

## Approval and modes

Connected mode retains server-verified demo Basic authentication. A read-only
tour can run the browser heuristic without credentials; it has no publishable
server plan ID. Signing in generates a server-owned draft for separate review.
Ordinary approval is for tomorrow or later, cannot replace an existing date,
and transactionally writes schedule, plan status, timestamp and audit record.
Today's plan or a previously published date requires a separately confirmed
emergency override with a public notice. Publication loads the stored plan;
clients cannot submit a replacement allocation through the approval endpoint.

If the initial health request fails or `VITE_DEMO_MODE=true`, the frontend
explicitly enters **browser-only demo**. The same typed API boundary routes
supported operations to the local heuristic and a distinct localStorage key.
Local approval is a rehearsal, visible only on that browser/origin. It never
sends an unauthenticated publication to a server. After a successful connection,
later API errors are reported rather than switching persistence modes mid-run.
Reload to retry backend connectivity. Public pages read approved schedules only;
they never render simulator markers as live locations. GPS sharing is disabled.

## Limits

OSM tiles require internet; offline road fixtures and calculations do not.
The tile-error UI supports retry. No live GPS, traffic, forecast, actual flood
extent, validated disease prediction, official patient count or production LGU
identity system is provided. Homogeneous service-compatible clinics are assumed.
SQLite needs persistent hosting storage. The browser demo is not a multi-user
database. Production rollout needs verified site suitability and input datasets.
