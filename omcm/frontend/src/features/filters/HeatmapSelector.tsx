import { useAppStore } from "../../store/useAppStore";
import type { MapMetric } from "../../types/municipality";
export const metricLabels: Record<MapMetric, string> = {
  score: "Healthcare Need Score",
  density: "People per square kilometre",
  disasterRisk: "Disaster Risk Level",
  morbidity: "Illness Rate (Sample Data)",
};
export function HeatmapSelector() {
  const activeMetric = useAppStore((s) => s.activeMetric);
  return (
    <label className="workspace-field">
      Map colors show
      <select
        aria-label="Map colors show"
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
