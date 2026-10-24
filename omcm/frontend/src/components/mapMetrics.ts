import type { Polygon, MultiPolygon, Position } from "geojson";

export type MapMetric = "score" | "disease" | "flood" | "density";
export const metricNames: Record<MapMetric, string> = {
  score: "Healthcare Need Score",
  disease: "Illness rate (sample data)",
  flood: "Flood risk",
  density: "People per square kilometre (sample estimate)",
};

/** Spherical polygon area, subtracting holes; no extra GIS dependency. */
export function areaKm2(geometry: Polygon | MultiPolygon): number {
  const ringArea = (ring: Position[]) => {
    const radians = Math.PI / 180;
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      sum +=
        (b[0] - a[0]) *
        radians *
        (2 + Math.sin(a[1] * radians) + Math.sin(b[1] * radians));
    }
    return (Math.abs(sum) * 6371.0088 ** 2) / 2;
  };
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.reduce(
    (sum, rings) =>
      sum +
      Math.max(
        0,
        ringArea(rings[0]) -
          rings.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0),
      ),
    0,
  );
}
