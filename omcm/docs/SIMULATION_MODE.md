# Three-scenario simulation

## User flow and shared time

Admin View → **30-day simulation** opens a side sheet on the same map. Select
No intervention, Manual or Optimized to view its heatmap. Cards, chart, logs and
snapshots share one viewed day. Playback advances all scenarios, pauses at Days
8, 15 and 22, and stops on Day 30. Scrubbing reviews reached days only. Collapse
the sheet to retain the clinics, colors and timeline while inspecting the map.

**Return to Day 1** only rewinds the viewed day and preserves reached history.
**Reset simulation**, near the scenario chooser, opens a review dialog and pauses
playback. Cancel/close/Escape keep the run intact. Confirming **Reset all
scenarios** calls the existing store reset: it cancels pending service requests,
clears all three placement/activity histories, drafts and recommendations,
rebuilds the baseline timelines and returns to Day 1 with no deployed clinics.
Fleet count, conditions, selected scenario, metric and playback speed remain.
Published schedules and ordinary clinic-planning drafts are unaffected. Focus
returns to the selected scenario, and completion feedback disappears when the
run changes. The same modal is scrollable and bounded on phones and landscape
screens. Reset introduces no new HNI calculation or backend endpoint.

The reproducible experiment begins on 2026-10-24 in Manila time, seed 42, across
681 barangays. Changing conditions or fleet size resets every run and cancels
pending requests. The fleet is 1–10 clinics. Each scenario permits one placement
per weekly window (1–7, 8–14, 15–21, 22–30), on its latest reached day. Placements
persist until replaced; later decisions preserve earlier snapshots.

| Scenario | Placement and evaluation | Map behavior |
| --- | --- | --- |
| No intervention | Common baseline; no service | Deterministic morbidity growth raises HNI; capped factors can plateau. |
| Manual | User chooses distinct sites; authenticated backend evaluates Apply | Host and reachable neighbors improve; other areas retain the common baseline. |
| Optimized | Authenticated backend minimizes scenario HNI; user explicitly applies proposal | Multiple solver-selected service areas improve through the same evaluation used for Manual. |

Manual Apply now requires the connected service. Failed requests preserve the
existing run; no local deductions substitute for a failed evaluation. Optimized
locations are read-only; use Manual to try alternatives. Draft markers remain
separate from applied markers. Neither scenario creates a publishable plan or
changes approved public schedules. Credentials and public/admin routing remain
unchanged.

## Baseline and unchanged group weights

Both browser baseline and backend evaluation preserve the agreed six factors:
35% morbidity, 30% hospital distance, 15% density, 10% municipal income class,
5% clinic distance, 5% clinic provision deficit. Missing factors rescale the
available weights. Flood risk adds no HNI weight. The baseline retains fixed
percentile references and the existing deterministic daily morbidity increase.
The correction changes service evaluation and placement objectives, not these
percentages, source records, or trained model artifacts.

The existing illness and appointment XGBoost models supply appointment demand
for each synthetic simulation date. History generation is reused across the
month for speed, but feature windows and rolling burden stop at each date's
issue-day prefix. No future mock observations enter an earlier forecast. This
is still a rehearsal using synthetic illness/weather, not a validated clinical
or live weather forecast. Baseline HNI growth itself remains deterministic.

## One backend service deduction

For each eligible host `j`, reach includes barangays whose centroids are within
3 km **and** have a safe modeled adjacency path of at most 25 minutes. The same
flood and land restrictions apply to Manual and Optimized. Border adjacency is
not verified road access; distances and travel remain estimates. Road reference
markers do not alter modeled paths.

For an in-reach barangay `i`:

```text
rawFraction[i,j] = 0.35 × (1 − 0.5 × distanceKm[i,j] / 3)
capacityScale[j] = min(1, 180 / total XGBoost appointment demand in j's catchment)
serviceFraction[i] = max(rawFraction[i,j] × capacityScale[j]) over opened clinics
scenarioHni[i] = baselineHni[i] × (1 − serviceFraction[i])
overallHni = Σ(population[i] × scenarioHni[i]) / Σ(population[i])
```

The 35% host and 17.5% catchment-edge deductions are **ceilings**, attained when
capacity covers catchment demand. Smaller capacity produces proportionately
smaller deductions. Each barangay receives the strongest single reservation;
service fractions are never added across overlapping clinics. Appointment demand
is attributed only to the winning clinic. Each clinic stays within 180 modeled
appointments and no barangay's demand is counted twice. Ties break by host ID,
so reordering clinic IDs does not change scores.

This is a conservative capacity reservation model. Overlap can leave reserved
capacity unused; spare reservations are not redistributed. It does not claim
optimal appointment scheduling or individual treatment outcomes.

Areas outside service retain baseline HNI. Uncovered need separately carries a
backlog: `min(100, baselineHni + 0.15 × previousUHNI) × (1 − serviceFraction)`.
The backend returns all 30 days' metrics and affected-barangay HNI patches. The
browser renders those patches and checks that the map's population-weighted
average equals the returned card value before accepting a placement. Colors
share the same opacity; served areas no longer become darker just because an
impact outline is present.

## Optimization and fair comparisons

The ordinary **Plan clinics** endpoint maximizes priority-weighted appointments.
The **simulation** endpoint instead maximizes total population-weighted HNI
reduction, using exactly the capacity-scaled fractions above. CP-SAT selects the
requested number of eligible sites. It receives a real marginal-gain incumbent
and the current feasible manual plan. The returned candidate is compared with
those incumbents using unrounded HNI benefits; a time-limited or rounded solver
result cannot replace a better manual comparison. Solver optimality, when
reported, refers to the finite-precision CP-SAT objective.

The guarantee is **no worse HNI than the supplied feasible Manual plan on the
selected optimization day**, with equal fleet, baseline, demand and constraints.
A tie is valid. Reaching more barangays does not mathematically guarantee a
larger reduction: population, baseline need, distance and capacity matter.

Locations remain held between decisions. Daily demand can change their ranking;
new manual placements also change the comparison. The UI identifies the day a
plan was optimized and flags changed manual locations. It does not claim a
fixed plan stays optimal on every later day. Generate a new comparison in the
next placement window. Two-decimal HNI cards show smaller capacity-limited gains.

## API and ownership

- `POST /api/planning/simulation/evaluate`: fleet, conditions and placement history → backend timeline.
- `POST /api/planning/simulation/optimize`: those inputs plus selected day and manual comparison sites → locations, timeline, comparison HNI and solver status.

Both require existing administrator authentication. Histories must contain one
distinct eligible site per clinic and at most one placement per weekly window.
Unknown municipalities, duplicate sites, unavailable/flooded sites and invalid
counts/days are rejected. Model failures return 503, never invented placements.
Proposal IDs are transient and cannot be approved through public scheduling.
`/api/simulate` remains the separate legacy before/after comparison endpoint.

The ordinary Plan clinics map preview retains its older geographic illustration
and is explicitly labeled separately; its appointment planner is unchanged.
Simulation backend ownership does not change that draft preview's API contract.

See [API](API.md), [changed-file inventory](SIMULATION_HNI_FIX.md), and the
[current verification record](VERIFICATION.md). Refresh clears rehearsals.
