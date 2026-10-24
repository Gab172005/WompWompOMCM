# Simulation HNI objective correction

Branch: `fix/simulation-hni-objective`, based on
`feat/seven-day-clinic-scheduling`. This change repairs the simulation comparison;
it preserves the existing group weights, source datasets, trained artifacts,
authentication, ordinary appointment planner and public approval workflow.

## Problem and result

The previous simulation asked the appointment optimizer for sites, then applied
an unrelated browser-only 3 km deduction. Maximizing priority-weighted
appointments did not minimize the HNI displayed by the scenario cards. Reach
also counted barangays without expressing their population, need or service
intensity. Higher impact opacity could make served areas appear darker.

Manual and Optimized now share a backend evaluation. XGBoost demand limits
catchment service to 180 modeled appointments per clinic. Both modes use the
same 3 km radius, modeled safe-access limit, flood exclusions, overlap rule,
baseline and population denominator. The simulation objective maximizes exactly
the population-weighted HNI reduction returned by that evaluator. The bounded
solver keeps a feasible manual incumbent when better, evaluated with unrounded
fractions. No optimized bonus or area-count multiplier is added.

The comparison guarantee applies on the selected optimization day. A tie is
valid; changing daily demand or later manual decisions can change the ranking
of held locations. More geographic areas alone does not imply a better HNI.
The UI identifies the optimization day and a changed manual comparison.
Conservative overlapping reservations can leave capacity unused. These are
mock planning estimates, not patient outcomes or verified road journeys.

## Exact files and logic changed

Paths are relative to `omcm/`. Existing files refine the prior implementation;
the three new implementation/test files are identified explicitly.

| File | Change and reason |
| --- | --- |
| `backend/models/hni_simulation.py` (new) | Add strict transient evaluation/proposal contracts, fleet/day/history bounds, and bounded HNI impacts. No storage migration. |
| `backend/services/hni_simulation.py` (new) | Own deterministic baseline parity, dated demand, access/flood catchments, capacity-scaled deductions, overlap, full timeline metrics and HNI-targeting CP-SAT with verified incumbents. |
| `backend/routers/simulation.py` | Add authenticated evaluate/optimize simulation endpoints with explicit validation/model-failure responses; retain legacy simulation API. |
| `backend/services/demand_model.py` | Accept optional synthetic issue/history dates; reuse stable history prefixes without exposing future features or changing normal next-day inference. |
| `frontend/src/services/forecasting/optimizer.ts` | Replace appointment-plan adapter with typed simulation request/proposal/evaluation contracts and runtime completeness guards. |
| `frontend/src/services/forecasting/interventions.ts` | Hydrate server per-barangay HNI/fractions and aggregate metrics; retain local ordinary-plan geographic preview separately. Add service/capacity/population metrics. |
| `frontend/src/store/useForecastStore.ts` | Request backend manual evaluation and HNI optimization with selected day/manual incumbent; accept only matching map averages, preserve history, cancel stale requests, keep optimized sites immutable and record comparison context. |
| `frontend/src/features/simulation/SimulationPanel.tsx` | Display two-decimal HNI, shared calculation/proposal metrics, placement loading, read-only optimized sites and dated comparison context. |
| `frontend/src/features/simulation/SimulationResults.tsx` | Show consistent precision, affected population, modeled appointments/capacity and accurate service labels in results/logs. |
| `frontend/src/features/simulation/SimulationPlayback.tsx` | Disable advance/play during connected calculations. |
| `frontend/src/features/simulation/useSimulationMap.ts` | Permit map placement edits only for Manual; preserve optimized proposal identity. |
| `frontend/src/features/simulation/FloodControls.tsx` | Explain that flood screening applies to both placement methods. |
| `frontend/src/features/map/components/BarangayBoundaryLayer.tsx` | Keep impacted/baseline fill opacity consistent and show precise simulation tooltip values. |
| `frontend/src/features/map/components/LagunaGoogleMap.tsx` | Apply the same opacity/tooltip correction in the optional Google renderer. |
| `frontend/src/features/map/components/MapLegend.tsx` | Identify radius as an upper bound, explain capacity/access, and distinguish the ordinary geographic preview from backend simulation. |
| `frontend/src/services/assistantTools.ts` | Consume evaluated optimized Apply, summarize the proposal without sending its full future timeline to the assistant, and describe updated units/access. |
| `frontend/src/services/requestFeedback.ts` | Preserve actionable simulation validation and provide clear model/evaluation errors without changing a run. |
| `frontend/src/services/forecasting/simulation.test.ts` | Update API fixtures; test server authority, manual comparison inputs, identical allocations, immutable optimized locations, stale/error responses and timeline guards. |
| `frontend/scripts/simulation-browser.mjs` | Verify real authenticated manual/optimized requests, fair equal-fleet comparison, HNI/map agreement, host/neighbor/outside effects, markers and responsive layout. |
| `tests/backend/test_hni_simulation.py` (new) | Verify analytic weighted math, capacity/overlap, exhaustive tiny optimization, timeout incumbents, history-prefix parity, unchanged factors, real comparison/privacy, auth, history validation, floods and model failures. |
| `README.md` | Explain corrected simulation ownership/objective and distinguish the ordinary preview. |
| `docs/API.md` | Document new request/response contracts, authentication, validation, solver status and transient proposal boundary. |
| `docs/ARCHITECTURE.md` | Record backend ownership, store hydration/cancellation, explicit objectives and unchanged publication. |
| `docs/SIMULATION_MODE.md` | Specify shared formulas, capacity reservations, dated demand, scenarios and comparison limits. |
| `docs/TEMPORAL_FORECAST.md` | Replace the obsolete capacity/access-unification gap with current simulation behavior. |
| `docs/GLOBAL_AUDIT.md` | Update superseded ownership/capacity findings and remaining evidence limits. |
| `docs/DEMO_SCRIPT.md` | Explain capacity ceilings, backend service and the selected-day comparison accurately. |
| `docs/VERIFICATION.md` | Record current checks and distinguish local verification from hosted deployment. |
| `docs/SIMULATION_HNI_FIX.md` (this file) | Provide the exact file/logic inventory and review steps. |

## Browser review

With the existing backend running and `npm run dev` in `frontend/`, sign in to
**Admin View** at `http://127.0.0.1:5173/admin`
and open **30-day simulation**:

1. Keep the same fleet and conditions for all three scenarios. Advance the shared
   timeline to see No intervention HNI rise.
2. In Manual, select distinct available sites and Apply. Wait for connected
   evaluation; inspect lower HNI at the host and affected neighbors. Outside
   service remains at baseline. Review appointments, capacity and activity logs.
3. Select Optimized on the same day, Generate optimized locations, review the
   HNI comparison, then Apply. The card and map use the returned evaluation;
   its HNI is no worse than the feasible manual comparison for that day.
4. Continue playback. Locations are held while mock demand changes; the dated
   optimization note remains visible. Replan in the next placement window.
5. Switch to Public View: rehearsal clinics, HNI metrics and draft predictions
   are absent. Approved schedules remain independent.

The connected Day 1 browser check with three clinics recorded Manual
**43.6706077702** versus Optimized **43.6032227472** HNI. The map's weighted
average matched the backend result. This is a reproducible synthetic example,
not a promise of that improvement for every input.
