# Optimization allocation review and implementation

Current extension: [dated illness forecasting](TEMPORAL_FORECAST.md), on
`feat/temporal-forecast-public-clinics`. The original appointment model remains
active and unchanged; a separate temporal model supplies forecast illness inputs.
The sections below record the original Step B implementation.

Current review branch: `feat/xgboost-clinic-allocation`, reconciled with main
at `537dde3`. The UI now uses main's **Plan clinics** label. See
[the final PR review](OPTIMIZATION_PR_REVIEW.md) for current checks, compatibility
decisions, scope and the complete diff inventory against that main commit.

Date: 2026-10-24. Branch: `feat/optimization-xgboost-allocation`.
Starting commit: `1cf68a2`, including the hospital/HNI refinements and main's
Paete forest-land overlay/facility icons. Remote main had not incorporated that
refinement branch when this work started.

## What the audit found

The map's Optimize panel previously called `runClinicOptimizer` in the browser.
Its Generate button only reset overrides; municipal heuristic scores selected
illustrative sites and utilization was fixed at 88%. This was separate from the
existing authenticated FastAPI `/api/optimize` endpoint and capacity-aware
OR-Tools CP-SAT solver. XGBoost was absent. Browser publication copied the local
plan into local storage rather than approving a stored server draft.

The existing backend solver already handled capacities, bounded clinic count,
modeled travel, explicit closures, synthetic flood exclusions, manual sites and
nonduplicated appointment allocations. It is preserved. Its combined travel and
site-count penalty did not strictly enforce the documented lexicographic ordering;
one minute of saved travel could tie with one extra opened site. The objective
now gives travel precedence over site count, after maximizing priority-weighted
served demand. The maximum fleet is an upper bound, not a requirement to open
unused sites.

## Resulting flow

1. Open Admin View and verify the configured backend credentials. Connected
   sign-in always verifies `/api/auth/me`, including when example credentials
   happen to match the form's demo hint. Credentials remain in memory. Explicit
   Authorization headers are sent without browser-managed HTTP credentials,
   preventing a rejected sign-in from opening a native Basic-auth prompt.
2. Open Optimize on the same map. Set available clinics, appointment capacity,
   road-time limit and optional flood/closure exclusions. Candidate IDs and road
   closure options come from `/api/clinics`, not municipal example constants.
3. Generate calls authenticated `POST /api/optimize` using `backendApi`, which
   never enters `demoApi`, even when other views use explicit demo mode.
4. The server estimates synthetic appointment demand with XGBoost, then runs
   CP-SAT and the population-first baseline on the same demand, eligibility and
   access constraints. It persists and returns a draft ID with actual metrics.
5. The panel shows that response. Map markers use the returned site coordinates,
   capacities and served counts. No route is invented; only staging positions
   are shown. Mobile markers appear above nearby hospital icons. New results
   scroll into view. Changing constraints, cancelling or signing out invalidates
   the transient draft; late responses cannot restore an invalidated result.
6. Changing a manual location submits the whole selected fleet back to the
   solver. Other locations are retained, duplicates are disabled, and the server
   rejects unknown, restricted, flooded or otherwise ineligible choices.
7. Approval uses the returned `plan_id` with `/api/schedules/approve`, or the
   existing confirmed emergency endpoint. Generating a draft never publishes it.
   Connected public sessions fetch `/api/schedules`, including fresh browser
   sessions; they do not manufacture a schedule from browser example sites.

Unavailable backend/model responses produce an explicit error and no local
allocation. Missing credentials reopen sign-in. A zero-clinic result explains
that no deployment can meet the constraints and cannot be published.

## Model and data provenance

`appointment-demand-v1` is a native XGBoost regression model estimating daily
appointments per 1,000 residents. Runtime converts that rate to a bounded integer
demand and applies the existing explicit outbreak multiplier. Model features are
baseline synthetic disease burden, vulnerable-resident percentage, poverty,
flood exposure and hospital-access minutes. Increasing these features is
constrained not to decrease the modeled rate. Unreachable hospital access uses
120 modeled minutes. Model warnings retain the existing missing-input warnings.

Training uses an explicitly hand-designed synthetic appointment-rate generator,
not patient records, clinical outcomes, HNI labels, geographic IDs or geographic
coordinates. Independent RNG streams create 3,200 training, 800 validation and
800 test observations. Validation selects the boosting iteration; test observations
are never used for fitting or tuning. The baseline predicts the training mean
appointment rate. Features, parameters, seeds, target, version, sample counts,
limitations and native-model checksum are recorded in the companion manifest.

| Held-out synthetic metric, appointments per 1,000 | XGBoost | Training-mean baseline |
| --- | ---: | ---: |
| MAE | 0.609 | 5.332 |
| RMSE | 0.768 | 6.475 |

These errors measure recovery of the synthetic generator, not real healthcare
demand or clinical validity. No predictive medical claim is made. A future
observational model requires suitable approved labels and independent validation.

