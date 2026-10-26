import { useEffect, type CSSProperties, useId } from "react";
import { ChevronRight, Play, Pause, RotateCcw } from "lucide-react";
import { useForecastStore } from "../../store/useForecastStore";
import { operationalPeriod } from "../../services/forecasting/forecast";

export function SimulationPlayback() {
  const s = useForecastStore();
  const run = s.runs[s.strategy];
  const hintId = useId();
  const week = operationalPeriod(run.day).week;
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
      aria-describedby={hintId}
    >
      <span className="sr-only" id={hintId}>
        All scenarios share this day. Playback pauses at weekly placement
        windows. Play or use Next day to advance; drag the timeline to revisit
        elapsed days.
      </span>
      <div className="playback-topline">
        <span>
          30-day timeline <small>All scenarios</small>
        </span>
        <output aria-live="off" aria-label="Current simulation day">
          Day {run.day}
          <small>/30</small>
          <span className="playback-week">Week {week}</span>
        </output>
        <span
          className={`playback-state${s.playing ? " is-playing" : ""}`}
          role="status"
        >
          <i aria-hidden="true" />
          {s.applyBusy || s.recommendBusy
            ? "Updating plan"
            : run.day === 30
              ? "Complete"
              : s.playing
                ? "Playing"
                : "Paused"}
        </span>
      </div>
      <div className="playback-controls">
        <button
          type="button"
          className="primary playback-play"
          aria-label={s.playing ? "Pause simulation" : "Play simulation"}
          title={s.playing ? "Pause" : "Play"}
          disabled={run.day === 30 || s.applyBusy || s.recommendBusy}
          onClick={() => useForecastStore.setState({ playing: !s.playing })}
        >
          {s.playing ? (
            <Pause size={17} aria-hidden="true" />
          ) : (
            <Play size={17} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="icon-button playback-rewind"
          aria-label="Return to Day 1"
          title="Return to Day 1"
          onClick={() => s.seek(1)}
        >
          <RotateCcw size={17} aria-hidden="true" />
        </button>
        <label
          className="workspace-timeline"
          style={
            {
              "--timeline-progress": `${((run.day - 1) / 29) * 100}%`,
            } as CSSProperties
          }
        >
          <span className="sr-only">Simulation day</span>
          <input
            type="range"
            aria-label="Shared 30-day simulation timeline"
            aria-valuetext={`Day ${run.day} of 30, week ${week}`}
            min={1}
            max={30}
            step={1}
            value={run.day}
            onChange={(event) => s.seek(Number(event.target.value))}
          />
          <span className="timeline-stops" aria-hidden="true">
            {[1, 8, 15, 22, 30].map((day) => (
              <span key={day} style={{ left: `${((day - 1) / 29) * 100}%` }}>
                {day}
              </span>
            ))}
          </span>
        </label>
        <button
          type="button"
          aria-label="Next day"
          title="Next day"
          className="playback-next"
          disabled={run.day === 30 || s.applyBusy || s.recommendBusy}
          onClick={s.advance}
        >
          <span>Next day</span>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
        <label className="playback-speed">
          <span className="sr-only">Playback speed</span>
          <select
            aria-label="Playback speed"
            value={s.speed}
            onChange={(event) =>
              useForecastStore.setState({ speed: Number(event.target.value) })
            }
          >
            {[1, 2, 5, 10].map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
