import {
  SlidersHorizontal,
  CheckCircle2,
  Sparkles,
  X,
} from "lucide-react";
import { LAGUNA_CANDIDATE_SITES } from "../../services/lagunaData";

interface OptimizationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  clinicCount: number;
  onChangeClinicCount: (count: number) => void;
  onRunOptimization: () => void;
  onAcceptPlan: () => void;
  isPlanApproved: boolean;
  proposedClinics: Array<{
    clinicId: string;
    siteId: string;
    siteName: string;
    municipality: string;
    lat: number;
    lng: number;
    capacity: number;
    servedEstimate: number;
    utilizationPct: number;
    reason: string;
  }>;
  onManualOverride: (clinicId: string, newSiteId: string) => void;
  totalCoveredPopulation: number;
  totalCapacity: number;
  averageNeedCovered: number;
}

export function OptimizationPanel({
  isOpen,
  onClose,
  clinicCount,
  onChangeClinicCount,
  onRunOptimization,
  onAcceptPlan,
  isPlanApproved,
  proposedClinics,
  onManualOverride,
  totalCoveredPopulation,
  totalCapacity,
  averageNeedCovered,
}: OptimizationPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute top-18 bottom-4 right-4 z-20 w-88 md:w-96 max-h-[calc(100vh-5.5rem)] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 pointer-events-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-emerald-400" />
          <h2 className="font-bold text-sm tracking-wide text-white uppercase">
            Clinic Fleet Optimization
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Status Pill */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isPlanApproved ? "bg-emerald-400 shadow-emerald-400/50 shadow" : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="font-semibold text-xs">
              {isPlanApproved ? "Approved Operational Schedule" : "Draft Optimization Proposal"}
            </span>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              isPlanApproved
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
            }`}
          >
            {isPlanApproved ? "APPROVED" : "DRAFT"}
          </span>
        </div>

        {/* Fleet Configuration Controls */}
        <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200">Available Mobile Clinics (K)</span>
            <span className="font-mono text-sm font-bold text-emerald-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700">
              {clinicCount} Units
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={clinicCount}
            onChange={(e) => onChangeClinicCount(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
          />

          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>1 Clinic</span>
            <span>3 Clinics</span>
            <span>5 Clinics</span>
          </div>

          <button
            onClick={onRunOptimization}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <Sparkles size={16} />
            <span>Generate Algorithmic Recommendations</span>
          </button>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-medium">Covered Need Score</span>
            <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
              {averageNeedCovered} / 100
            </span>
            <span className="text-[10px] text-slate-400">weighted priority reach</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-medium">Population Served</span>
            <span className="text-base font-bold text-white font-mono mt-0.5 block">
              {totalCoveredPopulation.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400">
              residents ({totalCapacity} pts/day cap)
            </span>
          </div>
        </div>

        {/* Recommended Clinic Deployments & Manual Overrides */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200 text-[11px] uppercase tracking-wider">
              Assigned Staging Locations
            </span>
            <span className="text-[10px] text-slate-400">{proposedClinics.length} Units Deployed</span>
          </div>

          {proposedClinics.map((clinic, idx) => (
            <div
              key={clinic.clinicId}
              className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-white">{clinic.clinicId}</span>
                </div>
                <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                  {clinic.capacity} pts/day
                </span>
              </div>

              {/* Manual Override Select */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  Assigned Staging Site (Select to Override):
                </label>
                <select
                  value={clinic.siteId}
                  onChange={(e) => onManualOverride(clinic.clinicId, e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {LAGUNA_CANDIDATE_SITES.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.municipality} — {site.name} ({site.capacity} cap)
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[10px] text-slate-400 leading-tight">
                {clinic.reason}
              </p>
            </div>
          ))}
        </div>

        {/* Persist / Approve Action */}
        <div className="pt-2">
          <button
            onClick={onAcceptPlan}
            disabled={isPlanApproved}
            className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${
              isPlanApproved
                ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>{isPlanApproved ? "Schedule Approved & Locked" : "Accept & Lock Deployment Plan"}</span>
          </button>
          <span className="text-[10px] text-slate-400 text-center block mt-1">
            Persists deployment schedule without altering historical baseline data.
          </span>
        </div>
      </div>
    </div>
  );
}