The model is trained offline, committed as native JSON, and loaded once per
backend process with feature/checksum checks. Runtime requests never train a
model. Missing, tampered or incompatible artifacts fail with 503 instead of a
heuristic fallback. After retraining, restart the backend to load the new artifact.

From `omcm/backend`:

```sh
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python scripts/train_demand_model.py
```

Windows uses `.venv/Scripts/python.exe`. Training uses the existing NumPy plus
XGBoost's native Python API; no scikit-learn or UI dependency was added. The
artifact was produced with XGBoost 3.4.1. The implementation follows the official
[native Python API](https://xgboost.readthedocs.io/en/stable/python/python_intro.html)
and [model serialization guidance](https://xgboost.readthedocs.io/en/stable/tutorials/saving_model.html).

## Scoring, geographic scope and compatibility

Keep `OMCM_DATASET=pilot`: the backend uses the existing 20-barangay Los Baños–Bay
pilot, eight illustrative staging sites and 168 directed modeled routes. The
province-wide map does not imply province-wide optimization road evidence. The
approximate Paete exclusion is shared from the existing committed frontend
geometry and enforced server-side, including direct manual API requests; it
remains a user-configured planning exclusion, not official land classification.

The seven-factor provincial HNI and Step A hospital evidence remain unchanged.
The solver uses the transparent six-factor pilot priority index. XGBoost predicts
appointment demand, not HNI. Optimization notes explicitly distinguish these.
`flood_safe_accessibility_pct` now measures demand with a safe modeled route to
an opened site before capacity limits; `demand_served_pct` includes capacity limits.
The legacy `unserved_population` field remains for compatibility, but the new UI
reports unserved appointment demand and does not claim population coverage.

No API request/response fields or SQLite tables were added or migrated. Model
provenance uses the existing `notes` and `metadata.disease` fields. Connected
authentication, optimization and public schedules do not silently switch to
browser demo. The explicit demo mode retains its existing labeled example
schedules outside the optimizer. Connected startup ignores locally saved demo
approvals and admin names and requires fresh sign-in.

Step C's host/neighbor need deductions, dynamic lighter heatmap and 30-day
simulation integration remain separate work. Existing browser simulation behavior
is retained. Step D's broader endpoint/privacy audit is also still pending; this
change does not claim to protect every legacy public data endpoint.

## Exact file and logic inventory

Paths are relative to `omcm/`. Existing-file changes refine groupmates' code;
new model, adapter, state and verification files extend the existing architecture.

| File | Change and reason |
| --- | --- |
| `backend/requirements.txt` | Add the approved XGBoost dependency, matching the tested artifact version family. |
| `backend/services/demand_model.py` | New validated, cached native-model loading and bounded synthetic demand inference with explicit model-unavailable errors. |
| `backend/scripts/train_demand_model.py` | New deterministic offline synthetic training, separate validation/test streams, mean-rate comparison and manifest generation. |
| `backend/data/models/appointment-demand-v1.json` | Commit the trained native model; no runtime fitting or downloaded pickle. |
| `backend/data/models/appointment-demand-v1.metadata.json` | Record provenance, feature/target contract, parameters, evaluation, limitations and checksum. |
| `backend/services/deployment_rules.py` | New server-side finite-coordinate and shared Paete polygon exclusion checks. |
| `backend/services/clinic_optimizer.py` | Feed XGBoost demand into both allocation strategies, enforce land restrictions, correct objective ordering/accessibility semantics, and explain model/scoring provenance. |
| `backend/routers/optimization.py` | Return 503 for unavailable required models before a fake or incomplete draft can be saved. |
| `backend/routers/clinics.py` | Return candidate eligibility consistent with server land restrictions. |
| `frontend/src/services/api.ts` | Expose an explicit backend-only transport and in-memory credential check; omit browser-managed credentials to avoid native sign-in prompts. Retain the legacy demo-capable wrapper for other views. |
| `frontend/src/services/optimization.ts` | New adapters from actual backend plans/approved schedules to existing map shapes, preserving coordinates and actual capacity/utilization without invented routes or draft risk data in public state. |
| `frontend/src/store/useOptimizationStore.ts` | New transient backend draft state, catalog loading, constraint requests, cancellation, stale-response protection and explicit errors. |
| `frontend/src/store/useAppStore.ts` | Connected startup does not create/rehydrate example schedules or trust persisted admin names; explicit demo startup retains its existing examples. |
| `frontend/src/features/optimization/OptimizationPanel.tsx` | Replace browser recommendations with backend generation, real constraints, pilot scope, loading/cancel/retry/errors and returned draft display. |
| `frontend/src/features/optimization/PlacementRecommendations.tsx` | Render actual server metrics, assignments, baseline comparison, solver status and provenance; scroll new results into view. |
| `frontend/src/features/optimization/ManualPlacement.tsx` | Use backend candidates and submit a server replan retaining the other selected sites. |
| `frontend/src/features/optimization/ClinicCountInput.tsx` | Invalidate the old backend result when available fleet size changes. |
| `frontend/src/features/optimization/DeploymentApproval.tsx` | Publish a persisted server draft through existing approval/emergency APIs, show failures and update public locations only from successful server responses. |
| `frontend/src/features/optimization/usePlanningResults.ts` | Use backend draft markers outside simulation; retain the existing local simulation separately. Never run the old municipal optimizer to substitute an allocation in Optimize. |
| `frontend/src/features/auth/AdminLoginModal.tsx` | Limit the browser credential shortcut to explicit demo mode; connected example credentials must also pass server verification. |
| `frontend/src/features/public/useScheduleSync.ts` | New connected public schedule fetching, cancellation and explicit connection failure without local example substitution. |
| `frontend/src/components/layout/AppLayout.tsx` | Synchronize published server schedules, invalidate drafts on sign-out and show public connection errors/accurate demo labels in the existing map shell. |
| `frontend/src/features/map/components/ClinicMarkers.tsx` | Keep returned mobile-clinic positions visible above nearby hospital markers. |
| `frontend/src/features/tracking/ClinicDetails.tsx` | Use appointment terminology and distinguish backend staging positions from animated example routes. |
| `frontend/src/features/chatbot/ChatbotPanel.tsx` | Describe the actual backend draft, or explain that no allocation has been generated, rather than claiming a local priority heuristic ran. |
| `frontend/src/styles/map-workspace.css` | Style the in-map optimizer controls, scope, evidence, comparison and connection errors with responsive existing plain CSS. |
| `frontend/package.json` | Add `test:optimization` using the already installed Playwright dependency. |
| `frontend/scripts/optimization-browser.mjs` | New real FastAPI/Vite/Chrome verification with temporary SQLite, manual replan, draft/publication separation, fresh public session, mobile layout and backend-down behavior. |
| `frontend/vite.config.ts` | Resolve the existing React Router dependency for sibling-directory tests, matching the existing test alias pattern. |
| `frontend/tsconfig.json` | Add the corresponding sibling-test React Router type-resolution path. |
| `tests/frontend/optimization.test.tsx` | Add five regressions for backend transport despite demo mode, current inputs/real metrics, no fallback, stale-response cancellation, credentials and map adaptation. |
| `tests/backend/test_optimizer_model.py` | Add seven regressions for the artifact/evaluation, inference vs fixture-rate shortcut, monotone demand, model failure/integrity, server exclusions and independently calculated solver travel tie-breaking. |
| `.env.example` | Correct configuration comments: connected optimization has no fallback. |
| `frontend/.env.example` | Explain connected authentication/schedules and backend-only optimization. |
| `README.md` | Document the connected map workflow, limited pilot scope and new browser command. |
| `docs/API.md` | Document model inference, 503 failure behavior, existing-field provenance, exclusions and corrected accessibility semantics without schema changes. |
| `docs/OPTIMIZATION_ALLOCATION.md` | Record this audit, implementation, complete inventory, model evidence and validation. |

## Verification and browser review

- `npm run lint`: passed.
- `npm test`: 79 tests passed, including all retained Step A regressions.
- `npm run build`: passed; existing bundle-size advisory remains.
- Backend `.venv/bin/python -m pytest -q`: 46 tests passed; existing Starlette/httpx deprecation warning remains.
- Offline retraining in a temporary directory reproduced the committed model checksum and held-out metrics exactly on the tested environment.
- `npm run test:hni`: passed for existing desktop/mobile hospital/HNI/search/source disclosures and forest overlay.
- `npm run test:optimization`: passed with actual HTTP requests through Vite to FastAPI, XGBoost and CP-SAT; temporary SQLite and configured test credentials; manual replan; approval of the same stored ID; published locations in a fresh browser context; mobile layout; no allocation fallback after stopping the backend.

The connected suite uses ports 5178/8007, temporary storage and isolated credentials,
and cleans up both processes. It does not modify the developer's schedules.
Only external basemap tile requests are blocked. The HNI suite uses its existing
explicit demo mode on port 5177. Google-specific layer behavior remains covered
with the existing mocked SDK; neither suite claims live traffic or GPS verification.
Generated screenshots are under `frontend/test-results/` and are not committed.

For manual review, start FastAPI on port 8000 and Vite on 5173, with
`VITE_DEMO_MODE=false`, `OMCM_DATASET=pilot`, `OMCM_DEMO_AUTH=true` and your backend
administrator credentials. Open `http://127.0.0.1:5173/`, sign in, select
**Optimize → Generate recommendations**, inspect the assignments and model
evidence, and optionally approve tomorrow's draft. Open Public View and choose
the approved date to inspect server-published locations. All tools remain on
the same admin map screen.
