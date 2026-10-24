# XGBoost clinic allocation PR review

Review branch: `feat/xgboost-clinic-allocation`.
Verified main base: `537dde3`.
Date: 2026-10-24.

## Historical pilot review

This document records the original connected pilot-allocation review. The
province-wide extension and its current assumptions are documented in
[`OPTIMIZATION_ALLOCATION.md`](OPTIMIZATION_ALLOCATION.md) and the project
README. The legacy pilot endpoints remain available; the map's Plan clinics
panel uses the all-Laguna endpoints.

## Original readiness and limits

Ready for a Step B **pilot allocation** PR. XGBoost estimates synthetic daily
appointment demand and OR-Tools CP-SAT allocates the fleet. It is not a
province-wide or clinically validated prediction model. Keep `OMCM_DATASET=pilot`:
20 Los Baños–Bay barangays, eight illustrative sites and the existing directed
route evidence. Step C host/neighbor weight deductions and dynamic lighter
heatmaps remain separate work.

The loaded artifact was verified as a native `xgboost.core.Booster`, XGBoost
3.4.1, with 249 trees. A two-clinic request with capacity 70 and maximum road
time 20 returned `OPTIMAL`, with 140 appointments; assignment totals, capacities
and road limits were checked. The native JSON, checksum, training generator and
synthetic-only held-out evaluation remain documented in the original model record.

## Main reconciliation

Main's refinement PR merge and commits `7106d04`, `8f25222`, and `537dde3` are
incorporated. Preserve the newer marker sizes, movable/minimizable legend,
readable planning language, error feedback, province-mask pane order and noClip
behavior. Resolve seven conflicts by combining these with server-backed drafts
and their approval flow. Do not restore the old browser municipal optimizer.

Main's new municipal HNI context is retained alongside actual backend assignments;
it is labeled as the map score, not the optimizer's priority. Planning-help score
answers now use that canonical municipal HNI as well.

## Credential compatibility

`backend/config.py`, backend request/response schemas and both frontend demo
username/password defaults are identical to main. The gitignored `backend/.env`
was not edited; the configured local administrator account remains unchanged.
Connected sign-in verifies the existing backend account. Main's **Use demo sign-in
details** helper remains available only for explicit browser demo mode. Credentials
and passwords must not be added to a PR title, description or committed artifact.

## Required conditions checked

- Clinic count is an upper bound; empty/zero-clinic and no-eligible-site results
  remain valid and cannot be published as a deployment.
- Each site's capacity and the requested daily capacity bound its allocated
  appointments; per-barangay allocations do not duplicate demand.
- Directed road times, road closures, flood exclusions and Paete land restrictions
  constrain both suggested and manually selected locations on the server.
- Both comparison strategies use the same XGBoost demand and transparent pilot
  priority. Weighted demand is optimized before road time and site count.
- Invalid inputs/references and duplicate manual IDs are rejected. Missing or
  tampered required models return an explicit failure without a replacement plan.
- Generate reaches FastAPI even when other features use browser demo mode.
  Current inputs, real coordinates, actual utilization and saved draft IDs drive
  the results. Cancelled/stale responses cannot restore invalidated drafts.
- Approval publishes the existing stored draft; generating and replanning do not
  publish. Fresh public sessions obtain approved schedules from the server.
- Backend-down behavior clears the draft and reports failure; it does not create
  a local allocation. Admin tools stay on the map screen.

## Validation

- Frontend lint passed.
- Frontend tests: 88 passed.
- Frontend production build passed; existing bundle-size advisory remains.
- Backend pytest: 46 passed; existing Starlette/httpx deprecation warning remains.
- Real connected optimizer browser suite passed, including manual replanning,
  approval, fresh public schedules, mobile layout and stopping the backend.
- Latest-main hospital/HNI browser suite passed, including marker counts,
  desktop/mobile panning, province-mask coverage, legend interaction and search.
- Demo defaults and backend authentication configuration were compared to main;
  no credential configuration changed.

