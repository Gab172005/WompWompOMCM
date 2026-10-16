import { useEffect, useRef } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import { geoJSON, Path } from "leaflet";
import type { Factor } from "../../../types";
import type { LagunaGeometry } from "../../../services/maps";
import type { Municipality } from "../../../services/municipalities";
import { riskColor } from "./choropleth";

function FitTerritories({
  data,
  request,
}: {
  data: LagunaGeometry;
  request: number;
}) {
  const map = useMap();
  useEffect(() => {
    const bounds = geoJSON(data).getBounds();
    const fit = () => {
      map.invalidateSize();
      if (bounds.isValid())
        map.fitBounds(bounds, {
          paddingTopLeft: [28, 65],
          paddingBottomRight: [28, 28],
          maxZoom: 13,
          animate: false,
        });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, data, request]);
  return null;
}

function ReadableLabels({ layerKey }: { layerKey: string }) {
  const map = useMap();
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewport = map.getContainer().getBoundingClientRect();
        const occupied: DOMRect[] = [];
        map
          .getContainer()
          .querySelectorAll<HTMLElement>(".municipality-label")
          .forEach((label) => {
            label.style.visibility = "hidden";
            const rect = label.getBoundingClientRect();
            if (
              rect.left < viewport.left ||
              rect.right > viewport.right ||
              rect.top < viewport.top ||
              rect.bottom > viewport.bottom
            )
              return;
            if (
              occupied.some(
                (other) =>
                  rect.left < other.right + 3 &&
                  rect.right + 3 > other.left &&
                  rect.top < other.bottom + 3 &&
                  rect.bottom + 3 > other.top,
              )
            )
              return;
            occupied.push(rect);
            label.style.visibility = "visible";
          });
      });
    };
    map.on("zoomend moveend resize", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      map.off("zoomend moveend resize", update);
    };
  }, [map, layerKey]);
  return null;
}

/** Municipal choropleth with borders visible even when need shading is off. */
export function Heatmap({
  data,
  records,
  filter,
  layerName,
  layerKey,
  selectedId,
  onSelect,
  coverageIds,
  needVisible,
  publicMode,
  recenter,
}: {
  data: LagunaGeometry;
  records: Record<string, Municipality | undefined>;
  filter: Factor | "score";
  layerName: string;
  layerKey: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  coverageIds: Set<string>;
  needVisible: boolean;
  publicMode: boolean;
  recenter: number;
}) {
  const interaction = useRef({ selectedId, coverageIds });
  interaction.current = { selectedId, coverageIds };
  const valueOf = (record?: Municipality) =>
    record
      ? filter === "score"
        ? record.score
        : record.factors[filter]
      : undefined;
  const borderStyle = (id: string) => ({
    color: interaction.current.coverageIds.has(id)
      ? "#2563eb"
      : interaction.current.selectedId === id
        ? "#451a1a"
        : "#475569",
    weight:
      interaction.current.coverageIds.has(id) ||
      interaction.current.selectedId === id
        ? 3
        : 1.8,
  });
  return (
    <>
      <FitTerritories data={data} request={recenter} />
      <GeoJSON
        key={layerKey}
        data={data}
        style={(feature) => ({
          className: `municipality-marker area-${feature?.properties?.area_id}`,
          ...borderStyle(feature?.properties?.area_id),
          opacity: 1,
          fillColor: publicMode
            ? "#D1D5DB"
            : riskColor(valueOf(records[feature?.properties?.area_id])),
          fillOpacity: publicMode
            ? 0.06
            : needVisible
              ? records[feature?.properties?.area_id]
                ? 0.48
                : 0.2
              : 0,
        })}
        onEachFeature={(feature, layer) => {
          const id = feature.properties?.area_id;
          const record = records[id];
          const value = valueOf(record);
          const tip = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = feature.properties?.name;
          tip.append(title);
          if (!publicMode) {
            tip.append(
              document.createElement("br"),
              `${layerName}: ${value == null || !Number.isFinite(value) ? "No data" : `${value.toFixed(1)}/100`}${record ? ` · Rank ${record.rank}` : ""}`,
            );
            if (record?.aggregated)
              tip.append(
                document.createElement("br"),
                `${record.barangay_count} available barangay records`,
              );
            if (filter !== "score" && record)
              tip.append(
                document.createElement("br"),
                `Healthcare need: ${record.score}/100`,
              );
          }
          layer.bindTooltip(tip, { sticky: true, className: "risk-hover" });
          if (layer instanceof Path) {
            layer.on("mouseover", () => {
              layer.setStyle({ color: "#0f172a", weight: 3 });
              layer.bringToFront();
            });
            layer.on("mouseout", () => layer.setStyle(borderStyle(id)));
            if (!publicMode) layer.on("click", () => onSelect(id));
          }
        }}
      />
      <GeoJSON
        key={`labels-${layerKey}`}
        data={data}
        interactive={false}
        style={{ opacity: 0, fillOpacity: 0, interactive: false }}
        onEachFeature={(feature, layer) => {
          const label = document.createElement("span");
          label.textContent = feature.properties?.name ?? "";
          layer.bindTooltip(label, {
            permanent: true,
            direction: "center",
            interactive: false,
            className: "municipality-label",
          });
        }}
      />
      <ReadableLabels layerKey={layerKey} />
    </>
  );
}
