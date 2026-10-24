import type {
  ComputedMunicipality,
  MapMetric,
} from "../../../types/municipality";
import { getMetricColor } from "../../../services/lagunaData";
/** Shared styling for the municipality choropleth. */
export function heatmapStyle(
  municipality: ComputedMunicipality | undefined,
  metric: MapMetric,
  selected: boolean,
) {
  const value = municipality
    ? {
        score: municipality.needScore,
        density: municipality.density,
        disasterRisk: municipality.adjustedDisasterRisk,
        morbidity: municipality.adjustedMorbidity,
      }[metric]
    : null;
  return {
    fillColor: getMetricColor(metric, value),
    fillOpacity: selected ? 0.88 : 0.65,
    color: selected ? "#102c43" : "#fff",
    weight: selected ? 3 : 1,
    opacity: 1,
  };
}
