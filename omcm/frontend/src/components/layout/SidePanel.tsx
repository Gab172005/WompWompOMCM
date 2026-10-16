import {
  X,
  MapPin,
  Hospital as HospitalIcon,
  ChevronRight,
  Info,
} from "lucide-react";
import type { ComputedMunicipality, HospitalFacility } from "../../services/lagunaData";

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  municipalities: ComputedMunicipality[];
  selectedPsgc: string | null;
  onSelectMunicipality: (psgc: string | null) => void;
  hospitals?: HospitalFacility[];
  onOpenOptimization: () => void;
  onOpenSimulation: () => void;
}

export function SidePanel({
  isOpen,
  onClose,
  municipalities,
  selectedPsgc,
  onSelectMunicipality,
  onOpenOptimization,
  onOpenSimulation,
}: SidePanelProps) {
  if (!isOpen) return null;

  const selected = municipalities.find((m) => m.psgc === selectedPsgc);

  // Compute province-wide summaries
  const totalPop = municipalities.reduce((sum, m) => sum + m.population, 0);
  const avgNeed = Math.round(
    municipalities.reduce((sum, m) => sum + m.needScore, 0) / municipalities.length
  );

  return (
    <aside className="absolute top-18 bottom-4 left-4 z-20 w-88 md:w-96 max-h-[calc(100vh-5.5rem)] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 transition-all duration-300 pointer-events-auto">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/40">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-sky-400" />
          <h2 className="font-bold text-sm tracking-wide text-slate-100 uppercase">
            {selected ? "Municipality Intelligence" : "Laguna Province Overview"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          title="Minimize Panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Panel Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {selected ? (
          // ================= SELECTED MUNICIPALITY VIEW =================
          <>
            {/* Header / Title */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-wider text-sky-400 font-semibold uppercase">
                  PSGC {selected.psgc} · {selected.level === "City" ? "Component City" : "Municipality"}
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full border border-slate-700">
                  Rank #{selected.rank} of 30
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-white mt-1 tracking-tight">
                {selected.name}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Laguna Province · Area: {selected.area_km2} km²
              </p>
            </div>

            {/* Healthcare Need Score Card */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-800/90 to-slate-950 border border-slate-700/80 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
                    Overall Need Score
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-3xl font-black text-white font-mono">
                      {selected.needScore}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">/ 100</span>
                  </div>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow ${
                    selected.levelCategory === "Critical"
                      ? "bg-red-500/20 text-red-400 border border-red-500/40"
                      : selected.levelCategory === "High"
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                      : selected.levelCategory === "Moderate"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  }`}
                >
                  {selected.levelCategory} Need
                </div>
              </div>
              <p className="text-[11px] text-slate-300 mt-2.5 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                {selected.explanation}
              </p>
            </div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">Population</span>
                <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                  {selected.population.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">PSA 2020 Census</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">Population Density</span>
                <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                  {selected.density.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">residents / km²</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">Morbidity Rate</span>
                <span className="text-sm font-bold text-amber-400 font-mono mt-0.5 block">
                  {selected.adjustedMorbidity} / 1k
                </span>
                <span className="text-[10px] text-slate-400">disease burden</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">Flood Exposure</span>
                <span className="text-sm font-bold text-sky-400 font-mono mt-0.5 block">
                  {selected.adjustedFlood} / 100
                </span>
                <span className="text-[10px] text-slate-400">hazard vulnerability</span>
              </div>
            </div>

            {/* Transparent Score Contribution Breakdown */}
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
              <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wide block">
                Score Weighting Breakdown
              </span>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Disease Burden (35%)</span>
                  <span className="font-mono font-semibold">{selected.scoreContributions.morbidity} pts</span>
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, (selected.scoreContributions.morbidity / 35) * 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-slate-300">
                  <span>Demographic Vulnerability (25%)</span>
                  <span className="font-mono font-semibold">{selected.scoreContributions.vulnerability} pts</span>
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, (selected.scoreContributions.vulnerability / 25) * 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-slate-300">
                  <span>Flood Exposure (20%)</span>
                  <span className="font-mono font-semibold">{selected.scoreContributions.flood} pts</span>
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, (selected.scoreContributions.flood / 20) * 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-slate-300">
                  <span>Density Factor (20%)</span>
                  <span className="font-mono font-semibold">{selected.scoreContributions.density} pts</span>
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, (selected.scoreContributions.density / 20) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Nearest Hospital Access */}
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
              <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wide block mb-1">
                Hospital Accessibility
              </span>
              <div className="flex items-start gap-2 text-slate-300">
                <HospitalIcon size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-100">{selected.nearest_hospital}</div>
                  <div className="text-[11px] text-slate-400">
                    Est. travel time: ~{selected.hospital_minutes} mins demo access
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => onSelectMunicipality(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-700"
              >
                <span>Back to Province Overview</span>
              </button>
            </div>
          </>
        ) : (
          // ================= LAGUNA PROVINCE DEFAULT OVERVIEW =================
          <>
            {/* Province Stats Card */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-800/90 to-slate-950 border border-slate-700/80 shadow-md">
              <span className="text-[10px] text-sky-400 font-mono font-semibold uppercase tracking-wider block">
                Region IV-A · CALABARZON
              </span>
              <h3 className="text-lg font-black text-white mt-0.5">Laguna Province</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                30 LGUs (6 Component Cities, 24 Municipalities)
              </p>

              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400">Total Population</span>
                  <div className="text-sm font-bold text-white font-mono">
                    {totalPop.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Avg Healthcare Need</span>
                  <div className="text-sm font-bold text-red-400 font-mono">
                    {avgNeed} / 100
                  </div>
                </div>
              </div>
            </div>

            {/* Fast Action Shortcuts */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onOpenOptimization}
                className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-left hover:bg-emerald-900/40 transition-colors"
              >
                <span className="text-[10px] text-emerald-400 font-bold block uppercase">
                  Deployment
                </span>
                <span className="font-semibold text-slate-200 text-xs block mt-0.5">
                  Optimize Clinics →
                </span>
              </button>

              <button
                onClick={onOpenSimulation}
                className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-left hover:bg-amber-900/40 transition-colors"
              >
                <span className="text-[10px] text-amber-400 font-bold block uppercase">
                  Scenario
                </span>
                <span className="font-semibold text-slate-200 text-xs block mt-0.5">
                  Disaster Simulator →
                </span>
              </button>
            </div>

            {/* Priority Ranking Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-200 text-[11px] uppercase tracking-wide">
                  Healthcare Need Priority List
                </span>
                <span className="text-[10px] text-slate-400">30 Municipalities</span>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {municipalities.map((m) => (
                  <button
                    key={m.psgc}
                    onClick={() => onSelectMunicipality(m.psgc)}
                    className="w-full text-left p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-[10px] font-mono text-slate-400 text-center font-bold">
                        #{m.rank}
                      </span>
                      <div>
                        <div className="font-semibold text-slate-200 group-hover:text-white">
                          {m.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {m.population.toLocaleString()} pop · {m.density}/km²
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          m.needScore >= 70
                            ? "bg-red-500/20 text-red-400"
                            : m.needScore >= 50
                            ? "bg-orange-500/20 text-orange-400"
                            : m.needScore >= 30
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        {m.needScore}
                      </span>
                      <ChevronRight size={14} className="text-slate-500 group-hover:text-slate-300" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Data Provenance Note */}
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1 text-slate-300 font-semibold">
                <Info size={12} />
                <span>Verified Data Sourcing</span>
              </div>
              <p>
                Boundaries: 2023 PSGC Official Snapshot. Demographics: 2020 PSA Census. Geographic Foundation: Google Maps Laguna Exclusively.
              </p>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
