# Global audit, views and interface review

Reviewed 2026-10-24 on `audit/omcm-features-and-views`, based on fetched main
`a7f5b7f`. That main already merged the earlier A/B/C, deployment and flood-map
branches. No original data, model artifacts, agreed coefficients, administrator
credentials or database schemas were changed in this pass.

## Subsequent scheduling refinement

The next-day-only approval restriction has been superseded by the
[seven-day booking policy](SCHEDULING.md). Freshness is still checked against
tomorrow's forecast target; booking a later date does not generate a later-day
forecast. Today's changes remain explicit emergency revisions. That document
records the separate branch's exact files, tests and unchanged schema/model.

## Verified data and calculations

- 681 unique barangays across 30 LGUs; bundled population total 3,687,345.
- 66 hospital source records, with 56 verified/located records usable on the map
  and for hospital distance. All original records remain available as evidence.
- 385 OSM clinic records in a valid offline snapshot: 382 active and 98 active,
  located in-province records. Two suspected duplicate pairs remain flagged for
  review; ambiguous records were not silently merged or deleted. Usability and
  assignment rules determine provision/distance evidence.
- Provincial planning export matches the shared frontend HNI inputs. The offline
  clinic-sensitivity report matches the same policy. No regeneration was needed.
- Both XGBoost files match their recorded SHA256. Illness synthetic test MAE is
  0.05118 cases/1,000 versus persistence 0.08715; appointment synthetic test MAE
  is 0.60877 appointments/1,000 versus the mean-rate baseline 5.33173. These
  metrics test fictional generators, not real-world clinical accuracy.

The Balanced HNI is morbidity 35%, hospital distance 30%, density 15%, municipal
income class 10%, clinic distance 5% and clinic provision deficit 5%. Missing
factors rescale available weights; hazard absence does not reduce HNI coverage.
Municipality summaries use population-weighted barangay scores. Zero hospitals
registered in one municipality does not mean no nearby hospital exists; distance
search may use a verified facility across its boundary.

## Findings and resolutions

| Finding | Resolution and evidence |
| --- | --- |
| Separate legacy admin pages were still reachable | Redirect legacy URLs into `/admin`, opening the relevant panel. Seven compatibility-link tests and connected tool-switch assertions verify this. |
| Scoring, analytics and candidate reads were public | Require existing server authentication for `/api/barangays`, `/api/analytics`, `/api/clinics` and `/api/planning/clinics`. Missing/incorrect credentials are rejected. |
| Assistant could expose scores through public lookup/ranking | Public summaries omit HNI/contributions/drafts; score ranking and private state require Admin View. Clear conversation on view/identity change. |
| Public emergency notices included the login account | Public response uses `LGU administrator`; private audit still retains the actor. Public schedules are no-store responses. |
| Simulator accepted a fleet larger than the API | Enforce a 1–10 fleet limit without erasing the run on invalid input. |
| Optimized scenario could be manually populated without generating | Require a connected proposal before applying optimized sites; disable drafting controls until it exists. |
| Incomplete solver placement gave a generic failure | Explain usable versus requested clinic counts and suggest reducing count or relaxing access. |
| Optimization markers did not lighten the need map | Preview the shared illustrative host/nearby service effect after actual backend success; show baseline and scenario HNI in tooltips. Backend appointment metrics are labeled separately. |
| Simulation flood dropdown offered an unsupported low setting | Offer baseline/no-screen and the supported numeric 25-/100-year screens. Existing wire values retain compatibility. |
| Active map still derived unused heuristic recommendations | Remove that call from `usePlanningResults`; active optimization comes only from the backend and simulation overlay from recorded scenario snapshots. |
| Legend occupied a large part of the map | Default to a compact scale with expandable symbols on desktop and mobile; retain flood layer/count and current map context. |
| Mobile expanded sheet collided with filter chips | Keep expanded sheet below controls; browser search/details regression covers expand/collapse and non-overlap. |
| Mobile playback could cover the simulation panel | Set separate panel/playback/legend bands and assert their bounding boxes do not overlap. |
| Modal headings reused one ID | Give each dialog a unique accessible title; retain native focus/Escape behavior. |
| README mixed historical local rehearsal, pilot and current publication | Rewrite the entry point and architecture; put current facts above dated historical records. |

## Shared service impact, without changing weights

Manual, optimized rehearsal and the real-plan map preview use the same
`interventions.ts` formula: up to 35% HNI reduction at a host centroid, tapering
to 17.5% at a 3 km centroid-distance edge. Areas beyond that reach receive no
deduction. Multiple clinics use the strongest single effect, avoiding duplicate
credit. Uncovered need separately carries 15% of the previous UHNI, capped at
100 before service. Neither formula rewrites the six agreed factor percentages.