## Final files changed relative to main

This table inventories every PR path relative to main `537dde3`; paths are
relative to `omcm/`. Incoming main files outside this table were retained without
additional changes relative to main. Earlier implementation/auth commits have
more detailed historical inventories in their respective documents.

| File | Final logic and purpose |
| --- | --- |
| `.env.example` | Correct configuration comments: connected optimization has no fallback. |
| `README.md` | Document the connected map workflow, limited pilot scope and new browser command. |
| `backend/data/models/appointment-demand-v1.json` | Commit the trained native model; no runtime fitting or downloaded pickle. |
| `backend/data/models/appointment-demand-v1.metadata.json` | Record provenance, feature/target contract, parameters, evaluation, limitations and checksum. |
| `backend/requirements.txt` | Add the approved XGBoost dependency, matching the tested artifact version family. |
| `backend/routers/clinics.py` | Return candidate eligibility consistent with server land restrictions. |
| `backend/routers/optimization.py` | Return 503 for unavailable required models before a fake or incomplete draft can be saved. |
| `backend/scripts/train_demand_model.py` | New deterministic offline synthetic training, separate validation/test streams, mean-rate comparison and manifest generation. |
| `backend/services/clinic_optimizer.py` | Feed XGBoost demand into both allocation strategies, enforce land restrictions, correct objective ordering/accessibility semantics, and explain model/scoring provenance. |
| `backend/services/demand_model.py` | New validated, cached native-model loading and bounded synthetic demand inference with explicit model-unavailable errors. |
| `backend/services/deployment_rules.py` | New server-side finite-coordinate and shared Paete polygon exclusion checks. |
| `docs/API.md` | Document model inference, 503 failure behavior, existing-field provenance, exclusions and corrected accessibility semantics without schema changes. |
| `docs/CONNECTED_ADMIN_SIGN_IN.md` | Retain the earlier sign-in fix record and its exact five-file inventory. |
| `docs/OPTIMIZATION_ALLOCATION.md` | Retain original model/implementation provenance and add the current review branch, main base and readiness link. |
| `docs/OPTIMIZATION_PR_REVIEW.md` | Record final model evidence, constraints, preserved credentials, main reconciliation, validation, PR text and complete final diff inventory. |
| `frontend/.env.example` | Explain connected authentication/schedules and backend-only optimization. |
| `frontend/package.json` | Add `test:optimization` using the already installed Playwright dependency. |
| `frontend/scripts/hospital-hni-browser.mjs` | Retain main legend/mask/panning/HNI checks and verify an empty planner in explicit demo mode; real allocation assertions run in the isolated connected suite. |
| `frontend/scripts/optimization-browser.mjs` | Use current main Plan clinics and sign-in labels; verify actual backend requests, manual replan, returned HNI context, stored approval, fresh public sessions, and backend-down failure. |
| `frontend/src/components/layout/AppLayout.tsx` | Synchronize published server schedules, invalidate drafts on sign-out and show public connection errors/accurate demo labels in the existing map shell. |
| `frontend/src/features/auth/AdminLoginModal.tsx` | Preserve main username/password defaults and friendly copy; show its demo helper only in explicit demo mode and require backend verification in connected mode. |
| `frontend/src/features/chatbot/ChatbotPanel.tsx` | Preserve main readable help; report actual saved drafts and canonical municipal map HNI instead of claiming the old municipal heuristic drives the backend allocator. |
| `frontend/src/features/map/components/ClinicMarkers.tsx` | Keep returned mobile-clinic positions visible above nearby hospital markers. |
| `frontend/src/features/optimization/ClinicCountInput.tsx` | Invalidate the old backend result when available fleet size changes. |
| `frontend/src/features/optimization/DeploymentApproval.tsx` | Preserve main wording while publishing the saved backend draft through authenticated approval/emergency APIs. |
| `frontend/src/features/optimization/ManualPlacement.tsx` | Use backend candidates and submit a server replan retaining the other selected sites. |
| `frontend/src/features/optimization/OptimizationPanel.tsx` | Use main-friendly planning language with actual backend generation, constraints, loading/errors, and success feedback only after a real response. |
| `frontend/src/features/optimization/PlacementRecommendations.tsx` | Combine actual server metrics/assignments with main municipal map-HNI context using the host PSGC; clearly separate map HNI from pilot allocation priority. |
| `frontend/src/features/optimization/usePlanningResults.ts` | Use backend draft markers outside simulation; retain the existing local simulation separately. Never run the old municipal optimizer to substitute an allocation in Optimize. |
| `frontend/src/features/public/useScheduleSync.ts` | New connected public schedule fetching, cancellation and explicit connection failure without local example substitution. |
| `frontend/src/features/tracking/ClinicDetails.tsx` | Retain main readable capacity/coordinate presentation and distinguish real draft locations from sample animation. |
| `frontend/src/services/api.ts` | Combine main requestFeedback/network messages with backend-only requests, HTTP error status, in-memory credentials and suppression of native Basic-auth prompts. |
| `frontend/src/services/optimization.ts` | New adapters from actual backend plans/approved schedules to existing map shapes, preserving coordinates and actual capacity/utilization without invented routes or draft risk data in public state. |
| `frontend/src/store/useAppStore.ts` | Connected startup does not create/rehydrate example schedules or trust persisted admin names; explicit demo startup retains its existing examples. |
| `frontend/src/store/useOptimizationStore.ts` | New transient backend draft state, catalog loading, constraint requests, cancellation, stale-response protection and explicit errors. |
| `frontend/src/styles/map-workspace.css` | Style the in-map optimizer controls, scope, evidence, comparison and connection errors with responsive existing plain CSS. |
| `frontend/tsconfig.json` | Add the corresponding sibling-test React Router type-resolution path. |
| `frontend/vite.config.ts` | Resolve the existing React Router dependency for sibling-directory tests, matching the existing test alias pattern. |
| `tests/backend/test_optimizer_model.py` | Add seven regressions for the artifact/evaluation, inference vs fixture-rate shortcut, monotone demand, model failure/integrity, server exclusions and independently calculated solver travel tie-breaking. |
| `tests/frontend/adminLogin.test.tsx` | Preserve six sign-in regressions using main demo-helper wording and unchanged credential defaults. |
| `tests/frontend/optimization.test.tsx` | Preserve transport/current-input/metric/cancellation/no-fallback regressions with main-friendly failure messages. |

