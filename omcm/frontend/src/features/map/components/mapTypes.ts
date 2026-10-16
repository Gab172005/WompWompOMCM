import type {
  ComputedMunicipality,
  HospitalFacility,
  MapMetric,
} from "../../../types/municipality";
import type { RoadDisruption } from "../../../types/simulation";
import type { Clinic } from "../../../types/clinic";
export interface MapProps {
  municipalities: ComputedMunicipality[];
  selectedPsgc: string | null;
  onSelectMunicipality: (psgc: string | null) => void;
  activeMetric: MapMetric;
  showHospitals: boolean;
  showClinics: boolean;
  hospitals: HospitalFacility[];
  proposedClinics: Clinic[];
  simulationActive: boolean;
  simulationProgress: number;
  selectedClinicId: string | null;
  onSelectClinic: (clinicId: string) => void;
  disruptions: RoadDisruption[];
  recenterTrigger: number;
  zoomDelta: number;
}
