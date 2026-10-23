import { useEffect, useRef } from "react";
import { GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { GeoJSON as LeafletGeoJSON, Path, PathOptions } from "leaflet";
import type { MapProps } from "./mapTypes";
import {
  BARANGAYS_BY_PSGC,
  barangayMetric,
  barangayMetricLabel,
} from "../../../services/providedData";
import { getMetricColor } from "../../../services/lagunaData";

export function BarangayBoundaryLayer({
  data,
  activeMetric,
  selectedBarangayPsgc,
  onSelectBarangay,
}: {
  data: FeatureCollection;
} & Pick<
  MapProps,
  "activeMetric" | "selectedBarangayPsgc" | "onSelectBarangay"
>) {
  const ref = useRef<LeafletGeoJSON>(null);
  const current = useRef({
    activeMetric,
    selectedBarangayPsgc,
    onSelectBarangay,
  });
  current.current = { activeMetric, selectedBarangayPsgc, onSelectBarangay };
  function style(feature?: Feature): PathOptions {
    const b = BARANGAYS_BY_PSGC.get(String(feature?.properties?.adm4_psgc));
    const { activeMetric: metric, selectedBarangayPsgc: selected } =
      current.current;
    const isSelected = b?.psgc === selected;
    return {
      fillColor: isSelected
        ? "#facc15"
        : getMetricColor(metric, b ? barangayMetric(b, metric) : null),
      fillOpacity: isSelected ? 0.7 : metric === "score" ? 0 : 0.62,
      color: isSelected ? "#102c43" : "#64748b",
      weight: isSelected ? 3.5 : 0.7,
      opacity: isSelected ? 1 : 0.85,
      className: `barangay-boundary${isSelected ? " is-selected" : ""}`,
    };
  }
  useEffect(() => {
    ref.current?.setStyle(style);
    ref.current?.eachLayer((layer) => {
      const path = layer as Path & { feature: Feature };
      const b = BARANGAYS_BY_PSGC.get(
        String(path.feature.properties?.adm4_psgc),
      );
      if (b?.psgc === selectedBarangayPsgc) path.bringToFront();
      const element = path.getElement();
      element?.classList.toggle(
        "is-selected",
        b?.psgc === selectedBarangayPsgc,
      );
      element?.setAttribute(
        "aria-pressed",
        String(b?.psgc === selectedBarangayPsgc),
      );
    });
  }, [activeMetric, selectedBarangayPsgc]);
  return (
    <GeoJSON
      ref={ref}
      data={data}
      style={style}
      onEachFeature={(feature, layer) => {
        const b = BARANGAYS_BY_PSGC.get(String(feature.properties?.adm4_psgc));
        if (!b) return;
        const select = () =>
          current.current.onSelectBarangay(b.psgc, b.municipalityPsgc);
        layer.bindTooltip(
          () => {
            const metric =
              current.current.activeMetric === "score"
                ? "disasterRisk"
                : current.current.activeMetric;
            const value = barangayMetric(b, metric);
            const label = document.createElement("span");
            label.textContent = `${b.name}, ${b.municipality} · ${barangayMetricLabel(metric)}: ${value === null ? "Needs review" : `${value.toLocaleString()}${metric === "density" ? "/km²" : metric === "morbidity" ? " / 1,000" : "/100"}`}`;
            return label;
          },
          { sticky: true, className: "laguna-map-tooltip" },
        );
        layer.on({
          click: select,
          mouseover: () =>
            (layer as Path).setStyle({ weight: 2, color: "#0f172a" }),
          mouseout: () => (layer as Path).setStyle(style(feature)),
          add: () => {
            const element = (layer as Path).getElement() as
              SVGElement | undefined;
            element?.setAttribute("tabindex", "0");
            element?.setAttribute("role", "button");
            element?.setAttribute(
              "aria-label",
              `Select ${b.name}, ${b.municipality}`,
            );
            element?.setAttribute("data-barangay-psgc", b.psgc);
            element?.addEventListener("keydown", (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                select();
              }
            });
          },
        });
      }}
    />
  );
}
