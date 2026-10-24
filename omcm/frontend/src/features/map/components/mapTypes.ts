import type { DailyRecord } from "../../../services/forecasting/interventions";
import type {
  ComputedMunicipality,
  HospitalFacility,
  MapMetric,
} from "../../../types/municipality";
import type { RoadDisruption } from "../../../types/simulation";
import type { Clinic } from "../../../types/clinic";
import type { LocatedOsmClinic } from "../../../types/osmClinic";
export interface MapProps {
  forecastOverlay?: SimulationOverlay;
  floodOverlay?: FloodMapOverlay | null;
  planningImpact?: Map<string, DailyRecord>;
  municipalities: ComputedMunicipality[];
  selectedPsgc: string | null;
  selectedBarangayPsgc: string | null;
  /** Repeated searches for the same place should refit its bounds. */
  selectionRevision?: number;
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

export interface FloodMapOverlay {
  returnPeriodYears: 25 | 100;
  barangayIds: ReadonlySet<string>;
}

export interface SimulationOverlay {
  day: number;
  metric: "hni" | "uhni";
  records: Map<string, DailyRecord>;
  active: {
    clinicId: string;
    psgc: string;
    name: string;
    lat: number;
    lng: number;
  }[];
  recommended: {
    clinicId: string;
    psgc: string;
    name: string;
    lat: number;
    lng: number;
  }[];
  select: (psgc: string) => void;
}
