import { describe, expect, it } from "vitest";
import {
  HEALTHCARE_NEED_FACTORS,
  HEALTHCARE_NEED_VERSION,
  clinicAccessByBarangay,
  computeBarangayHealthcareNeed,
  defaultNeedWeights,
  distanceKm,
  incomeClassOrdinal,
  isLocatedClinic,
  percentileScores,
  type NeedFactor,
} from "../../frontend/src/services/healthcareNeed";
import type {
  ClinicDataset,
  ClinicSnapshot,
  LocatedOsmClinic,
  OsmClinic,
} from "../../frontend/src/types/osmClinic";
import {
  LAGUNA_BARANGAYS,
  MAPPED_OSM_CLINICS,
  OSM_CLINIC_SNAPSHOT,
  PROVIDED_HOSPITALS,
  PROVIDED_OSM_CLINICS,
  RANKED_BARANGAYS,
  barangayMetric,
} from "../../frontend/src/services/providedData";

const PRODUCTION: Record<NeedFactor, number> = {
  morbidity: 0.25,
  hospitalAccess: 0.3,
  disasterRisk: 0.15,
  density: 0.1,
  incomeClass: 0.1,
  clinicDistance: 0.05,
  clinicProvision: 0.05,
};
const ALTERNATIVE: Record<NeedFactor, number> = {
  morbidity: 0.2,
  hospitalAccess: 0.4,
  disasterRisk: 0.15,
  density: 0.05,
  incomeClass: 0.1,
  clinicDistance: 0.05,
  clinicProvision: 0.05,
};

const hospital = {
  id: "H1",
  name: "Verified hospital",
  lat: 0,
  lng: 0,
  verified: true,
};
/** Three barangays one degree apart, with a known population and income class. */
const rows = [
  {
    psgc: "A",
    name: "A",
    municipality: "Town",
    lat: 0,
    lng: 0,
    population: 1000 as number | null,
    morbidity: 10,
    density: 100,
    disasterRisk: 0 as number | null,
    incomeClass: "1st",
    urbanRural: "Urban",
  },
  {
    psgc: "B",
    name: "B",
    municipality: "Town",
    lat: 0,
    lng: 1,
    population: 2000 as number | null,
    morbidity: 20,
    density: 200,
    disasterRisk: 50 as number | null,
    incomeClass: "2nd",
    urbanRural: "Urban",
  },
  {
    psgc: "C",
    name: "C",
    municipality: "Town",
    lat: 0,
    lng: 2,
    population: 3000 as number | null,
    morbidity: 30,
    density: 300,
    disasterRisk: 100 as number | null,
    incomeClass: "3rd",
    urbanRural: "Rural",
  },
];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let nextId = 0;
function clinic(
  overrides: Partial<OsmClinic> & { lat?: number | null; lng?: number | null },
): OsmClinic {
  nextId += 1;
  const id = overrides.id ?? `node/${nextId}`;
  const lat = overrides.lat === undefined ? 0 : overrides.lat;
  const lng = overrides.lng === undefined ? 0 : overrides.lng;
  return {
    id,
    osmType: "node",
    osmId: nextId,
    name: `Clinic ${nextId}`,
    locationMethod: lat === null || lng === null ? "unavailable" : "node",
    tags: { amenity: "clinic" },
    active: true,
    inProvince: true,
    barangayPsgc: null,
    municipalityPsgc: null,
    assignmentStatus: "assigned",
    warnings: [],
    ...overrides,
    lat,
    lng,
  };
}
function snapshot(overrides: Partial<ClinicSnapshot> = {}): ClinicSnapshot {
  return {
    valid: true,
    retrievedAt: "2026-10-23T17:32:47.575509+00:00",
    osmBaseTimestamp: "2026-10-23T17:31:38Z",
    endpoint: "https://overpass-api.de/api/interpreter",
    query: "[out:json];",
    attribution: "© OpenStreetMap contributors",
    license: "Open Database License (ODbL) 1.0",
    rawSha256: "0".repeat(64),
    boundarySha256: null,
    counts: {},
    warnings: [],
    ...overrides,
  };
}
function dataset(
  clinics: OsmClinic[],
  overrides: Partial<ClinicSnapshot> = {},
): ClinicDataset {
  return { clinics, clinicSnapshot: snapshot(overrides) };
}
const factorSum = (b: { needContributions: Record<NeedFactor, number | null> }) =>
  Object.values(b.needContributions).reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );

