import type { runClinicOptimizer } from "../services/lagunaData";
export type ClinicPlan = ReturnType<typeof runClinicOptimizer>;
export type Clinic = ClinicPlan["clinics"][number];
export interface StagingSite {
  id: string;
  name: string;
  municipality: string;
  psgc: string;
  lat: number;
  lng: number;
  capacity: number;
  eligible: boolean;
  status: string;
}
