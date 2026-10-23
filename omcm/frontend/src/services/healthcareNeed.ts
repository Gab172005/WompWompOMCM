/** An explicit planning heuristic using only supplied barangay/hospital inputs. */
export const HEALTHCARE_NEED_VERSION = "barangay-healthcare-need-v2";
export const HEALTHCARE_NEED_FACTORS = {
  morbidity: { label: "Synthetic morbidity", weight: 0.28 },
  disasterRisk: { label: "Disaster risk", weight: 0.2 },
  density: { label: "Population density", weight: 0.16 },
  hospitalAccess: { label: "Hospital distance", weight: 0.16 },
  incomeClass: { label: "Municipality income class", weight: 0.1 },
  urbanRural: { label: "Urban / rural classification", weight: 0.1 },
} as const;
export type NeedFactor = keyof typeof HEALTHCARE_NEED_FACTORS;
type NeedInput = {
  psgc: string;
  name: string;
  municipality: string;
  lat: number;
  lng: number;
  morbidity: number;
  density: number;
  disasterRisk: number | null;
  incomeClass: string | null;
  urbanRural: string | null;
};
type HospitalInput = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  verified: boolean;
};
export interface BarangayHealthcareNeed {
  needScore: number;
  needRank: number;
  needProvisional: boolean;
  needCoverage: number;
  needFactors: Record<NeedFactor, number | null>;
  needContributions: Record<NeedFactor, number | null>;
  nearestHospital: { id: string; name: string; distanceKm: number } | null;
}

/** Ordinal codes from the dataset; unknown values stay unavailable. */
export function incomeClassOrdinal(value: string | null): number | null {
  const classes: Record<string, number> = {
    "1st": 1,
    "2nd": 2,
    "3rd": 3,
    "4th": 4,
    "5th": 5,
    "6th": 6,
  };
  const key =
    value
      ?.trim()
      .toLowerCase()
      .replace(/\s+class$/, "") ?? "";
  return classes[key] ?? null;
}

export function classificationScore(value: string | null): number | null {
  const key = value?.trim().toLowerCase();
  return key === "rural" ? 100 : key === "urban" ? 0 : null;
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return (
    6371 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)))
  );
}

/** Percentile of the average tied rank, from 0 to 100; equal inputs stay equal. */
export function percentileScores(values: (number | null)[]): (number | null)[] {
  const sorted = values
    .filter((n): n is number => n !== null && Number.isFinite(n))
    .sort((a, b) => a - b);
  const percentiles = new Map<number, number>();
  for (let start = 0; start < sorted.length;) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[start]) end++;
    percentiles.set(
      sorted[start],
      sorted.length === 1
        ? 50
        : ((start + end) / 2 / (sorted.length - 1)) * 100,
    );
    start = end + 1;
  }
  return values.map((value) =>
    value === null ? null : (percentiles.get(value) ?? null),
  );
}

export function computeBarangayHealthcareNeed<T extends NeedInput>(
  barangays: T[],
  hospitals: HospitalInput[],
): (T & BarangayHealthcareNeed)[] {
  const locatedHospitals = hospitals.filter(
    (h): h is HospitalInput & { lat: number; lng: number } =>
      h.verified &&
      h.lat !== null &&
      h.lng !== null &&
      Number.isFinite(h.lat) &&
      Number.isFinite(h.lng),
  );
  const nearest = barangays.map((b) => {
    const candidates = locatedHospitals.map((h) => ({
      id: h.id,
      name: h.name,
      distanceKm: distanceKm(b, h),
    }));
    candidates.sort(
      (a, c) => a.distanceKm - c.distanceKm || a.id.localeCompare(c.id),
    );
    return candidates[0] ?? null;
  });
  const morbidity = percentileScores(barangays.map((b) => b.morbidity));
  const density = percentileScores(barangays.map((b) => b.density));
  const access = percentileScores(nearest.map((h) => h?.distanceKm ?? null));
  const incomeOrdinals = barangays.map((b) =>
    incomeClassOrdinal(b.incomeClass),
  );
  const knownClasses = incomeOrdinals.filter(
    (value): value is number => value !== null,
  );
  const minClass = knownClasses.length ? Math.min(...knownClasses) : null;
  const maxClass = knownClasses.length ? Math.max(...knownClasses) : null;
  const factorKeys = Object.keys(HEALTHCARE_NEED_FACTORS) as NeedFactor[];
  const scored = barangays.map((b, index) => {
    if (
      b.disasterRisk !== null &&
      (!Number.isFinite(b.disasterRisk) ||
        b.disasterRisk < 0 ||
        b.disasterRisk > 100)
    ) {
      throw new Error(`Invalid disaster risk index for barangay ${b.psgc}`);
    }
    const factors = {
      morbidity: morbidity[index],
      disasterRisk: b.disasterRisk,
      density: density[index],
      hospitalAccess: access[index],
      incomeClass:
        incomeOrdinals[index] === null || minClass === null || maxClass === null
          ? null
          : minClass === maxClass
            ? 50
            : ((incomeOrdinals[index]! - minClass) / (maxClass - minClass)) *
              100,
      urbanRural: classificationScore(b.urbanRural),
    };
    const coverage = factorKeys.reduce(
      (sum, key) =>
        sum + (factors[key] === null ? 0 : HEALTHCARE_NEED_FACTORS[key].weight),
      0,
    );
    if (coverage === 0)
      throw new Error(`No healthcare need inputs for barangay ${b.psgc}`);
    const contributions = {} as Record<NeedFactor, number | null>;
    let score = 0;
    for (const key of factorKeys) {
      const value = factors[key];
      contributions[key] =
        value === null
          ? null
          : (value * HEALTHCARE_NEED_FACTORS[key].weight) / coverage;
      score += contributions[key] ?? 0;
    }
    return {
      ...b,
      needScore: Math.round(score * 10) / 10,
      needRank: 0,
      needProvisional: coverage < 1 - 1e-9,
      needCoverage: Math.round(coverage * 100),
      needFactors: factors,
      needContributions: contributions,
      nearestHospital: nearest[index],
    };
  });
  // Competition ranking: e.g. 1, 2, 2, 4. Names only order rows within a tie.
  const ordered = [...scored].sort(
    (a, b) =>
      b.needScore - a.needScore ||
      a.municipality.localeCompare(b.municipality, "en") ||
      a.name.localeCompare(b.name, "en") ||
      a.psgc.localeCompare(b.psgc),
  );
  ordered.forEach((b, index) => {
    b.needRank =
      index && b.needScore === ordered[index - 1].needScore
        ? ordered[index - 1].needRank
        : index + 1;
  });
  // Preserve the source order for existing consumers; ranking views sort explicitly.
  return scored;
}
