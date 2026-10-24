# 30-day Laguna simulation implementation

Simulation Mode now forecasts all 681 barangays for 30 consecutive daily timestamps, with independent No Intervention, Manual Allocation, and Optimizer-Assisted Allocation runs. Allocation decisions occur on Days 1, 8, 15, and 22; the final period includes Days 22–30. Nothing is published to public schedules by the simulator.

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

The synthetic experiment starts on October 24, 2026, at midnight Manila time. A fixed seed (42) and municipality PSGC determine shared morbidity phases. Morbidity controls affect these common illness inputs. Flood controls do not add HNI points; connected backend planning retains its operational flood/site/route exclusions. The browser rehearsal still uses straight-line catchments. All three strategies use exactly the same forecast records. Clinic deployments never change HNI.

Daily untreated demand is `min(100, HNI + 0.15 × previous UHNI)`. A clinic supplies up to 35% modeled service within a 3 km straight-line catchment, tapering to 17.5% at its edge. Overlapping clinics use the maximum service fraction rather than adding fractions. UHNI is untreated demand multiplied by the remaining fraction. The same equations apply to manual and optimizer deployments; identical allocations produce identical outcomes.

## Weekly optimizer

The optimizer projects untreated demand for every day in the upcoming operational period, seeded by the strategy's previous daily snapshot. It sums population × projected demand across those days. Eligible locations have valid supplied WGS84 coordinates and positive population.

Greedy selection scores each candidate's additional population-weighted coverage after overlap. A relocation penalty of `period demand × 0.00002 × travel kilometres` encourages keeping existing clinic locations when coverage gains are similar. Each iteration chooses a distinct deployment PSGC and an unused clinic ID. Candidate ordering and tie handling are deterministic. The result is validated for exactly k unique sites and exactly the available clinic identities `MC-1` through `MC-k`. Insufficient candidates raise `InfeasibleAllocationError`.

Every recommendation includes its supplied barangay name, municipality, PSGC, clinic identity, coordinates, marginal expected covered priority, catchment count, and selection explanation. The weekly estimate also compares covered priority with keeping the current allocation. Clicking the recommendation button changes only the draft. Users can reject it, change individual locations, or explicitly apply it.

## State and interface

- Clinic count defaults to 3. Changing k restarts all runs and recalculates an optimizer draft when that strategy is selected. Changing environmental conditions also restarts all runs.
- Each strategy has its own day, reached day, weekly deployment history, and snapshots. Clinics remain at confirmed locations until a later confirmed allocation.
- Playback advances one day at a time, pauses at intervention decision points, and stops on Day 30. The user may continue a period without relocating clinics.
- The timeline inspects recorded days. Past decision points cannot be edited after advancing beyond them. Applying at the current decision point recalculates that day and later projections while preserving every earlier snapshot.
- Future snapshots are deterministic internal projections. Charts and comparisons expose only reached days, so undeployed future projections are not presented as recorded results. Each strategy must be advanced through Day 30 for a full comparison.
- Google Maps and the Leaflet fallback both render projected HNI/UHNI shading, separate recommendation and active markers, and clinic catchment circles. Map polygon selection can assign the selected clinic at a decision point. Existing mobile clinic visibility controls also apply to these layers.
- Daily metrics include population-weighted HNI and UHNI, total unmet priority, served barangays, covered priority percentage, relocations, and cumulative unmet priority. The comparison chart shows daily UHNI; its table includes all seven measures.

## Files changed

