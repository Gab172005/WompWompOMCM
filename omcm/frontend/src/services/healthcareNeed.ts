/** An explicit planning heuristic using only supplied barangay/hospital/OSM inputs. */
import type { ClinicDataset, LocatedOsmClinic } from "../types/osmClinic";

const isFiniteCoordinate = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Active, in-province, located OSM record usable as clinic distance evidence. */
function usableForClinicDistance(
  clinic: ClinicDataset["clinics"][number],
): clinic is LocatedOsmClinic {
  return (
    clinic.active &&
    clinic.inProvince &&
    clinic.assignmentStatus !== "outside" &&
    clinic.lat !== null &&
    clinic.lng !== null &&
    isFiniteCoordinate(clinic.lat) &&
    isFiniteCoordinate(clinic.lng) &&
    clinic.lat >= -90 &&
    clinic.lat <= 90 &&
    clinic.lng >= -180 &&
    clinic.lng <= 180
  );
}

/** Located records for map consumers: coordinates present, finite and in range. */
export function isLocatedClinic<
  T extends { lat: number | null; lng: number | null },
>(clinic: T): clinic is T & { lat: number; lng: number } {
  return (
    clinic.lat !== null &&
    clinic.lng !== null &&
    isFiniteCoordinate(clinic.lat) &&
    isFiniteCoordinate(clinic.lng) &&
    clinic.lat >= -90 &&
    clinic.lat <= 90 &&
    clinic.lng >= -180 &&
    clinic.lng <= 180
  );
}

