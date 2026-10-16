import { describe, expect, it } from "vitest";
import { areaKm2 } from "./mapMetrics";
import type { Polygon } from "geojson";

const square: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [121, 14],
      [121.01, 14],
      [121.01, 14.01],
      [121, 14.01],
      [121, 14],
    ],
  ],
};
describe("map density area", () => {
  it("measures square kilometres and subtracts polygon holes", () => {
    const area = areaKm2(square);
    expect(area).toBeGreaterThan(1.19);
    expect(area).toBeLessThan(1.21);
    expect(
      areaKm2({
        ...square,
        coordinates: [...square.coordinates, ...square.coordinates],
      }),
    ).toBe(0);
    expect(
      areaKm2({
        type: "MultiPolygon",
        coordinates: [square.coordinates, square.coordinates],
      }),
    ).toBeCloseTo(2 * area);
  });
});
