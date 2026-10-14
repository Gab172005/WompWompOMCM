import { describe, expect, it } from "vitest";
import { demonstrationBoundaries, riskColor } from "./choropleth";

describe("risk choropleth", () => {
  it("uses all five shades at the scoring thresholds and gray for missing data", () => {
    expect([0, 15, 30, 50, 70, 100].map(riskColor)).toEqual([
      "#FEE5E5", "#FCBABA", "#F87171", "#DC2626", "#7F1D1D", "#7F1D1D",
    ]);
    expect(riskColor(undefined)).toBe("#D1D5DB");
    expect(riskColor(NaN)).toBe("#D1D5DB");
  });
  it("creates closed, adjacent demonstration polygons with stable record IDs", () => {
    const data = demonstrationBoundaries([
      { id: "a", name: "A", lng: 121.1, lat: 14.2 },
      { id: "b", name: "B", lng: 121.14, lat: 14.2 },
    ]);
    expect(data.features.map((f) => f.properties?.barangay_id)).toEqual(["a", "b"]);
    const rings = data.features.map((f) => {
      if (f.geometry.type !== "Polygon") throw new Error("Expected polygon");
      const ring = f.geometry.coordinates[0];
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      expect(f.properties?.demonstration).toBe(true);
      return ring;
    });
    expect(rings[0].filter((p) => rings[1].some((q) => Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[1] - q[1]) < 1e-9)).length).toBeGreaterThanOrEqual(2);
  });
});