export const HEALTHCARE_NEED_VERSION = "barangay-healthcare-need-v3";
export const HEALTHCARE_NEED_FACTORS = {
  morbidity: { label: "Synthetic morbidity", weight: 0.25 },
  hospitalAccess: { label: "Hospital distance", weight: 0.3 },
  disasterRisk: { label: "Disaster risk", weight: 0.15 },
  density: { label: "Population density", weight: 0.1 },
  incomeClass: { label: "Municipality income class", weight: 0.1 },
  clinicDistance: { label: "Clinic distance", weight: 0.05 },
  clinicProvision: { label: "Clinic provision deficit", weight: 0.05 },
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
  population?: number | null;
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
  clinicCount: number | null;
  clinicsPer10000: number | null;
  nearestClinic: { id: string; name: string; distanceKm: number } | null;
  clinicWarnings: string[];
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

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isPositive = (value: unknown): value is number =>
  isFiniteNumber(value) && value > 0;

/** Code-point lexicographic ordering for stable raw OSM/hospital IDs. */
const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * A usable WGS84 point, or null. Explicit null means "not located"; a present
 * but non-numeric or out-of-range coordinate is invalid and is never measured.
 */
function validPoint(point: {
  lat: number | null;
  lng: number | null;
}): { lat: number; lng: number } | null {
  const { lat, lng } = point;
  if (lat === null || lat === undefined || lng === null || lng === undefined)
    return null;
  return isFiniteNumber(lat) &&
    isFiniteNumber(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
    ? { lat, lng }
    : null;
}

/** One eligibility rule for hospital markers, nearest lists and HNI evidence. */
export function isEligibleHospital<T extends HospitalInput>(
  hospital: T,
): hospital is T & { lat: number; lng: number } {
  return hospital.verified && validPoint(hospital) !== null;
}

export function hospitalsByDistance<T extends HospitalInput>(
  point: { lat: number; lng: number },
  hospitals: T[],
) {
  if (!validPoint(point)) return [];
  return hospitals
    .filter(isEligibleHospital)
    .map((hospital) => ({
      ...hospital,
      distanceKm: distanceKm(point, hospital),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm || compareIds(a.id, b.id));
}

/**
 * Active OSM clinics assigned to exactly this barangay polygon. Assignment alone
 * is not enough: the record must also be in-province and carry valid WGS84
 * coordinates, so an inactive, outside or out-of-range record cannot inflate a
 * count.
 */
function assignedClinicCount(clinics: ClinicDataset["clinics"], psgc: string) {
  return clinics.filter(
    (clinic) =>
      usableForClinicDistance(clinic) &&
      clinic.assignmentStatus === "assigned" &&
      clinic.barangayPsgc === psgc,
  ).length;
}

interface ClinicAccess {
  /** Active located OSM clinics whose polygon assignment is this barangay. */
  clinicCount: number | null;
  clinicsPer10000: number | null;
  nearestClinic: { id: string; name: string; distanceKm: number } | null;
  /** Percentile of nearest-clinic distance (higher = farther). */
  distancePercentile: number | null;
  /** Deficit score: 100 − percentile of clinics per 10,000 residents. */
  provisionDeficit: number | null;
  warnings: string[];
}

/**
 * OSM clinic measures for every barangay. The clinic snapshot must be valid for
 * any clinic factor to exist; an invalid population removes only provision, and
 * no eligible in-province located clinic removes only distance. Counts use
 * assigned active clinics only, including a genuine zero.
 */
export function clinicAccessByBarangay<
  T extends {
    psgc: string;
    lat: number;
    lng: number;
    population?: number | null;
  },
>(barangays: T[], dataset?: ClinicDataset): Map<string, ClinicAccess> {
  const result = new Map<string, ClinicAccess>();
  const snapshotValid = Boolean(dataset?.clinicSnapshot?.valid);
  const clinics = snapshotValid ? (dataset?.clinics ?? []) : [];
  // Eligible as distance evidence: active, located, in-province records that
  // are not known to lie outside Laguna. Assigned, ambiguous and in-province
  // unassigned records qualify; excluded records never contribute a distance.
  const distanceCandidates = clinics.filter(usableForClinicDistance);
  const nearestByPsgc = new Map<
    string,
    { id: string; name: string; distanceKm: number } | null
  >();
  if (snapshotValid && distanceCandidates.length) {
    for (const barangay of barangays) {
      // An invalid barangay point yields no distance instead of a NaN one.
      const point = validPoint(barangay);
      const ranked = point
        ? distanceCandidates
            .map((clinic) => ({
              id: clinic.id,
              name: clinic.name,
              distanceKm: distanceKm(point, clinic),
            }))
            .sort(
              (a, b) => a.distanceKm - b.distanceKm || compareIds(a.id, b.id),
            )
        : [];
      nearestByPsgc.set(barangay.psgc, ranked[0] ?? null);
    }
  }
  const distancePercentiles = percentileScores(
    barangays.map(
      (barangay) => nearestByPsgc.get(barangay.psgc)?.distanceKm ?? null,
    ),
  );
  const provisionValues = barangays.map((barangay) => {
    if (!isPositive(barangay.population)) return null;
    return (
      (assignedClinicCount(clinics, barangay.psgc) / barangay.population) *
      10000
    );
  });
  const provisionPercentiles = percentileScores(provisionValues);
  // Located in the Laguna polygon but in no barangay polygon: usable for
  // province-wide distance, never counted for a barangay.
  const inProvinceUnassigned = clinics.filter(
    (clinic) =>
      usableForClinicDistance(clinic) &&
      clinic.assignmentStatus !== "assigned" &&
      clinic.assignmentStatus !== "ambiguous",
  ).length;
  barangays.forEach((barangay, index) => {
    const warnings: string[] = [];
    if (!snapshotValid) {
      result.set(barangay.psgc, {
        clinicCount: null,
        clinicsPer10000: null,
        nearestClinic: null,
        distancePercentile: null,
        provisionDeficit: null,
        warnings: [
          "Clinic snapshot unavailable or invalid: both clinic factors are excluded and are not treated as zero provision.",
        ],
      });
      return;
    }
    // The count stays a count even when population is unusable; only the
    // per-10,000 rate and the provision factor depend on population.
    const clinicCount = assignedClinicCount(clinics, barangay.psgc);
    const per10000 =
      isPositive(barangay.population) && provisionValues[index] !== null
        ? provisionValues[index]
        : null;
    if (per10000 === null)
      warnings.push(
        "Population is missing or not positive, so clinics per 10,000 residents cannot be computed; clinic provision is excluded and is not treated as zero.",
      );
    const nearest = nearestByPsgc.get(barangay.psgc) ?? null;
    if (!distanceCandidates.length)
      warnings.push(
        "No active located OSM clinic is available in the province snapshot, so clinic distance is excluded.",
      );
    else if (!nearest)
      warnings.push(
        "This barangay has no usable WGS84 point, so clinic distance is excluded.",
      );
    const provisionPercentile = provisionPercentiles[index];
    if (per10000 !== null && provisionPercentile === null)
      warnings.push(
        "No comparable clinics-per-10,000 value exists across barangays, so clinic provision is excluded.",
      );
    if (nearest) {
      const nearestClinic = distanceCandidates.find(
        (clinic) => clinic.id === nearest.id,
      );
      if (nearestClinic?.assignmentStatus === "ambiguous")
        warnings.push(
          `Nearest OSM clinic ${nearestClinic.id} lies in more than one barangay boundary. It is kept as distance evidence and excluded from clinic counts.`,
        );
      else if (nearestClinic?.barangayPsgc !== barangay.psgc)
        warnings.push(
          `Nearest OSM clinic ${nearestClinic!.id} is not assigned to this barangay. Distance is province-wide and may come from a neighbouring barangay.`,
        );
      for (const warning of nearestClinic?.warnings ?? [])
        if (
          warning.startsWith("Ambiguous barangay assignment") ||
          warning.startsWith("Suspected duplicate")
        )
          warnings.push(warning);
    }
    if (inProvinceUnassigned)
      warnings.push(
        `${inProvinceUnassigned} active OSM clinic record(s) inside the Laguna polygon but in no barangay polygon are eligible for clinic distance and excluded from barangay counts; no barangay was guessed.`,
      );
    for (const warning of dataset?.clinicSnapshot?.warnings ?? [])
      if (typeof warning === "string" && warning.length) warnings.push(warning);
    result.set(barangay.psgc, {
      clinicCount,
      clinicsPer10000: per10000,
      nearestClinic: nearest,
      distancePercentile: distancePercentiles[index],
      provisionDeficit:
        provisionPercentile === null ? null : 100 - provisionPercentile,
      warnings,
    });
  });
  return result;
}

/** Production weights, optionally overridden by complete, validated weights. */
function resolveWeights(
  weights?: Record<NeedFactor, number>,
): Record<NeedFactor, number> {
  const factorWeights: Record<NeedFactor, number> = {
    ...defaultNeedWeights(),
    ...(weights ?? {}),
  };
  let total = 0;
  for (const key of Object.keys(HEALTHCARE_NEED_FACTORS) as NeedFactor[]) {
    const weight = factorWeights[key];
    if (!isFiniteNumber(weight) || weight < 0)
      throw new Error(`Invalid healthcare need weight for ${key}`);
    total += weight;
  }
  if (Math.abs(total - 1) > 1e-9)
    throw new Error(
      `Healthcare need weights must be non-negative and total 1; received ${total}`,
    );
  return factorWeights;
}

export function computeBarangayHealthcareNeed<T extends NeedInput>(
  barangays: T[],
  hospitals: HospitalInput[],
  clinicDataset?: ClinicDataset,
  weights?: Record<NeedFactor, number>,
): (T & BarangayHealthcareNeed)[] {
  const factorWeights = resolveWeights(weights);
  const nearest = barangays.map((barangay) => {
    const hospital = hospitalsByDistance(barangay, hospitals)[0];
    return hospital
      ? {
          id: hospital.id,
          name: hospital.name,
          distanceKm: hospital.distanceKm,
        }
      : null;
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
  const clinicAccess = clinicAccessByBarangay(barangays, clinicDataset);
  const factorKeys = Object.keys(HEALTHCARE_NEED_FACTORS) as NeedFactor[];
  const scored = barangays.map((b, index) => {
    const clinics = clinicAccess.get(b.psgc)!;
    const disasterRisk =
      isFiniteNumber(b.disasterRisk) &&
      b.disasterRisk >= 0 &&
      b.disasterRisk <= 100
        ? b.disasterRisk
        : null;
    const factors = {
      morbidity: morbidity[index],
      disasterRisk,
      density: density[index],
      hospitalAccess: access[index],
      incomeClass:
        incomeOrdinals[index] === null || minClass === null || maxClass === null
          ? null
          : minClass === maxClass
            ? 50
            : ((incomeOrdinals[index]! - minClass) / (maxClass - minClass)) *
              100,
      clinicDistance: clinics.distancePercentile,
      clinicProvision: clinics.provisionDeficit,
    };
    // urbanRural is deliberately absent: it is context, never a scored factor.
    const coverage = factorKeys.reduce(
      (sum, key) => sum + (factors[key] === null ? 0 : factorWeights[key]),
      0,
    );
    if (coverage === 0)
      throw new Error(`No healthcare need inputs for barangay ${b.psgc}`);
    const contributions = {} as Record<NeedFactor, number | null>;
    let score = 0;
    for (const key of factorKeys) {
      const value = factors[key];
      contributions[key] =
        value === null ? null : (value * factorWeights[key]) / coverage;
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
      clinicCount: clinics.clinicCount,
      clinicsPer10000: clinics.clinicsPer10000,
      nearestClinic: clinics.nearestClinic,
      clinicWarnings: clinics.warnings,
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

export function defaultNeedWeights(): Record<NeedFactor, number> {
  return Object.fromEntries(
    (Object.keys(HEALTHCARE_NEED_FACTORS) as NeedFactor[]).map((key) => [
      key,
      HEALTHCARE_NEED_FACTORS[key].weight,
    ]),
  ) as Record<NeedFactor, number>;
}
