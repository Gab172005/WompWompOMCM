import dataset from "../data/laguna-datasets.json";
import type { MapMetric, HospitalFacility } from "../types/municipality";
import type {
  ClinicDataset,
  ClinicSnapshot,
  LocatedOsmClinic,
  OsmClinic,
} from "../types/osmClinic";
import {
  computeBarangayHealthcareNeed,
  HEALTHCARE_NEED_FACTORS,
  isEligibleHospital,
  isLocatedClinic,
  type BarangayHealthcareNeed,
  type NeedFactor,
} from "./healthcareNeed";
export { distanceKm } from "./healthcareNeed";

/**
 * OSM clinic evidence is joined offline by the Python importer and bundled with
 * the generated dataset (`clinics`, `clinicSnapshot`). The browser never calls
 * Overpass and repeats no boundary assignment.
 */
const clinicBundle = dataset as typeof dataset & {
  clinics?: OsmClinic[];
  clinicSnapshot?: ClinicSnapshot;
};

/**
 * The generated snapshot, or an explicitly invalid stand-in when a build has no
 * clinic bundle. An unusable snapshot excludes both clinic factors; it is never
 * read as verified zero provision.
 */
export const OSM_CLINIC_SNAPSHOT: ClinicSnapshot =
  clinicBundle.clinicSnapshot ?? {
    valid: false,
    retrievedAt: null,
    osmBaseTimestamp: null,
    endpoint: null,
    query: null,
    attribution: "© OpenStreetMap contributors",
    license: "Open Database License (ODbL) 1.0",
    rawSha256: null,
    boundarySha256: null,
    counts: {},
    warnings: [
      "No OSM clinic snapshot is bundled with this dataset build, so clinic factors are excluded.",
    ],
  };

const clinicDataset: ClinicDataset = {
  clinics: clinicBundle.clinics ?? [],
  clinicSnapshot: OSM_CLINIC_SNAPSHOT,
};

// Full provenance register, including coordinate-less and lifecycle-only records.
export const PROVIDED_OSM_CLINICS: OsmClinic[] = clinicDataset.clinics;
/**
 * Only clinics that may appear on the map: usable snapshot, active, inside the
 * province, valid WGS84 coordinates and not known to be outside the boundary.
 * Every other record stays in the register above without a marker.
 */
export function mapEligibleOsmClinics(
  clinics: OsmClinic[],
  snapshotValid: boolean,
): LocatedOsmClinic[] {
  if (!snapshotValid) return [];
  return clinics.filter(
    (clinic): clinic is LocatedOsmClinic =>
      clinic.active &&
      clinic.inProvince &&
      clinic.assignmentStatus !== "outside" &&
      isLocatedClinic(clinic),
  );
}
export const MAPPED_OSM_CLINICS: LocatedOsmClinic[] = mapEligibleOsmClinics(
  PROVIDED_OSM_CLINICS,
  OSM_CLINIC_SNAPSHOT.valid,
);

export type BarangayRecord = (typeof dataset.barangays)[number] &
  BarangayHealthcareNeed;
export type HospitalRecord = (typeof dataset.hospitals)[number];
export const LAGUNA_BARANGAYS: BarangayRecord[] = computeBarangayHealthcareNeed(
  dataset.barangays,
  dataset.hospitals,
  clinicDataset,
);
export const RANKED_BARANGAYS = [...LAGUNA_BARANGAYS].sort(
  (a, b) =>
    b.needScore - a.needScore ||
    a.municipality.localeCompare(b.municipality, "en") ||
    a.name.localeCompare(b.name, "en") ||
    a.psgc.localeCompare(b.psgc),
);
export const BARANGAYS_BY_PSGC = new Map(
  LAGUNA_BARANGAYS.map((b) => [b.psgc, b]),
);
export const PROVIDED_HOSPITALS: HospitalRecord[] = dataset.hospitals;
// Historical, unverified and unlocated records remain in PROVIDED_HOSPITALS.
// The map uses exactly the same verified, located evidence as hospital access in HNI.
export const MAPPED_HOSPITALS: HospitalFacility[] =
  PROVIDED_HOSPITALS.filter(isEligibleHospital);

