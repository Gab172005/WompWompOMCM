import { useState } from "react";
import {
  CloudRain,
  Activity,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import type { ComputedMunicipality, RoadDisruption, SimulationScenario } from "../../services/lagunaData";

interface SimulationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  municipalities: ComputedMunicipality[];
  scenario: SimulationScenario;
  onUpdateFlood: (psgc: string, severity: "none" | "low" | "moderate" | "severe") => void;
  onUpdateMorbidity: (psgc: string, multiplier: number) => void;
  disruptions: RoadDisruption[];
  onToggleRoadDisruption: (id: string) => void;
  onResetScenario: () => void;
}

export function SimulationPanel({
  isOpen,
  onClose,
  municipalities,
  scenario,
  onUpdateFlood,
  onUpdateMorbidity,
  disruptions,
  onToggleRoadDisruption,
  onResetScenario,
}: SimulationPanelProps) {
  if (!isOpen) return null;

  const [selectedMunPsgc, setSelectedMunPsgc] = useState<string>(
    municipalities[0]?.psgc || "403402000"
  );

  const targetMun = municipalities.find((m) => m.psgc === selectedMunPsgc);
  const currentFlood = scenario.floodOverrides[selectedMunPsgc] || "moderate";
  const currentMorbiditySpike = scenario.morbiditySpikes[selectedMunPsgc] ?? 1.0;

  return (
    <div className="absolute top-18 bottom-24 right-4 z-20 w-88 md:w-96 max-h-[calc(100vh-10rem)] bg-slate-900/95 backdrop-blur-xl border border-amber-500/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 pointer-events-auto">
      {/* Simulation Warning Header */}
      <div className="p-3.5 bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-b border-amber-500/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-400 animate-pulse" />
          <div>
            <h2 className="font-bold text-xs tracking-wider text-amber-300 uppercase">
              Scenario Builder
            </h2>
            <div className="text-[10px] text-amber-400/80 font-medium">
              Simulation Mode Active (Isolated from Actuals)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onResetScenario}
            className="text-xs text-amber-300 hover:text-white px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 flex items-center gap-1 transition-all"
            title="Reset Scenario Parameters"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
          <button
            onClick={onClose}
            className="text-amber-300/80 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
            title="Close Scenario Builder"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Municipality Selector for Targeted Scenario Tuning */}
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
          <label className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">
            Target Municipality for Disaster Injection
          </label>
          <select
            value={selectedMunPsgc}
            onChange={(e) => setSelectedMunPsgc(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-semibold"
          >
            {municipalities.map((m) => (
              <option key={m.psgc} value={m.psgc}>
                {m.name} ({m.level}) · Current Need: {m.needScore}/100
              </option>
            ))}
          </select>
        </div>

        {/* 1. Municipality Flood Severity Parameter */}
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CloudRain size={16} className="text-sky-400" />
              <span className="font-bold text-slate-200">Flood Inundation Severity</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-950 text-sky-300 uppercase border border-sky-800">
              {currentFlood}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {(["none", "low", "moderate", "severe"] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => onUpdateFlood(selectedMunPsgc, sev)}
                className={`py-1.5 rounded-lg text-[11px] font-bold capitalize border transition-all ${
                  currentFlood === sev
                    ? "bg-sky-600 text-white border-sky-400 shadow"
                    : "bg-slate-900/60 text-slate-400 border-slate-700/60 hover:text-white hover:bg-slate-800"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slate-400 block leading-tight">
            Elevates localized flood risk exposure in {targetMun?.name}. Affects road traversal safety and clinic staging feasibility.
          </span>
        </div>

        {/* 2. Municipality Morbidity Surge Parameter */}
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-amber-400" />
              <span className="font-bold text-slate-200">Disease Outbreak Surge</span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400">
              +{Math.round((currentMorbiditySpike - 1.0) * 100)}% Surge
            </span>
          </div>

          <input
            type="range"
            min={1.0}
            max={3.0}
            step={0.1}
            value={currentMorbiditySpike}
            onChange={(e) => onUpdateMorbidity(selectedMunPsgc, parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
          />

          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Baseline (+0%)</span>
            <span>+100%</span>
            <span>Critical (+200%)</span>
          </div>

          <span className="text-[10px] text-slate-400 block leading-tight">
            Simulates a contagious disease or waterborne illness surge in {targetMun?.name}, dynamically shifting overall health priority.
          </span>
        </div>

        {/* 3. Simulated Road Blockages & Disruptions */}
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="font-bold text-slate-200">Road Blockages & Route Disruptions</span>
          </div>

          <div className="space-y-1.5">
            {disruptions.map((d) => (
              <label
                key={d.id}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
              >
                <div className="pr-2">
                  <div className="font-semibold text-slate-200 text-xs">{d.name}</div>
                  <div className="text-[10px] text-slate-400">{d.corridor}</div>
                </div>
                <input
                  type="checkbox"
                  checked={d.closed}
                  onChange={() => onToggleRoadDisruption(d.id)}
                  className="w-4 h-4 rounded text-red-600 focus:ring-0 bg-slate-800 border-slate-600 cursor-pointer"
                />
              </label>
            ))}
          </div>

          <span className="text-[10px] text-slate-400 block leading-tight">
            Marking arterial corridors as disrupted excludes hazard-affected routes and forces clinic deployment re-evaluations.
          </span>
        </div>
      </div>
    </div>
  );
}
