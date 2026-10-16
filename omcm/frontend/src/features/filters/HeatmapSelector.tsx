import { useAppStore } from "../../store/useAppStore";
import type { MapMetric } from "../../types/municipality";
export const metricLabels: Record<MapMetric, string> = {
  score: "Healthcare need",
  density: "Population density",
  flood: "Flood exposure",
  morbidity: "Morbidity rate",
};
export function HeatmapSelector() {
  const activeMetric = useAppStore((s) => s.activeMetric);
  return (
    <label className="workspace-field">
      Heatmap layer
      <select
        aria-label="Heatmap layer"
        value={activeMetric}
        onChange={(e) =>
          useAppStore.setState({ activeMetric: e.target.value as MapMetric })
        }
      >
        {Object.entries(metricLabels).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
