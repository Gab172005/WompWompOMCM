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
  const selected = {
    ...data,
    features: data.features.filter(
      (feature) => String(feature.properties?.adm3_psgc) === props.selectedPsgc,
    ),
  };
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
          style={() => ({
            fill: false,
            color: "#334155",
            opacity: 0.9,
            weight: 1.6,
            className: "municipality-boundary",
          })}
        />
        {selected.features.length > 0 && (
          <>
            <GeoJSON
              key={`halo-${props.selectedPsgc}`}
              data={selected}
              interactive={false}
              style={{
                fill: false,
                color: "#fff",
                opacity: 1,
                weight: 9,
                className: "municipality-selection-halo",
              }}
            />
            <GeoJSON
              key={`selection-${props.selectedPsgc}`}
              data={selected}
              interactive={false}
              style={{
                fill: false,
                color: "#1a73e8",
                opacity: 1,
                weight: 5,
                className: "municipality-boundary is-selected",
              }}
            />
          </>
        )}
      </Pane>
    </>
  );
}