/** Display rollups of the same scored barangays used by both map engines. */
const municipalityNeed = [
  ...new Set(LAGUNA_BARANGAYS.map((b) => b.municipalityPsgc)),
]
  .map((psgc) => {
    const records = LAGUNA_BARANGAYS.filter((b) => b.municipalityPsgc === psgc);
    const population = records.reduce((sum, b) => sum + b.population, 0);
    const mean = (read: (b: BarangayRecord) => number) =>
      records.reduce((sum, b) => sum + read(b) * b.population, 0) / population;
    const needContributions = Object.fromEntries(
      (Object.keys(HEALTHCARE_NEED_FACTORS) as NeedFactor[]).map((factor) => [
        factor,
        records.every((b) => b.needContributions[factor] === null)
          ? null
          : mean((b) => b.needContributions[factor] ?? 0),
      ]),
    ) as Record<NeedFactor, number | null>;
    return {
      psgc,
      density: Math.round(
        population / records.reduce((sum, b) => sum + b.areaKm2, 0),
      ),
      needScore: Math.round(mean((b) => b.needScore) * 10) / 10,
      needCoverage: Math.round(mean((b) => b.needCoverage) * 10) / 10,
      provisionalBarangays: records.filter((b) => b.needProvisional).length,
      barangayCount: records.length,
      needContributions,
    };
  })
  .sort((a, b) => b.needScore - a.needScore || a.psgc.localeCompare(b.psgc));

export const MUNICIPALITY_HEALTHCARE_NEED = new Map(
  municipalityNeed.map((summary) => [
    summary.psgc,
    {
      ...summary,
      needRank:
        1 +
        municipalityNeed.filter((m) => m.needScore > summary.needScore).length,
    },
  ]),
);
// Active, located OSM clinics the importer assigned to each barangay polygon.
// This is separate evidence; it never enters the municipal hospital register.
export const OSM_CLINICS_BY_BARANGAY: Map<string, LocatedOsmClinic[]> =
  new Map();
for (const clinic of MAPPED_OSM_CLINICS) {
  if (
    !clinic.active ||
    clinic.assignmentStatus !== "assigned" ||
    !clinic.barangayPsgc
  )
    continue;
  const records = OSM_CLINICS_BY_BARANGAY.get(clinic.barangayPsgc) ?? [];
  records.push(clinic);
  OSM_CLINICS_BY_BARANGAY.set(clinic.barangayPsgc, records);
}
for (const records of OSM_CLINICS_BY_BARANGAY.values())
  records.sort(
    (a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id),
  );

export const normalizeMunicipality = (value: string) =>
  value
    .toLowerCase()
    .replace(/city of | city/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

export function municipalityDataset(psgc: string) {
  const records = LAGUNA_BARANGAYS.filter((b) => b.municipalityPsgc === psgc);
  const population = records.reduce((sum, b) => sum + b.population, 0);
  const resolved = records.filter((b) => b.disasterRisk !== null);
  const riskPopulation = resolved.reduce((sum, b) => sum + b.population, 0);
  return {
    population,
    morbidity:
      records.reduce((sum, b) => sum + b.morbidity * b.population, 0) /
      population,
    disasterRisk: riskPopulation
      ? Math.round(
          (resolved.reduce(
            (sum, b) => sum + b.disasterRisk! * b.population,
            0,
          ) /
            riskPopulation) *
            100,
        ) / 100
      : null,
    riskRecords: resolved.length,
    barangayCount: records.length,
  };
}

export function barangayMetric(
  b: BarangayRecord,
  metric: MapMetric,
): number | null {
  if (metric === "score") return b.needScore;
  if (metric === "disasterRisk") return b.disasterRisk;
  if (metric === "density") return b.density;
  return b.morbidity;
}

export const barangayMetricLabel = (metric: MapMetric) =>
  metric === "score"
    ? "Healthcare Need Score"
    : metric === "disasterRisk"
      ? "Disaster Risk Score"
      : metric === "density"
        ? "People per square kilometre"
        : "Illness rate (sample data)";