describe("Healthcare need weights", () => {
  it("freezes the production weights at 1 and keeps hospital access", () => {
    expect(HEALTHCARE_NEED_VERSION).toBe("barangay-healthcare-need-v3");
    expect(defaultNeedWeights()).toEqual(PRODUCTION);
    for (const [key, factor] of Object.entries(HEALTHCARE_NEED_FACTORS))
      expect(factor.weight).toBe(PRODUCTION[key as NeedFactor]);
    expect(HEALTHCARE_NEED_FACTORS.clinicDistance.label).toBe("Clinic distance");
    expect(HEALTHCARE_NEED_FACTORS.clinicProvision.label).toBe(
      "Clinic provision deficit",
    );
    expect(Object.keys(HEALTHCARE_NEED_FACTORS)).not.toContain("urbanRural");
    expect(
      Object.values(HEALTHCARE_NEED_FACTORS).reduce(
        (sum, factor) => sum + factor.weight,
        0,
      ),
    ).toBeCloseTo(1, 12);
  });
  it("rejects custom weights that are negative, non-finite or do not total 1", () => {
    const call = (weights: Record<NeedFactor, number>) =>
      computeBarangayHealthcareNeed(rows, [hospital], undefined, weights);
    expect(() => call({ ...PRODUCTION, morbidity: -0.1 })).toThrow(
      "Invalid healthcare need weight for morbidity",
    );
    expect(() => call({ ...PRODUCTION, clinicDistance: Number.NaN })).toThrow(
      "Invalid healthcare need weight for clinicDistance",
    );
    expect(() =>
      call({ ...PRODUCTION, incomeClass: Number.POSITIVE_INFINITY }),
    ).toThrow("Invalid healthcare need weight for incomeClass");
    expect(() => call({ ...PRODUCTION, density: 0.2 })).toThrow(
      "must be non-negative and total 1",
    );
    // A complete identical copy is accepted; partial overrides are completed.
    expect(call({ ...PRODUCTION }).map((b) => b.needScore)).toEqual(
      computeBarangayHealthcareNeed(rows, [hospital]).map((b) => b.needScore),
    );
    expect(
      call({ ...PRODUCTION, disasterRisk: 0.2, density: 0.05 }).map(
        (b) => b.needCoverage,
      ),
    ).toEqual([90, 90, 90]);
  });
});

