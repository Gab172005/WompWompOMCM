import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { containsLagunaPoint, parseLagunaGeometry } from "../../frontend/src/services/maps";
const data = parseLagunaGeometry(
  JSON.parse(
    readFileSync("public/assets/geo/laguna_municipalities.geojson", "utf8"),
  ),
  "municipality",
);
it("uses all 30 real Laguna LGUs and rejects neighboring city points", () => {
  expect(data.features).toHaveLength(30);
  expect(containsLagunaPoint(data, 121.243, 14.18)).toBe(true);
  expect(containsLagunaPoint(data, 120.9842, 14.5995)).toBe(false);
  expect(containsLagunaPoint(data, 121.186, 14.576)).toBe(false);
});
