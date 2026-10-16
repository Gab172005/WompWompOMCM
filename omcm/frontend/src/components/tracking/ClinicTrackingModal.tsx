import { Truck, X, MapPin, Navigation } from "lucide-react";

interface ClinicTrackingModalProps {
  clinicId: string | null;
  onClose: () => void;
  clinicDetails?: {
    clinicId: string;
    siteName: string;
    municipality: string;
    lat: number;
    lng: number;
    capacity: number;
    servedEstimate: number;
    utilizationPct: number;
  };
  progress: number; // 0 to 1
}

export function ClinicTrackingModal({
  clinicId,
  onClose,
  clinicDetails,
  progress,
}: ClinicTrackingModalProps) {
  if (!clinicId || !clinicDetails) return null;

  const percent = Math.round(progress * 100);
  const totalKm = 18.5; // Illustrative Laguna route distance
  const remainingKm = Math.max(0, Number((totalKm * (1 - progress)).toFixed(1)));
  const etaMinutes = Math.max(1, Math.round(28 * (1 - progress)));

  let statusText = "En Route (Dispatched)";
  let statusColor = "bg-sky-500/20 text-sky-400 border-sky-500/30";
  if (percent >= 100) {
    statusText = "Arrived at Staging Site (Deployed)";
    statusColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  } else if (percent === 0) {
    statusText = "Staged at Depot (Scheduled)";
    statusColor = "bg-slate-700 text-slate-300 border-slate-600";
  }

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4 pointer-events-auto">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-sky-500/50 rounded-2xl p-4 shadow-2xl text-slate-100 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-600/30 text-sky-400 flex items-center justify-center border border-sky-500/40">
              <Truck size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">{clinicDetails.clinicId}</h3>
              <span className="text-[10px] text-amber-400 font-mono font-medium block">
                Simulated Telemetry (Not Live GPS)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${statusColor}`}>
            {statusText}
          </span>
          <span className="text-xs font-mono font-bold text-slate-300">{percent}% Complete</span>
        </div>

        {/* Route Details */}
        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1.5 text-xs">
          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] text-slate-400 block">Origin:</span>
              <span className="text-slate-200 font-medium">
                Provincial Health Office Depot (Santa Cruz)
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Navigation size={14} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] text-slate-400 block">Destination Staging Site:</span>
              <span className="text-slate-100 font-bold">
                {clinicDetails.siteName} ({clinicDetails.municipality})
              </span>
            </div>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
            <span className="text-[10px] text-slate-400 block font-sans">Simulated ETA:</span>
            <span className="text-sm font-bold text-sky-400 mt-0.5 block">
              ~{etaMinutes} mins
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
            <span className="text-[10px] text-slate-400 block font-sans">Dist. Remaining:</span>
            <span className="text-sm font-bold text-white mt-0.5 block">
              {remainingKm} km
            </span>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
          Capacity: {clinicDetails.capacity} patients/day · Est. utilization: {clinicDetails.utilizationPct}%
        </div>
      </div>
    </div>
  );
}