describe("Barangay healthcare need model", () => {
  it("scores without a clinic snapshot through explicit weights and rescaling", () => {
    const scored = computeBarangayHealthcareNeed(rows, [hospital]);
    expect(scored.map((b) => b.needCoverage)).toEqual([90, 90, 90]);
    expect(scored.every((b) => b.needProvisional)).toBe(true);
    expect(scored.every((b) => b.needContributions.clinicDistance === null)).toBe(
      true,
    );
    expect(scored.every((b) => b.needContributions.clinicProvision === null)).toBe(
      true,
    );
    expect(scored.every((b) => b.clinicCount === null)).toBe(true);
    expect(scored.every((b) => b.clinicsPer10000 === null)).toBe(true);
    expect(scored.every((b) => b.nearestClinic === null)).toBe(true);
    expect(
      scored.every((b) =>
        b.clinicWarnings[0]?.includes("Clinic snapshot unavailable or invalid"),
      ),
    ).toBe(true);
    // With unavailable clinic factors, coverage is 90%; available percentiles
    // still span the neutral 0/50/100 ordering.
    expect(scored.map((b) => b.needScore)).toEqual([0, 50, 100]);
    expect(scored.map((b) => b.needRank)).toEqual([3, 2, 1]);
    for (const b of scored) expect(factorSum(b)).toBeCloseTo(b.needScore, 0);
  });
  it("rescales risk coverage and keeps invalid risk unavailable", () => {
    const invalidRiskRows = rows.map((b) => ({
      ...b,
      disasterRisk: b.psgc === "B" ? Number.NaN : b.disasterRisk,
    }));
    const scored = computeBarangayHealthcareNeed(invalidRiskRows, [hospital]);
    expect(scored[1].needCoverage).toBe(75);
    expect(scored[1].needFactors.disasterRisk).toBeNull();
    expect(scored[1].needContributions.disasterRisk).toBeNull();
    expect(scored[1].needScore).toBe(50);
    const outOfRange = computeBarangayHealthcareNeed(
      rows.map((b) => ({
        ...b,
        disasterRisk: b.psgc === "B" ? 101 : b.disasterRisk,
      })),
      [hospital],
    )[1];
    expect(outOfRange.needCoverage).toBe(75);
    expect(outOfRange.needFactors.disasterRisk).toBeNull();
  });
  it("uses Haversine kilometers and code-point ordering for tied raw IDs", () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(
      111.195,
      2,
    );
    const tied = computeBarangayHealthcareNeed(
      [rows[0]],
      [hospital],
      dataset([
        clinic({ id: "node/2", lat: 0, lng: 1 }),
        clinic({ id: "node/10", lat: 0, lng: -1 }),
      ]),
    );
    // IDs are compared as raw code points, not locale/numeric collation.
    expect(tied[0].nearestClinic!.id).toBe("node/10");
  });
  it("applies the stated contributions to every supplied input", () => {
    const clinics = [
      clinic({ id: "node/1", lat: 0, lng: 0, barangayPsgc: "A" }),
      clinic({ id: "node/2", lat: 0, lng: 1, barangayPsgc: "B" }),
      clinic({ id: "node/3", lat: 0, lng: 1, barangayPsgc: "B" }),
      clinic({ id: "node/4", lat: 0, lng: 2, barangayPsgc: "C" }),
    ];
    const scored = computeBarangayHealthcareNeed(
      rows,
      [hospital],
      dataset(clinics),
    );
    expect(scored.every((b) => b.needCoverage === 100)).toBe(true);
    expect(scored.every((b) => !b.needProvisional)).toBe(true);
    expect(scored.map((b) => b.clinicCount)).toEqual([1, 2, 1]);
    for (const [index, expected] of [10, 10, 10 / 3].entries())
      expect(scored[index].clinicsPer10000).toBeCloseTo(expected, 12);
    // All three nearest clinics are colocated with their barangay points, so
    // distance ties at 50. A/B tie at a rate of 10 (deficit percentile 75);
    // C's lower rate gives it the unique maximum deficit 100.
    expect(scored.map((b) => b.needFactors.clinicDistance)).toEqual([
      50, 50, 50,
    ]);
    expect(scored.map((b) => b.needFactors.clinicProvision)).toEqual([
      25, 25, 100,
    ]);
    expect(scored[0].needFactors).toMatchObject({
      morbidity: 0,
      disasterRisk: 0,
      density: 0,
      hospitalAccess: 0,
      incomeClass: 0,
    });
    for (const [key, weight] of Object.entries(PRODUCTION))
      expect(scored[0].needContributions[key as NeedFactor]).toBeCloseTo(
        (scored[0].needFactors[key as NeedFactor]! * weight) / 1,
        10,
      );
    expect(scored[0].needScore).toBe(3.8);
    expect(scored[2].needFactors.clinicDistance).toBe(50);
    expect(scored[2].needFactors.clinicProvision).toBe(100);
    expect(scored[2].needContributions.clinicProvision).toBeCloseTo(5, 12);
    expect(scored.map((b) => b.needScore)).toEqual([3.8, 48.8, 97.5]);
    expect(scored.map((b) => b.needRank)).toEqual([3, 2, 1]);
  });
  it("rescales a missing disaster risk instead of treating it as zero", () => {
    const missing = computeBarangayHealthcareNeed(
      rows.map((b) => ({
        ...b,
        disasterRisk: b.psgc === "B" ? null : b.disasterRisk,
      })),
      [hospital],
    )[1];
    const zero = computeBarangayHealthcareNeed(
      rows.map((b) => ({
        ...b,
        disasterRisk: b.psgc === "B" ? 0 : b.disasterRisk,
      })),
      [hospital],
    )[1];
    expect(missing).toMatchObject({
      needCoverage: 75,
      needProvisional: true,
    });
    expect(missing.needContributions.disasterRisk).toBeNull();
    // B without risk: the 75% that remains is rescaled, so all-50 inputs stay 50.
    expect(missing.needScore).toBe(50);
    // Zero risk is observed, while the absent clinic snapshot still excludes 10%.
    expect(zero.needScore).toBe(41.7); // (50 × 0.75 + 0 × 0.15) / 0.90
    expect(zero.needProvisional).toBe(true);
    expect(zero.needCoverage).toBe(90);
  });
  it("withholds only clinic factors when the snapshot is invalid or missing", () => {
    const clinics = [clinic({ lat: 0, lng: 0, barangayPsgc: "B", id: "node/9" })];
    const scored = computeBarangayHealthcareNeed(
      rows,
      [hospital],
      dataset(clinics, { valid: false }),
    );
    expect(scored.map((b) => b.needCoverage)).toEqual([90, 90, 90]);
    expect(scored[1].clinicCount).toBeNull();
    expect(scored[1].nearestClinic).toBeNull();
    expect(scored[1].clinicWarnings.join(" ")).toContain("snapshot");
    expect(
      computeBarangayHealthcareNeed(rows, [hospital], {
        clinics,
        clinicSnapshot: snapshot({ valid: false }),
      }).map((b) => b.needScore),
    ).toEqual(scored.map((b) => b.needScore));
  });
  it("keeps a valid zero count as observed zero provision rather than absence", () => {
    const clinics = [
      clinic({ id: "node/1", lat: 0, lng: 1, barangayPsgc: "B" }),
      clinic({ id: "node/2", lat: 0, lng: 1, barangayPsgc: "B" }),
      clinic({ id: "node/3", lat: 0, lng: 2, barangayPsgc: "C" }),
      clinic({ id: "node/4", lat: 0, lng: 1.1, assignmentStatus: "unlocated" }),
    ];
    const scored = computeBarangayHealthcareNeed(
      rows,
      [hospital],
      dataset(clinics),
    );
    expect(scored[0].clinicCount).toBe(0);
    expect(scored[0].clinicsPer10000).toBe(0);
    expect(scored[0].needFactors.clinicProvision).toBe(100);
    // A is the unique farthest from a clinic and has zero assigned provision;
    // both factors are exact unique extrema, each contributing five points.
    expect(scored[0].needFactors.clinicDistance).toBe(100);
    expect(scored[0].needFactors.clinicProvision).toBe(100);
    expect(scored[0].needContributions.clinicProvision).toBeCloseTo(5, 10);
    expect(scored[0].needScore).toBe(10);
    expect(scored[0].needFactors.clinicDistance).not.toBeNull();
    expect(scored[0].needCoverage).toBe(100);
  });
  it("gives neutral 50 provision when every barangay has an equal rate, including zero", () => {
    const allZero = computeBarangayHealthcareNeed(
      rows.map((b) => ({ ...b, population: 2500 })),
      [hospital],
      dataset([]),
    );
    expect(allZero.map((b) => b.clinicCount)).toEqual([0, 0, 0]);
    expect(allZero.map((b) => b.needFactors.clinicProvision)).toEqual([
      50, 50, 50,
    ]);
    // No eligible located clinic: distance is excluded, provision stays valid.
    expect(allZero.map((b) => b.needFactors.clinicDistance)).toEqual([
      null, null, null,
    ]);
    expect(allZero.map((b) => b.needCoverage)).toEqual([95, 95, 95]);
    expect(allZero.map((b) => b.nearestClinic)).toEqual([null, null, null]);
    const equalRates = computeBarangayHealthcareNeed(
      rows,
      [hospital],
      dataset([
        clinic({ id: "node/1", lat: 0, lng: 0, barangayPsgc: "A" }),
        clinic({ id: "node/2", lat: 0, lng: 1, barangayPsgc: "B" }),
        clinic({ id: "node/3", lat: 0, lng: 1, barangayPsgc: "B" }),
        clinic({ id: "node/4", lat: 0, lng: 2, barangayPsgc: "C" }),
        clinic({ id: "node/5", lat: 0, lng: 2, barangayPsgc: "C" }),
        clinic({ id: "node/6", lat: 0, lng: 2, barangayPsgc: "C" }),
      ]),
    );
    expect(equalRates.map((b) => b.clinicsPer10000)).toEqual([10, 10, 10]);
    expect(equalRates.map((b) => b.needFactors.clinicProvision)).toEqual([
      50, 50, 50,
    ]);
  });
  it("excludes only provision when population is invalid, keeping the count", () => {
    const clinics = [clinic({ id: "node/1", lat: 0, lng: 1, barangayPsgc: "B" })];
    const scored = computeBarangayHealthcareNeed(
      rows.map((b) => ({
        ...b,
        population: b.psgc === "B" ? null : b.population,
      })),
      [hospital],
      dataset(clinics),
    );
    expect(scored[1].clinicCount).toBe(1);
    expect(scored[1].clinicsPer10000).toBeNull();
    expect(scored[1].needFactors.clinicProvision).toBeNull();
    expect(scored[1].needFactors.clinicDistance).not.toBeNull();
    expect(scored[1].needCoverage).toBe(95);
    expect(scored[1].clinicWarnings.join(" ")).toContain("Population");
    expect(scored[0].needFactors.clinicProvision).not.toBeNull();
    const nonPositive = computeBarangayHealthcareNeed(
      rows.map((b) => ({ ...b, population: b.psgc === "B" ? 0 : b.population })),
      [hospital],
      dataset(clinics),
    );
    expect(nonPositive[1].clinicCount).toBe(1);
    expect(nonPositive[1].clinicsPer10000).toBeNull();
    expect(nonPositive[1].needFactors.clinicProvision).toBeNull();
    const nonFinite = computeBarangayHealthcareNeed(
      rows.map((b) => ({
        ...b,
        population: b.psgc === "B" ? Number.NaN : b.population,
      })),
      [hospital],
      dataset(clinics),
    );
    expect(nonFinite[1].needFactors.clinicProvision).toBeNull();
  });
  it("measures the nearest clinic across barangay boundaries and breaks ties by id", () => {
    const clinics = [
      clinic({ id: "node/9", lat: 0, lng: 0.5, barangayPsgc: "A" }),
      clinic({ id: "node/2", lat: 0, lng: 1.5, barangayPsgc: "C" }),
    ];
    const scored = computeBarangayHealthcareNeed(
      rows,
      [hospital],
      dataset(clinics),
    );
    expect(scored[0].nearestClinic).toMatchObject({ id: "node/9" });
    // A straight-line Haversine distance of half a degree at the equator.
    expect(scored[0].nearestClinic!.distanceKm).toBeCloseTo(55.6, 1);
    expect(scored[1].nearestClinic).toMatchObject({ id: "node/2" });
    expect(scored[1].nearestClinic!.distanceKm).toBeCloseTo(55.6, 1);
    expect(scored[2].nearestClinic).toMatchObject({ id: "node/2" });
    // B has no assigned clinic, so its distance is evidence, not a barangay facility.
    expect(scored[1].clinicCount).toBe(0);
    expect(scored[1].clinicWarnings.join(" ")).toContain(
      "not assigned to this barangay",
    );
    const tied = computeBarangayHealthcareNeed(
      rows,
      [hospital],
      dataset([
        clinic({ id: "node/5", lat: 0, lng: 0.5 }),
        clinic({ id: "node/4", lat: 0, lng: -0.5 }),
      ]),
    );
    expect(tied[0].nearestClinic!.id).toBe("node/4");
    const reversed = computeBarangayHealthcareNeed(
      rows,
      [hospital],
      dataset([
        clinic({ id: "node/4", lat: 0, lng: -0.5 }),
        clinic({ id: "node/5", lat: 0, lng: 0.5 }),
      ]),
    );
    expect(
      reversed.map((b) => [b.needScore, b.nearestClinic?.id]),
    ).toEqual(tied.map((b) => [b.needScore, b.nearestClinic?.id]));
  });
  it("ignores inactive, outside and unlocated records but keeps ambiguous distance", () => {
    const clinics = [
      clinic({ id: "node/1", lat: 0, lng: 0.2, active: false }),
      clinic({ id: "node/2", lat: 0, lng: 0.3, inProvince: false }),
      clinic({ id: "node/3", lat: null, lng: null }),
      clinic({
        id: "node/4",
        lat: 0,
        lng: 0.4,
        assignmentStatus: "ambiguous",
      }),
    ];
    const scored = computeBarangayHealthcareNeed(
      rows,
      [hospital],
      dataset(clinics),
    );
    expect(scored.map((b) => b.clinicCount)).toEqual([0, 0, 0]);
    expect(scored[0].nearestClinic).toMatchObject({ id: "node/4" });
    expect(scored[0].clinicWarnings.join(" ")).toContain(
      "more than one barangay boundary",
    );
    const onlyExcluded = computeBarangayHealthcareNeed(
      rows,
      [hospital],
      dataset([
        clinic({ id: "node/1", lat: 0, lng: 0, active: false }),
        clinic({ id: "node/2", lat: 0, lng: 0, inProvince: false }),
        clinic({ id: "node/3", lat: null, lng: null }),
      ]),
    );
    expect(onlyExcluded.map((b) => b.nearestClinic)).toEqual([null, null, null]);
    expect(onlyExcluded.map((b) => b.needFactors.clinicDistance)).toEqual([
      null, null, null,
    ]);
  });
  it("rejects invalid hospital coordinates and barangay points without NaN", () => {
    const result = computeBarangayHealthcareNeed(rows, [
      hospital,
      { ...hospital, id: "closed", lng: 2, verified: false },
      { ...hospital, id: "unlocated", lat: null },
      { ...hospital, id: "out-of-range", lat: 91, lng: 0 },
      { ...hospital, id: "nan", lat: Number.NaN, lng: 0 },
    ]);
    expect(result[2].nearestHospital?.id).toBe("H1");
    expect(result[2].nearestHospital!.distanceKm).toBeCloseTo(222.39, 1);
    const invalidPoint = computeBarangayHealthcareNeed(
      [{ ...rows[0], lat: Number.NaN }],
      [hospital],
      dataset([clinic({ id: "node/1", lat: 0, lng: 0 })]),
    )[0];
    expect(invalidPoint.nearestHospital).toBeNull();
    expect(invalidPoint.nearestClinic).toBeNull();
    expect(invalidPoint.needFactors.hospitalAccess).toBeNull();
    expect(invalidPoint.needFactors.clinicDistance).toBeNull();
    expect(invalidPoint.needFactors.clinicProvision).not.toBeNull();
    expect(Number.isNaN(invalidPoint.needScore)).toBe(false);
    const missing = computeBarangayHealthcareNeed(rows, []);
    expect(missing.every((b) => b.nearestHospital === null)).toBe(true);
    expect(missing.map((b) => b.needCoverage)).toEqual([60, 60, 60]);
  });
  it("keeps urban/rural context from changing any score, coverage or rank", () => {
    const clinics = [
      clinic({ id: "node/1", lat: 0, lng: 0.5, barangayPsgc: "B" }),
      clinic({ id: "node/2", lat: 0, lng: 2.5, barangayPsgc: "C" }),
    ];
    const variants = [
      "Urban",
      "Rural",
      "",
      null,
      "Mixed",
      undefined,
    ];
    const baseline = computeBarangayHealthcareNeed(
      rows.map((b) => ({ ...b, urbanRural: "Urban" })),
      [hospital],
      dataset(clinics),
    );
    for (const urbanRural of variants) {
      const result = computeBarangayHealthcareNeed(
        rows.map((b) => ({ ...b, urbanRural: urbanRural as string | null })),
        [hospital],
        dataset(clinics),
      );
      expect(result.map((b) => b.needScore)).toEqual(
        baseline.map((b) => b.needScore),
      );
      expect(result.map((b) => b.needCoverage)).toEqual(
        baseline.map((b) => b.needCoverage),
      );
      expect(result.map((b) => b.needRank)).toEqual(
        baseline.map((b) => b.needRank),
      );
      expect(result.map((b) => b.needContributions)).toEqual(
        baseline.map((b) => b.needContributions),
      );
      expect(Object.keys(result[0].needFactors)).not.toContain("urbanRural");
      expect(defaultNeedWeights()).not.toHaveProperty("urbanRural");
    }
  });
  it("keeps income observed-class min–max scaling and rejects invalid risk", () => {
    expect(incomeClassOrdinal(" 3rd CLASS ")).toBe(3);
    expect(incomeClassOrdinal("unverified")).toBeNull();
    expect(incomeClassOrdinal(null)).toBeNull();
    const sameClass = computeBarangayHealthcareNeed(
      rows.map((b) => ({ ...b, incomeClass: "2nd" })),
      [hospital],
    );
    expect(sameClass.every((b) => b.needFactors.incomeClass === 50)).toBe(true);
    const observed = computeBarangayHealthcareNeed(
      rows.map((b) => ({
        ...b,
        incomeClass: { A: "1st", B: "4th", C: "unverified" }[b.psgc]!,
      })),
      [hospital],
    );
    expect(observed.map((b) => b.needFactors.incomeClass)).toEqual([
      0, 100, null,
    ]);
    const withMissingIncome = computeBarangayHealthcareNeed(
      [{ ...rows[1], incomeClass: "" }],
      [hospital],
      dataset([clinic({ id: "node/income", lat: 0, lng: 1, barangayPsgc: "B" })]),
    )[0];
    // Income alone is unavailable, so the other six factors cover 90%.
    expect(withMissingIncome).toMatchObject({
      needCoverage: 90,
      needProvisional: true,
    });
    const invalidRisk = computeBarangayHealthcareNeed(
      [{ ...rows[0], disasterRisk: 101 }], [],
    )[0];
    expect(invalidRisk.needFactors.disasterRisk).toBeNull();
    expect(invalidRisk.needCoverage).toBe(45); // no hospitals (30%), clinics (10%) or risk (15%)
    expect(invalidRisk.needProvisional).toBe(true);
  });
  it("keeps tied percentiles and competition ranking independent of input order", () => {
    expect(percentileScores([1, 1, 3])).toEqual([25, 25, 100]);
    expect(percentileScores([8, 8, 8])).toEqual([50, 50, 50]);
    expect(percentileScores([8])).toEqual([50]);
    expect(percentileScores([null, 1, Number.NaN])).toEqual([null, 50, null]);
    const input = [rows[0], { ...rows[0], psgc: "B", name: "B" }, rows[2]];
    const result = computeBarangayHealthcareNeed(input, [hospital]);
    expect(result.map((b) => b.needRank)).toEqual([2, 2, 1]);
    expect(
      computeBarangayHealthcareNeed([...input].reverse(), [hospital])
        .map((b) => [b.psgc, b.needRank])
        .sort(),
    ).toEqual(result.map((b) => [b.psgc, b.needRank]).sort());
    expect(input[0]).not.toHaveProperty("needScore");
  });
  it("validates clinic records before they become distance evidence", () => {
    const access = clinicAccessByBarangay(
      rows,
      dataset([
        clinic({ id: "node/1", lat: Number.NaN, lng: 0 }),
        clinic({ id: "node/2", lat: 91, lng: 0 }),
        clinic({ id: "node/3", lat: 0, lng: 181 }),
        clinic({ id: "node/4", lat: null, lng: 0 }),
      ]),
    );
    expect(access.get("A")!.nearestClinic).toBeNull();
    expect(access.get("A")!.clinicCount).toBe(0);
    expect(Number.isFinite(access.get("A")!.provisionDeficit!)).toBe(true);
    expect(isLocatedClinic(clinic({ lat: 0, lng: 0 }))).toBe(true);
    expect(isLocatedClinic(clinic({ lat: null, lng: 0 }))).toBe(false);
  });
});

