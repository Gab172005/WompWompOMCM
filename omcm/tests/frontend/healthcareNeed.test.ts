import { describe, expect, it } from "vitest";
import {
  computeBarangayHealthcareNeed,
  percentileScores,
  incomeClassOrdinal,
  classificationScore,
  HEALTHCARE_NEED_FACTORS,
} from "../../frontend/src/services/healthcareNeed";
import {
  LAGUNA_BARANGAYS,
  RANKED_BARANGAYS,
  barangayMetric,
} from "../../frontend/src/services/providedData";

const hospital = {
  id: "H1",
  name: "Verified hospital",
  lat: 0,
  lng: 0,
  verified: true,
};
const rows = [
  {
    psgc: "A",
    name: "A",
    municipality: "Town",
    lat: 0,
    lng: 0,
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
    morbidity: 30,
    density: 300,
    disasterRisk: 100 as number | null,
    incomeClass: "3rd",
    urbanRural: "Rural",
  },
];
describe("Barangay healthcare need model", () => {
  it("calculates the stated weighted index and ranks larger need first", () => {
    const scored = computeBarangayHealthcareNeed(rows, [hospital]);
    expect(scored.map((b) => b.needScore)).toEqual([0, 45, 100]);
    expect(scored.map((b) => b.needRank)).toEqual([3, 2, 1]);
    const expected = {
      morbidity: 14,
      disasterRisk: 10,
      density: 8,
      hospitalAccess: 8,
      incomeClass: 5,
      urbanRural: 0,
    };
    for (const [key, value] of Object.entries(scored[1].needContributions)) {
      expect(value).toBeCloseTo(expected[key as keyof typeof expected], 8);
    }
    expect(
      scored.every((b) => b.needCoverage === 100 && !b.needProvisional),
    ).toBe(true);
  });
  it("rescales missing disaster risk and marks its score/rank as provisional", () => {
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
      needScore: 43.8,
      needCoverage: 80,
      needProvisional: true,
    });
    expect(missing.needContributions.disasterRisk).toBeNull();
    expect(zero.needScore).toBe(35);
    expect(zero.needProvisional).toBe(false);
  });
  it("uses tied percentile scores and competition ranks, independently of input order", () => {
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
  it("excludes unverified and unlocated hospital records from access calculations", () => {
    const result = computeBarangayHealthcareNeed(rows, [
      hospital,
      { ...hospital, id: "closed", lng: 2, verified: false },
      { ...hospital, id: "unknown-location", lat: null },
    ]);
    expect(result[2].nearestHospital?.id).toBe("H1");
    expect(result[2].nearestHospital!.distanceKm).toBeCloseTo(222.39, 1);
    const missing = computeBarangayHealthcareNeed(rows, []);
    expect(
      missing.every(
        (b) =>
          b.needProvisional &&
          b.needCoverage === 84 &&
          b.nearestHospital === null,
      ),
    ).toBe(true);
  });
  it("uses municipal income class and rural classification in scores and ranks", () => {
    const sameBase = { ...rows[1], disasterRisk: 50 };
    const variants = [
      {
        ...sameBase,
        psgc: "rich-urban",
        incomeClass: "1st",
        urbanRural: "Urban",
      },
      {
        ...sameBase,
        psgc: "low-urban",
        incomeClass: "4th",
        urbanRural: "Urban",
      },
      {
        ...sameBase,
        psgc: "low-rural",
        incomeClass: "4th",
        urbanRural: "Rural",
      },
    ];
    const result = computeBarangayHealthcareNeed(variants, [hospital]);
    expect(result.map((b) => b.needScore)).toEqual([40, 50, 60]);
    expect(result.map((b) => b.needRank)).toEqual([3, 2, 1]);
    expect(result[1].needContributions.incomeClass).toBeCloseTo(10);
    expect(result[2].needContributions.urbanRural).toBeCloseTo(10);
    expect(result[0].needFactors.incomeClass).toBe(0);
    expect(result[0].needFactors.urbanRural).toBe(0);
    expect(
      Object.values(HEALTHCARE_NEED_FACTORS).reduce(
        (sum, f) => sum + f.weight,
        0,
      ),
    ).toBeCloseTo(1);
  });
  it("normalizes income classes and handles missing/unknown classifications without assigning zero", () => {
    expect(incomeClassOrdinal(" 3rd CLASS ")).toBe(3);
    expect(incomeClassOrdinal("unverified")).toBeNull();
    expect(incomeClassOrdinal(null)).toBeNull();
    expect(classificationScore(" rural ")).toBe(100);
    expect(classificationScore("URBAN")).toBe(0);
    expect(classificationScore("mixed")).toBeNull();
    const sameClass = computeBarangayHealthcareNeed(
      rows.map((b) => ({ ...b, incomeClass: "2nd" })),
      [hospital],
    );
    expect(sameClass.every((b) => b.needFactors.incomeClass === 50)).toBe(true);
    const missing = computeBarangayHealthcareNeed(
      [{ ...rows[1], incomeClass: "", urbanRural: "Unknown" }],
      [hospital],
    )[0];
    expect(missing).toMatchObject({ needProvisional: true, needCoverage: 80 });
    expect(missing.needContributions.incomeClass).toBeNull();
    expect(missing.needContributions.urbanRural).toBeNull();
    expect(missing.needScore).toBe(50);
  });
  it("rejects invalid indices and a score with no available inputs", () => {
    expect(() =>
      computeBarangayHealthcareNeed([{ ...rows[0], disasterRisk: 101 }], []),
    ).toThrow("Invalid disaster risk");
    expect(() =>
      computeBarangayHealthcareNeed(
        [
          {
            ...rows[0],
            disasterRisk: null,
            morbidity: NaN,
            density: NaN,
            incomeClass: null,
            urbanRural: null,
          },
        ],
        [],
      ),
    ).toThrow("No healthcare need inputs");
  });
});

describe("Scores for the supplied 681 barangays", () => {
  it("scores every barangay and exposes its own score to the heatmap", () => {
    expect(RANKED_BARANGAYS).toHaveLength(681);
    expect(LAGUNA_BARANGAYS.filter((b) => b.needProvisional)).toHaveLength(4);
    for (const b of LAGUNA_BARANGAYS) {
      expect(b.needScore).toBeGreaterThanOrEqual(0);
      expect(b.needScore).toBeLessThanOrEqual(100);
      expect(barangayMetric(b, "score")).toBe(b.needScore);
      expect(b.needFactors.urbanRural).toBe(b.urbanRural === "Rural" ? 100 : 0);
      const incomeNumber = incomeClassOrdinal(b.incomeClass)!;
      expect(b.needFactors.incomeClass).toBeCloseTo(
        ((incomeNumber - 1) / 3) * 100,
      );
      expect(b.needRank).toBe(
        LAGUNA_BARANGAYS.filter((other) => other.needScore > b.needScore)
          .length + 1,
      );
      expect(
        Object.values(b.needContributions).reduce<number>(
          (sum, n) => sum + (n ?? 0),
          0,
        ),
      ).toBeCloseTo(b.needScore, 0);
    }
    expect(RANKED_BARANGAYS[0].needRank).toBe(1);
    expect(
      RANKED_BARANGAYS.every(
        (b, i) => !i || b.needScore <= RANKED_BARANGAYS[i - 1].needScore,
      ),
    ).toBe(true);
  });
});
