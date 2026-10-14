import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Popup,
  Marker,
  Polyline,
  GeoJSON,
  useMap,
} from "react-leaflet";
import { divIcon, geoJSON, Path } from "leaflet";
import type { FeatureCollection } from "geojson";
import { riskColor, riskScale } from "./choropleth";
import { loadLagunaGeography, matchAreas, parseLagunaGeometry } from "./lagunaGeography";
import type { Geography } from "./lagunaGeography";
import type { Feature } from "geojson";
import { Hospital as HospitalIcon, MapPin, Navigation, X } from "lucide-react";
import { useOMCM } from "../services/store";
import type { Barangay, Clinic, Factor } from "../types";
import { NeedBadge, number } from "./ui";
const icon = (kind: "hospital" | "site" | "clinic") =>
  divIcon({
    className: `map-symbol ${kind}`,
    html:
      kind === "hospital"
        ? "+"
        : kind === "clinic"
          ? "<span>✚</span>"
          : "<span>◇</span>",
    iconSize: kind === "clinic" ? [34, 34] : [24, 24],
    // Offset glyphs in pixels so community points remain clickable at every zoom.
    // The geographic coordinate remains the exact supplied site/hospital coordinate.
    iconAnchor: kind === "hospital" ? [-8, 32] : kind === "clinic" ? [37, -8] : [32, -8],
  });
