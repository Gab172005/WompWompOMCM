import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import forestLand from "../data/paete-forest-land.json";
import { containsLagunaPoint } from "./maps";

export const FOREST_LAND_GEOMETRY = forestLand as FeatureCollection<
  Polygon | MultiPolygon
>;

export const FOREST_LAND_RESTRICTION = "No mobile clinic deployment";

export function isDeploymentRestricted(position: { lat: number; lng: number }) {
  return containsLagunaPoint(FOREST_LAND_GEOMETRY, position.lng, position.lat);
}

// A reference marker in Paete's uplands, separate from barangay health records.
export const PAETE_FOREST_LAND = {
  name: "Sierra Madre Mountains Forest Land",
  jurisdiction: "Paete, Laguna",
  position: { lat: 14.3747, lng: 121.5349 },
};
