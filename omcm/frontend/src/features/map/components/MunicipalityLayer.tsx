import { GeoJSON, Pane } from "react-leaflet";
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
    <>
      <GeoJSON
        key={JSON.stringify([
          props.activeMetric,
          props.selectedPsgc,
          props.municipalities,
        ])}
        data={data}
        interactive={false}
        style={(f) => {
          const code = String(f?.properties?.adm3_psgc);
          return {
            ...heatmapStyle(
              byCode.get(code),
              props.activeMetric,
              props.selectedPsgc === code,
            ),
            fillOpacity: 0,
            weight: 0,
          };
        }}
      />
      <Pane
        name="municipality-borders"
        style={{ zIndex: 410, pointerEvents: "none" }}
      >
        <GeoJSON
          key={props.selectedPsgc}
          data={data}
          interactive={false}
          style={(f) => ({
            fill: false,
            color: "#334155",
            opacity: 0.9,
            weight:
              String(f?.properties?.adm3_psgc) === props.selectedPsgc
                ? 2.8
                : 1.6,
            className: "municipality-boundary",
          })}
        />
      </Pane>
    </>
  );
}
