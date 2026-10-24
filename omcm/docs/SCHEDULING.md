# Clinic booking window and emergency publication

Branch: `feat/seven-day-clinic-scheduling`. This branch includes the preceding
global audit, protected views and UI polish. The scheduling refinement changes
business rules on existing fields, without a new API/database schema, model
retraining, HNI percentage changes or account changes.

## Why the previous form allowed only tomorrow

The XGBoost inference produces a next-day estimate and the previous approval
rule required the deployment date to equal that forecast date. This kept the
meaning of prediction and booking aligned but made ordinary advance booking
unnecessarily rigid. The public schedule storage already accepts separate ISO
dates, and the public summary already handles future announced visits.

## Current rules

| Action | Allowed date | Requirements |
| --- | --- | --- |
| Ordinary approval | Tomorrow through seven days ahead, inclusive | Stored nonempty plan, fresh dated forecast when present, valid hours and selected services; no ordinary replacement of an existing schedule. |
| Emergency publication/revision | Today through seven days ahead | Same plan/date checks, a trimmed public notice of at least 10 characters, explicit confirmation. |
| Date beyond seven days | Rejected | Revisit and generate a fresh plan nearer the date. |
| Expired forecast | Rejected | Generate a new plan; changing the booking date cannot bypass freshness. |

Dates use Asia/Manila. A dated plan is fresh when its saved forecast target is
tomorrow, so a plan issued yesterday must be regenerated before new publication.
Undated legacy plans retain compatibility with the same seven-day date bounds.
An already published schedule remains visible when its source estimate gets
older; freshness applies to new publication, not automatic deletion of visits.
Today's ordinary schedule stays fixed unless an officer confirms an emergency
revision. A single approval publishes one date; there is no recurring or bulk
week-long deployment feature.

Seven days is an operational booking policy, not a scientifically validated
forecast-validity period. A later booking uses the current allocation and latest
next-day estimate as a planning reference. The form states the forecast date
and asks for review before deployment. This does not extrapolate XGBoost seven
days, fabricate weather observations or alter the agreed HNI. A real multi-day
forecast would require a separately reviewed modeling change.

## Why the emergency button can be disabled

The screenshot's `hello` is only five characters, and the explicit revision
confirmation is unchecked. Both conditions independently disable publication.
Use a useful notice such as “Clinic relocated to the barangay hall.” and check
“I confirm this emergency revision and public notice.”

The form now shows a trimmed character count and an actionable “Before you can
publish” list. Other blockers include no plan/clinic, no service, an invalid date,
closing before opening, or an expired forecast. The backend independently trims
and checks notices so padding a short message with spaces cannot bypass the UI.
The button becomes enabled only after all current requirements are met. It still
requires a deliberate click to publish.

## Exact files and logic changed

| File | Change |
| --- | --- |
| `backend/routers/clinics.py` | Seven-day date bounds; dated-draft freshness instead of booking/forecast-date equality; server-side trimmed emergency notice validation. |
| `frontend/src/features/optimization/DeploymentApproval.tsx` | Seven-day calendar limit, explicit estimate/booked-date distinction, shared blockers and visible emergency guidance. |
| `frontend/src/styles/map-workspace.css` | Style the concise publication requirements card. |
| `tests/backend/test_temporal_forecast.py` | Approve Days 1/2/7, reject Day 8 and expired drafts, reject padded short notices and verify trimmed public text. |
| `tests/frontend/optimization.test.tsx` | Calendar bounds, expiry feedback and both emergency blockers becoming satisfied. |
| `frontend/scripts/optimization-browser.mjs` | Exercise disabled/enabled emergency controls, book Day 7 through real FastAPI and see the approved visit in a fresh public session. |
| `README.md`, `docs/API.md`, `docs/ARCHITECTURE.md` | Describe the current booking/forecast distinction and date rules. |
| `docs/TEMPORAL_FORECAST.md`, `docs/PUBLIC_VISITS.md`, `docs/DEMO_SCRIPT.md`, `docs/GLOBAL_AUDIT.md` | Reconcile forecast, public visit and demonstration guidance with the new business rule. |
| `docs/VERIFICATION.md`, `docs/SCHEDULING.md` | Record evidence, exact inventory and operational limits. |

## Browser review

Admin View → Plan clinics → Generate recommendations → Approve & Publish.
Choose a date from tomorrow through seven days ahead. For today, select the
emergency override, enter a 10+ character notice, then check confirmation.
The requirements list explains remaining blockers. After approval, Preview
Public View → Next clinic day shows the selected announced visit.

Validation is recorded in [VERIFICATION.md](VERIFICATION.md). Production needs
both frontend/backend deployed from this branch before the date rules agree.
