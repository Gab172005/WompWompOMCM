# Clinic integration review — pending fixes

Read-only Sol6.1 review completed workflow-131064e948ab4472, 2026-10-24. Drafts changing; confirm each finding against final slice output. No tests ran in review. Parent sent findings to owning agents; Luna integration pass should fix remaining.

1. P1 MAPPED_OSM_CLINICS coordinates-only includes inactive/outside bbox false positives; require valid snapshot, active,inProvince,isLocatedClinic,status!=outside. Keep complete PROVIDED audit. Review observed385 located but98 active in-province; verify final provenance before quoting counts. Independent browser eligibility oracle, mock excluded fixtures.
2. P1 Python Haversine constant12,742,000 is diameter not circumference; dividing/pi distances too small factorpi; use2*6371*asin in km. Test equator1deg111.195km, duplicate49m/51m/100m; regenerate snapshot.
3. P1 raw-only import sibling sidecar discovery trusts query without raw checksum/reference match; checked acquisition loader must validate raw identity/hash. CLI default endpoint must not overwrite sidecar source endpoint.
4. P1 raw import no sidecar query/retrievedAt currently persists validtrue but bundle rejects. Require real metadata before replacing; never invent query/date; preserve old bytes on rejected imports.
5. P1 bundle loader must require raw/provenance/normalized triple, compare BOTH geometry hashes current, and offline rebuild normalized/full metadata before embed. Current checks raw+query/date only permit stale geometry/tampered PSGC/counts.
6. P2 normalized state invariants: assigned must be inProvince, valid WGS84, barangay+municipality. Defensively scorer count/BY_PSGC require active located inProvince assigned. Direct fixtures excluded but matching real PSGC.
7. P2 --allow-empty cannot work parser rejects elements[] before guard/bundle rejects empty records; accept COMPLETE empty response only explicit confirmation, reject remark/errors always. Test neither flag/each/both against installed nonempty. Flags empty and large-drop independent.
8. P2 large-drop guard must compare retained meaningful clinic records not only candidates (includes unrelated and duplicate elements); keep raw audit counts, warn active/inProvince losses. Test100clinics vs1clinic+99unrelated.
9. P2 imports fixed .tmp/.bak names concurrency unsafe. Serialize lock+unique staging; preserve backup on rollback failure; avoid impossible 'never mixed' crash guarantees. Test injected swap failures and concurrent importer rejection.
10. P2 alternative-weight test passes no hospitals/clinics then compares coverage production with supplied sources; SAME sources, change only weights. Missing risk85 both, all full100.

Additional parent UI findings sent: do not say every bar percentile (risk/income aren't); mapped observedzero not verified absence; zero provision tied deficit not necessarily100; competition ranks apply rounded totals, not average tied percentiles.

Previously reported issues review observed corrected: unauthorized virtual Vite/runtime joins removal, missing clinicDataset import, undefined variable, missing Python test creation, shared-edge/hole spatial fixes, safe popup DOM/text, purple inline icon, acquisition date, Google OSM cleanup, PSGC strings, unlocated retained, distinct confirmation flags. Confirm final files.

Outstanding verification: importer stdlib tests/checks, generated bundle reproducibility, lint/unit/build/browser, generate/check sensitivity report, final docs real counts/commands. No final completion/commit-ready claim until passes. Model effort API unavailable; routing provider/model only.
