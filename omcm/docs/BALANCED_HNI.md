# Agreed Balanced HNI alignment

Branch: `fix/agreed-balanced-hni-weights`. Reviewed 2026-10-24.
This branch includes all previous connected allocation, dated forecast and public
visit work through `c18c7ce`; push/open one combined PR from this latest branch.

## Approved policy

The user confirmed that the supplied group-agreed Balanced profile is authoritative.
The active model is `barangay-healthcare-need-v4-balanced`:

| HNI factor | Weight |
| --- | ---: |
| Sample morbidity | 35% |
| Hospital distance | 30% |
| Population density | 15% |
| Municipal income class | 10% |
| Mapped clinic distance | 5% |
| Mapped clinic provision deficit | 5% |

With complete evidence, HNI = `0.35*M + 0.30*H + 0.15*D + 0.10*I + 0.05*C + 0.05*P`.
The existing percentiles, income normalization, distance eligibility, OSM
provenance, one-decimal rounding and competition-rank rules are preserved.
Missing agreed factors still rescale available weights and mark HNI provisional.

Disaster risk contributes no HNI term, coverage loss or ranking change, whether
its source value is zero, positive, missing or invalid. Hazard records/layers
remain available separately. Consequently the four missing hazard indices no
longer make otherwise complete HNI records provisional. Source CSV/JSON/boundary
files remain unchanged; no missing hazard values were imputed.

The map, barangay/municipality HNI details, ranking and 30-day HNI projection
share this policy. The projection reads the common weights rather than restoring
historical v2 coefficients. It retains clinic distance/provision factors and
common synthetic morbidity changes. Disaster pulses, direct flood additions and
urban/rural scoring are removed from that HNI projection. Backlog/service
fractions, host/neighbor catchments, weekly decisions and publication rules are
unchanged. Browser rehearsal flood settings do not add HNI points or alter its
straight-line reach; connected planning retains operational flood exclusions.

## Boundaries preserved

Neither XGBoost artifact nor its fitted parameters was changed. Dated synthetic
forecasting, original appointment inference, backend pilot-priority coefficients,
capacity/travel/site exclusions and configured administrator credentials remain.
The backend pilot-priority index uses different inputs and is separately labeled;
this change does not remap its vulnerability, poverty or travel measures into
provincial HNI concepts. No API schema/database change or migration was made.

Public schedules still display approved allocations/hours/services from FastAPI,
without draft HNI/features. The connected allocation browser suite confirms fresh
public sessions, emergency revisions and outage retention continue working.
Any shared HNI consumer computes current scores from the shared definition.

## Exact files and logic changed

All paths below are relative to `omcm/`. Existing files refine groupmates' work.

| File | Change and reason |
| --- | --- |
| `README.md` | Publish agreed Balanced percentages and shared simulation policy. |
| `datasets/README.md` | Replace seven-factor formula and missing-hazard rescaling rules. |
| `docs/ARCHITECTURE.md` | Describe one shared Balanced HNI definition and retain separate pilot scope. |
| `docs/CLINIC_IMPLEMENTATION_HANDOFF.md` | Mark the historical frozen v3 policy as superseded. |
| `docs/CLINIC_SENSITIVITY.md` | Regenerate ranks/overlap/coverage for six-factor production and diagnostic profiles. |
| `docs/HOSPITAL_HNI_AUDIT.md` | Mark historical v3/missing-risk conclusions as superseded. |
| `docs/OPTIMIZATION_ALLOCATION.md` | Identify the current HNI policy above historical Step B notes. |
| `docs/OSM_CLINICS.md` | Update active clinic/HNI weights and missing-data explanations. |
| `docs/PUBLIC_VISITS.md` | Point the combined push/PR handoff to this latest branch and include Balanced alignment. |
| `docs/SIMULATION_MODE.md` | Replace historical v2 weights and disaster pulses with shared Balanced HNI behavior. |
| `docs/TEMPORAL_FORECAST.md` | Record the user-approved resolution of the earlier weight discrepancy. |
| `frontend/scripts/clinic-sensitivity.mjs` | Keep the offline diagnostic within the six supported factors; refresh report wording. |
| `frontend/scripts/hospital-hni-browser.mjs` | Verify complete HNI for Dambo/Pangil despite missing disaster context. |
| `frontend/src/features/chatbot/ChatbotPanel.tsx` | Explain exact agreed HNI percentages and separate hazard context. |
| `frontend/src/features/municipalities/BarangayPanel.tsx` | Show six factors and remove obsolete risk contribution formatting. |
| `frontend/src/features/municipalities/HealthcareNeedMethod.tsx` | Describe Balanced weights and exclusion of disaster risk. |
| `frontend/src/features/municipalities/MunicipalityMetrics.tsx` | Explain hazard context separately from HNI and its contributions. |
| `frontend/src/features/municipalities/PlaceDetails.tsx` | Remove disaster-risk HNI driver explanation. |
| `frontend/src/features/simulation/SimulationPanel.tsx` | Explain shared Balanced HNI and the separate operational hazard scope. |
| `frontend/src/services/forecasting/forecast.ts` | Reuse shared weights, retain clinic factors, remove historical disaster/urban-rural scoring. |
| `frontend/src/services/forecasting/simulation.test.ts` | Check shared version/weights, weighted totals, coverage and hazard invariance. |
| `frontend/src/services/healthcareNeed.ts` | Set agreed 35/30/15/10/5/5 profile, remove hazard scoring, reject unsupported custom factors and version policy. |
| `tests/frontend/barangayRanking.test.tsx` | Verify six displayed weights and complete HNI despite absent hazard context. |
| `tests/frontend/healthcareNeed.test.ts` | Verify exact agreed policy, hazard-invariant scores/ranks/coverage and missing agreed inputs. |
| `tests/frontend/hospitalHni.test.tsx` | Check canonical municipality rollups without false hazard-driven provisional flags. |
| `docs/BALANCED_HNI.md` | Record approved policy, exact file/logic inventory, verification and consolidated branch handoff. |

## Verification and review

Passed frontend `npm run lint`, `npm test` (93 tests), `npm run build`; backend
`.venv/bin/python -m pytest -q` (53 tests). Also passed `test:hni`,
`test:optimization`, `test:simulation` and sensitivity regeneration/`--check`.
Existing bundle-size and Starlette/httpx deprecation advisories remain.

Regression checks cover every barangay, independent contribution sums and ranks,
missing agreed inputs, invariance to hazard-only changes, shared projection
weights, native allocation/publication and mobile layouts. The sensitivity report
compares the approved production profile against an offline diagnostic only;
it does not activate an alternate policy.

Browser: open `http://127.0.0.1:5173/`, enter Admin View, search **Pangil**, then
select **Dambo** from its barangay list. Its HNI shows 100% available factor weight
with the bundled usable clinic evidence, despite its unresolved hazard index.
Expand **How each factor affects the score** and **How is this score calculated?**
to inspect percentages. **30-day simulation** uses the same six HNI weights.

Push this latest branch yourself and open one PR into `main`:

```sh
git push -u origin fix/agreed-balanced-hni-weights
```

The older allocation, sign-in and temporal/public branches are included ancestors;
they require no separate PRs. Keep them until the combined PR is merged.