| Files | Purpose |
| --- | --- |
| `frontend/src/services/forecasting/forecast.ts` | Deterministic six-factor forecasts and operational periods |
| `frontend/src/services/forecasting/interventions.ts` | Geographic coverage, allocation validation, daily interventions and metrics |
| `frontend/src/services/forecasting/optimizer.ts` | Dynamic-k weekly greedy maximum coverage and infeasibility |
| `frontend/src/services/forecasting/simulation.test.ts` | Forecast, optimizer, geography, intervention, and history tests |
| `frontend/src/store/useForecastStore.ts` | Independent scenario state, histories, snapshots, drafts and clock actions |
| `frontend/src/features/simulation/SimulationPanel.tsx` | Scenario/count controls and confirmed allocation workflow |
| `frontend/src/features/simulation/SimulationPlayback.tsx` | Daily timeline, play/pause, replay and stepping |
| `frontend/src/features/simulation/SimulationResults.tsx` | Daily metrics and strategy comparison chart/table |
| `frontend/src/features/simulation/useSimulationMap.ts` | Adapter between simulation state and map rendering |
| `frontend/src/features/map/components/SimulationLayers.tsx` | Leaflet active/recommended markers and catchments |
| `frontend/src/features/map/components/BarangayBoundaryLayer.tsx` | Simulation shading, tooltip and selection support |
| `frontend/src/features/map/components/LagunaGoogleMap.tsx` | Google simulation shading, markers and catchments |
| `frontend/src/features/map/components/LagunaLeafletMap.tsx` | Leaflet simulation layer integration |
| `frontend/src/features/map/components/mapTypes.ts` | Shared simulation overlay contract |
| `frontend/src/features/map/components/MapLegend.tsx` | Daily HNI/UHNI and deployment legend |
| `frontend/src/components/layout/AppLayout.tsx` | Simulation map integration and panel title |
| `frontend/src/types/google.maps.d.ts` | Minimal Google Circle declaration |
| `frontend/src/styles/globals.css` | Allocation controls, statistics and scrollable comparison table |
| `frontend/src/styles/map-workspace.css` | Simulation-only phone panel/clock/legend layout |
| `frontend/scripts/simulation-browser.mjs` | Interactive simulation browser regression |
| `frontend/package.json` | `test:simulation` command |
| `frontend/vite.config.ts` | Discover new source-local tests alongside existing tests |
| `docs/SIMULATION_MODE.md` | Implementation, validation and limitations report |

## Validation

- `npm run build`: passed (TypeScript and Vite); existing large-bundle advisory remains.
- `npm run lint`: passed.
- `npm test`: 14 simulation tests passed, including k = 1, 2, 3, 5, explicit insufficient-candidate errors, unique clinic identities/PSGCs, supplied boundary identities and in-province coordinates, weekly future demand, relocation tie handling, shared HNI, identical-allocation parity, confirmation/rejection, replay protection and cumulative metrics.
- `npm run test:simulation`: passed in local Chrome. Covers 681 map polygons, changing k from 3 to 5, separate recommendation/confirmation, rejection, manual allocation, independent strategies, weekly decisions, history protection, UHNI heatmap, playback/pause, Day 30 and phone layout without panel/clock/legend overlap or horizontal overflow. No page JavaScript errors.
- Recovered original frontend tests: 60 passed / 8 failed when combined with the 14 new tests (46 passed / 8 failed among original tests alone). A clean copy of original HEAD reproduced the same eight failures: seven healthcare-need expectations and one clinic snapshot count-field expectation.
- Original barangay browser regression: reaches the mobile legend-overlap assertion, then fails. The clean original HEAD reproduced the identical failure. Earlier boundary, ranking, filtering, facility-toggle and barangay-selection checks succeeded.
- Original Python clinic data regression: 41 passed, 27 subtests passed, one importer rollback test failed. A clean original HEAD reproduced that failure as well.
- `git diff --check`: clean. No dataset or geography changes.

The working tree already had the original tests deleted when this task began. Those deletions were preserved; the original suites were recovered into temporary directories for validation. New simulation tests live under `frontend/src` and run normally with `npm test`. Frontend dependencies were reinstalled from the unchanged lockfile because the original node_modules contained cloud-only placeholders that stalled validation.

## Remaining limitations

This is a deterministic planning simulation, not a clinically calibrated morbidity forecast. Priority units are population × index (or population × index-days for weekly/cumulative totals), not patient or appointment counts. The service radius, service fraction, backlog carryover and relocation penalty are explicit heuristic assumptions. Weekly optimizer coverage is an estimate against untreated projected demand; realized daily outcomes include feedback through the backlog recurrence.

Coverage and relocation use straight-line distances. Existing road closures remain visible scenario references and do not model drive time, terrain, road feasibility, staffing or appointment capacity. Greedy selection provides an initial heuristic solution rather than a globally optimal allocation guarantee. Simulation state is held in memory; reloading the application starts fresh runs. A live Google Maps key was not used for browser validation; Leaflet ran the browser scenarios and existing mocked Google map regression tests passed. Original-revision regression failures described above remain outside the Simulation Mode changes.
