# 30-day Laguna simulation implementation

Simulation Mode forecasts all 681 barangays over 30 daily steps with three independent runs: No Intervention, Manual Clinic Allocation and Optimized Clinic Allocation. The baseline need rises deterministically each day. A deployed clinic lowers the displayed scenario HNI for its host barangay and nearby barangays, while unaffected areas continue along the baseline. Decisions occur on Days 1, 8, 15 and 22; the final placement period covers Days 22–30. Simulation changes remain local to the admin practice view and never publish public schedules.

## Forecast and intervention algorithms

The simulator and map share the agreed `barangay-healthcare-need-v4-balanced` profile from `healthcareNeed.ts`. The historical v2 disaster/urban-rural profile is no longer used:

| Factor | Weight |
| --- | ---: |
| Morbidity | 35% |
| Density | 15% |
| Hospital distance | 30% |
| Income class | 10% |
| Clinic distance | 5% |
| Clinic provision deficit | 5% |

Baseline percentiles and income normalization remain fixed throughout the month. Missing factors remain null; available weights are renormalized, and incomplete scores stay provisional. No CSV, generated dataset or boundary file changes are required. Disaster risk and urban/rural remain context and never alter HNI coverage or rank.

The synthetic experiment starts on October 24, 2026, at midnight Manila time. A fixed seed (42) and municipality PSGC set a small, repeatable daily morbidity increase. All three runs share identical baseline forecasts and the same six Balanced HNI weights. Morbidity controls affect the shared illness inputs. Flood controls do not add HNI points; the connected planner may use configured flood conditions for operating constraints. Browser catchments use straight-line distance.

Daily untreated demand is `min(100, baseline HNI + 0.15 × previous UHNI)`. Scenario HNI is the agreed weighted score after modeled service: service reduces HNI by up to 35% at the host and tapers to 17.5% at the 3 km edge. Neighboring barangays inside that catchment receive the same distance-based adjustment; areas outside it receive none. Overlapping clinics use the strongest single service fraction instead of adding deductions. UHNI is untreated demand multiplied by the remaining fraction. Manual and optimized deployments share these impact calculations. Baseline HNI remains available for comparison and the factor weights are never modified.

## Optimized scenario

The Optimized Clinic Allocation scenario requests `/api/planning/optimize` from the connected FastAPI service. The backend uses its dated XGBoost appointment-demand model and capacity-aware CP-SAT planner across Laguna. The province endpoint enforces the fixed agreed Balanced HNI policy; the shared request's legacy pilot weights do not change that policy. Simulator morbidity/flood conditions pass through where supported. The returned plan and solver metrics are shown as a draft; the user can review or edit locations before Apply. Applying affects only the simulator and is required before optimized sites appear as deployed. There is no browser-side allocation fallback. The backend forecast estimates the next planning day; it is not a forecast for each synthetic simulator date.

## State and interface

- Clinic count defaults to 3. Changing k or environmental conditions restarts all runs and clears any stale backend draft. The user explicitly requests a fresh optimized plan.
- Each strategy has its own day, reached day, weekly deployment history, and snapshots. Clinics remain at confirmed locations until a later confirmed allocation.
- Playback advances one day at a time, pauses at intervention decision points, and stops on Day 30. The user may continue a period without relocating clinics.
- The timeline inspects recorded days. Past decision points cannot be edited after advancing beyond them. Applying at the current decision point recalculates that day and later projections while preserving every earlier snapshot.
- Future snapshots are deterministic internal projections. Charts and comparisons expose only reached days, so undeployed future projections are not presented as recorded results. Each strategy must be advanced through Day 30 for a full comparison.
- Google Maps and the Leaflet fallback both render post-service HNI or uncovered-need shading. The simulation HNI palette is continuous so a reduction remains visible even within one legend band. Numbered deployed markers, distinct suggested markers and 3 km catchment circles show clinic status. Polygon selection can stage a clinic location at a decision point.
- Daily metrics include baseline HNI, scenario HNI after service, UHNI, total unmet priority, served barangays, covered priority percentage, relocations and cumulative unmet priority. The chart compares scenario HNI across the three runs; the table shows baseline and scenario HNI separately.

## Files changed

