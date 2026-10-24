# Three-scenario simulation

## User flow and shared time

Admin View → **30-day simulation** opens a side sheet over the same map.
Select No intervention, Manual or Optimized to view that run's map. All three
cards, chart series, logs and snapshots refer to the same viewed day. Playback
advances them together, pauses at Days 8, 15 and 22, and stops on Day 30.
Scrubbing reviews reached days only; earlier decisions cannot be edited. The
side sheet can be collapsed to inspect the map while keeping clinics, colors and
playback active.

The reproducible experiment starts on 2026-10-24 in Manila time with seed 42.
It projects all 681 barangays. Changing environmental assumptions or fleet size
restarts all runs and cancels stale proposals. Fleet size is 1–10, matching the
backend maximum. The baseline uses the agreed Balanced HNI factors and fixed
baseline percentiles with a small deterministic daily morbidity increase.

## Scenarios

| Scenario | Placement | Expected map behavior |
| --- | --- | --- |
| No intervention | No clinic service | Need rises along the common morbidity projection; capped factors may plateau. |
| Manual | Distinct eligible barangays chosen by the user | Host and nearby barangays lighten; other areas follow the baseline. |
| Optimized | Actual authenticated FastAPI XGBoost/CP-SAT proposal, then explicit Apply | Multiple returned locations create simultaneous service areas. |

Draft markers are distinct from deployed markers. A connected proposal is
required before optimized placement controls become available. The user may
review/edit proposed sites for rehearsal; backend metrics describe the original
proposal, not an independently solved edited draft. Manual placements remain
local. Neither Apply nor playback publishes a schedule.

Each scenario permits one placement per weekly window (1–7, 8–14, 15–21, 22–30)
on its latest reached day. Locations remain active until a later placement
replaces them. Weekly windows permit a new decision; they do not automatically
remove deployed clinics. Earlier snapshots are preserved when a later decision
recalculates the remaining days.

## HNI policy and service deductions

The baseline reads `defaultNeedWeights()` from `healthcareNeed.ts`:
35% morbidity, 30% hospital distance, 15% density, 10% income class,
5% clinic distance and 5% clinic provision deficit. Missing factors rescale
available weights. Flood hazard has no direct HNI term.

For a barangay centroid within 3 km of an eligible host centroid, the modeled
service fraction is:

```text
fraction = 0.35 × (1 − 0.5 × distanceKm / 3)
scenario HNI = baseline HNI × (1 − fraction)
```

The host receives a 35% score reduction; the catchment edge receives 17.5%.
Affected neighboring areas use centroid distance, not shared-border membership
or verified road access. Outside 3 km the deduction is zero. Overlapping clinics
use the strongest single fraction rather than adding deductions. The original
factor percentages and baseline records remain intact. For example, baseline
HNI 80 becomes 52 at the host. This is a modeled score adjustment, not removal
of 35 percentage points from an HNI factor weight.

Uncovered need carries forward a separate backlog:

```text
untreated demand index = min(100, baseline HNI + 0.15 × previous UHNI)
UHNI = untreated demand index × (1 − fraction)
```

HNI, UHNI and population-weighted totals are planning indices, not counts of
patients. Capacity-aware backend appointments and browser service fractions are
different calculations. Host/neighbor deduction currently runs in the browser's
shared `interventions.ts`; no backend 30-day deduction contract exists yet.
Backend ownership is an explicit remaining architecture gap, not a verified
feature. Changing that API/data model requires separate approval.

## Backend requests and operational context

The optimized run calls authenticated `/api/planning/optimize` with fleet and
supported municipality outbreak/flood conditions. It validates draft identity,
XGBoost/Balanced provenance and returned locations. A response with fewer usable
sites than requested gives an actionable error; no fabricated sites fill the gap.
The planner forecasts the next real Manila day, not the selected synthetic
future simulation day. A new weekly request therefore does not claim to be a
week-ahead XGBoost forecast.

Flood controls use no additional screen, the 25-year layer or the 100-year layer.
They affect connected optimized planning exclusions; they do not add HNI weight
or change the manual straight-line catchment. Road reference markers in the
30-day rehearsal do not recompute road access. Operational model-link exclusions
are configured in **Plan clinics**. No measured flood depth is available.

## Files and verification

Core files: `forecasting/forecast.ts`, `forecasting/interventions.ts`,
`forecasting/optimizer.ts`, `store/useForecastStore.ts`, simulation components,
`useSimulationMap.ts`, and both map renderers. Optimization also reuses the
service formula for its map preview. Scenario cards, selected-run details,
chart, activity log, numbered markers and HNI/UHNI colors share those snapshots.

The [current verification record](VERIFICATION.md) records unit and browser
checks for rising baseline, host/neighbor impact, overlap, synchronized days,
weekly history, a real backend proposal, manual-pretending-to-be-optimized
rejection, fleet limits, markers and responsive layout. Google Maps live
verification needs a configured key. Refreshing clears in-memory rehearsals.
