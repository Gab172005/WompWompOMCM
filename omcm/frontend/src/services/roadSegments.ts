import type { Pilot, RoadRoute } from "./pilot";
export function segmentId(a: number[], b: number[]) {
  const key = (p: number[]) =>
    p.map((v) => Math.floor(v * 100000 + 0.5)).join(",");
  return `segment:${[key(a), key(b)].sort().join(":")}`;
}
export function routeSegmentIds(route: RoadRoute) {
  return route.coordinates
    .slice(1)
    .map((p, i) => segmentId(route.coordinates[i], p));
}
export function roadSegments(pilot: Pilot) {
  const segments = new Map<string, { id: string; coordinates: number[][] }>();
  for (const route of pilot.routes) {
    route.coordinates.slice(1).forEach((point, i) => {
      const id = segmentId(route.coordinates[i], point);
      if (!segments.has(id))
        segments.set(id, { id, coordinates: [route.coordinates[i], point] });
    });
  }
  return [...segments.values()];
}
