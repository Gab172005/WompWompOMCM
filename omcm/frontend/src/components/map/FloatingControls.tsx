import { Flame, Users, CloudRain, Activity, Hospital as HospitalIcon, Truck } from "lucide-react";

interface FloatingControlsProps {
  activeMetric: "score" | "density" | "flood" | "morbidity";
  onChangeMetric: (metric: "score" | "density" | "flood" | "morbidity") => void;
  showHospitals: boolean;
  onToggleHospitals: () => void;
  showClinics: boolean;
  onToggleClinics: () => void;
}

export function FloatingControls({
  activeMetric,
  onChangeMetric,
  showHospitals,
  onToggleHospitals,
  showClinics,
  onToggleClinics,
}: FloatingControlsProps) {
  const metrics = [
    {
      id: "score" as const,
      label: "Overall Need Score",
      description: "Aggregated composite health need (0-100)",
      icon: Flame,
      color: "text-red-400",
      activeBg: "bg-red-500/20 border-red-500/40 text-red-200",
    },
    {
      id: "density" as const,
      label: "Population Density",
      description: "Residents per km² (PSA Census)",
      icon: Users,
      color: "text-purple-400",
      activeBg: "bg-purple-500/20 border-purple-500/40 text-purple-200",
    },
    {
      id: "flood" as const,
      label: "Flood Vulnerability",
      description: "Exposure index & hazard risk",
      icon: CloudRain,
      color: "text-sky-400",
      activeBg: "bg-sky-500/20 border-sky-500/40 text-sky-200",
    },
    {
      id: "morbidity" as const,
      label: "Morbidity Statistics",
      description: "Disease burden cases per 1,000",
      icon: Activity,
      color: "text-amber-400",
      activeBg: "bg-amber-500/20 border-amber-500/40 text-amber-200",
    },
  ];

  return (
    <div className="absolute top-18 right-4 z-20 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-3 shadow-2xl space-y-3 pointer-events-auto text-slate-100">
      {/* Heatmap Filters Section */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
            Heatmap Layer
          </span>
          <span className="text-[10px] text-slate-400">Laguna 30 LGUs</span>
        </div>

        <div className="space-y-1">
          {metrics.map((m) => {
            const Icon = m.icon;
            const isActive = activeMetric === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onChangeMetric(m.id)}
                className={`w-full text-left p-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                  isActive
                    ? m.activeBg + " shadow-md"
                    : "bg-slate-800/40 border-slate-700/40 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={15} className={m.color} />
                  <span>{m.label}</span>
                </div>
                {isActive && (
                  <span className="w-2 h-2 rounded-full bg-current shadow" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Layer Visibility Toggles */}
      <div className="pt-2 border-t border-slate-800 space-y-1.5">
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block px-1 mb-1">
          Facility Markers
        </span>

        {/* Hospitals Toggle */}
        <label className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:bg-slate-800 transition-colors cursor-pointer text-xs">
          <div className="flex items-center gap-2 text-slate-200 font-medium">
            <HospitalIcon size={15} className="text-red-400" />
            <span>Hospitals & Facilities</span>
          </div>
          <input
            type="checkbox"
            checked={showHospitals}
            onChange={onToggleHospitals}
            className="w-4 h-4 rounded text-red-600 focus:ring-0 bg-slate-700 border-slate-600 cursor-pointer"
          />
        </label>

        {/* Mobile Clinics Toggle */}
        <label className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:bg-slate-800 transition-colors cursor-pointer text-xs">
          <div className="flex items-center gap-2 text-slate-200 font-medium">
            <Truck size={15} className="text-emerald-400" />
            <span>Mobile Clinic Staging</span>
          </div>
          <input
            type="checkbox"
            checked={showClinics}
            onChange={onToggleClinics}
            className="w-4 h-4 rounded text-emerald-600 focus:ring-0 bg-slate-700 border-slate-600 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}
