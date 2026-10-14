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
import { demonstrationBoundaries, riskColor, riskScale } from "./choropleth";
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
  const [filter, setFilter] = useState<Factor | "score">("score"),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [showFacilities, setShowFacilities] = useState(publicMode || showRoads),
    [tilesUnavailable, setTilesUnavailable] = useState(false);
  const shownClinics = clinics ?? plan?.optimized.clinics ?? [];
  const byId = useMemo(
    () => Object.fromEntries(barangays.map((b) => [b.id, b])),
    [barangays],
  );
  const selected = selectedId ? byId[selectedId] : null;
  const locations = useMemo(() => barangays.map(({ id, name, lat, lng }) => ({ id, name, lat, lng })).sort((a, b) => a.id.localeCompare(b.id)), [barangays]);
  const locationKey = JSON.stringify(locations);
  const territoryData = useMemo(() => boundaries.geojson ?? demonstrationBoundaries(JSON.parse(locationKey)), [boundaries.geojson, locationKey]);
  const valueOf = (b?: Barangay) => b ? filter === "score" ? b.score : b.factors[filter] : undefined;
  const layerName = filter === "score" ? "Healthcare need" : filter === "disease" ? "Disease risk" : filter === "vulnerability" ? "Population vulnerability" : filter === "flood" ? "Flood exposure" : "Hospital inaccessibility";
  const layerKey = JSON.stringify([territoryData, filter, barangays.map((b) => [b.id, b.score, b.factors])]);
  return (
    <div className="map-shell">
      {!publicMode && (
        <div className="map-toolbar">
          <span>
            <span className="live-dot" />
            Laguna pilot area
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
        {!publicMode && <>
          <FitTerritories data={territoryData} />
          <GeoJSON
            key={layerKey}
            data={territoryData}
            style={(feature) => ({ className: "barangay-marker", color: "#FFFFFF", weight: 1.5, opacity: 1,
              fillColor: riskColor(valueOf(byId[feature?.properties?.barangay_id])), fillOpacity: 1 })}
            onEachFeature={(feature: Feature, layer) => {
              const b = byId[feature.properties?.barangay_id];
              const name = b?.name ?? feature.properties?.name ?? feature.properties?.barangay_id ?? "Unknown barangay";
              const value = valueOf(b);
              const tip = document.createElement("div");
              const title = document.createElement("strong");
              title.textContent = name;
              tip.append(title, document.createElement("br"), `${layerName}: ${value == null || !Number.isFinite(value) ? "No data" : `${value.toFixed(1)}/100`}`);
              if (filter !== "score" && b) tip.append(document.createElement("br"), `Healthcare need: ${b.score}/100`);
              layer.bindTooltip(tip, { sticky: true, className: "risk-hover" });
              if (layer instanceof Path) {
                layer.on("mouseover", () => { layer.setStyle({ color: "#451A1A", weight: 3 }); layer.bringToFront(); });
                layer.on("mouseout", () => layer.setStyle({ color: "#FFFFFF", weight: 1.5 }));
                layer.on("click", () => { if (b) setSelectedId(b.id); });
              }
            }}
          />
          <GeoJSON key={`labels-${layerKey}`} data={territoryData}
            style={{ opacity: 0, fillOpacity: 0, interactive: false }}
            onEachFeature={(feature, layer) => {
              const b = byId[feature.properties?.barangay_id];
              const label = document.createElement("span");
              const name = String(b?.name ?? feature.properties?.name ?? feature.properties?.barangay_id ?? "").replace(/^Demo /, "");
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
      {selected && !publicMode && (
        <div className="map-detail">
          <button
            className="icon-button detail-close"
            aria-label="Close barangay details"
            onClick={() => setSelectedId(null)}
          >
            <X size={17} />
          </button>
          <span className="eyebrow">SYNTHETIC BARANGAY · {selected.id}</span>
          <h3>{selected.name}</h3>
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
          : `${boundaries.geojson ? boundaries.source : "DEMONSTRATION GEOGRAPHY | Synthetic territories; not actual Laguna barangay boundaries"} | Backend scores /100 | Scroll to zoom; drag to pan`}

      </div>
    </div>
  );
}