The three scenario histories share one day. At weekly placement windows a new
plan may replace existing sites; otherwise locations remain active. No
intervention follows the common increasing morbidity baseline. A manual plan
changes its local catchments, while optimized locations affect multiple
catchments together. A wider improvement is scenario-dependent: the same sites
must produce the same result regardless of whether they were manually selected.
The UI does not force optimized outcomes to beat every manual arrangement.

## Proposal alignment and remaining limits

The local `WompWomp.pdf` was reviewed directly, especially methodology page 4.
It specifies a transparent risk model followed by capacity-aware maximal
coverage. XGBoost is an implementation choice, not a named proposal requirement.
The proposal explicitly includes a maximum travel-time constraint; removing
its UI field would not remove the need for a defined access rule.

| Proposal idea | Current implementation and practical limit |
| --- | --- |
| Explainable need priority | Fixed group-agreed six-factor HNI, factor contributions and rankings. Broader proposal vulnerability/poverty factors are not silently restored to this policy. |
| Predict next-day illness/demand | Two validated native XGBoost artifacts using dated synthetic histories. No disease-specific clinical validation or live weather feed. |
| Capacity-aware maximal coverage | CP-SAT with demand, capacity, fleet and access constraints; compare against population-first placement. Bounded search may return FEASIBLE. |
| Stable approved public visits | Authenticated stored-draft approval, protected same-day emergency revisions, read-only public refresh. |
| Flood/road scenarios | Point-based 25-/100-year exclusion screens and model-link closures. Province links are adjacency estimates, not verified roads. |
| Nightly automation | Next-day generation is user-triggered; no unattended scheduled job is claimed. |
| Service deductions | Working browser formula and dynamic map. Backend-authoritative 30-day deductions remain unimplemented; adding that API contract requires data-model approval. |
| Durable public operation | Local persistent SQLite works; Vercel `/tmp` SQLite is temporary and unshared. A persistent deployment/storage arrangement remains necessary for durable shared publication. |

The 30-day simulation uses deterministic morbidity growth rather than XGBoost
for each simulated future day. Its 3 km service footprint ignores terrain and
capacity; backend appointment assignment uses its own capacity and travel model.
Flood options do not imply measured water depths. Blue outlines show flagged
barangays, not exact inundation extent. Live Google Maps rendering needs a key;
Leaflet is the browser verification renderer. All health data remains synthetic.

## Public/admin boundary

Public UI and assistant expose community population, mapped facilities and
approved clinic schedules/services/notices. Private draft/forecast details stay
in Admin View, and sensitive backend reads/mutations require actual credentials.
Drafts and rehearsals never publish themselves. Public view changes clear
private conversation state and cancel proposals. The static synthetic source
datasets remain inspectable in the browser bundle; this is not confidentiality
for uploaded real health records and no such records are used.

## Review commits

- `563aefc` — protect backend planning reads and public notice attribution.
- `85fb347` — validate simulator fleet/proposal requirements.
- `99ea66b` — unify views, enforce public assistant boundaries and polish the map UI.
- The documentation commit records the inventory and evidence in this file.

## Exact code and test inventory

All paths are relative to `omcm/`; these are refinements to existing group work
unless explicitly marked new. Documentation changes are listed separately below.

