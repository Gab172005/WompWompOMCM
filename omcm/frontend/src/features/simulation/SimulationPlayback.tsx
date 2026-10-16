import { Play, Pause, RotateCcw } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
export function SimulationPlayback() {
  const { progress, isPlaying, playbackSpeed, seek } = useAppStore();
  return (
    <section
      className="workspace-playback card"
      aria-label="Simulation playback"
    >
      <button
        className="primary"
        aria-label={isPlaying ? "Pause simulation" : "Play simulation"}
        onClick={() =>
          useAppStore.setState({
            isPlaying: !isPlaying,
            progress: progress >= 1 ? 0 : progress,
          })
        }
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button
        className="icon-button"
        aria-label="Reset playback"
        onClick={() => seek(0)}
      >
        <RotateCcw size={17} />
      </button>
      <label className="workspace-timeline">
        Deployment timeline
        <input
          type="range"
          aria-label="Deployment timeline"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={(e) => seek(Number(e.target.value))}
        />
      </label>
      <output>{Math.round(progress * 100)}%</output>
      <label>
        <span className="sr-only">Playback speed</span>
        <select
          aria-label="Playback speed"
          value={playbackSpeed}
          onChange={(e) =>
            useAppStore.setState({ playbackSpeed: Number(e.target.value) })
          }
        >
          {[1, 2, 5, 10].map((v) => (
            <option value={v} key={v}>
              {v}×
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
