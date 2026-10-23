/** Fixed OSM facilities: never a simulated mobile Clinic or an approved schedule. */
export interface OsmClinic {
  id: string;
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
  lat: number | null;
  lng: number | null;
  locationMethod: "node" | "overpass-center" | "unavailable";
  tags: Record<string, string>;
  active: boolean;
  inProvince: boolean;
  barangayPsgc: string | null;
  municipalityPsgc: string | null;
  assignmentStatus: "assigned" | "ambiguous" | "outside" | "unlocated";
  warnings: string[];
}
export interface ClinicSnapshot {
  valid: boolean;
  retrievedAt: string | null;
  osmBaseTimestamp: string | null;
  endpoint: string | null;
  query: string | null;
  attribution: string;
  license: string;
  rawSha256: string | null;
  boundarySha256: string | null;
  counts: Record<string, number>;
  warnings: string[];
}
export interface ClinicDataset {
  clinics: OsmClinic[];
  clinicSnapshot: ClinicSnapshot;
}
export type LocatedOsmClinic = OsmClinic & { lat: number; lng: number };
