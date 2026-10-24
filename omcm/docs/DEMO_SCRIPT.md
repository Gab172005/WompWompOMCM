# Verified demonstration and presentation outline

## Prepare

Use the audit branch with a running FastAPI service and Vite frontend. Sign in
with the existing configured account. Use an isolated persistent local database
for repeatable publication demonstrations; Vercel scratch SQLite is temporary.
OpenStreetMap works without a key. Have desktop and 390px screenshots available.

## Five-minute walkthrough

1. **Public care (40 seconds).** Start at `/`. Search a community. Show nearby
   hospitals and approved visits/hours/services, or the explicit empty state.
   Explain that only approval publishes a draft.
2. **Transparent need (50 seconds).** Sign in, search Pangil then Dambo, inspect
   HNI contributions and the hospital list. Show the six agreed percentages.
   A municipality with no local record can still have nearby referral facilities.
3. **Connected planning (60 seconds).** Open Plan clinics, choose three clinics,
   capacity and travel cutoff, then Generate recommendations. Show the saved
   backend draft, appointments, baseline comparison and returned map markers.
   Lighter red is an illustrative service preview; capacity metrics are separate.
4. **Three scenarios (90 seconds).** Open 30-day simulation without leaving the
   map. Advance No intervention a few days. In Manual, place distinct sites and
   Apply; observe local improvement. In Optimized, generate a real backend
   proposal and Apply. Compare all three on the same day using cards/chart/log.
   Several clinic areas change together, but a particular optimized run need not
   outperform every possible manual arrangement under the visual heuristic.
5. **Flood and publication (60 seconds).** Return to Plan clinics. Select the
   25-year layer and regenerate to show blue flagged-barangay outlines. Explain
   return periods and operational exclusion. Approve the matching next-day draft
   and open Public View to see approved locations; rehearse emergency revision
   only in the isolated demonstration database.

## Presentation slides

| Slide | Main message | Evidence to show |
| --- | --- | --- |
| 1. Problem and scope | Help LGUs place limited mobile clinics across Laguna | 681 barangays, 30 LGUs, shared map |
| 2. Need assessment | Fixed transparent group-agreed HNI | 35/30/15/10/5/5 contribution breakdown |
| 3. Prediction and allocation | Synthetic XGBoost forecasts feed capacity-aware CP-SAT | Model provenance, saved draft and population-first comparison |
| 4. Clinic impact scenarios | Compare identical days with different placements | No intervention, Manual, Optimized cards/chart and lighter host/nearby areas |
| 5. Operational control | Review before publication; screen flood/link access | Flagged outlines, draft approval and confirmed public visits |
| 6. Verification and limitations | Demonstrated behavior and explicit evidence limits | Current test/browser results and limitations below |

## Methodology to explain accurately

XGBoost is the chosen implementation; the proposal does not name it. The
proposal describes transparent estimation plus maximal covering with capacity
and maximum travel time. The 30-day rehearsal is a deterministic experiment,
while the connected model forecasts tomorrow from synthetic history. Clinic
service reduces scenario scores, not the agreed HNI factor percentages. Host
impact reaches 35%, tapering to 17.5% at a 3 km centroid edge; overlaps take the
strongest effect.

Flood options select mapped 25-/100-year scenarios (about 4%/1% annual chance),
not water depths. Barangay outlines do not establish exact flood extents. Travel
is adjacency-based, not verified driving time. Model metrics measure fictional
training generators; no clinical validity, live weather, GPS or automatic
nightly scheduling is claimed. Service deductions currently run in the browser.
The final deployment decision belongs to LGU officers.

Use [current verification](VERIFICATION.md) for exact results and
[the audit](GLOBAL_AUDIT.md) for the changed-file inventory and remaining gaps.
