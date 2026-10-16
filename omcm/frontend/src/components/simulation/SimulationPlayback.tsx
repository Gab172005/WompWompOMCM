import { Play, Pause, RotateCcw } from "lucide-react";

interface SimulationPlaybackProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  progress: number; // 0 to 1
  onSeek: (value: number) => void;
  playbackSpeed: number; // 1, 2, 5
  onChangeSpeed: (speed: number) => void;
  onReset: () => void;
  proposedClinics: Array<{
    clinicId: string;
    siteName: string;
    municipality: string;
  }>;
  selectedClinicId: string | null;
  onSelectClinic: (clinicId: string) => void;
}

export function SimulationPlayback({
  isPlaying,
  onTogglePlay,
  progress,
  onSeek,
  playbackSpeed,
  onChangeSpeed,
  onReset,
  proposedClinics,
  selectedClinicId,
  onSelectClinic,
}: SimulationPlaybackProps) {
  const percent = Math.round(progress * 100);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4 pointer-events-auto">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 rounded-2xl p-3 shadow-2xl space-y-2.5 text-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Simulated Route Deployment Animation
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-300">
              {percent}% Dispatched
            </span>
            <span className="text-[10px] text-amber-400/80 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded">
              SIMULATED
            </span>
          </div>
        </div>

        {/* Timeline Scrubber */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={progress}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
          />
        </div>

        {/* Playback Controls & Speed */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePlay}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition-all active:scale-95"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isPlaying ? "Pause" : "Play Animation"}</span>
            </button>

            <button
              onClick={onReset}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all"
              title="Reset Timeline"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/80">
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => onChangeSpeed(spd)}
                className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  playbackSpeed === spd
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Fleet quick select chips */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-[180px]">
            {proposedClinics.map((c) => (
              <button
                key={c.clinicId}
                onClick={() => onSelectClinic(c.clinicId)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                  selectedClinicId === c.clinicId
                    ? "bg-sky-500 text-slate-950 border-sky-400"
                    : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                {c.clinicId}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