describe("Supplied 681 barangays with their clinic bundle", () => {
  it("scores every barangay with the production weights and ranks invariants", () => {
    expect(RANKED_BARANGAYS).toHaveLength(681);
    expect(LAGUNA_BARANGAYS).toHaveLength(681);
    const missingRisk = LAGUNA_BARANGAYS.filter(
      (b) => b.disasterRisk === null,
    );
    expect(missingRisk.map((b) => b.name)).toEqual([
      "Dambo",
      "Natividad",
      "Coralan",
      "Masinao",
    ]);
    const snapshotUsable = OSM_CLINIC_SNAPSHOT.valid;
    for (const b of LAGUNA_BARANGAYS) {
      expect(b.needScore).toBeGreaterThanOrEqual(0);
      expect(b.needScore).toBeLessThanOrEqual(100);
      expect(barangayMetric(b, "score")).toBe(b.needScore);
      expect(Object.keys(b.needFactors)).toEqual([
        "morbidity",
        "disasterRisk",
        "density",
        "hospitalAccess",
        "incomeClass",
        "clinicDistance",
        "clinicProvision",
      ]);
      // Income class stays the observed-class min–max scaling (1st–4th here).
      const incomeNumber = incomeClassOrdinal(b.incomeClass)!;
      expect(b.needFactors.incomeClass).toBeCloseTo(
        ((incomeNumber - 1) / 3) * 100,
      );
      expect(b.needRank).toBe(
        LAGUNA_BARANGAYS.filter((other) => other.needScore > b.needScore)
          .length + 1,
      );
      expect(factorSum(b)).toBeCloseTo(b.needScore, 0);
      expect(b.needProvisional).toBe(
        b.disasterRisk === null || !snapshotUsable,
      );
      expect(b.needCoverage).toBe(
        Math.round(Object.entries(PRODUCTION).reduce(
          (total, [key, weight]) => total + (b.needFactors[key as NeedFactor] === null ? 0 : weight),
          0,
        ) * 100),
      );
      if (snapshotUsable) {
        expect(typeof b.clinicCount).toBe("number");
        expect(b.clinicsPer10000).not.toBeNull();
        expect(b.needFactors.clinicProvision).not.toBeNull();
        expect(b.nearestClinic).not.toBeNull();
      } else {
        expect(b.clinicCount).toBeNull();
        expect(b.clinicsPer10000).toBeNull();
        expect(b.nearestClinic).toBeNull();
        expect(b.clinicWarnings.length).toBeGreaterThan(0);
      }
    }
    expect(RANKED_BARANGAYS[0].needRank).toBe(1);
    expect(
      RANKED_BARANGAYS.every(
        (b, index) =>
          !index || b.needScore <= RANKED_BARANGAYS[index - 1].needScore,
      ),
    ).toBe(true);
    // Urban/rural remains demographic context only.
    for (const b of LAGUNA_BARANGAYS)
      expect(b.needFactors).not.toHaveProperty("urbanRural");
    // Context is still carried, in the original 267 urban / 414 rural split.
    expect(
      LAGUNA_BARANGAYS.filter((b) => b.urbanRural === "Urban").length,
    ).toBe(267);
    expect(
      LAGUNA_BARANGAYS.filter((b) => b.urbanRural === "Rural").length,
    ).toBe(414);
  });
  it("uses the recorded clinic snapshot and maps only located records", () => {
    expect(OSM_CLINIC_SNAPSHOT).toBeTruthy();
    if (!OSM_CLINIC_SNAPSHOT.valid) {
      expect(PROVIDED_OSM_CLINICS).toEqual([]);
      expect(MAPPED_OSM_CLINICS).toEqual([]);
      return;
    }
    expect(PROVIDED_OSM_CLINICS.length).toBeGreaterThan(0);
    expect(MAPPED_OSM_CLINICS.length).toBeGreaterThan(0);
    expect(MAPPED_OSM_CLINICS.length).toBeLessThanOrEqual(
      PROVIDED_OSM_CLINICS.length,
    );
    for (const clinic of MAPPED_OSM_CLINICS as LocatedOsmClinic[]) {
      expect(Number.isFinite(clinic.lat)).toBe(true);
      expect(Number.isFinite(clinic.lng)).toBe(true);
    }
    const assigned = MAPPED_OSM_CLINICS.filter(
      (clinic) => clinic.active && clinic.assignmentStatus === "assigned",
    );
    expect(
      LAGUNA_BARANGAYS.reduce((sum, b) => sum + (b.clinicCount ?? 0), 0),
    ).toBe(assigned.length);
  });
  it("scores alternative weights on the very same input datasets", () => {
    const inputs = {
      clinics: PROVIDED_OSM_CLINICS,
      clinicSnapshot: OSM_CLINIC_SNAPSHOT,
    };
    const production = computeBarangayHealthcareNeed(
      LAGUNA_BARANGAYS,
      PROVIDED_HOSPITALS,
      inputs,
      PRODUCTION,
    );
    const alternative = computeBarangayHealthcareNeed(
      LAGUNA_BARANGAYS,
      PROVIDED_HOSPITALS,
      inputs,
      ALTERNATIVE,
    );
    expect(production).toHaveLength(681);
    expect(alternative).toHaveLength(681);
    // Only the weights changed, so coverage must match barangay for barangay.
    expect(alternative.map((b) => b.needCoverage)).toEqual(
      production.map((b) => b.needCoverage),
    );
    // A missing risk excludes 15 points of weight under either weight set.
    const missingRisk = alternative.filter((b) => b.disasterRisk === null);
    expect(missingRisk.map((b) => b.psgc)).toEqual([
      "403421002",
      "403421006",
      "403427008",
      "403427014",
    ]);
    for (const b of missingRisk) expect(b.needCoverage).toBe(85);
    expect(
      alternative.filter(
        (b, index) => b.needScore !== production[index].needScore,
      ).length,
    ).toBeGreaterThan(0);
    for (const b of alternative) {
      expect(b.needScore).toBeGreaterThanOrEqual(0);
      expect(b.needScore).toBeLessThanOrEqual(100);
    }
  });
  it("never lets an excluded clinic inflate a real barangay's count", () => {
    const psgc = "403401003";
    const barangay = LAGUNA_BARANGAYS.find((b) => b.psgc === psgc)!;
    expect(barangay).toBeTruthy();
    const at = { lat: barangay.lat, lng: barangay.lng, barangayPsgc: psgc };
    const eligible = clinic({ id: "node/eligible", ...at });
    const excluded = [
      clinic({ id: "node/out-province", ...at, inProvince: false }),
      clinic({ id: "node/inactive", ...at, active: false }),
      clinic({ id: "node/out-of-range", ...at, lat: 123 }),
      clinic({ id: "node/unlocated", ...at, lat: null, lng: null }),
      clinic({ id: "node/beyond", ...at, assignmentStatus: "outside" }),
    ];
    const withOnly = computeBarangayHealthcareNeed(
      [{ ...barangay }],
      [],
      dataset([eligible]),
    )[0];
    const withAll = computeBarangayHealthcareNeed(
      [{ ...barangay }],
      [],
      dataset([eligible, ...excluded]),
    )[0];
    expect(withOnly.clinicCount).toBe(1);
    expect(withAll.clinicCount).toBe(1);
    expect(withAll.clinicsPer10000).toBe(withOnly.clinicsPer10000);
    expect(withAll.needFactors.clinicProvision).toBe(
      withOnly.needFactors.clinicProvision,
    );
    // Excluded records never become the nearest clinic either.
    expect(withAll.nearestClinic!.distanceKm).toBe(0);
    const excludedOnly = computeBarangayHealthcareNeed(
      [{ ...barangay }],
      [],
      dataset(excluded),
    )[0];
    expect(excludedOnly.clinicCount).toBe(0);
    expect(excludedOnly.nearestClinic).toBeNull();
  });
});
