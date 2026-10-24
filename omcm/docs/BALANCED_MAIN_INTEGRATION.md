# Balanced HNI integration with latest main

Branch: `fix/agreed-balanced-hni-weights`. Main: `51fc711` (interactive assistant).
The Balanced correction is `1f272bd`; the subsequent normal merge incorporates
the groupmate's assistant without restoring outdated scores or browser plans.

## Conflicts and reconciliation

- `frontend/src/features/chatbot/ChatbotPanel.tsx`: retain main's interactive
  conversation instead of the previous local chat panel. Move accurate HNI and
  connected-allocation explanations into its actual fast/tool/server paths.
- `frontend/package.json`: keep both `test:optimization` and `test:assistant`.
- `.env.example` and `frontend/.env.example`: retain the existing templates
  despite main's deletions. Their content and existing local credentials are
  unchanged. Main's backend/root environment-loading support is preserved.

Both instant and provider-assisted answers now identify the agreed six-factor
Balanced HNI and the shared 30-day projection policy. Ranking tools report the
current shared model version, not a hardcoded v3 name.

The assistant's plan lookup reads `useOptimizationStore.result`: either the
saved FastAPI draft or an explicit no-allocation state. It no longer runs the old
municipal browser optimizer. Changing clinic count updates actual optimizer
inputs and invalidates stale results, without inventing a new allocation. The
user selects Generate recommendations to call the backend.

Map, clinic planning, simulation, community selection and public schedule
actions change state on the current map screen. Supporting legacy destinations
remain separate. Provider instructions reflect those boundaries and the real
XGBoost/CP-SAT pilot. The assistant cannot approve or publish schedules.

No trained artifacts, agreed HNI percentages, bundled datasets, configured
credentials, capacity/route constraints or existing API schemas were changed by
this integration. Main's new assistant API/model types are inherited as authored.

## Exact changed files relative to the Balanced commit

Paths are relative to `omcm/`. Most files are main's existing work being imported,
not newly authored replacements. Reconciled files are identified explicitly.

| File | Origin and logic |
| --- | --- |
| `backend/config.py` | Preserve main's nonempty backend/root environment loading and process precedence. |
| `backend/main.py` | Preserve main's assistant route registration. |
| `backend/routers/assistant.py` | Preserve main's validated provider transport endpoint. |
| `backend/services/assistant.py` | Import main's provider/tools; update HNI, allocation and map-action instructions. |
| `docs/ASSISTANT.md` | Preserve main's feature documentation; add the reconciliation notice. |
| `frontend/package.json` | Combine both browser verification scripts. |
| `frontend/scripts/assistant-browser.mjs` | Import main's browser test; verify Balanced explanation and unchanged map URL. |
| `frontend/src/app/App.tsx` | Preserve main's global assistant mount. |
| `frontend/src/components/layout/MapControls.tsx` | Preserve main's assistant launch control. |
| `frontend/src/features/chatbot/AssistantWidget.tsx` | Preserve main's floating conversation widget. |
| `frontend/src/features/chatbot/ChatMessage.tsx` | Preserve main's richer message rendering. |
| `frontend/src/features/chatbot/ChatbotPanel.tsx` | Resolve conflict in favor of main's interactive conversation. |
| `frontend/src/services/assistant.test.ts` | Import main's tests; verify in-place tools and actual-draft invalidation. |
| `frontend/src/services/assistantApi.ts` | Preserve main's backend provider transport. |
| `frontend/src/services/assistantFast.test.ts` | Import main's tests; check agreed HNI and in-place simulation. |
| `frontend/src/services/assistantFast.ts` | Preserve fast commands; explain shared HNI and separate connected allocation. |
| `frontend/src/services/assistantTools.ts` | Preserve tool framework; read actual drafts/config, report current HNI version and keep map tools in place. |
| `frontend/src/store/useAssistantStore.ts` | Preserve main's conversation/action state and cancellation. |
| `frontend/src/styles/assistant.css` | Preserve main's responsive assistant styles. |
| `frontend/src/types/assistant.ts` | Preserve main's assistant types. |
| `tests/backend/test_assistant.py` | Import main's tests; add a policy/connected-allocation instruction regression. |
| `docs/BALANCED_HNI.md` | Update merged verification and integration link. |
| `docs/PUBLIC_VISITS.md` | Update main hash, combined branch handoff and final counts. |
| `docs/BALANCED_MAIN_INTEGRATION.md` | Record conflicts, exact origin/logic inventory and validation. |

## Final verification

- Frontend lint and production build passed; 127 unit tests passed.
- Backend: 65 tests passed.
- HNI, connected allocation/publication, 30-day simulation and assistant browser
  suites passed on desktop/mobile. Sensitivity report remains reproducible.
- The allocation suite exercises real FastAPI/XGBoost/CP-SAT and temporary
  SQLite, including fresh public sessions, emergency updates and outage retention.
- Assistant common commands use actual app data; provider responses are stubbed
  in this browser suite. No live paid provider call was made for this integration.
- Existing bundle-size and Starlette/httpx deprecation advisories remain.

## Review and push

Open `http://127.0.0.1:5173/`. In Admin View, search Pangil and inspect Dambo's
six HNI contributions. In Ask OMCM, enter **Explain the need score**; it reports
35% morbidity and 15% density with no disaster-risk contribution. **Open clinic
planning with four clinics** changes inputs and opens the current map panel;
it does not fabricate or publish a recommendation.

Only this latest branch needs to be pushed for a combined PR into main:

```sh
git push -u origin fix/agreed-balanced-hni-weights
```

Earlier XGBoost, sign-in and temporal/public branches are already ancestors.
Main through `51fc711` is included, and the four merge conflicts are resolved.
