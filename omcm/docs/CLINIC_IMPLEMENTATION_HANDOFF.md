# OSM clinic implementation handoff

Current policy update: [the agreed Balanced HNI](BALANCED_HNI.md) supersedes
historical v3/seven-factor weights in this record. Active HNI uses six factors
with no disaster-risk contribution; the earlier audit details below are history.

## Objective
Implement Laguna-only exact OSM clinic tags, seven-factor per-barangay healthcare need, fixed clinic layers independent from mobile simulations, docs/tests/sensitivity. Preserve all 681 barangay IDs/demographics/hazards, 66 hospital records (61 located), separate municipal and server pilot scoring/publication/auth/simulation behavior.

## Frozen decisions
- Production weights morbidity25%, hospitalAccess30%, disasterRisk15%, density10%, incomeClass10%, clinicDistance5%, clinicProvision5%. Urban/rural stays demographic context only; no contribution/coverage/rank effect.
- Income class remains observed known-class min-max, currently 1st–4th.
- Clinic distance = tied province-wide percentile of Haversine nearest active located in-province clinic, cross-barangay allowed; stable ID tie-break.
- Provision deficit =100−percentile(count/population×10000), equal values50. Valid zero observation differs from absent/invalid snapshot; invalid snapshot excludes both clinic factors, invalid population excludes provision, no eligible location excludes distance.
- Nodes exact amenity=clinic OR healthcare=clinic, plus ways/relations (Overpass center, not entrance). Lifecycle-only records retained in provenance but inactive. No name matching/broader types. Identity-only dedup; suspected distinct IDs flagged, not merged.
- Polygon/MultiPolygon/hole-aware barangay assignment; ambiguous excluded counts, in-province located eligible distance with warning. Laguna-only distance has province-edge bias.
- Offline snapshot and generator; explicit refresh only, staged failure-safe replacements, empty/large-drop confirmation.
- Separate default-on showOsmClinics and purple fixed layer; hospitals red/mobile green independent. OSM text React/DOM textContent; no HTML interpolation. Google mock verification, no key required.
- Sensitivity alternative20/40/15/5/10/5/5; production remains unchanged.

## Workspace/tool facts
Root C:\Users\desmo\WompWompOMCM, app omcm/. Read root AGENTS.md. Windows PowerShell; read existing files before edits. Python bundled C:\Users\desmo\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe, Node C:\Program Files\nodejs\node.exe and npm C:\Program Files\nodejs\npm.ps1. Frontend deps installed. No backend venv last inspected.
User requests automatic handoff at120k for all agents; harness tools do not expose threshold/new-session rollover. Preserve this document and slice completion reports; do not claim threshold control.

