// Offline policy-weight sensitivity. Node 22.18+ strips TypeScript types.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { computeBarangayHealthcareNeed, HEALTHCARE_NEED_FACTORS, HEALTHCARE_NEED_VERSION } from "../src/services/healthcareNeed.ts";
const root = new URL("../../", import.meta.url);
const dataset = JSON.parse(await readFile(new URL("frontend/src/data/laguna-datasets.json", root), "utf8"));
const clinics = { clinics: dataset.clinics, clinicSnapshot: dataset.clinicSnapshot };
if (!clinics.clinicSnapshot?.valid) throw new Error("Sensitivity requires a validated offline clinic snapshot.");
const alternativeWeights = { morbidity: .20, hospitalAccess: .40, disasterRisk: .15, density: .05, incomeClass: .10, clinicDistance: .05, clinicProvision: .05 };
const production = computeBarangayHealthcareNeed(dataset.barangays, dataset.hospitals, clinics);
const alternative = computeBarangayHealthcareNeed(dataset.barangays, dataset.hospitals, clinics, alternativeWeights);
const order = (a, b) => b.needScore - a.needScore || a.municipality.localeCompare(b.municipality, "en") || a.name.localeCompare(b.name, "en") || a.psgc.localeCompare(b.psgc);
const pTop = [...production].sort(order).slice(0, 25);
const aTop = [...alternative].sort(order).slice(0, 25);
const pIds = new Set(pTop.map(b => b.psgc));
const overlap = aTop.filter(b => pIds.has(b.psgc)).length;
const alternatives = new Map(alternative.map(b => [b.psgc, b]));
const movements = production.map(b => ({ ...b, alternative: alternatives.get(b.psgc), movement: Math.abs(b.needRank - alternatives.get(b.psgc).needRank) }));
const sorted = movements.map(b => b.movement).sort((a,b) => a-b);
const mid = Math.floor(sorted.length/2);
const median = sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
const maximum = sorted.at(-1);
const escape = s => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");
const rows = Object.entries(HEALTHCARE_NEED_FACTORS).map(([key, f]) => `| ${f.label} | ${f.weight*100}% | ${alternativeWeights[key]*100}% |`).join("\n");
const topRows = pTop.map(b => { const a=alternatives.get(b.psgc); return `| ${b.psgc} | ${escape(b.name)} | ${escape(b.municipality)} | ${b.needScore.toFixed(1)} | ${b.needRank} | ${a.needScore.toFixed(1)} | ${a.needRank} | ${Math.abs(a.needRank-b.needRank)} |`; }).join("\n");
const maxRows = movements.filter(b => b.movement===maximum).map(b => `- ${escape(b.name)}, ${escape(b.municipality)} (${b.psgc}): #${b.needRank} → #${b.alternative.needRank}.`).join("\n");
const content = `# Clinic-weight sensitivity report\n\nGenerated offline from the bundled browser dataset; model **${HEALTHCARE_NEED_VERSION}**.\nOSM snapshot retrieved **${dataset.clinicSnapshot.retrievedAt}**, OSM database base **${dataset.clinicSnapshot.osmBaseTimestamp}**.\nThese are policy assumptions, not fitted clinical coefficients. The alternative is a diagnostic only; it does not change production weights or either separate planner.\n\n| Factor | Production | Alternative |\n| --- | --- | --- |\n${rows}\n\n## Rank stability across ${production.length} barangays\n\n- Top-25 overlap: **${overlap}/25 (${(overlap/25*100).toFixed(0)}%)**.\n- Median absolute competition-rank movement: **${median}** places.\n- Maximum absolute competition-rank movement: **${maximum}** places.\n- Provisional records: production **${production.filter(b=>b.needProvisional).length}**, alternative **${alternative.filter(b=>b.needProvisional).length}**.\n\nTop 25 means exactly 25 records ordered by one-decimal score descending, municipality/name/PSGC tie-break. Shared displayed scores use competition ranks (1,2,2,4). Movement uses those ranks across all barangays, not just top-25 records. Null factors are excluded with available-weight rescaling under each weight set.\n\n### Largest movement\n\n${maxRows}\n\n### Production top 25 compared with the alternative\n\n| PSGC | Barangay | Municipality | Production score | Rank | Alternative score | Rank | Absolute movement |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${topRows}\n\n## Interpretation\n\nHospital distance and clinic measures both proxy access and can overlap; changing their relative emphasis can change priorities even with identical source inputs. Clinic counts are OSM mapping observations, not verified absence or capacity. Straight-line distances are not travel times. Laguna-only scope can overstate access gaps at the provincial edge. Morbidity is synthetic, disaster screening coverage is unverified, and no result should be presented as a clinical or operational fact.\n\nReproduce from \`omcm/frontend\`: \`node --experimental-strip-types scripts/clinic-sensitivity.mjs\`; verify without writes using \`--check\`.\n`;
const output = new URL("docs/CLINIC_SENSITIVITY.md", root);
if (process.argv.includes("--check")) {
  if (await readFile(output, "utf8") !== content) throw new Error("Sensitivity report is stale.");
  console.log("Sensitivity report matches the offline dataset and both policy sets.");
} else {
  await writeFile(output, content, "utf8");
  console.log(`Wrote ${fileURLToPath(output)}; overlap ${overlap}/25; median ${median}; max ${maximum}`);
}
