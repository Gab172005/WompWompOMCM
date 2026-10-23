export interface MunicipalityRecord {
  psgc: string;
  name: string;
  level: "City" | "Mun";
  area_km2: number;
  population: number;
  lat: number;
  lng: number;
  disasterRisk: number | null;
  riskRecords: number;
  barangayCount: number;
  morbidity: number;
  vulnerability: number;
}
export interface ComputedMunicipality extends MunicipalityRecord {
  density: number;
  adjustedDisasterRisk: number | null;
  adjustedMorbidity: number;
  needScore: number;
  levelCategory: "Critical" | "High" | "Moderate" | "Low";
  rank: number;
  scoreContributions: {
    morbidity: number;
    vulnerability: number;
    disasterRisk: number;
    density: number;
  };
  explanation: string;
}
export interface HospitalFacility {
  id: string;
  name: string;
  municipality: string;
  lat: number;
  lng: number;
  type: string;
  services: string[];
  capacity: number | null;
  verified: boolean;
  barangay?: string;
  verificationStatus?: string;
  capacityAsOf?: string;
  capacityDefinition?: string;
  notes?: string;
}
export type MapMetric = "score" | "density" | "disasterRisk" | "morbidity";
