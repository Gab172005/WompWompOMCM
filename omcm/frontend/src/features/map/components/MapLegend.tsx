import { getMetricColor } from "../../../services/lagunaData";
import { useAppStore } from "../../../store/useAppStore";
import { metricLabels } from "../../filters/HeatmapSelector";
export function MapLegend() {
  const metric = useAppStore((s) => s.activeMetric);
  const steps =
    metric === "density"
      ? [0, 500, 1500, 4000, 8000]
      : metric === "morbidity"
        ? [0, 25, 35, 50, 70]
        : [0, 20, 35, 50, 70];
  return (
    <section className="workspace-legend card" aria-label="Map legend">
      <strong>{metricLabels[metric]}</strong>
      <span>
        {metric === "density"
          ? "Residents / km²"
          : metric === "morbidity"
            ? "Cases / 1,000 · illustrative"
            : "Index / 100 · illustrative"}
      </span>
      <div className="workspace-colorbar">
        {steps.map((value) => (
          <div key={value}>
            <i style={{ background: getMetricColor(metric, value) }} />
            <small>{value}+</small>
          </div>
        ))}
      </div>
    </section>
  );
}
