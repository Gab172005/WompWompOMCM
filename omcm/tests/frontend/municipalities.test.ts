import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import raw from "../../frontend/public/assets/pilot/pilot.json";
import { defaultConfig } from "../../frontend/src/services/defaults";
import { scorePilot, type Pilot } from "../../frontend/src/services/pilot";
import { matchAreas, parseLagunaGeometry } from "../../frontend/src/services/maps";
import {
  aggregateMunicipalities,
  coveredMunicipalities,
} from "../../frontend/src/services/municipalities";
import type { Barangay, Weights } from "../../frontend/src/types";

const geometry = parseLagunaGeometry(
  JSON.parse(
    readFileSync("public/assets/geo/laguna_municipalities.geojson", "utf8"),
  ),
  "municipality",
);
const scores = scorePilot(raw as unknown as Pilot, defaultConfig);
const indicators = (value: number): Weights => ({
  disease: value,
  vulnerability: value,
  accessibility: value,
  poverty: value,
  flood: value,
  population: value,
});
const record = (changes: Partial<Barangay> = {}): Barangay => ({
  ...scores[0],
  id: "health-1",
  psgc: "403411001",
  name: "Source community",
  municipality: "Los Baños",
  population: 100,
  demand: 10,
  vulnerable_residents: 30,
  score: 20,
  factors: indicators(20),
  contributions: indicators(4),
  disease_per_1000: 10,
  hospital_minutes: 10,
  ...changes,
});

describe("municipal healthcare summaries", () => {
  it("matches the barangay layer to the same records used by municipal rollups", () => {
    const boundaries = parseLagunaGeometry(
      JSON.parse(
        readFileSync("public/assets/geo/laguna_barangays.geojson", "utf8"),
      ),
      "barangay",
    );
    const matches = matchAreas(boundaries, scores, {});
    expect(boundaries.features).toHaveLength(681);
    expect(Object.values(matches).filter(Boolean)).toHaveLength(20);
    for (const area of aggregateMunicipalities(geometry, scores)) {
      const children = boundaries.features
        .filter((f) => `${f.properties.area_id.slice(0, 6)}000` === area.id)
        .flatMap((f) =>
          matches[f.properties.area_id] ? [matches[f.properties.area_id]!] : [],
        );
      expect(children.map((b) => b.id).sort()).toEqual(
        [...area.source_ids].sort(),
      );
      expect(children.reduce((sum, b) => sum + b.population, 0)).toBe(
        area.population,
      );
      expect(
        children.reduce((sum, b) => sum + b.score * b.population, 0) /
          area.population,
      ).toBeCloseTo(area.score, 2);
    }
  });

  it("groups the pilot into its two municipalities and preserves source totals", () => {
    const municipalities = aggregateMunicipalities(geometry, scores);
    expect(geometry.features).toHaveLength(30);
    expect(municipalities.map((b) => b.id).sort()).toEqual([
      "403402000",
      "403411000",
    ]);
    expect(municipalities.reduce((n, b) => n + b.barangay_count, 0)).toBe(20);
    for (const field of [
      "population",
      "demand",
      "vulnerable_residents",
    ] as const) {
      expect(municipalities.reduce((n, b) => n + b[field], 0)).toBe(
        scores.reduce((n, b) => n + b[field], 0),
      );
    }
    expect(municipalities.map((b) => b.rank)).toEqual([1, 2]);
  });

  it("weights scores and rates by population and sums counts", () => {
    const municipalities = aggregateMunicipalities(geometry, [
      record(),
      record({
        id: "health-2",
        psgc: "0403411002",
        population: 300,
        demand: 25,
        vulnerable_residents: 100,
        score: 80,
        factors: indicators(80),
        contributions: indicators(16),
        disease_per_1000: 50,
        hospital_minutes: 30,
      }),
    ]);
    expect(municipalities).toHaveLength(1);
    expect(municipalities[0]).toMatchObject({
      id: "403411000",
      score: 65,
      level: "High",
      high_priority: true,
      population: 400,
      demand: 35,
      vulnerable_residents: 130,
      disease_per_1000: 40,
      hospital_minutes: 25,
      factors: indicators(65),
      contributions: indicators(13),
      source_ids: ["health-1", "health-2"],
    });
  });

  it("updates municipal scores for changed scenario inputs", () => {
    const before = aggregateMunicipalities(geometry, scores);
    const after = aggregateMunicipalities(
      geometry,
      scores.map((b) => ({ ...b, score: 90, factors: indicators(90) })),
    );
    expect(after.every((b) => b.score === 90 && b.level === "Critical")).toBe(
      true,
    );
    expect(after.map((b) => b.score)).not.toEqual(before.map((b) => b.score));
  });

  it("matches qualified municipal names and explicit source aliases", () => {
    expect(
      aggregateMunicipalities(geometry, [
        record({ psgc: undefined, municipality: "City of Biñan" }),
      ])[0].id,
    ).toBe("403403000");
    expect(
      aggregateMunicipalities(
        geometry,
        [record({ psgc: undefined, municipality: undefined })],
        { "0403411001": "health-1" },
      )[0].id,
    ).toBe("403411000");
    expect(
      aggregateMunicipalities(geometry, [
        record({
          psgc: undefined,
          name: "Demo Fiction",
          municipality: "Los Baños",
        }),
      ]),
    ).toEqual([]);
    expect(
      aggregateMunicipalities(geometry, [record({ psgc: "123456789" })]),
    ).toEqual([]);
  });

  it("prefers a municipal record without double counting its children", () => {
    const direct = record({
      id: "municipal-total",
      psgc: "403411000",
      geography_level: "municipality",
      population: 1000,
    });
    expect(
      aggregateMunicipalities(geometry, [record(), direct])[0],
    ).toMatchObject({
      population: 1000,
      aggregated: false,
      source_ids: ["municipal-total"],
    });
    expect(
      aggregateMunicipalities(geometry, [
        direct,
        { ...direct, id: "duplicate" },
      ]),
    ).toEqual([]);
    expect(
      aggregateMunicipalities(geometry, [
        record(),
        record({ id: "duplicate" }),
      ]),
    ).toEqual([]);
  });

  it("preserves missing access indicators and highlights assigned municipalities", () => {
    const areas = aggregateMunicipalities(geometry, [
      record({ hospital_minutes: null }),
    ]);
    expect(areas[0].hospital_minutes).toBeNull();
    expect(coveredMunicipalities(areas, ["health-1"])).toEqual(
      new Set(["403411000"]),
    );
    expect(coveredMunicipalities(areas, ["unknown"])).toEqual(new Set());
    expect(coveredMunicipalities(areas, ["0403411000"])).toEqual(
      new Set(["403411000"]),
    );
  });
});