| Files | Purpose |
| --- | --- |
| `frontend/src/services/forecasting/forecast.ts` | Deterministic six-factor forecasts and operational periods |
| `frontend/src/services/forecasting/interventions.ts` | Geographic coverage, post-service HNI, unmet demand and metrics |
| `frontend/src/services/forecasting/optimizer.ts` | FastAPI request mapping and backend-plan validation; no local optimizer fallback |
| `frontend/src/services/forecasting/simulation.test.ts` | Rising baseline, localized service impact and backend adapter tests |
| `frontend/src/store/useForecastStore.ts` | Independent scenario state, histories, snapshots and connected draft requests |
| `frontend/src/features/simulation/SimulationPanel.tsx` | Three scenarios, explicit backend request and confirmation workflow |
| `frontend/src/features/simulation/SimulationPlayback.tsx` | Daily timeline, play/pause, replay and stepping |
| `frontend/src/features/simulation/SimulationResults.tsx` | Baseline/scenario HNI, uncovered need and comparison chart/table |
| `frontend/src/features/simulation/useSimulationMap.ts` | Adapter between simulation state and map rendering |
| `frontend/src/features/map/components/SimulationLayers.tsx` | Leaflet active/recommended markers and catchments |
| `frontend/src/features/map/components/BarangayBoundaryLayer.tsx` | Continuous post-service HNI colors, tooltip and selection support |
| `frontend/src/features/map/components/LagunaGoogleMap.tsx` | Google simulation shading, numbered markers and catchments |
| `frontend/src/features/map/components/LagunaLeafletMap.tsx` | Leaflet simulation layer integration |
| `frontend/src/features/map/components/mapTypes.ts` | Shared simulation overlay contract |
| `frontend/src/features/map/components/MapLegend.tsx` | Scenario HNI/UHNI ramp and deployment legend |
| `frontend/src/components/layout/AppLayout.tsx` | Simulation map integration and panel title |
| `frontend/src/types/google.maps.d.ts` | Minimal Google Circle declaration |
| `frontend/src/styles/globals.css` | Allocation controls, statistics and scrollable comparison table |
| `frontend/src/styles/map-workspace.css` | Simulation-only phone panel/clock/legend layout |
| `frontend/src/services/lagunaData.ts` | Continuous simulation HNI color interpolation |
| `frontend/src/services/assistantTools.ts` | Assistant reports the real optimizer request workflow accurately |
| `backend/services/assistant.py` | Assistant guidance for scenario HNI and connected plan requests |
| `frontend/scripts/simulation-browser.mjs` | Connected-backend browser regression for all three scenarios |
| `frontend/src/services/assistant.test.ts` | Assert assistant cannot fabricate a simulation allocation |
| `frontend/scripts/assistant-browser.mjs` | Verify assistant opens the optimizer action without inventing a plan |
| `frontend/package.json` | `test:simulation` command |
| `frontend/vite.config.ts` | Discover new source-local tests alongside existing tests |
| `docs/SIMULATION_MODE.md` | Implementation, validation and limitations report |

## Validation

- `npm run lint`: passed.
- `npm test`: passed, 129 tests across 15 files.
- `npm run build`: passed; Vite still reports the existing large JavaScript chunk advisory.
- `python -m pytest -q` (backend virtual environment): passed, 75 tests. One Starlette/httpx deprecation warning remains.
- `npm run test:simulation`: passed in Chrome against a temporary FastAPI service. Verified rising baseline HNI, manual host/neighbor-only deductions, a real `/api/planning/optimize` response with XGBoost/CP-SAT notes, explicit draft confirmation, multiple optimized impact areas, visible numbered clinic markers and mobile layout.
- `npm run test:assistant`: passed. Its demo setup logs an expected unavailable optional planning-catalog proxy; it verifies that the assistant opens the optimizer flow without fabricating a draft.
- `git diff --check`: clean. No datasets, HNI weight percentages or public schedules were changed.

## Remaining limitations

This is a deterministic planning simulation, not a clinically calibrated morbidity forecast. Priority units are population × index (or population × index-days for weekly/cumulative totals), not patient or appointment counts. The service radius, service fraction, backlog carryover and relocation penalty are explicit heuristic assumptions. Weekly optimizer coverage is an estimate against untreated projected demand; realized daily outcomes include feedback through the backlog recurrence.

Simulation morbidity growth, coverage radius, service fraction and backlog carryover are demonstration assumptions, not a clinically calibrated forecast. Scores and weighted totals are planning indices, not patient or appointment counts. Catchments use straight-line distances and do not model actual road access, terrain, staffing or available appointment capacity. The connected planner uses its own next-day XGBoost demand forecast and modeled adjacency travel; it does not forecast each future simulator date. State is held in memory, so reloading starts fresh runs. The browser regression uses Leaflet because no Google Maps key is configured in the test environment.