## Orchestration/current work
User explicitly requests large multi-agent workflow. Configured provider codebuddy models deepseek-v4.1-flash, gpt-6.1-sol and gpt-6-luna. workflow API accepts provider/model, not reasoning effort; do not claim high/max/low was enforced.
- Initial invalid-model scout workflow-152f9f3fbe9f4e75 returned null, collected.
- Successful scout workflow-47f7eb19c19d42d7 collected. Its suggestions contained requirement conflicts; frozen decisions above override them.
- Actual acquisition pwsh-2bf1b3319dd24289 completed/collected;385 raw candidates, retrieved2026-10-23T17:32:47.575509+00:00, OSM base2026-10-23T17:31:38Z. Staged raw and acquisition provenance frontend/test-results/osm-clinics-{raw,acquisition}.json. bbox13.9634909,121.0052961,14.5957714,121.6346258. Endpoint https://overpass-api.de/api/interpreter; exact QL in acquisition provenance. No actual persistent imported snapshot yet at document creation.
- RUNNING workflow-0a85c29c1a204b4f, four parallel DeepSeekV4.1 slices below. Collect output before integration. No busy polling.
- RUNNING workflow-131064e948ab4472, codebuddy/gpt-6.1-sol read-only integration review of current draft, highest-value findings, aware coding in-flight. Collect before Luna fix phase. Parent requested review early to overlap; revalidate findings against final slice files.
- pwsh-9f94127fcd5b40a1 syntax check of parent sensitivity/browser scripts completed/collected exit0.
- workflow-131064e948ab4472 review completed/collected; findings saved docs/CLINIC_REVIEW_HANDOFF.md and sent slices. This replaces earlier running status.
- RUNNING workflow-08288fff934e4862 Luna6 MAP ONLY targeted fixes/tests; map slice original agent inactive so no conflict. Other slices still active.
- pwsh-9c241db458d94fe7 initial lint failed69errors in agents' scratch artifacts; collected. Both scorer/UI agents now stopped and claim own scratch removed. Need rerun full lint.
- pwsh-bbaaa7f463954b41 initial Vitest sandbox EPERM esbuild capturedpipes; collected. Exact danger-full-access retry pwsh-1a16efc62a714e71 approved and completed/collected:16fail19pass,5files. Detailed failures sent Luna agents.
- RUNNING workflow-99a6809ab9234d5b Luna6 SCORER ONLY repairs/test expectations; scorer owner a144...now stopped; owns scorer/providedData +2tests, no config/maps/UI. Original UI9857...also stopped; parent fixed duplicate warningkeys, false never100 explanation, UI test selectBarangay2args/hospital queryscope/timeout20sec. Luna map06584...allowed narrow Vite test aliases react-leaflet/leaflet only after sibling resolution failure.
- ALL DeepSeek slices now stopped; workflow-0a85c29c1a204b4f completed/collected. Importer actual35stdlibtests passed and snapshot+bundle regenerated/reproducible; review remaining explicit-empty, meaningfuldrop, locking delegated RUNNING workflow-defd1d8ee46a48b3 Luna6 IMPORTER ONLY scripts/tests/data/JSON regen. Collect all three Luna workflows.
- pwsh-235ef3c114354f77 git diff/status completed/collected:35files staged by unknown external actor, some newer worktree edits not staged; DO NOT git add/unstage/commit without request. No scratch entries remain. Original map agent reports npm ci --ignore-scripts ran to repair install; actual unrestricted Vitest starts successfully.
- pwsh-356873842f984fd6 lint + tsc collected:unusedmapimport/inprogressedit + sibling react-leaflet type errors; mapLuna authorized narrow aliases, nowcompleted/collected workflow-08288fff934e4862, editsSTOPPED.
- Build pwsh-9aaf521302c0469c tscPASSED thenViteEPERM; exactdangerretry RUNNING pwsh-c0be9af732b14f42. Targetmaptests pwsh-0b49d9e05a5c4d1d startupEPERMcollected, exactretryRUNNING pwsh-22a03b9a82b4497c.
- Edgebrowser pwsh-6d25fec0dcfa45d8 EPERMcollected; exactretry pwsh-31e4510aa40041f6 Vite starts butcoldpage.goto load30stimeoutcollected; testnowDOMContentLoaded120s geometry90s actualreadiness, RUNNING retry pwsh-22697ece6b764621.
- Sensitivity pwsh-714860c660ac4dc4 passedgenerated report21/25overlap median33 max190 provisional4both; scorerunderintegration sofinalregenerate/checkrequired. Narrow root.gitattributes createdpins OSMraw/prov/normalized+2geometry bytefiles -text, generatedbundle LF prevents core.autocrlf=true breakingfreshcheckout hash/rebuild. No indexoperations. READMEdisclosesbackendtests+venv absent, bundledPython no backenddeps (probe pwsh-b5834922165a4feecollected). Parent UI fixes done, awaits final rerun.
- All DeepSeek slices except Python importer now stopped (historical status; superseded above). Need workflow original completion/collect once importer finishes. Persistent actual snapshot exists385records/98activeinProvince/284activeoutside/3inactive; docs OSM_CLINICS.md actual counts/commands added, suspected duplicates count intentionally not final until corrected Haversine regen.
- Persisted goal goal-2180ec2d-38f6-4062-9b71-bc1061888882 revision2 paused; resume attempt denied tool 'model cannot resume a paused goal; user must resume it'. Do not claim active persisted goal; human implementation work proceeds via todos.

