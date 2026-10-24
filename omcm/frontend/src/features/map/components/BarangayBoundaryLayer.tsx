import { simulationMetricLabels } from "../../../services/planningLanguage";
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
import {
  getMetricColor,
  getSimulationNeedColor,
} from "../../../services/lagunaData";

export function BarangayBoundaryLayer({
  data,
  activeMetric,
  selectedBarangayPsgc,
  onSelectBarangay,
  publicMode = false,
  forecastOverlay,
  floodOverlay,
  planningImpact,
}: {
  data: FeatureCollection;
} & Pick<
  MapProps,
  | "activeMetric"
  | "selectedBarangayPsgc"
  | "onSelectBarangay"
  | "publicMode"
  | "forecastOverlay"
  | "floodOverlay"
  | "planningImpact"
>) {
  const ref = useRef<LeafletGeoJSON>(null);
  const current = useRef({
    activeMetric,
    selectedBarangayPsgc,
    onSelectBarangay,
    publicMode,
    forecastOverlay,
    floodOverlay,
    planningImpact,
  });
  current.current = {
    activeMetric,
    selectedBarangayPsgc,
    onSelectBarangay,
    publicMode,
    forecastOverlay,
    floodOverlay,
    planningImpact,
  };
  function style(feature?: Feature): PathOptions {
    const b = BARANGAYS_BY_PSGC.get(String(feature?.properties?.adm4_psgc));
    const {
      activeMetric: metric,
      selectedBarangayPsgc: selected,
      publicMode: isPublic,
      forecastOverlay: overlay,
      floodOverlay: flood,
      planningImpact: impact,
    } = current.current;
    const isSelected = b?.psgc === selected;
    const record = b ? overlay?.records.get(b.psgc) ?? (metric === "score" ? impact?.get(b.psgc) : undefined) : undefined;
    const hasClinicImpact = Boolean(record && record.serviceFraction > 0);
    const hasFloodImpact = Boolean(b && flood?.barangayIds.has(b.psgc));
    return {
      fillColor:
        isSelected && !overlay && !impact
          ? "#facc15"
          : isPublic
            ? "#f8fafc"
            : overlay && b
              ? getSimulationNeedColor(
                  overlay.metric === "hni"
                    ? (overlay.records.get(b.psgc)?.scenarioHni ?? null)
                    : (overlay.records.get(b.psgc)?.uhni ?? null),
                )
              : record && metric === "score"
                ? getSimulationNeedColor(record.scenarioHni)
                : getMetricColor(metric, b ? barangayMetric(b, metric) : null),
      fillOpacity: isSelected
        ? 0.7
        : isPublic
          ? 0.45
          : hasClinicImpact
            ? 0.72
            : 0.62,
      color: isSelected
        ? "#102c43"
        : hasFloodImpact
          ? "#0369a1"
          : hasClinicImpact
            ? "#f17d8b"
            : "#64748b",
      weight: isSelected ? 3.5 : hasFloodImpact ? 2.2 : hasClinicImpact ? 1.15 : 0.7,
      opacity: isSelected ? 1 : hasFloodImpact ? 1 : hasClinicImpact ? 0.9 : 0.85,
      dashArray: hasFloodImpact ? "5 3" : undefined,
      className: `barangay-boundary${isSelected ? " is-selected" : ""}${hasClinicImpact ? " has-clinic-impact" : ""}${hasFloodImpact ? " has-flood-impact" : ""}`,
    };
  }
  useEffect(() => {
    ref.current?.setStyle(style);
    ref.current?.eachLayer((layer) => {
      layer.closeTooltip();
      const path = layer as Path & { feature: Feature };
      const b = BARANGAYS_BY_PSGC.get(
        String(path.feature.properties?.adm4_psgc),
      );
      const element = path.getElement();
      const record = current.current.forecastOverlay?.records.get(b?.psgc ?? "") ??
        (activeMetric === "score" ? planningImpact?.get(b?.psgc ?? "") : undefined);
      const hasFloodImpact = Boolean(
        b && current.current.floodOverlay?.barangayIds.has(b.psgc),
      );
      element?.classList.toggle(
        "has-clinic-impact",
        Boolean(record && record.serviceFraction > 0),
      );
      element?.classList.toggle("has-flood-impact", hasFloodImpact);
      if (b?.psgc === selectedBarangayPsgc) path.bringToFront();
      element?.classList.toggle(
        "is-selected",
        b?.psgc === selectedBarangayPsgc,
      );
      element?.setAttribute(
        "aria-pressed",
        String(b?.psgc === selectedBarangayPsgc),
      );
    });
  }, [activeMetric, selectedBarangayPsgc, publicMode, forecastOverlay, floodOverlay, planningImpact]);
  return (
    <GeoJSON
      ref={ref}
      data={data}
      style={style}
      onEachFeature={(feature, layer) => {
        const b = BARANGAYS_BY_PSGC.get(String(feature.properties?.adm4_psgc));
        if (!b) return;
        const select = () => {
          if (current.current.forecastOverlay)
            current.current.forecastOverlay.select(b.psgc);
          else current.current.onSelectBarangay(b.psgc, b.municipalityPsgc);
        };
        layer.bindTooltip(
          () => {
            const label = document.createElement("span");
            const overlay = current.current.forecastOverlay;
            if (overlay) {
              const record = overlay.records.get(b.psgc);
              const value =
                overlay.metric === "hni" ? record?.scenarioHni : record?.uhni;
              label.textContent = `${b.name}, ${b.municipality} · Day ${overlay.day} · ${simulationMetricLabels[overlay.metric]}: ${value?.toFixed(1) ?? "Unavailable"}/100${overlay.metric === "hni" && record ? ` · Baseline ${record.hni.toFixed(1)}` : ""} · Estimate${record?.provisional ? " · Some data missing" : ""}`;
              return label;
            }
            if (current.current.publicMode) {
              label.textContent = `${b.name}, ${b.municipality} · Population: ${b.population.toLocaleString()} · Click for nearby clinics & hospitals`;
              return label;
            }
            const metric = current.current.activeMetric;
            const impact = current.current.planningImpact?.get(b.psgc);
            if (metric === "score" && impact) {
              label.textContent = `${b.name}, ${b.municipality} · Draft service HNI: ${impact.scenarioHni.toFixed(1)}/100 · Baseline: ${impact.hni.toFixed(1)} · Illustrative clinic effect`;
              if (current.current.floodOverlay?.barangayIds.has(b.psgc))
                label.textContent += ` · Flagged by ${current.current.floodOverlay.returnPeriodYears}-year flood screen`;
              return label;
            }
            const value = barangayMetric(b, metric);
            label.textContent = `${b.name}, ${b.municipality} · ${barangayMetricLabel(metric)}: ${value === null ? "Information unavailable" : `${value.toLocaleString()}${metric === "density" ? "/km²" : metric === "morbidity" ? " / 1,000" : "/100"}`}`;
            if (metric === "score")
              label.textContent += ` · Healthcare need rank #${b.needRank} of 681${b.needProvisional ? " · Some data missing" : ""}`;
            if (current.current.floodOverlay?.barangayIds.has(b.psgc))
              label.textContent += ` · Flagged by ${current.current.floodOverlay.returnPeriodYears}-year flood screen`;
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
