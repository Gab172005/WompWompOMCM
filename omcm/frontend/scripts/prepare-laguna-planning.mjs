// Reproduce the backend's provincial inputs from the existing shared HNI scorer.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  computeBarangayHealthcareNeed,
  defaultNeedWeights,
  HEALTHCARE_NEED_VERSION,
} from "../src/services/healthcareNeed.ts";

const sourceUrl = new URL("../src/data/laguna-datasets.json", import.meta.url);
const raw = await readFile(sourceUrl);
const source = JSON.parse(raw);
const barangays = computeBarangayHealthcareNeed(source.barangays, source.hospitals, source);
if (barangays.length !== 681 || new Set(barangays.map((b) => b.municipalityPsgc)).size !== 30)
  throw new Error("Provincial planning requires all 681 barangays and 30 LGUs.");
const document = {
  model: HEALTHCARE_NEED_VERSION,
  weights: defaultNeedWeights(),
  sourceSha256: createHash("sha256").update(raw).digest("hex"),
  synthetic: true,
  barangays: barangays.map((b) => ({
    psgc: b.psgc, name: b.name, municipality: b.municipality,
    municipalityPsgc: b.municipalityPsgc, lat: b.lat, lng: b.lng,
    population: b.population, morbidity: b.morbidity,
    adjacentBarangays: b.adjacentBarangays, hazards: b.hazards,
    needScore: b.needScore, needFactors: b.needFactors,
    needCoverage: b.needCoverage, nearestHospital: b.nearestHospital,
  })),
};
const output = new URL("../../backend/data/laguna-planning.json", import.meta.url);
const content = JSON.stringify(document) + "\n";
if (process.argv.includes("--check")) {
  if (await readFile(output, "utf8") !== content)
    throw new Error("Provincial planning snapshot is stale; regenerate it.");
  console.log("Provincial planning matches the shared HNI and all 681 source records.");
} else {
  await writeFile(output, content);
  console.log("Prepared 681 barangays across 30 LGUs using the agreed Balanced HNI.");
}