## Nonconflicting ownership (do not cross-edit while workflow runs)
1. Importer slice: frontend/scripts/import-osm-clinics.py, optional osm_clinics.py, import-laguna-datasets.py, public/assets/osm/* raw/normalized/provenance, generated src/data/laguna-datasets.json (generator only), tests/data/test_osm_clinics.py+fixtures. Must import staged actual snapshot and run Python focused tests/checks.
2. Scorer slice: src/services/healthcareNeed.ts+providedData.ts, tests/frontend/healthcareNeed.test.ts+providedData.test.ts. v3 scorer and typed shared clinic exports.
3. Map slice: store/useAppStore.ts, LayerToggles.tsx, AppLayout.tsx, mapTypes.ts, LagunaLeafletMap.tsx, LagunaGoogleMap.tsx, new OsmClinicMarkers.tsx/optional osmClinicPopup.ts, MapLegend.tsx, new osmClinicLayers/googleClinicLayer tests.
4. UI slice: BarangayPanel.tsx, HealthcareNeedMethod.tsx, tests/frontend/barangayRanking.test.tsx.
Parent owns src/types/osmClinic.ts (already created frozen), browser barangay-map.mjs (already updated stdio inherit/new toggles/85%/clinic labels; mobile marker class clinic-staging-marker), scripts/clinic-sensitivity.mjs (created but not run), markdown docs and integration review/fixes after agents finish. Parent updated datasets/README.md, README.md and docs/ARCHITECTURE.md seven-factor formulas and source links; created docs/OSM_CLINICS.md (needs actual committed snapshot counts/commands section when importer finishes). Runtime confirmed Nodev24.18.0, bundledPython3.12.14, msedge exists. Runtime job pwsh-b60022ec95e1484f completed/collected. Historical three e2e scripts absent; only barangay-map.mjs available and README verification corrected accordingly. Parent does not run full tests/build while agents actively changing source.

## Frozen shared contract
Read frontend/src/types/osmClinic.ts. OsmClinic fields id,osmType,osmId,name,lat/lng nullable,locationMethod(node|overpass-center|unavailable),tags,active,inProvince,barangayPsgc/municipalityPsgc nullable,assignmentStatus(assigned|ambiguous|outside|unlocated),warnings. ClinicSnapshot valid,retrievedAt,osmBaseTimestamp,endpoint,query,attribution,license,rawSha256,boundarySha256,counts,warnings. ClinicDataset{clinics,clinicSnapshot};LocatedOsmClinic nonnullable lat/lng.
Scorer signature computeBarangayHealthcareNeed(barangays,hospitals,clinicDataset?,weights?). New outputs clinicCount:number|null,clinicsPer10000:number|null,nearestClinic:{id,name,distanceKm}|null,clinicWarnings:string[]. providedData exports PROVIDED_OSM_CLINICS,MAPPED_OSM_CLINICS,OSM_CLINIC_SNAPSHOT. MapProps adds osmClinics and showOsmClinics. Test exact labels Clinic distance/Clinic provision deficit, OSM clinics, Mobile clinics; marker class osm-clinic-marker-custom.

## Integration issues already sent to slices (check resolution)
- Scorer draft created unauthorized services/clinicDataset.ts+virtual Vite plugin reading gitignored staged test-results; parent explicitly ordered removal and restoring original vite.config.ts. MUST confirm no virtual imports/runtime second spatial join survive. Generated bundle is sole normalized evidence.
- Scorer issues sent: remove obsolete classificationScore, harmonize exact labels Clinic distance / Clinic provision deficit, validate WGS84 nearest point inputs and nonnegative finite total1 weights; clinicAccess generic must include lat/lng; count retained even invalid population (only rate null); ambiguous warning must reference nearest ambiguous (strict distance<nearest was impossible); counts only eligible assigned active inProvince located.
- Importer issues sent: preserve PSGC string (no lstrip0), simultaneous base clinic+inactive lifecycle/boolean inactive flags must exclude; missing node both coords retain unlocated; near same normalized name<=50m suspected duplicates, municipality checksum included; in-province no barangay ambiguous not outside.
- Importer atomic swap draft critical bug after moving target to backup then replacement throws before bookkeeping; test/repair bookkeeping before moves and preserve backups if rollback fails. Empty override must NOT be bypassed by accept-large-drop.
- Map slice icons must have actual purple inline style or CSS (new class initially unstyled); Google popup needs snapshot date; safe operator/specialty as optional text; all layer cleanup mocked.

## Remaining work
- Collect workflow completion, inspect diffs/source/output/tests, confirm schema and actual snapshot counts.
- Sol6.1 read-only review workflow (provider codebuddy/model gpt-6.1-sol), then Luna6 integration/fix workflow (provider codebuddy/model gpt-6-luna) with focused non-conflicting edits. Effort not exposed.
- Update datasets README, ARCHITECTURE.md, main README relevant sections, new OSM_CLINICS.md actual commands/query/counts/license/limitations. Remove stale Sources.md references only as relevant.
- Generate docs/CLINIC_SENSITIVITY.md via frontend/scripts/clinic-sensitivity.mjs once scorer/snapshot ready; report top25 overlap median/max movement. Read existing output before regeneration.
- Verify offline importer Python tests + --check, frontend lint →unit→build→barangay Playwright browser, sensitivity --check. Browser starts own Vite5176 stdio inherit; use OMCM_BROWSER_CHANNEL=msedge if needed. No replacement harness GUI/server. Capture results/failures honestly; investigate nonzero exits.
- Snapshot complete only when valid actual data integrated; do not invent actual clinic counts. Missing Google live key disclose mocked coverage. Backend unchanged; avoid road fixture refresh/export.
- Before final collect all still relevant jobs; stop irrelevant jobs. Link source/doc paths in final; no present for edited source. Primary final results counts/version/weights/test outcome/sensitivity and caveats, concise.
