import type { FeatureCollection, Position } from "geojson";
import type { Barangay } from "../types";

export const riskScale = [
  { label: "Very Low", min: 0, color: "#FEE5E5", range: "0–<15" },
  { label: "Low", min: 15, color: "#FCBABA", range: "15–<30" },
  { label: "Moderate", min: 30, color: "#F87171", range: "30–<50" },
  { label: "High", min: 50, color: "#DC2626", range: "50–<70" },
  { label: "Critical", min: 70, color: "#7F1D1D", range: "70–100" },
];
export function riskColor(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return "#D1D5DB";
  return [...riskScale].reverse().find((step) => value >= step.min)?.color ?? riskScale[0].color;
}

// Synthetic Voronoi territories, clipped to an irregular pilot outline.
// These are illustrative subdivisions, never administrative boundaries.
export function demonstrationBoundaries(points: Pick<Barangay, "id" | "name" | "lat" | "lng">[]): FeatureCollection {
  if (!points.length) return { type: "FeatureCollection", features: [] };
  // Break the demo source's regular point grid into distinct irregular shapes.
  // Stable ID-based offsets affect illustrative geometry only, never real locations.
  points = points.map((p) => {
    const seed = [...p.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 17);
    return { ...p, lng: p.lng + (Math.sin(seed * 12.9898) * .006),
      lat: p.lat + (Math.sin(seed * 78.233) * .005) };
  });
  const xs = points.map((p) => p.lng), ys = points.map((p) => p.lat);
  const left = Math.min(...xs) - .023, right = Math.max(...xs) + .023;
  const bottom = Math.min(...ys) - .019, top = Math.max(...ys) + .019;
  const w = right - left, h = top - bottom;
  const outline: Position[] = [[left, bottom + h * .13], [left + w * .08, bottom],
    [right - w * .18, bottom + h * .025], [right, bottom + h * .18],
    [right - w * .02, top - h * .15], [right - w * .13, top],
    [left + w * .2, top - h * .025], [left + w * .025, top - h * .16]];
  return { type: "FeatureCollection", features: points.map((p) => {
    let ring = outline;
    for (const q of points) {
      if (p.id === q.id || (p.lng === q.lng && p.lat === q.lat)) continue;
      const dx = q.lng - p.lng, dy = q.lat - p.lat;
      const side = (v: Position) => dx * (v[0] - (p.lng + q.lng) / 2) + dy * (v[1] - (p.lat + q.lat) / 2);
      const clipped: Position[] = [];
      ring.forEach((a, i) => {
        const b = ring[(i + 1) % ring.length], sa = side(a), sb = side(b);
        if (sa <= 0) clipped.push(a);
        if ((sa <= 0) !== (sb <= 0)) {
          const t = sa / (sa - sb);
          clipped.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
        }
      });
      ring = clipped;
    }
    return { type: "Feature", properties: { barangay_id: p.id, name: p.name, demonstration: true },
      geometry: { type: "Polygon", coordinates: [ring.length ? [...ring, ring[0]] : []] } };
  }) };
}
