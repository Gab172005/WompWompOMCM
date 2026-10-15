import type { FeatureCollection } from "geojson";
export type Factor =
  "disease" | "vulnerability" | "accessibility" | "poverty" | "flood";
export type Weights = Record<Factor, number>;
export interface Barangay {
  id: string;
  psgc?: string;
  municipality?: string;
  geography_level?: "barangay" | "municipality";
  name: string;
  lat: number;
  lng: number;
  population: number;
  vulnerable_residents: number;
  children_pct?: number;
  elderly_pct?: number;
  disease_per_1000: number;
  factors: Weights;
  contributions: Weights;
  score: number;
  level: string;
  demand: number;
  high_priority: boolean;
  nearest_hospital: string;
  hospital_minutes: number | null;
  explanation: string;
  recommended_services: string[];
  warnings: string[];
  rank: number;
}
export interface Site {
  id: string;
  barangay_id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  eligible: boolean;
}
export interface Hospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  services: string[];
}
export interface Road {
  id: string;
  source: string;
  target: string;
  name: string;
  minutes: number;
}
export interface Assignment {
  barangay_id: string;
  name: string;
  residents: number;
  minutes: number;
}
export interface Clinic extends Site {
  served: number;
  daily_capacity: number;
  assignments: Assignment[];
  utilization: number;
  reason: string;
}
export interface Metrics {
  residents_served: number;
  high_priority_reached: number;
  weighted_demand: number;
  total_demand: number;
  unserved_demand: number;
  average_travel_minutes: number;
  capacity_utilization: number;
  demand_served_pct: number;
  flood_safe_accessibility_pct: number;
}
export interface Allocation {
  clinics: Clinic[];
  metrics: Metrics;
  served_by_barangay: Record<string, number>;
  solver_status: string;
  optimal: boolean;
}
export interface Config {
  flood_level?: "none" | "moderate" | "severe";
  clinic_count: number;
  capacity: number;
  max_travel_minutes: number;
  weights: Weights;
  eligible_sites: string[] | null;
  flooded_sites: string[];
  closed_roads: string[];
  outbreak_barangays: string[];
  outbreak_multiplier: number;
  manual_sites: string[] | null;
}
export interface Metadata {
  synthetic: boolean;
  region: string;
  generated_at: string;
  source: string;
  travel_times: string;
}
export interface Plan {
  created_at?: string;
  status?: "draft" | "published";
  plan_id?: string;
  optimized: Allocation;
  baseline: Allocation;
  improvement_pct: number | null;
  barangays: Barangay[];
  inputs: Config;
  metadata: Metadata;
  notes: string[];
}
export interface Simulation {
  before: Plan;
  after: Plan;
  changes: {
    previously_covered: number;
    newly_covered: number;
    losing_coverage: number;
    average_travel_delta: number;
    utilization_delta: number;
  };
  note: string;
}
export interface Schedule {
  date: string;
  plan_id: string;
  status: string;
  start_time: string;
  end_time: string;
  services: string[];
  clinics: Clinic[];
  updated_at: string;
}
export interface PublicData {
  schedules: Schedule[];
  notices: { id: string; date: string; text: string; created_at: string }[];
  today: string;
  synthetic: boolean;
}
export interface BoundaryData {
  geojson: FeatureCollection | null;
  source: string;
  updated_at?: string;
}
