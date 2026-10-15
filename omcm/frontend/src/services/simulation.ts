import type { RoadRoute } from "./pilot";
export type Position = [number, number]; // longitude, latitude
export interface PreparedRoute extends RoadRoute {
  cumulative: number[];
  length: number;
}
export const routeColors = [
  "#2459cc",
  "#7c3aed",
  "#087f8c",
  "#b45309",
  "#475569",
];
export function distance(a: Position, b: Position) {
  const rad = Math.PI / 180,
    dlat = (b[1] - a[1]) * rad,
    dlng = (b[0] - a[0]) * rad;
  return (
    6371000 *
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin(dlat / 2) ** 2 +
            Math.cos(a[1] * rad) *
              Math.cos(b[1] * rad) *
              Math.sin(dlng / 2) ** 2,
        ),
      ),
    )
  );
}
export function prepareRoute(route: RoadRoute): PreparedRoute {
  const cumulative = [0];
  for (let i = 1; i < route.coordinates.length; i++)
    cumulative.push(
      cumulative[i - 1] +
        distance(route.coordinates[i - 1], route.coordinates[i]),
    );
  return { ...route, cumulative, length: cumulative.at(-1)! };
}
export function vehicleAt(
  route: PreparedRoute,
  elapsed: number,
  departure: number,
) {
  const progress = Math.min(
    1,
    route.length === 0 && elapsed >= departure
      ? 1
      : Math.max(
          0,
          (elapsed - departure) / Math.max(1, route.duration_seconds),
        ),
  );
  const target = progress * route.length;
  let low = 0,
    high = route.cumulative.length - 1;
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (route.cumulative[mid] <= target) low = mid;
    else high = mid;
  }
  const a = route.coordinates[low],
    b = route.coordinates[high],
    length = route.cumulative[high] - route.cumulative[low];
  const fraction = length ? (target - route.cumulative[low]) / length : 0;
  const position: Position =
    progress === 1
      ? route.coordinates.at(-1)!
      : [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
  const rad = Math.PI / 180,
    dlng = (b[0] - a[0]) * rad;
  const heading =
    ((Math.atan2(
      Math.sin(dlng) * Math.cos(b[1] * rad),
      Math.cos(a[1] * rad) * Math.sin(b[1] * rad) -
        Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos(dlng),
    ) *
      180) /
      Math.PI +
      360) %
    360;
  return {
    position,
    heading,
    progress,
    traveled: target,
    remaining: Math.max(0, route.length - target),
    eta: Math.max(0, departure + route.duration_seconds - elapsed),
    speed:
      elapsed < departure || progress === 1
        ? 0
        : (route.length / Math.max(1, route.duration_seconds)) * 3.6,
    status:
      elapsed < departure
        ? "Scheduled"
        : progress === 1
          ? "Deployed"
          : elapsed - departure < 10
            ? "Departing"
            : "En route",
    trail: [...route.coordinates.slice(0, low + 1), position],
  };
}
export function clockLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(8 + Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
