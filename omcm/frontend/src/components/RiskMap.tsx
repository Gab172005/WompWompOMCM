import { useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Marker,
  Polyline,
  GeoJSON,
} from "react-leaflet";
import { divIcon } from "leaflet";
import type { Feature } from "geojson";
import { Hospital as HospitalIcon, MapPin, Navigation, X } from "lucide-react";
import { useOMCM } from "../services/store";
import type { Barangay, Clinic, Factor } from "../types";
import { colors, NeedBadge, number } from "./ui";
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
const level = (n: number) =>
  n >= 70 ? "Critical" : n >= 50 ? "High" : n >= 30 ? "Moderate" : "Low";
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
    [selected, setSelected] = useState<Barangay | null>(null),
    [tilesUnavailable, setTilesUnavailable] = useState(false);
  const shownClinics = clinics ?? plan?.optimized.clinics ?? [];
  const byId = useMemo(
    () => Object.fromEntries(barangays.map((b) => [b.id, b])),
    [barangays],
  );
  function mapColor(b: Barangay) {
    return colors[
      level(
        filter === "score" ? b.score : b.factors[filter],
      ) as keyof typeof colors
    ];
  }
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
        scrollWheelZoom={false}
        className="risk-map"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setTilesUnavailable(true) }}
        />
        {!publicMode && boundaries.geojson && (
          <GeoJSON
            key={`${boundaries.updated_at}-${filter}`}
            data={boundaries.geojson}
            style={(feature) => {
              const b = byId[feature?.properties?.barangay_id];
              return {
                color: b ? mapColor(b) : "#8297a3",
                weight: 2,
                fillOpacity: 0.25,
              };
            }}
            onEachFeature={(feature: Feature, layer) => {
              const b = byId[feature.properties?.barangay_id];
              if (b) layer.on("click", () => setSelected(b));
            }}
          />
        )}
        {!publicMode &&
          barangays.map((b) => (
            <CircleMarker
              key={b.id}
              center={[b.lat, b.lng]}
              className="barangay-marker"
              radius={selected?.id === b.id ? 13 : 9}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: mapColor(b),
                fillOpacity: 0.9,
              }}
              eventHandlers={{ click: () => setSelected(b) }}
            >
              <Popup>
                <strong>{b.name}</strong>
                <br />
                Demo healthcare need: {b.score}/100
                <br />
                Estimated demand: {number(b.demand)} appointments
              </Popup>
            </CircleMarker>
          ))}
        {hospitals.map((h) => (
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
          sites
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
        {shownClinics.map((c) => (
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
            onClick={() => setSelected(null)}
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
          Object.entries(colors).map(([label, color]) => (
            <span key={label}>
              <i style={{ background: color }} />
              {label}
            </span>
          ))}
        <span>
          <HospitalIcon size={13} /> Hospital
        </span>
        <span>
          <MapPin size={13} /> {publicMode ? "Approved clinic" : "Clinic hub"}
        </span>
      </div>
      <div className="map-caption">
        Demo Data ·{" "}
        {boundaries.geojson && !publicMode
          ? "Administrator-supplied boundaries"
          : "Synthetic point locations; no official barangay boundaries"}{" "}
        ·{" "}
        {tilesUnavailable
          ? "Base map unavailable; local markers remain usable"
          : "OpenStreetMap base map"}
      </div>
    </div>
  );
}
