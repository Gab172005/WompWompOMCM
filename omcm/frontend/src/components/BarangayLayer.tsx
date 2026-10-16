import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { GeoJSON, Pane, useMap } from "react-leaflet";
import type { Barangay } from "../types";
import {
  matchAreas,
  parseLagunaGeometry,
  type AreaMapping,
  type LagunaGeometry,
} from "../services/maps";
import { areaKm2, metricNames, type MapMetric } from "./mapMetrics";
import { riskColor } from "./choropleth";

/** Display existing results without recomputing barangay need scores. */
export function BarangayLayer({
  records,
  filter,
  densityMax,
  needVisible,
  onSelect,
  mapping,
}: {
  records: Barangay[];
  filter: MapMetric;
  densityMax: number;
  needVisible: boolean;
  onSelect: (id: string) => void;
  mapping?: AreaMapping;
}) {
  const map = useMap();
  const subscribe = useCallback(
    (notify: () => void) => {
      map.on("zoomend", notify);
      return () => {
        map.off("zoomend", notify);
      };
    },
    [map],
  );
  const zoom = useSyncExternalStore(subscribe, () => map.getZoom());
  const [geometry, setGeometry] = useState<LagunaGeometry | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/geo/laguna_barangays.geojson`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Boundary request failed");
        const data = parseLagunaGeometry(await response.json(), "barangay");
        if (!controller.signal.aborted) setGeometry(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Barangay boundaries unavailable. Municipality details remain available.",
          );
      });
    return () => controller.abort();
  }, []);
  const matches = useMemo(
    () => (geometry ? matchAreas(geometry, records, mapping ?? {}) : {}),
    [geometry, records, mapping],
  );
  const densities = useMemo(
    () =>
      Object.fromEntries(
        (geometry?.features ?? []).flatMap((f) => {
          const record = matches[f.properties.area_id];
          const area = areaKm2(f.geometry);
          return record && area > 0
            ? [[f.properties.area_id, record.population / area]]
            : [];
        }),
      ),
    [geometry, matches],
  );
  if (zoom < 12) return null;
  if (error)
    return createPortal(
      <div className="map-geography-status" role="status">
        {error}
      </div>,
      map.getContainer(),
    );
  if (!geometry) return null;
  const valueOf = (id: string) => {
    const record = matches[id];
    if (!record) return undefined;
    return filter === "score"
      ? record.score
      : filter === "density"
        ? (densities[id] / densityMax) * 100
        : record.factors[filter];
  };
  return (
    <Pane name="barangay-boundaries" style={{ zIndex: 410 }}>
      <GeoJSON
        key={JSON.stringify([records, filter, needVisible])}
        data={geometry}
        style={(feature) => ({
          className: `barangay-marker barangay-${feature?.properties.area_id}`,
          color: "#64748b",
          weight: 1,
          fillColor: riskColor(valueOf(feature?.properties.area_id)),
          fillOpacity: needVisible ? 0.55 : 0,
        })}
        onEachFeature={(feature, layer) => {
          const id = feature.properties.area_id;
          const record = matches[id];
          const tip = document.createElement("div");
          tip.textContent = `${feature.properties.name}, ${feature.properties.municipality} · ${metricNames[filter]}: ${record ? (filter === "density" ? `${densities[id].toFixed(1)} people/km² (estimated represented density)` : `${valueOf(id)?.toFixed(1)}/100`) : "No data"}${record ? ` · Barangay need ${record.score}/100 · Rank ${record.rank} · Synthetic estimates` : ""}`;
          layer.bindTooltip(tip, { sticky: true });
          layer.on("click", () => onSelect(`${id.slice(0, 6)}000`));
        }}
      />
    </Pane>
  );
}
