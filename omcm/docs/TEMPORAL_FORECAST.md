# Dated illness forecasting

Branch: `feat/temporal-forecast-public-clinics`. Reviewed 2026-10-24.

Page 4 of `WompWomp.pdf` separates transparent risk estimation from
capacity-aware maximal covering. It does not specify XGBoost. This extension
retains the project's XGBoost requirement and that separation: dated illness
forecast → unchanged weighted pilot priority and appointment model → existing
CP-SAT placement, with identical constraints for the population-first baseline.

## Data and computation

`forecast_history.py` generates fictional daily case rates, rainfall and
temperature from January 2023 through the Manila issue date. Independent seeded
streams preserve historical prefixes when future dates are added. No patient
records or observed weather feeds are used. Static source morbidity sets a
simulation scale divided by 30; this does not assert a source reporting period.

`illness-forecast-v2` predicts aggregate next-day cases per 1,000 from case lags,
seven/fourteen-day means, trend, current/seven-day rainfall, a mock next-day
rain forecast, temperature, flood exposure and seasonal calendar features.
Features exclude future observations. Scenario flood exposure affects inference
without rewriting historical baseline inputs. This is not disease-specific diagnosis.

Tomorrow's rolling burden combines 29 known synthetic daily rates and one
prediction. Corresponding case counts replace morbidity in a copied scoring
frame, preserving bundled datasets. Existing six-factor coefficients remain.
Original `appointment-demand-v1` then estimates appointments using that burden
and the existing other inputs. Its artifact, fitted parameters and constraints
are unchanged. Explicit outbreak multipliers and demand bounds remain.

The province-wide baseline HNI remains separate and unchanged. The user's
Balanced-profile image shows morbidity 35%, density 15%, hospital distance 30%,
income 10%, clinic distance 5%, clinic provision 5%. Current main instead has
morbidity 25%, density 10% and disaster 15%, with the other percentages unchanged.
**No coefficient file was edited to resolve this existing policy discrepancy.**
Changing the active profile requires a separate group decision.

## Model evidence

Thirty-two fictional profiles use chronological target-date folds. Identities
are RNG seeds, not model features; training identities differ from pilot IDs.

| Fold | Target dates | Rows |
| --- | --- | ---: |
| Train | 2023-01-31 to 2024-06-30 | 16,544 |
| Validation | 2024-07-01 to 2024-09-30 | 2,944 |
| Test | 2024-10-01 to 2024-12-31 | 2,944 |

Validation selects the iteration. Test targets are excluded from fitting and
selection. Baselines use only information available on each issue day.

| Synthetic daily cases per 1,000 | Test MAE | Test RMSE |
| --- | ---: | ---: |
| XGBoost | 0.0512 | 0.0697 |
| Latest observation | 0.0872 | 0.1401 |
| Seven-day mean | 0.1349 | 0.2234 |
| Linear regression | 0.0894 | 0.1288 |

These measure recovery of a fictional generator, not clinical accuracy.
Forecast burdens above the original appointment model's training range produce
a provisional-estimate warning. Runtime never trains models. Missing/tampered
artifacts fail with 503 instead of inventing an allocation.

From `omcm/backend`, reproduce separately using existing requirements:

```sh
.venv/bin/python scripts/train_illness_model.py
.venv/bin/python scripts/train_demand_model.py
```

Both scripts reproduced their committed checksum, metrics and manifest exactly
in temporary directories on the tested environment.

## Publication and limits

Forecast dates, provenance and baselines use existing plan notes/metadata;
no API schema or database migration was introduced. Ordinary approval must
match the saved forecast target date and existing future-date rules. Generate
a fresh plan after the date changes. Confirmed emergency override can revise
today/future schedules with a notice. Older undated drafts retain existing rules.

Published locations, assignments, hours and services flow to public schedules;
draft notes and raw forecast features do not. See PUBLIC_VISITS.md for the public
consumer update. Authentication and configured credentials remain unchanged.
Automatic nightly scheduling, unification of the separate 30-day browser
simulation/HNI engines, and the broader endpoint/privacy audit remain pending.

## Exact file and logic inventory

Paths are relative to `omcm/`; existing files refine groupmates' implementation.

| File | Change |
| --- | --- |
| `backend/services/forecast_history.py` | New causal dated synthetic histories and lag features. |
| `backend/scripts/train_illness_model.py` | New chronological training, baseline evaluation and forecast export. |
| `backend/scripts/train_demand_model.py` | Preserve training logic; import explicitly named original model constants. |
| `backend/data/models/illness-forecast-v2.json` | Add the separate native forecast model. |
| `backend/data/models/illness-forecast-v2.metadata.json` | Add chronology, features, evaluation, limitations and checksum. |
| `backend/services/demand_model.py` | Validate both models, forecast illness and preserve original demand/surge behavior. |
| `backend/services/clinic_optimizer.py` | Feed forecast burden into unchanged scoring/placement; report dated provenance. |
| `backend/routers/clinics.py` | Reject ordinary approval on a mismatched forecast date. |
| `frontend/src/features/optimization/OptimizationPanel.tsx` | Explain dated synthetic forecasts and pilot scope. |
| `frontend/src/features/optimization/DeploymentApproval.tsx` | Default to forecast date; explain ordinary date restriction. |
| `tests/backend/test_optimizer_model.py` | Adapt inference checks, retain integrity/solver regressions. |
| `tests/backend/test_temporal_forecast.py` | Check leakage, prefixes, chronology, original model, source/factor invariance, surge and publication. |
| `datasets/SOURCES.md` | Identify fictional history provenance. |
| `docs/API.md` | Document forecast notes/date guard; correct stale accessibility definition. |
| `docs/OPTIMIZATION_ALLOCATION.md` | Link the extension above the original Step B audit. |
| `docs/TEMPORAL_FORECAST.md` | Record scope, policy discrepancy, evidence and inventory. |

Checks passed: frontend lint, 93 tests and build; backend 53 tests; HNI and
connected allocation/publication browser suites. Existing bundle-size and
Starlette/httpx deprecation warnings remain.
