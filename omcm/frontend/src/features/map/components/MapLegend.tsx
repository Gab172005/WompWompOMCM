import { getMetricColor } from "../../../services/lagunaData";
import { useAppStore } from "../../../store/useAppStore";
import { metricLabels } from "../../filters/HeatmapSelector";
export function MapLegend() {
  const metric = useAppStore((s) => s.activeMetric);
  const steps =
    metric === "disasterRisk"
      ? [0, 33.33, 66.67, 100]
      : metric === "density"
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
            : metric === "disasterRisk"
              ? "Index / 100 · barangay point screening"
              : "Municipal index / 100 · planning estimate"}
      </span>
      <div className="workspace-colorbar">
        {steps.map((value) => (
          <div key={value}>
            <i style={{ background: getMetricColor(metric, value) }} />
            <small>
              {value}
              {metric === "disasterRisk" ? "" : "+"}
            </small>
          </div>
        ))}
      </div>
      <div className="workspace-boundary-keys">
        <span>
          <i className="boundary-key municipality-key" /> Municipality
        </span>
        <span>
          <i className="boundary-key barangay-key" /> Barangay
        </span>
        <span>
          <i className="boundary-key selected-key" /> Selected barangay
        </span>
        {metric === "disasterRisk" && (
          <span>
            <i className="missing-risk-key" /> Needs review / unavailable
          </span>
        )}
      </div>
    </section>
  );
}