| File | Change |
| --- | --- |
| `backend/routers/municipalities.py` | Authenticate scored barangay and analytics reads. |
| `backend/routers/clinics.py` | Authenticate candidate catalogs, no-store public schedules, sanitize notice actor. |
| `frontend/src/app/routes.tsx` | Route only to the map shell and redirect legacy links. |
| `frontend/src/components/layout/AppLayout.tsx` | Preserve initial panel after sign-in, cancel/clear private state on view changes, wire service overlay/icons, collapse tools without exiting. |
| `frontend/src/components/layout/MapControls.tsx` | Add reusable map color/facility chips below search. |
| `frontend/src/components/ui/Modal.tsx` | Unique dialog title IDs and explicit close-button semantics. |
| `frontend/src/features/filters/MapFilterChips.tsx` | New in-place metric/facility shortcuts using existing icons. |
| `frontend/src/features/map/components/BarangayBoundaryLayer.tsx` | Render service-adjusted draft HNI and baseline/flood tooltips on Leaflet. |
| `frontend/src/features/map/components/LagunaGoogleMap.tsx` | Match Google renderer's draft impact styling and tooltip values. |
| `frontend/src/features/map/components/MapLegend.tsx` | Identify planned impact distinctly from baseline/simulation/flood context. |
| `frontend/src/features/map/components/mapTypes.ts` | Type the browser-only service overlay. |
| `frontend/src/features/optimization/OptimizationPanel.tsx` | Shorten initial explanation, expand methodology/flood meaning on demand, show busy state. |
| `frontend/src/features/optimization/PlacementRecommendations.tsx` | Explain preview service assumptions versus backend metrics. |
| `frontend/src/features/optimization/usePlanningResults.ts` | Derive real-plan service preview, remove unused heuristic, guard private overlays. |
| `frontend/src/features/simulation/FloodControls.tsx` | Show supported numeric return-period labels instead of unsupported choices. |
| `frontend/src/features/simulation/SimulationPanel.tsx` | Apply fleet limit and require connected proposal before optimized editing. |
| `frontend/src/features/simulation/useSimulationMap.ts` | Prevent optimized drafting before a proposal exists. |
| `frontend/src/services/forecasting/optimizer.ts` | Explain incomplete placement count without fabricating results. |
| `frontend/src/store/useForecastStore.ts` | Enforce maximum fleet and connected-proposal application guard. |
| `frontend/src/store/useOptimizationStore.ts` | Select HNI coloring after successful plan generation. |
| `frontend/src/services/assistantTools.ts` | Public data redaction, private-tool guards, in-place navigation aliases. |
| `frontend/src/services/assistantFast.ts` | Format public answers without missing/private score fields. |
| `frontend/src/styles/map-workspace.css` | Shared controls, fields, chips, cards, alerts, legend, side sheets, responsive spacing and motion. |
| `frontend/src/styles/assistant.css` | Consistent assistant surface, focus/motion, mobile compact launcher positioning. |
| `frontend/src/services/assistant.test.ts` | Public preview cannot access scores or private plan state. |
| `frontend/src/services/assistantFast.test.ts` | Run private score expectations in an authenticated admin context. |
| `frontend/src/services/forecasting/simulation.test.ts` | Fleet rejection and no manually fabricated optimized run. |
| `tests/frontend/workspaceRoutes.test.tsx` | New regression for seven legacy-to-map entry links. |
| `tests/backend/test_api.py` | Private GET authorization, no-store schedule response and safe public actor. |
| `tests/backend/test_optimizer_model.py` | Use authorized catalog reads while checking restricted sites. |
| `tests/backend/test_provincial_planning.py` | Use authorized provincial/pilot catalog reads. |
| `frontend/scripts/optimization-browser.mjs` | Authenticate catalog fixture, assert stable admin URL and visible service impact. |
| `frontend/scripts/simulation-browser.mjs` | Verify mobile panel/playback/legend separation, collapse without losing clinic markers/timeline, and capture settled screenshots. |

## Documentation inventory

`README.md` and `docs/ARCHITECTURE.md` are rewritten as current entry points;
`docs/SIMULATION_MODE.md` describes exact scenario ownership and formulas.
`docs/API.md` updates current authorization and provincial result behavior.
`docs/AUDIT.md`, `docs/BALANCED_HNI.md`, `docs/HOSPITAL_HNI_AUDIT.md`,
`docs/OPTIMIZATION_ALLOCATION.md`, `docs/TEMPORAL_FORECAST.md`,
`docs/PUBLIC_VISITS.md` and `docs/INTERFACE-SCOPE.md` identify historical records
and link current conclusions; optimization/public/interface docs also detail the
new behavior. `datasets/README.md` and `datasets/SOURCES.md` record unchanged-data
validation. `docs/VERCEL_DEPLOYMENT.md` explains authenticated checks and bundled
assets. `docs/ASSISTANT.md` records the new public boundary. `docs/VERIFICATION.md`
contains fresh commands/results. `docs/DEMO_SCRIPT.md` gives a verified walkthrough
and presentation outline. This file records the consolidated evidence/inventory.

## Review in the browser

1. Open `/`, search a community and review nearby care/approved visits. Ask the
   assistant for a need ranking: it requires Admin View.
2. Sign in using existing configured credentials. Filter chips appear. Search
   Pangil/Dambo; compare factor details and nearby hospitals across boundaries.
3. Open Plan clinics and generate. The map lightens around returned clinics;
   tooltips distinguish baseline and draft-service HNI. Review backend metrics,
   flood outlines and method details. Closing a panel keeps the map.
4. Open 30-day simulation on the same URL. Advance No intervention, apply a
   manual plan, generate/apply an optimized proposal and compare equal days.
5. Approve a next-day draft, then preview Public View. Only published clinics
   appear, and private assistant history is cleared.
6. Repeat at 390px/320px, expand/collapse details and inspect playback/legend
   separation. Test reduced motion and keyboard focus.

Fresh outcomes and artifact locations are recorded in [verification](VERIFICATION.md).
