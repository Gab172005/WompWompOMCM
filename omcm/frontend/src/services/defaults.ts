import type { Config, Weights } from "../types";
export const defaultWeights: Weights = {
  disease: 30,
  vulnerability: 20,
  accessibility: 20,
  poverty: 15,
  flood: 15,
};
export const defaultConfig: Config = {
  clinic_count: 3,
  capacity: 180,
  max_travel_minutes: 15,
  weights: defaultWeights,
  eligible_sites: null,
  flooded_sites: [],
  closed_roads: [],
  outbreak_barangays: [],
  outbreak_multiplier: 1,
  manual_sites: null,
  flood_level: "none",
};