## Browser review

Open `http://127.0.0.1:5173/`, sign in with the existing backend account, then
choose **Plan clinics → Generate recommendations**. Review the draft, assignments,
map-context score and model evidence. Approval remains an explicit next step.

## Suggested PR title

Connect XGBoost demand estimates to clinic allocation

## Suggested PR description

The map planner now generates authenticated backend allocations instead of
browser-only municipal suggestions and fixed utilization estimates.

- Estimate synthetic daily appointment demand using a reproducible native
  XGBoost model, then allocate sites and appointments with capacity-constrained
  CP-SAT and a population-first comparison.
- Send fleet, capacity, road-time, flood/closure and manual-site inputs to FastAPI;
  display returned draft IDs, assignments, coordinates and metrics.
- Enforce server-side eligibility and land exclusions, correct solver objective
  ordering, and reject failed/stale requests without local allocation fallback.
- Publish saved drafts through the existing approval endpoints; fresh public
  sessions read server-approved schedules.
- Preserve latest main's map/legend/wording fixes and existing administrator
  credentials; clarify connected versus browser-demo sign-in.

Validation: frontend lint/build, 88 frontend tests, 46 backend tests, real
connected optimization browser flow and latest hospital/HNI browser checks passed.

Scope: existing 20-barangay Los Baños–Bay pilot, synthetic training/evaluation,
no patient records, no API/database schema migration. Step C clinic-impact
weight deductions and heatmap changes remain separate work.
