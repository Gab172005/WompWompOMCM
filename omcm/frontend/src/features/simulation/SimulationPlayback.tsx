import { useEffect } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { useForecastStore } from "../../store/useForecastStore";
export function SimulationPlayback() {
  const s = useForecastStore(),
    run = s.runs[s.strategy];
  useEffect(() => {
    if (!s.playing) return;
    const timer = window.setInterval(
      () => useForecastStore.getState().advance(),
      1000 / s.speed,
    );
    return () => window.clearInterval(timer);
  }, [s.playing, s.speed]);
  return (
    <section
      className="workspace-playback card"
      aria-label="Simulation playback"
    >
      <button
        className="primary"
        aria-label={s.playing ? "Pause simulation" : "Play simulation"}
        title={
          s.playing
            ? "Pause on this day"
            : "Advance all scenarios; pauses at weekly placement windows"
        }
        disabled={run.day === 30}
        onClick={() => useForecastStore.setState({ playing: !s.playing })}
      >
        {s.playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button
        className="icon-button"
        aria-label="Return to Day 1"
        title="Review Day 1 without clearing your clinic plan"
        onClick={() => s.seek(1)}
      >
        <RotateCcw size={17} />
      </button>
      <label className="workspace-timeline">
        Shared 30-day timeline
        <input
          type="range"
          aria-label="Shared 30-day simulation timeline"
          min={1}
          max={30}
          step={1}
          value={run.day}
          onChange={(e) => s.seek(Number(e.target.value))}
        />
      </label>
      <output>Day {run.day}/30</output>
      <button disabled={run.day === 30} onClick={s.advance}>
        Next day
      </button>
      <label>
        <span className="sr-only">Playback speed</span>
        <select
          aria-label="Playback speed"
          value={s.speed}
          onChange={(e) =>
            useForecastStore.setState({ speed: Number(e.target.value) })
          }
        >
          {[1, 2, 5, 10].map((n) => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
