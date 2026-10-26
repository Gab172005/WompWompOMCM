import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Maximize2,
  MessageCircle,
  Minimize2,
  X,
} from "lucide-react";
import { MapControls } from "./MapControls";
import { SheetHandle } from "../ui/SheetHandle";
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
import { useAssistantStore } from "../../store/useAssistantStore";
import { useForecastStore } from "../../store/useForecastStore";

const ADMIN_ROUTES = new Set([
  "/admin",
  "/dashboard/admin",
  "/risk",
  "/optimization",
  "/simulator",
]);

export function AppLayout() {
  const [collapsedTool, setCollapsedTool] = useState<string | null>(null);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const state = useAppStore(),
    { municipalities, plan, disruptions, floodOverlay, planningImpact } =
      usePlanningResults();
  const { pathname, state: navigationState } = useLocation();
  useClinicAnimation();
  const forecastOverlay = useSimulationMap();
  const scheduleError = useScheduleSync();
  useEffect(() => {
    useAssistantStore.getState().clear();
    if (state.viewMode === "public" || !state.adminUser) {
      useOptimizationStore.getState().invalidate();
      useForecastStore.getState().reject();
    }
    if (!state.adminUser) useForecastStore.getState().reset();
  }, [state.adminUser, state.viewMode]);

  useEffect(() => {
    const store = useAppStore.getState();
    if (ADMIN_ROUTES.has(pathname)) {
      const initialPanel = (navigationState as { panel?: string } | null)
        ?.panel;
      const targetPanel =
        initialPanel === "optimization" || initialPanel === "simulation"
          ? initialPanel
          : undefined;
      if (store.adminUser) {
        useAppStore.setState({ viewMode: "admin", loginModalOpen: false });
        if (targetPanel) store.openPanel(targetPanel);
      } else {
        store.requestAdminView(targetPanel);
      }
    } else {
      store.setViewMode("public");
    }
  }, [pathname, state.adminUser, navigationState]);

  const isPublic = state.viewMode !== "admin" || !state.adminUser;
  const publicSchedule =
    state.publishedSchedules[state.selectedScheduleDate] ?? null;
  const savedDeployment = useOptimizationStore((s) => s.deployment);
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
  const PanelIcon =
    state.panel === "optimization"
      ? Crosshair
      : state.panel === "simulation"
        ? Activity
        : MessageCircle;
  const toolCollapsed = Boolean(state.panel && collapsedTool === state.panel);

  return (
    <div
      className={`workspace ${!isPublic && state.panel ? "has-tool-panel" : state.sidePanelOpen ? "has-detail-panel" : ""} ${state.selectedPsgc ? "has-map-selection" : ""} ${!isPublic && state.panel === "simulation" ? "is-simulating" : ""} ${isPublic ? "is-public-view" : "is-admin-view"}`}
    >
      <main className="workspace-stage" aria-label="Laguna planning map">
        <LagunaMap
          floodOverlay={floodOverlay}
          planningImpact={planningImpact}
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
            !isPublic && savedDeployment && state.panel === "optimization"
              ? `${savedDeployment.date} · ${savedDeployment.start_time}–${savedDeployment.end_time} PH Time · ${savedDeployment.status}`
              : isPublic && publicSchedule
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
          planningImpact={Boolean(planningImpact)}
        />
        <MapNavigation />
        {!isPublic && state.panel && (
          <aside
            className={`workspace-panel tool-panel card${toolCollapsed ? " is-collapsed" : ""}${expandedTool === state.panel ? " is-expanded" : ""}`}
            aria-label={titles[state.panel]}
          >
            <SheetHandle
              expanded={expandedTool === state.panel && !toolCollapsed}
              onExpand={() => {
                setExpandedTool(state.panel);
                setCollapsedTool(null);
              }}
              onReduce={() => {
                if (expandedTool === state.panel) setExpandedTool(null);
                else setCollapsedTool(state.panel);
              }}
            />
            <div className="workspace-panel-heading">
              <h2>
                <PanelIcon size={18} aria-hidden="true" />
                {titles[state.panel]}
              </h2>
              <button
                type="button"
                className="icon-button panel-height-toggle"
                aria-label={
                  expandedTool === state.panel
                    ? "Reduce panel height"
                    : "Expand panel height"
                }
                aria-expanded={expandedTool === state.panel}
                onClick={() => {
                  setExpandedTool(
                    expandedTool === state.panel ? null : state.panel,
                  );
                  setCollapsedTool(null);
                }}
              >
                {expandedTool === state.panel ? (
                  <Minimize2 size={17} aria-hidden="true" />
                ) : (
                  <Maximize2 size={17} aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={
                  toolCollapsed ? "Expand tool panel" : "Collapse tool panel"
                }
                aria-expanded={!toolCollapsed}
                onClick={() => {
                  setExpandedTool(null);
                  setCollapsedTool(toolCollapsed ? null : state.panel);
                }}
                title={
                  toolCollapsed ? "Show tool details" : "See more of the map"
                }
              >
                {toolCollapsed ? (
                  <ChevronDown size={18} aria-hidden="true" />
                ) : (
                  <ChevronUp size={18} aria-hidden="true" />
                )}
              </button>
              <button
                className="icon-button"
                aria-label="Close tool panel"
                onClick={() => state.openPanel(null)}
              >
                <X size={17} />
              </button>
            </div>
            <div
              className="workspace-panel-body"
              key={state.panel}
              hidden={toolCollapsed}
            >
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