function FitTerritories({ data }: { data: FeatureCollection }) {
  const map = useMap();
  useEffect(() => {
    const bounds = geoJSON(data).getBounds();
    const fit = () => {
      map.invalidateSize();
      if (bounds.isValid()) map.fitBounds(bounds, { paddingTopLeft: [28, 65], paddingBottomRight: [28, 28], maxZoom: 13, animate: false });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, data]);
  return null;
}
function ReadableLabels({ layerKey, barangayLevel }: { layerKey: string; barangayLevel: boolean }) {
  const map = useMap();
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewport = map.getContainer().getBoundingClientRect();
        const occupied: DOMRect[] = [];
        map.getContainer().querySelectorAll<HTMLElement>(".barangay-label").forEach((label) => {
          label.style.visibility = "hidden";
          if (barangayLevel && map.getZoom() < 12) return;
          const rect = label.getBoundingClientRect();
          if (rect.left < viewport.left || rect.right > viewport.right || rect.top < viewport.top || rect.bottom > viewport.bottom) return;
          if (occupied.some((other) => rect.left < other.right + 3 && rect.right + 3 > other.left
            && rect.top < other.bottom + 3 && rect.bottom + 3 > other.top)) return;
          occupied.push(rect);
          label.style.visibility = "visible";
        });
      });
    };
    map.on("zoomend moveend resize", update);
    update();
    return () => { cancelAnimationFrame(frame); map.off("zoomend moveend resize", update); };
  }, [map, layerKey, barangayLevel]);
  return null;
}
export function RiskMap({
  clinics,
  data,
  closedRoads = [],
  floodedSites = [],
  showRoads = false,
  publicMode = false,
  scheduleInfo = "",
  services = [],
}: {
  clinics?: Clinic[];
  data?: Barangay[];
  closedRoads?: string[];
  floodedSites?: string[];
  showRoads?: boolean;
  publicMode?: boolean;
  scheduleInfo?: string;
  services?: string[];
}) {
  const {
    barangays: currentBarangays,
    sites,
    hospitals,
    boundaries,
    roads,
    plan,
  } = useOMCM();
  const barangays = data ?? currentBarangays;
  const [geography, setGeography] = useState<Geography | null>(null);
  const [geographyError, setGeographyError] = useState("");
  useEffect(() => {
    if (publicMode) return;
    let active = true;
    loadLagunaGeography().then((value) => { if (active) setGeography(value); })
      .catch((error) => { if (active) setGeographyError(error.message); });
    return () => { active = false; };
  }, [publicMode]);
  const [filter, setFilter] = useState<Factor | "score">("score"),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [showFacilities, setShowFacilities] = useState(publicMode || showRoads),
    [tilesUnavailable, setTilesUnavailable] = useState(false);
  const shownClinics = clinics ?? plan?.optimized.clinics ?? [];
  const byId = useMemo(
    () => Object.fromEntries(barangays.map((b) => [b.id, b])),
    [barangays],
  );
  const uploadedGeometry = useMemo(() => {
    if (!boundaries.geojson) return null;
    try {
      const p = boundaries.geojson.features[0]?.properties;
      const level = p?.adm4_psgc || p?.level === "barangay" || p?.geo_level === "Bgy" ? "barangay" : "municipality";
      return parseLagunaGeometry(boundaries.geojson, level);
    } catch { return null; } // Legacy invented uploads never replace real geography.
  }, [boundaries.geojson]);
  const territoryData = uploadedGeometry ?? geography?.geojson;
  const areaRecords = useMemo(() => territoryData ? matchAreas(territoryData, barangays, geography?.mapping ?? {}) : {}, [geography, territoryData, barangays]);
  const selectedArea = territoryData?.features.find((f) => f.properties.area_id === selectedId)?.properties;
  const selected = selectedId ? areaRecords[selectedId] : undefined;
  const matchedCount = Object.values(areaRecords).filter(Boolean).length;
  const borderWeight = territoryData?.features[0]?.properties.level === "barangay" ? 0.7 : 1.5;
  const valueOf = (b?: Barangay) => b ? filter === "score" ? b.score : b.factors[filter] : undefined;
  const layerName = filter === "score" ? "Healthcare need" : filter === "disease" ? "Disease risk" : filter === "vulnerability" ? "Population vulnerability" : filter === "flood" ? "Flood exposure" : "Hospital inaccessibility";
  const layerKey = JSON.stringify([filter, barangays.map((b) => [b.id, b.name, b.psgc, b.municipality, b.geography_level, b.score, b.factors]), geography?.source, boundaries.updated_at]);
  return (
    <div className="map-shell">
      {!publicMode && (
        <div className="map-toolbar">
          <span>
            <span className="live-dot" />
            Laguna · {territoryData?.features[0]?.properties.level === "municipality" ? "Municipalities" : "Barangays"}
          </span>
          <label className="sr-only" htmlFor="map-layer">
            Map layer
          </label>
          <button className="map-overlay-toggle" aria-pressed={showFacilities} onClick={() => setShowFacilities(!showFacilities)}>Facilities {showFacilities ? "on" : "off"}</button>
          <select
            id="map-layer"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Factor | "score")}
          >
            <option value="score">Overall healthcare need</option>
            <option value="disease">Disease burden</option>
            <option value="vulnerability">Vulnerable population</option>
            <option value="accessibility">Hospital inaccessibility</option>
            <option value="flood">Flood exposure</option>
          </select>
        </div>
      )}
      <MapContainer
        center={[14.215, 121.208]}
        zoom={11}
        zoomSnap={0.1}
        scrollWheelZoom={true}
        className={`risk-map ${publicMode ? "" : "choropleth-map"}`}
      >
        {publicMode && <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setTilesUnavailable(true) }}
        />}
        {!publicMode && territoryData && <>
          <FitTerritories data={territoryData} />
          <GeoJSON
            key={layerKey}
            data={territoryData}
            style={(feature) => ({ className: `barangay-marker area-${feature?.properties?.area_id}`, color: "#FFFFFF", weight: borderWeight, opacity: 1,
              fillColor: riskColor(valueOf(areaRecords[feature?.properties?.area_id])), fillOpacity: 1 })}
            onEachFeature={(feature: Feature, layer) => {
              const b = areaRecords[feature.properties?.area_id];
              const name = `${feature.properties?.name}${feature.properties?.level === "barangay" ? `, ${feature.properties?.municipality}` : ""}`;
              const value = valueOf(b);
              const tip = document.createElement("div");
              const title = document.createElement("strong");
              title.textContent = name;
              tip.append(title, document.createElement("br"), `${layerName}: ${value == null || !Number.isFinite(value) ? "No data" : `${value.toFixed(1)}/100`}`);
              if (filter !== "score" && b) tip.append(document.createElement("br"), `Healthcare need: ${b.score}/100`);
              layer.bindTooltip(tip, { sticky: true, className: "risk-hover" });
              if (layer instanceof Path) {
                layer.on("mouseover", () => { layer.setStyle({ color: "#451A1A", weight: 3 }); layer.bringToFront(); });
                layer.on("mouseout", () => layer.setStyle({ color: "#FFFFFF", weight: borderWeight }));
                layer.on("click", () => setSelectedId(feature.properties?.area_id));
              }
            }}
          />
          <GeoJSON key={`labels-${layerKey}`} data={territoryData} interactive={false}
            style={{ opacity: 0, fillOpacity: 0, interactive: false }}
            onEachFeature={(feature, layer) => {
              const b = areaRecords[feature.properties?.area_id];
              const label = document.createElement("span");
              const name = String(feature.properties?.name ?? "");
              const full = document.createElement("span");
              full.className = "barangay-label-full";
              full.textContent = name;
              const compact = document.createElement("span");
              compact.className = "barangay-label-compact";
              compact.textContent = name.split(/[\s-]+/).length > 1
                ? name.split(/[\s-]+/).map((word) => word[0]).join("").toUpperCase()
                : name.slice(0, 3).toUpperCase();
              label.append(full, compact);
              layer.bindTooltip(label, { permanent: true, direction: "center", interactive: false, className: `barangay-label ${valueOf(b) != null && valueOf(b)! >= 50 ? "light-label" : ""}` });
            }} />
          <ReadableLabels layerKey={layerKey} barangayLevel={territoryData.features[0]?.properties.level === "barangay"} />
        </>}
        {showFacilities && hospitals.map((h) => (
          <Marker
            key={h.id}
            position={[h.lat, h.lng]}
            icon={icon("hospital")}
          >
            <Popup>
              <strong>{h.name}</strong>
              <br />
              Synthetic participating hospital
              <br />
              {h.services.join(" · ")}
            </Popup>
          </Marker>
        ))}
        {!publicMode &&
          showFacilities && sites
            .filter((s) => !shownClinics.some((c) => c.id === s.id))
            .map((s) => (
              <Marker
                key={s.id}
                position={[s.lat, s.lng]}
                icon={icon("site")}
                opacity={floodedSites.includes(s.id) ? 0.35 : 0.75}
              >
                <Popup>
                  <strong>{s.name}</strong>
                  <br />
                  {floodedSites.includes(s.id)
                    ? "Flooded — excluded"
                    : "Candidate staging site"}
                  <br />
                  Synthetic demonstration site
                </Popup>
              </Marker>
            ))}
        {(publicMode || showFacilities) && shownClinics.map((c) => (
          <Marker
            key={c.id}
            position={[c.lat, c.lng]}
            icon={icon("clinic")}
          >
            <Popup>
              <strong>{c.name}</strong>
              <br />
              {publicMode
                ? scheduleInfo
                : `${c.served} daily appointments · ${c.utilization}% capacity`}
              <br />
              {publicMode ? services.join(" · ") : c.reason}
              <br />
              Demo deployment
            </Popup>
          </Marker>
        ))}
        {showRoads &&
          roads.map((r) => {
            const a = byId[r.source],
              b = byId[r.target];
            if (!a || !b) return null;
            return (
              <Polyline
                key={r.id}
                positions={[
                  [a.lat, a.lng],
                  [b.lat, b.lng],
                ]}
                pathOptions={{
                  color: closedRoads.includes(r.id) ? "#df4e5c" : "#577c91",
                  weight: closedRoads.includes(r.id) ? 5 : 2,
                  opacity: 0.65,
                  dashArray: closedRoads.includes(r.id) ? "6 6" : undefined,
                }}
              >
                <Popup>
                  {r.name}
                  <br />
                  {closedRoads.includes(r.id)
                    ? "Closed in scenario"
                    : `${r.minutes} demo minutes`}
                </Popup>
              </Polyline>
            );
          })}
      </MapContainer>
      {!publicMode && !territoryData && <div className="map-geography-status" role="status">{geographyError || "Loading real Laguna boundaries…"}</div>}
      {selectedArea && !selected && !publicMode && (
        <div className="map-detail">
          <button className="icon-button detail-close" aria-label="Close barangay details" onClick={() => setSelectedId(null)}><X size={17} /></button>
          <span className="eyebrow">LAGUNA {selectedArea.level.toUpperCase()} · PSGC {selectedArea.area_id}</span>
          <h3>{selectedArea.name}</h3>
          {selectedArea.level === "barangay" && <p>{selectedArea.municipality}, Laguna</p>}
          <strong className="detail-score">No data</strong>
          <p>No matching healthcare record. The fictional pilot communities are not assigned to real Laguna areas.</p>
          <div className="detail-grid">{["Population", "Disease burden", "Vulnerability", "Flood exposure", "Hospital accessibility", "Overall healthcare need"].map((field) => <div key={field}>{field}<strong>No data</strong></div>)}</div>
        </div>
      )}
      {selectedArea && selected && !publicMode && (
        <div className="map-detail">
          <button
            className="icon-button detail-close"
            aria-label="Close barangay details"
            onClick={() => setSelectedId(null)}
          >
            <X size={17} />
          </button>
          <span className="eyebrow">LAGUNA {selectedArea.level.toUpperCase()} · PSGC {selectedArea.area_id}</span>
          <h3>{selectedArea.name}</h3>
          <p>{selectedArea.municipality} · Healthcare record: {selected.name}</p>
          <NeedBadge level={selected.level} />
          <strong className="detail-score">
            {selected.score}
            <small>/100 need</small>
          </strong>
          <div className="detail-grid">
            <div>
              Population<strong>{number(selected.population)}</strong>
            </div>
            <div>
              Disease burden<strong>{selected.disease_per_1000}/1k</strong>
            </div>
            <div>
              Vulnerability
              <strong>{selected.factors.vulnerability.toFixed(0)}/100</strong>
            </div>
            <div>
              Flood exposure
              <strong>{selected.factors.flood.toFixed(0)}/100</strong>
            </div>
          </div>
          <p>
            <HospitalIcon size={14} /> {selected.nearest_hospital}
          </p>
          <p>
            <Navigation size={14} />{" "}
            {selected.hospital_minutes === null
              ? "No reachable hospital"
              : `${selected.hospital_minutes} min · demo travel`}
          </p>
          <p className="explanation">{selected.explanation}</p>
          <h4>Preventive services to consider</h4>
          <div className="service-tags">
            {selected.recommended_services.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <small>{selected.warnings.join(" ")}</small>
        </div>
      )}
      <div className="map-legend">
        {!publicMode &&
          riskScale.map(({label, color, range}) => (
            <span key={label}>
              <i style={{ background: color }} />
              {label} <small>{range}</small>
            </span>
          ))}
        {!publicMode && <span><i style={{ background: "#D1D5DB" }} />No data</span>}
        <span>
          <HospitalIcon size={13} /> Hospital
        </span>
        <span>
          <MapPin size={13} /> {publicMode ? "Approved clinic" : "Clinic hub"}
        </span>
      </div>
      <div className="map-caption">
        {publicMode ? `Demo deployments | ${tilesUnavailable ? "Base map unavailable" : "OpenStreetMap base map"}`
          : territoryData ? `${uploadedGeometry ? boundaries.source : geography?.source} | ${matchedCount}/${territoryData.features.length} areas matched to healthcare records | Unmatched areas: gray, no data | Scroll to zoom; drag to pan${territoryData.features[0]?.properties.level === "barangay" ? " | Zoom in for labels; hover for names" : ""}${geography?.warning ? ` | ${geography.warning}` : ""}` : geographyError || "Loading real Laguna GeoJSON"}

      </div>
    </div>
  );
}
