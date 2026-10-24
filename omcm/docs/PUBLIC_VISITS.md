# Approved visits and branch handoff

Branch: `fix/agreed-balanced-hni-weights`. Reviewed 2026-10-24.

## Public behavior

The existing public date input is replaced by an approved-visits summary:
today, the next actually published clinic day, and additional announced days
when available. It shows actual counts, Philippine operating hours and approval
or emergency status. Empty days explain that no visit has been announced.
Locations, available services and nearby hospitals remain below it.

Connected public sessions refresh `/api/schedules` every 30 seconds while visible,
on return/focus, when connectivity returns, or by pressing refresh. Stale requests
are cancelled/ignored. Publication or emergency revisions update public markers
and cards from the approved server snapshot. Drafts never create public clinics.
During an outage, the last confirmed schedule stays visible with an explicit
update-delay message. It is not presented as live availability.

Service-area names come from actual published clinic assignments. The former
generic claim that a clinic serves its municipality and neighboring barangays
is removed. Missing assignment evidence is labeled pending LGU confirmation.
The municipality badge describes location rather than guaranteed coverage.
Raw illness predictions, feature histories and private draft notes stay out of
this UI. No page routing, persistent schema, authentication or credential change
was introduced.

## Exact files and logic changed

Paths are relative to `omcm/`. Existing files refine the current public interface.

| File | Change |
| --- | --- |
| `frontend/src/store/usePublicScheduleStore.ts` | Add transient confirmed-snapshot state, safe refresh/cancellation, stale retention and actual assignment-name lookup. |
| `frontend/src/features/public/useScheduleSync.ts` | Refresh visible public sessions periodically and on focus/online; cancel on exit. |
| `frontend/src/features/public/PublicVisitSummary.tsx` | Add today/next-announced-day summary, real counts/hours, manual refresh and stale feedback. |
| `frontend/src/features/public/PublicSidePanel.tsx` | Replace the date picker, prioritize the summary and display evidenced service areas. |
| `frontend/src/features/tracking/ClinicDetails.tsx` | Use the same actual assignments in public clinic details. |
| `frontend/src/components/layout/AppLayout.tsx` | Avoid duplicate connection alerts when the public panel already displays one. |
| `frontend/src/styles/map-workspace.css` | Style the summary and accessible responsive controls in existing plain CSS. |
| `tests/frontend/publicVisits.test.tsx` | Check next published date, actual service areas, outage retention, cancellation and periodic/focus refresh. |
| `frontend/scripts/optimization-browser.mjs` | Verify real forecast/approval, fresh public sessions, responsive summary, unpublished-draft exclusion, emergency revision and stale retention. |
| `README.md` | Link current forecast/public workflow and review instructions. |
| `docs/PUBLIC_VISITS.md` | Record exact logic, validation and consolidated branch handoff. |

## Verification and review

Passed frontend lint, 127 tests and build; backend 65 tests; HNI and connected
allocation browser suites. Both original demand and new illness training scripts
reproduced their respective committed artifacts and metrics. Existing build-size
and Starlette/httpx deprecation warnings remain.

The connected browser suite starts actual FastAPI/XGBoost/CP-SAT with temporary
SQLite and an isolated Vite server. It verifies that a new draft does not alter
public clinics, approved/emergency revisions do, and stopping the backend retains
confirmed public visits while optimizer requests fail without a fallback.
Desktop and 390px mobile screenshots are in ignored `frontend/test-results/`.

Browser: open `http://127.0.0.1:5173/`, enter Admin View with the existing
configured credentials, choose **Plan clinics**, then **Generate recommendations**.
Review dated forecast notes and approve its next-day draft. Use **Preview Public
View**, then **Approved Schedule** / **Schedules & Advisories** and **Next clinic
day** to see the confirmed deployment. No draft appears publicly before approval.

## What to push

The latest checked remote main is `51fc711`. It is an ancestor of this branch;
there are no outstanding merge conflicts with that fetched version. The assistant
update was reconciled with the agreed HNI and connected allocation; see
[BALANCED_MAIN_INTEGRATION.md](BALANCED_MAIN_INTEGRATION.md). Earlier integration
commit `12e35ad` preserves main's Sierra Madre/forest polygon hover behavior and
updates the earlier browser check to the new polygon interaction.

This branch includes the earlier connected XGBoost allocation, administrator
sign-in clarification, both main integrations, dated forecast and public visit
improvements, plus the agreed Balanced HNI alignment documented in BALANCED_HNI.md.
The older allocation/sign-in/temporal branches are checkpoints, not separate
PRs to merge in sequence. Step A was already integrated into main through the
earlier refinement PR.

Push this branch yourself, then open one PR with base `main`:

```sh
git push -u origin fix/agreed-balanced-hni-weights
```

Suggested PR title: **Connect clinic allocation, dated forecasts and public visits**

Suggested description:

> Connect Plan clinics to authenticated FastAPI, native XGBoost demand estimation
> and capacity/travel-constrained CP-SAT, with persisted draft approval and no
> browser-generated fallback allocations. Add a separate next-day illness model
> using dated synthetic histories and chronological evaluation, retaining the
> original appointment model and configured credentials. Align provincial HNI
> and 30-day HNI projection with the agreed six-factor Balanced percentages.
>
> Replace the public date picker with today/next-published visits, actual service
> areas and automatic approved-schedule refresh with outage retention. Preserve
> current main's forest interactions. No API/database schema migration.
>
> Validation: frontend lint, 127 tests, build; backend 65 tests; HNI and connected
> allocation/publication browser suites; exact reproduction of both native models.
> Forecasts remain synthetic demonstrations, with Los Baños–Bay pilot scope.

If main changes again before merging, fetch and inspect it first. Merge new main
commits into this feature branch using a normal merge; resolve any marked files,
rerun the required checks and commit the merge before pushing again. Do not force
push or rebase. Keep old branches until the combined PR is merged; they need no
additional push/merge to carry their included commits into main.
