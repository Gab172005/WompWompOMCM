import { expect, it } from "vitest";
import { segmentId } from "./roadSegments";
import { routeSafe, type RoadRoute } from "./pilot";
it("treats reversed shared segments as the same blocked road", () => {
  const a = [121.123456, 14.123456],
    b = [121.124, 14.124];
  expect(segmentId(a, b)).toBe(segmentId(b, a));
  const route = { coordinates: [a, b], blocked_by: [] } as unknown as RoadRoute;
  expect(routeSafe(route, new Set([segmentId(b, a)]))).toBe(false);
  expect(routeSafe(route, new Set())).toBe(true);
});
