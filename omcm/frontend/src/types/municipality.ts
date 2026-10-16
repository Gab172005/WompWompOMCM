export interface MunicipalityRecord {
  psgc: string;
  name: string;
  level: "City" | "Mun";
  area_km2: number;
  population: number;
  lat: number;
  lng: number;
  flood: number;
  morbidity: number;
  vulnerability: number;
  hospital_minutes: number;
  nearest_hospital: string;
}
export interface ComputedMunicipality extends MunicipalityRecord {
  density: number;
  adjustedFlood: number;
  adjustedMorbidity: number;
  needScore: number;
  levelCategory: "Critical" | "High" | "Moderate" | "Low";
  rank: number;
  scoreContributions: {
    morbidity: number;
    vulnerability: number;
    flood: number;
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
  capacity: number;
  verified: boolean;
}
export type MapMetric = "score" | "density" | "flood" | "morbidity";
