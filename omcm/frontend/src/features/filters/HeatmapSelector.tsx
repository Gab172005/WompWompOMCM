import { useId } from "react";
import { Check } from "lucide-react";
import { getMetricColor } from "../../services/lagunaData";
import { useAppStore } from "../../store/useAppStore";
import type { MapMetric } from "../../types/municipality";
export const metricLabels: Record<MapMetric, string> = {
  score: "Healthcare Need Score",
  density: "People per square kilometre",
  disasterRisk: "Disaster Risk Level",
  morbidity: "Illness Rate (Sample Data)",
};
const options: { id: MapMetric; label: string; description: string }[] = [
  {
    id: "score",
    label: "Overall need",
    description: "Relative planning priority",
  },
  { id: "density", label: "Population", description: "People per km²" },
  { id: "disasterRisk", label: "Hazards", description: "Reference-point risk" },
  { id: "morbidity", label: "Morbidity", description: "Sample illness rates" },
];
const scaleSteps: Record<MapMetric, number[]> = {
  score: [0, 20, 35, 50, 70],
  density: [0, 500, 1500, 4000, 8000],
  disasterRisk: [0, 33.33, 66.67, 100],
  morbidity: [0, 25, 35, 50, 70],
};
export function HeatmapSelector() {
  const activeMetric = useAppStore((state) => state.activeMetric);
  const name = useId();
  return (
    <fieldset className="map-color-options">
      <legend>Map colors show</legend>
      <div>
        {options.map(({ id, label, description }) => (
          <label key={id} className={`map-color-option is-${id}`}>
            <input
              type="radio"
              name={name}
              aria-label={metricLabels[id]}
              value={id}
              checked={activeMetric === id}
              onChange={() => useAppStore.setState({ activeMetric: id })}
            />
            <span className="map-color-preview" aria-hidden="true">
              {scaleSteps[id].map((value) => (
                <i
                  key={value}
                  style={{ background: getMetricColor(id, value) }}
                />
              ))}
            </span>
            <strong>{label}</strong>
            <small>{description}</small>
            {activeMetric === id && (
              <Check
                className="color-option-check"
                size={13}
                aria-hidden="true"
              />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
