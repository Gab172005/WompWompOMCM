import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { MapControls } from "./MapControls";
import { MapNavigation } from "./MapNavigation";
import { SidePanel } from "./SidePanel";
import { FloatingControls } from "./FloatingControls";
import { LagunaMap } from "../../features/map/components/LagunaMap";
import { MapLegend } from "../../features/map/components/MapLegend";
import { OptimizationPanel } from "../../features/optimization/OptimizationPanel";
import { usePlanningResults } from "../../features/optimization/usePlanningResults";
import { useSimulationMap } from "../../features/simulation/useSimulationMap";
import { SimulationPanel } from "../../features/simulation/SimulationPanel";
import { SimulationPlayback } from "../../features/simulation/SimulationPlayback";
import { ClinicTracker } from "../../features/tracking/ClinicTracker";
import { useClinicAnimation } from "../../features/tracking/useClinicAnimation";
import { ChatbotPanel } from "../../features/chatbot/ChatbotPanel";
import { PublicSidePanel } from "../../features/public/PublicSidePanel";
import { AdminLoginModal } from "../../features/auth/AdminLoginModal";
import { LAGUNA_HOSPITALS } from "../../services/lagunaData";
// Fixed OSM facilities come from the offline snapshot; they are not simulated clinics.
import {
  MAPPED_OSM_CLINICS,
  OSM_CLINIC_SNAPSHOT,
} from "../../services/providedData";
import { useAppStore } from "../../store/useAppStore";
import { useOptimizationStore } from "../../store/useOptimizationStore";
import { useScheduleSync } from "../../features/public/useScheduleSync";
import { isBrowserDemo } from "../../services/api";

const ADMIN_ROUTES = new Set([
  "/admin",
  "/dashboard/admin",
  "/risk",
  "/optimization",
  "/simulator",
]);

export function AppLayout() {
  const state = useAppStore(),
    { municipalities, plan, disruptions, floodOverlay } = usePlanningResults();
  const { pathname } = useLocation();
  useClinicAnimation();
  const forecastOverlay = useSimulationMap();
  const scheduleError = useScheduleSync();
  useEffect(() => {
    if (!state.adminUser) useOptimizationStore.getState().invalidate();
  }, [state.adminUser]);

  useEffect(() => {
    const store = useAppStore.getState();
    if (ADMIN_ROUTES.has(pathname)) {
      const targetPanel =
        pathname === "/optimization"
          ? "optimization"
          : pathname === "/simulator"
            ? "simulation"
            : null;
      if (store.adminUser) {
        useAppStore.setState({ viewMode: "admin", loginModalOpen: false });
        store.openPanel(targetPanel);
      } else {
        store.requestAdminView(targetPanel);
      }
    } else {
      store.setViewMode("public");
    }
  }, [pathname, state.adminUser]);

  const isPublic = state.viewMode === "public";
  const publicSchedule =
    state.publishedSchedules[state.selectedScheduleDate] ?? null;
  const displayedClinics = isPublic
    ? (publicSchedule?.plan.clinics ?? [])
    : forecastOverlay
      ? []
      : plan.clinics;

  const titles = {
    optimization: "Plan clinic locations",
    simulation: "Try a 30-day clinic plan",
    chatbot: "Planning help",
  };

  return (
    <div
      className={`workspace ${!isPublic && state.panel ? "has-tool-panel" : state.sidePanelOpen ? "has-detail-panel" : ""} ${state.selectedPsgc ? "has-map-selection" : ""} ${!isPublic && state.panel === "simulation" ? "is-simulating" : ""} ${isPublic ? "is-public-view" : "is-admin-view"}`}
    >
      <main className="workspace-stage" aria-label="Laguna planning map">
        <LagunaMap
          floodOverlay={floodOverlay}
          forecastOverlay={forecastOverlay}
          municipalities={municipalities}
          selectedPsgc={state.selectedPsgc}
          selectedBarangayPsgc={state.selectedBarangayPsgc}
          selectionRevision={state.selectionRevision}
          onSelectBarangay={state.selectBarangay}
          onSelectMunicipality={state.selectMunicipality}
          activeMetric={state.activeMetric}
          showHospitals={state.showHospitals}
          showClinics={state.showClinics}
          showOsmClinics={state.showOsmClinics}
          hospitals={LAGUNA_HOSPITALS}
          proposedClinics={displayedClinics}
          osmClinics={MAPPED_OSM_CLINICS}
          simulationActive={!isPublic && state.panel === "simulation"}
          simulationProgress={state.progress}
          selectedClinicId={state.selectedClinicId}
          onSelectClinic={(selectedClinicId) =>
            useAppStore.setState({ selectedClinicId })
          }
          disruptions={disruptions}
          recenterTrigger={state.recenterTrigger}
          zoomDelta={state.zoomDelta}
          publicMode={isPublic}
          publicScheduleInfo={
            publicSchedule
              ? `${publicSchedule.date} · ${publicSchedule.startTime}–${publicSchedule.endTime} PH Time · ${publicSchedule.status}`
              : ""
          }
        />
        <MapControls />
        {isPublic && scheduleError && !state.sidePanelOpen && (
          <div className="workspace-connection-error" role="alert">
            {scheduleError}
          </div>
        )}
        {isPublic ? <PublicSidePanel /> : !state.panel && <SidePanel />}
        <FloatingControls />
        <MapLegend
          clinicSnapshot={OSM_CLINIC_SNAPSHOT}
          floodOverlay={floodOverlay}
        />
        <MapNavigation />
        {!isPublic && state.panel && (
          <aside
            className="workspace-panel tool-panel card"
            aria-label={titles[state.panel]}
          >
            <div className="workspace-panel-heading">
              <h2>{titles[state.panel]}</h2>
              <button
                className="icon-button"
                aria-label="Close tool panel"
                onClick={() => state.openPanel(null)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="workspace-panel-body">
              {state.panel === "optimization" ? (
                <OptimizationPanel />
              ) : state.panel === "simulation" ? (
                <SimulationPanel />
              ) : (
                <ChatbotPanel />
              )}
            </div>
          </aside>
        )}
        {!isPublic && state.panel === "simulation" && <SimulationPlayback />}
        {!forecastOverlay && <ClinicTracker />}
        <AdminLoginModal />
      </main>
      <div className="map-disclaimer">
        {isPublic
          ? `OMCM · Public View · Approved mobile clinic schedules & hospitals${isBrowserDemo() ? " (Demo)" : ""}`
          : "OMCM · Admin View · Supplied barangay data · Planning estimates"}
      </div>
    </div>
  );
}
