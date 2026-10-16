import { useState, useMemo, useEffect, useRef } from "react";
import { LagunaMap } from "./map/LagunaMap";
import { AppHeader } from "./layout/AppHeader";
import { SidePanel } from "./layout/SidePanel";
import { FloatingControls } from "./map/FloatingControls";
import { MapLegend } from "./map/MapLegend";
import { OptimizationPanel } from "./optimization/OptimizationPanel";
import { SimulationPanel } from "./simulation/SimulationPanel";
import { SimulationPlayback } from "./simulation/SimulationPlayback";
import { ClinicTrackingModal } from "./tracking/ClinicTrackingModal";
import { AIChatbotDrawer } from "./chatbot/AIChatbotDrawer";
import {
  computeLagunaMunicipalities,
  runClinicOptimizer,
  LAGUNA_HOSPITALS,
  LAGUNA_DISRUPTIONS,
  type SimulationScenario,
  type RoadDisruption,
} from "../services/lagunaData";

export function LagunaWorkspace() {
  // Primary State
  const [selectedPsgc, setSelectedPsgc] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<"score" | "density" | "flood" | "morbidity">("score");
  const [showHospitals, setShowHospitals] = useState<boolean>(true);
  const [showClinics, setShowClinics] = useState<boolean>(true);
  const [recenterTrigger, setRecenterTrigger] = useState<number>(0);

  // Panels & Drawers Toggles (strictly as specified in requirements)
  const [sidePanelOpen, setSidePanelOpen] = useState<boolean>(true);
  const [optimizationOpen, setOptimizationOpen] = useState<boolean>(false);
  const [simulationMode, setSimulationMode] = useState<boolean>(false);
  const [chatbotOpen, setChatbotOpen] = useState<boolean>(false);

  // Fleet Optimization State
  const [clinicCount, setClinicCount] = useState<number>(3);
  const [manualSiteOverrides, setManualSiteOverrides] = useState<Record<string, string>>({});
  const [isPlanApproved, setIsPlanApproved] = useState<boolean>(false);

  // Simulation Scenario State
  const [scenario, setScenario] = useState<SimulationScenario>({
    floodOverrides: {},
    morbiditySpikes: {},
    closedRoadIds: [],
  });
  const [disruptions, setDisruptions] = useState<RoadDisruption[]>(LAGUNA_DISRUPTIONS);

  // Animation Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<number>(0.2); // 0 to 1
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  // Animation Loop via requestAnimationFrame
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!simulationMode || !isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const animate = (time: number) => {
      if (lastTimeRef.current !== null) {
        const deltaSec = (time - lastTimeRef.current) / 1000;
        // Complete route in 12 seconds at 1x speed
        const speedMultiplier = playbackSpeed;
        const deltaProgress = (deltaSec / 12) * speedMultiplier;

        setSimProgress((prev) => {
          const next = prev + deltaProgress;
          if (next >= 1) {
            setIsPlaying(false);
            return 1;
          }
          return next;
        });
      }
      lastTimeRef.current = time;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [simulationMode, isPlaying, playbackSpeed]);

  // Derive live municipality metrics based on baseline + scenario
  const municipalities = useMemo(() => {
    return computeLagunaMunicipalities(scenario);
  }, [scenario]);

  const selectedMunicipality = useMemo(() => {
    return municipalities.find((m) => m.psgc === selectedPsgc);
  }, [municipalities, selectedPsgc]);

  // Compute clinic optimization recommendations
  const optimizationResult = useMemo(() => {
    const manualIds =
      Object.keys(manualSiteOverrides).length > 0 ? Object.values(manualSiteOverrides) : null;
    return runClinicOptimizer(clinicCount, municipalities, scenario, manualIds);
  }, [clinicCount, municipalities, scenario, manualSiteOverrides]);

  // Automatically open side panel when a municipality is selected
  useEffect(() => {
    if (selectedPsgc) {
      setSidePanelOpen(true);
    }
  }, [selectedPsgc]);

  // Handlers for Simulation
  const handleUpdateFlood = (psgc: string, severity: "none" | "low" | "moderate" | "severe") => {
    setScenario((prev) => ({
      ...prev,
      floodOverrides: {
        ...prev.floodOverrides,
        [psgc]: severity,
      },
    }));
  };

  const handleUpdateMorbidity = (psgc: string, multiplier: number) => {
    setScenario((prev) => ({
      ...prev,
      morbiditySpikes: {
        ...prev.morbiditySpikes,
        [psgc]: multiplier,
      },
    }));
  };

  const handleToggleRoadDisruption = (id: string) => {
    setDisruptions((prev) =>
      prev.map((d) => (d.id === id ? { ...d, closed: !d.closed } : d))
    );
    setScenario((prev) => {
      const isClosed = prev.closedRoadIds.includes(id);
      return {
        ...prev,
        closedRoadIds: isClosed
          ? prev.closedRoadIds.filter((x) => x !== id)
          : [...prev.closedRoadIds, id],
      };
    });
  };

  const handleResetScenario = () => {
    setScenario({
      floodOverrides: {},
      morbiditySpikes: {},
      closedRoadIds: [],
    });
    setDisruptions(LAGUNA_DISRUPTIONS.map((d) => ({ ...d, closed: false })));
    setSimProgress(0);
    setIsPlaying(false);
  };

  // Handlers for Optimization
  const handleManualOverride = (clinicId: string, newSiteId: string) => {
    setManualSiteOverrides((prev) => ({
      ...prev,
      [clinicId]: newSiteId,
    }));
    setIsPlanApproved(false);
  };

  const handleAcceptPlan = () => {
    setIsPlanApproved(true);
  };

  const handleRunOptimization = () => {
    setManualSiteOverrides({});
    setIsPlanApproved(false);
  };

  // Find details for selected clinic if any
  const selectedClinicDetails = useMemo(() => {
    if (!selectedClinicId) return undefined;
    return optimizationResult.clinics.find((c) => c.clinicId === selectedClinicId);
  }, [selectedClinicId, optimizationResult.clinics]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* 1. Main Interactive Map Canvas (Full Viewport) */}
      <main className="absolute inset-0 z-0">
        <LagunaMap
          municipalities={municipalities}
          selectedPsgc={selectedPsgc}
          onSelectMunicipality={setSelectedPsgc}
          activeMetric={activeMetric}
          showHospitals={showHospitals}
          showClinics={showClinics}
          hospitals={LAGUNA_HOSPITALS}
          proposedClinics={optimizationResult.clinics}
          simulationActive={simulationMode}
          simulationProgress={simProgress}
          selectedClinicId={selectedClinicId}
          onSelectClinic={setSelectedClinicId}
          disruptions={disruptions}
          recenterTrigger={recenterTrigger}
        />
      </main>

      {/* 2. Top Bar & Primary Toggles */}
      <AppHeader
        municipalities={municipalities}
        selectedPsgc={selectedPsgc}
        onSelectMunicipality={setSelectedPsgc}
        simulationMode={simulationMode}
        onToggleSimulation={() => {
          setSimulationMode((prev) => !prev);
          if (!simulationMode) {
            setOptimizationOpen(false);
          }
        }}
        optimizationOpen={optimizationOpen}
        onToggleOptimization={() => {
          setOptimizationOpen((prev) => !prev);
          if (!optimizationOpen) {
            setSimulationMode(false);
          }
        }}
        chatbotOpen={chatbotOpen}
        onToggleChatbot={() => setChatbotOpen((prev) => !prev)}
        onRecenter={() => setRecenterTrigger((n) => n + 1)}
      />

      {/* 3. Dedicated Contextual Side Panel */}
      <SidePanel
        isOpen={sidePanelOpen}
        onClose={() => setSidePanelOpen(false)}
        municipalities={municipalities}
        selectedPsgc={selectedPsgc}
        onSelectMunicipality={setSelectedPsgc}
        hospitals={LAGUNA_HOSPITALS}
        onOpenOptimization={() => setOptimizationOpen(true)}
        onOpenSimulation={() => setSimulationMode(true)}
      />

      {/* Side Panel Re-open Pill if closed */}
      {!sidePanelOpen && (
        <button
          onClick={() => setSidePanelOpen(true)}
          className="absolute top-20 left-4 z-20 px-3 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white shadow-xl flex items-center gap-1.5 transition-all"
        >
          <span>Open Intelligence Panel</span>
        </button>
      )}

      {/* 4. Floating Heatmap Filter & Visibility Controls */}
      <FloatingControls
        activeMetric={activeMetric}
        onChangeMetric={setActiveMetric}
        showHospitals={showHospitals}
        onToggleHospitals={() => setShowHospitals((v) => !v)}
        showClinics={showClinics}
        onToggleClinics={() => setShowClinics((v) => !v)}
      />

      {/* 5. Dynamic Map Legend */}
      <MapLegend activeMetric={activeMetric} />

      {/* 6. Collapsible Clinic Optimization Panel */}
      <OptimizationPanel
        isOpen={optimizationOpen}
        onClose={() => setOptimizationOpen(false)}
        clinicCount={clinicCount}
        onChangeClinicCount={setClinicCount}
        onRunOptimization={handleRunOptimization}
        onAcceptPlan={handleAcceptPlan}
        isPlanApproved={isPlanApproved}
        proposedClinics={optimizationResult.clinics}
        onManualOverride={handleManualOverride}
        totalCoveredPopulation={optimizationResult.metrics.coveredPopulation}
        totalCapacity={optimizationResult.metrics.totalCapacity}
        averageNeedCovered={optimizationResult.metrics.averageNeedScore}
      />

      {/* 7. Collapsible Simulation Mode Scenario Builder */}
      <SimulationPanel
        isOpen={simulationMode}
        onClose={() => setSimulationMode(false)}
        municipalities={municipalities}
        scenario={scenario}
        onUpdateFlood={handleUpdateFlood}
        onUpdateMorbidity={handleUpdateMorbidity}
        disruptions={disruptions}
        onToggleRoadDisruption={handleToggleRoadDisruption}
        onResetScenario={handleResetScenario}
      />

      {/* 8. Bottom Floating Deployment Timeline / Playback Controls (Active only during Simulation) */}
      {simulationMode && (
        <SimulationPlayback
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          progress={simProgress}
          onSeek={setSimProgress}
          playbackSpeed={playbackSpeed}
          onChangeSpeed={setPlaybackSpeed}
          onReset={() => {
            setSimProgress(0);
            setIsPlaying(false);
          }}
          proposedClinics={optimizationResult.clinics}
          selectedClinicId={selectedClinicId}
          onSelectClinic={setSelectedClinicId}
        />
      )}

      {/* 9. Individual Mobile Clinic Telemetry Tracking Modal */}
      <ClinicTrackingModal
        clinicId={selectedClinicId}
        onClose={() => setSelectedClinicId(null)}
        clinicDetails={selectedClinicDetails}
        progress={simProgress}
      />

      {/* 10. Collapsible AI Chatbot Assistant */}
      <AIChatbotDrawer
        isOpen={chatbotOpen}
        onClose={() => setChatbotOpen(false)}
        selectedMunicipality={selectedMunicipality}
        activeMetric={activeMetric}
        simulationActive={simulationMode}
        scenario={scenario}
        proposedClinics={optimizationResult.clinics}
      />
    </div>
  );
}
