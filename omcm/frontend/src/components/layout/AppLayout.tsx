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
import { SimulationPanel } from "../../features/simulation/SimulationPanel";
import { SimulationPlayback } from "../../features/simulation/SimulationPlayback";
import { ClinicTracker } from "../../features/tracking/ClinicTracker";
import { useClinicAnimation } from "../../features/tracking/useClinicAnimation";
import { ChatbotPanel } from "../../features/chatbot/ChatbotPanel";
import { LAGUNA_HOSPITALS } from "../../services/lagunaData";
import { useAppStore } from "../../store/useAppStore";
export function AppLayout() {
  const state = useAppStore(),
    { municipalities, plan, disruptions } = usePlanningResults();
  const { pathname } = useLocation();
  useClinicAnimation();
  useEffect(() => {
    useAppStore
      .getState()
      .openPanel(
        pathname === "/optimization"
          ? "optimization"
          : pathname === "/simulator"
            ? "simulation"
            : null,
      );
  }, [pathname]);
  const titles = {
    optimization: "Clinic optimization",
    simulation: "Disaster simulator",
    chatbot: "Operations assistant",
  };
  return (
    <div
      className={`workspace ${state.panel ? "has-tool-panel" : state.sidePanelOpen ? "has-detail-panel" : ""} ${state.panel === "simulation" ? "is-simulating" : ""}`}
    >
      <main className="workspace-stage" aria-label="Laguna planning map">
        <LagunaMap
          municipalities={municipalities}
          selectedPsgc={state.selectedPsgc}
          selectedBarangayPsgc={state.selectedBarangayPsgc}
          onSelectBarangay={state.selectBarangay}
          onSelectMunicipality={state.selectMunicipality}
          activeMetric={state.activeMetric}
          showHospitals={state.showHospitals}
          showClinics={state.showClinics}
          hospitals={LAGUNA_HOSPITALS}
          proposedClinics={plan.clinics}
          simulationActive={state.panel === "simulation"}
          simulationProgress={state.progress}
          selectedClinicId={state.selectedClinicId}
          onSelectClinic={(selectedClinicId) =>
            useAppStore.setState({ selectedClinicId })
          }
          disruptions={disruptions}
          recenterTrigger={state.recenterTrigger}
          zoomDelta={state.zoomDelta}
        />
        <MapControls />
        {!state.panel && <SidePanel />}
        <FloatingControls />
        <MapLegend />
        <MapNavigation />
        {state.panel && (
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
        {state.panel === "simulation" && <SimulationPlayback />}
        <ClinicTracker />
      </main>
      <div className="map-disclaimer">OMCM · Supplied barangay data · Planning estimates</div>
    </div>
  );
}
