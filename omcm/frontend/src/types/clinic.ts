import type { runClinicOptimizer } from "../services/lagunaData";
export type ClinicPlan = ReturnType<typeof runClinicOptimizer>;
export type Clinic = ClinicPlan["clinics"][number];
export type ViewMode = "public" | "admin";
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
export interface PublishedSchedule {
  date: string;
  startTime: string;
  endTime: string;
  services: string[];
  status: "Approved" | "Emergency Override";
  emergencyNotice: string | null;
  approvedBy: string;
  updatedAt: string;
  plan: ClinicPlan;
}
export interface PublishScheduleInput {
  date: string;
  startTime: string;
  endTime: string;
  services: string[];
  emergency?: boolean;
  emergencyNotice?: string;
}

