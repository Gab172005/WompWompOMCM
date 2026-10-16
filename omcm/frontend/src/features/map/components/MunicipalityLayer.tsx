import { GeoJSON } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import type { MapProps } from "./mapTypes";
import { heatmapStyle } from "./HeatmapLayer";
export function MunicipalityLayer({
  data,
  ...props
}: { data: FeatureCollection } & Pick<
  MapProps,
  "municipalities" | "activeMetric" | "selectedPsgc" | "onSelectMunicipality"
>) {
  const byCode = new Map(props.municipalities.map((m) => [m.psgc, m]));
  return (
    <GeoJSON
      key={JSON.stringify([
        props.activeMetric,
        props.selectedPsgc,
        props.municipalities,
      ])}
      data={data}
      style={(f) => {
        const code = String(f?.properties?.adm3_psgc);
        return heatmapStyle(
          byCode.get(code),
          props.activeMetric,
          props.selectedPsgc === code,
        );
      }}
      onEachFeature={(feature, layer) => {
        const code = String(feature.properties?.adm3_psgc),
          m = byCode.get(code);
        const tooltip = document.createElement("span");
        tooltip.textContent = `${m?.name ?? "Municipality"} · Need ${m?.needScore ?? "—"}/100 · Rank #${m?.rank ?? "—"}`;
        layer.bindTooltip(tooltip, {
          sticky: true,
          className: "laguna-map-tooltip",
        });
        layer.on("click", () =>
          props.onSelectMunicipality(code === props.selectedPsgc ? null : code),
        );
      }}
    />
  );
}
