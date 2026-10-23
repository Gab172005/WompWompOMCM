import dataset from "../data/laguna-datasets.json";
import type { MapMetric, HospitalFacility } from "../types/municipality";

export type BarangayRecord = (typeof dataset.barangays)[number];
export type HospitalRecord = (typeof dataset.hospitals)[number];
export const LAGUNA_BARANGAYS: BarangayRecord[] = dataset.barangays;
export const BARANGAYS_BY_PSGC = new Map(
  LAGUNA_BARANGAYS.map((b) => [b.psgc, b]),
);
export const PROVIDED_HOSPITALS: HospitalRecord[] = dataset.hospitals;
// Keep records without a verified location in the register, without inventing map points.
export const MAPPED_HOSPITALS: HospitalFacility[] = PROVIDED_HOSPITALS.filter(
  (h): h is HospitalRecord & { lat: number; lng: number } =>
    h.lat !== null && h.lng !== null,
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
  // Healthcare need is a municipality estimate; do not invent barangay scores.
  if (metric === "score") return null;
  if (metric === "disasterRisk") return b.disasterRisk;
  if (metric === "density") return b.density;
  return b.morbidity;
}

export const barangayMetricLabel = (metric: MapMetric) =>
  metric === "score" || metric === "disasterRisk"
    ? "Disaster risk index"
    : metric === "density"
      ? "Population density"
      : "Synthetic morbidity rate";

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad,
    dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
