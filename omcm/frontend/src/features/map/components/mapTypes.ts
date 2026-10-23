import type {
  ComputedMunicipality,
  HospitalFacility,
  MapMetric,
} from "../../../types/municipality";
import type { RoadDisruption } from "../../../types/simulation";
import type { Clinic } from "../../../types/clinic";
import type { LocatedOsmClinic } from "../../../types/osmClinic";
export interface MapProps {
  municipalities: ComputedMunicipality[];
  selectedPsgc: string | null;
  selectedBarangayPsgc: string | null;
  onSelectBarangay: (psgc: string, municipalityPsgc: string) => void;
  onSelectMunicipality: (psgc: string | null) => void;
  activeMetric: MapMetric;
  showHospitals: boolean;
  showClinics: boolean;
  showOsmClinics: boolean;
  hospitals: HospitalFacility[];
  proposedClinics: Clinic[];
  /** Fixed OSM facilities with a supplied location; separate from mobile clinics. */
  osmClinics: LocatedOsmClinic[];
  simulationActive: boolean;
  simulationProgress: number;
  selectedClinicId: string | null;
  onSelectClinic: (clinicId: string) => void;
  disruptions: RoadDisruption[];
  recenterTrigger: number;
  zoomDelta: number;
  publicMode?: boolean;
  publicScheduleInfo?: string;
}
