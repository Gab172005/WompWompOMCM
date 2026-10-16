import { useMemo, useState, type ReactNode } from "react";
import {
  MapContainer,
  TileLayer,
  Popup,
  Marker,
  Polyline,
} from "react-leaflet";
import { divIcon } from "leaflet";
import { riskScale } from "./choropleth";
import { Heatmap } from "./Heatmap";
import { LagunaMask } from "./LagunaMask";
import { useMunicipalities } from "../hooks/useMunicipalities";
import { coveredMunicipalities } from "../services/municipalities";
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
    iconAnchor:
      kind === "hospital" ? [-8, 32] : kind === "clinic" ? [37, -8] : [32, -8],
  });
export function MapView({
  clinics,
  data,
  closedRoads = [],
  floodedSites = [],
  showRoads = false,
  publicMode = false,
  scheduleInfo = "",
  services = [],
  children,
  needVisible = true,
  coverageIds = [],
}: {
  clinics?: Clinic[];
  data?: Barangay[];
  closedRoads?: string[];
  floodedSites?: string[];
  showRoads?: boolean;
  publicMode?: boolean;
  scheduleInfo?: string;
  services?: string[];
  children?: ReactNode;
  needVisible?: boolean;
  coverageIds?: string[];
}) {
  const {
    barangays: currentBarangays,
    sites,
    hospitals,
    boundaries,
    roads,
    plan,
  } = useOMCM();
  const barangays = data ?? plan?.barangays ?? currentBarangays;
  const {
    geography,
    geographyError,
    territoryData,
    municipalities,
    uploadedGeometry,
  } = useMunicipalities(barangays, boundaries);
  const [filter, setFilter] = useState<Factor | "score">("score"),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [showFacilities, setShowFacilities] = useState(publicMode || showRoads),
    [tilesUnavailable, setTilesUnavailable] = useState(false);
  const [recenter, setRecenter] = useState(0),
    [tileAttempt, setTileAttempt] = useState(0);
  const shownClinics = clinics ?? plan?.optimized.clinics ?? [];
  const byId = useMemo(
    () => Object.fromEntries(barangays.map((b) => [b.id, b])),
    [barangays],
  );
  const areaRecords = useMemo(
    () => Object.fromEntries(municipalities.map((area) => [area.id, area])),
    [municipalities],
  );
  const municipalityCoverage = useMemo(
    () => coveredMunicipalities(municipalities, coverageIds),
    [municipalities, coverageIds],
  );
  const selectedArea = territoryData?.features.find(
    (f) => f.properties.area_id === selectedId,
  )?.properties;
  const selected = selectedId ? areaRecords[selectedId] : undefined;
  const matchedCount = Object.values(areaRecords).filter(Boolean).length;
  const layerName =
    filter === "score"
      ? "Healthcare need"
      : filter === "disease"
        ? "Disease risk"
        : filter === "vulnerability"
          ? "Population vulnerability"
          : filter === "flood"
            ? "Flood exposure"
            : "Hospital inaccessibility";
  const layerKey = useMemo(
    () => JSON.stringify([filter, municipalities, territoryData, publicMode]),
    [filter, municipalities, territoryData, publicMode],
  );
  return (
    <div className="map-shell">
      {!publicMode && (
        <div className="map-toolbar">
          <span>
            <span className="live-dot" />
            Laguna · Cities & municipalities
          </span>
          <label className="sr-only" htmlFor="map-layer">
            Map layer
          </label>
          <button
            className="map-overlay-toggle"
            aria-pressed={showFacilities}
            onClick={() => setShowFacilities(!showFacilities)}
          >
            Facilities {showFacilities ? "on" : "off"}
          </button>
          <button
            className="map-overlay-toggle"
            onClick={() => setRecenter((n) => n + 1)}
          >
            Recenter
          </button>
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
        zoomAnimation={false}
        markerZoomAnimation={false}
        scrollWheelZoom={true}
        className={`risk-map ${publicMode ? "" : "choropleth-map"}`}
      >
        <TileLayer
          key={tileAttempt}
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setTilesUnavailable(true) }}
        />
        {territoryData && (
          <Heatmap
            data={territoryData}
            records={areaRecords}
            filter={filter}
            layerName={layerName}
            layerKey={layerKey}
            selectedId={selectedId}
            onSelect={setSelectedId}
            coverageIds={municipalityCoverage}
            needVisible={needVisible}
            publicMode={publicMode}
            recenter={recenter}
          />
        )}
        {showFacilities &&
          hospitals.map((h) => (
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
          showFacilities &&
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
        {(publicMode || showFacilities) &&
          shownClinics.map((c) => (
            <Marker key={c.id} position={[c.lat, c.lng]} icon={icon("clinic")}>
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
        {children}
        <LagunaMask data={territoryData} />
      </MapContainer>
      {tilesUnavailable && (
        <div className="map-caption" role="status">
          Some OpenStreetMap tiles could not load. Internet access is needed for
          the street basemap.{" "}
          <button
            className="text-link"
            onClick={() => {
              setTilesUnavailable(false);
              setTileAttempt((n) => n + 1);
            }}
          >
            Retry tiles
          </button>
        </div>
      )}
      {!territoryData && (
        <div className="map-geography-status" role="status">
          {geographyError || "Loading real Laguna boundaries…"}
        </div>
      )}
      {selectedArea && !selected && !publicMode && (
        <div className="map-detail">
          <button
            className="icon-button detail-close"
            aria-label="Close municipality details"
            onClick={() => setSelectedId(null)}
          >
            <X size={17} />
          </button>
          <span className="eyebrow">
            LAGUNA CITY / MUNICIPALITY · PSGC {selectedArea.area_id}
          </span>
          <h3>{selectedArea.name}</h3>
          <p>Laguna</p>
          <strong className="detail-score">No data</strong>
          <p>
            No healthcare records are available for this city or municipality.
            Its boundary remains visible for geographic context.
          </p>
          <div className="detail-grid">
            {[
              "Population",
              "Disease burden",
              "Vulnerability",
              "Flood exposure",
              "Hospital accessibility",
              "Overall healthcare need",
            ].map((field) => (
              <div key={field}>
                {field}
                <strong>No data</strong>
              </div>
            ))}
          </div>
        </div>
      )}
      {selectedArea && selected && !publicMode && (
        <div className="map-detail">
          <button
            className="icon-button detail-close"
            aria-label="Close municipality details"
            onClick={() => setSelectedId(null)}
          >
            <X size={17} />
          </button>
          <span className="eyebrow">
            LAGUNA CITY / MUNICIPALITY · PSGC {selectedArea.area_id}
          </span>
          <h3>{selectedArea.name}</h3>
          <p>
            {selected.aggregated
              ? `${selected.barangay_count} available barangay records · Population-weighted indicators`
              : "City / municipality healthcare record"}
          </p>
          <NeedBadge level={selected.level} />
          <strong className="detail-score">
            {selected.score}
            <small>/100 need</small>
          </strong>
          <div className="detail-grid">
            <div>
              Represented population
              <strong>{number(selected.population)}</strong>
            </div>
            <div>
              Children / elderly
              <strong>
                {selected.children_pct?.toFixed(1) ?? "—"}% /{" "}
                {selected.elderly_pct?.toFixed(1) ?? "—"}%
              </strong>
            </div>
            <div>
              Poverty indicator
              <strong>{selected.factors.poverty.toFixed(1)}%</strong>
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
              ? "Hospital access unavailable for one or more records"
              : `${selected.hospital_minutes} min · demo travel`}
          </p>
          <p className="explanation">{selected.explanation}</p>
          <h4>Score contributions</h4>
          {Object.entries(selected.contributions).map(([key, value]) => (
            <div className="summary-line" key={key}>
              <span>{key}</span>
              <strong>{value.toFixed(1)} / 100</strong>
            </div>
          ))}
          <p className="tiny">
            Boundary: 2023 PSGC snapshot · Health inputs: 2026-10-15 ·
            Confidence: synthetic. Illustrative synthetic data — not reported
            disease cases.
          </p>
          <h4>Illustrative 7-day disease-indicator trend</h4>
          <svg
            viewBox="0 0 210 60"
            role="img"
            aria-label="Synthetic disease indicator trend, illustrative values only"
            style={{ width: "100%", height: 60 }}
          >
            {[0.7, 0.72, 0.81, 0.77, 0.85, 0.9, 1].map((scale, i) => (
              <rect
                key={i}
                x={i * 30 + 4}
                y={55 - scale * 45}
                width="20"
                height={scale * 45}
                fill="#dc2626"
              >
                <title>
                  Demo day {i + 1}:{" "}
                  {(selected.disease_per_1000 * scale).toFixed(1)} per 1,000
                  (synthetic)
                </title>
              </rect>
            ))}
          </svg>
          <small>
            Generated illustration ending at the selected synthetic indicator;
            no observed time series is available.
          </small>
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
        <span>
          <i className="municipality-border-key" /> City / municipality border
        </span>
        {!publicMode &&
          riskScale.map(({ label, color, range }) => (
            <span key={label}>
              <i style={{ background: color }} />
              {label} <small>{range}</small>
            </span>
          ))}
        {!publicMode && (
          <span>
            <i style={{ background: "#D1D5DB" }} />
            No data
          </span>
        )}
        <span>
          <HospitalIcon size={13} /> Hospital
        </span>
        <span>
          <MapPin size={13} /> {publicMode ? "Approved clinic" : "Clinic hub"}
        </span>
      </div>
      {!publicMode && territoryData && (
        <label className="map-inspector">
          Inspect city or municipality
          <select
            aria-label="Inspect city or municipality"
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
          >
            <option value="">Choose a city or municipality</option>
            {territoryData.features.map((f) => (
              <option key={f.properties.area_id} value={f.properties.area_id}>
                {f.properties.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="map-caption">
        {territoryData
          ? `${uploadedGeometry ? "Verified city / municipality boundary overrides" : geography?.source} | ${territoryData.features.length} city / municipality borders${publicMode ? " | Approved demo deployments" : ` | ${matchedCount} areas with healthcare data | Gray: no data | Scores weighted by source population; totals cover available records only`}${municipalityCoverage.size ? " | Blue borders: contain assigned communities, not full municipal coverage" : ""} | Scroll to zoom; drag to pan${geography?.warning ? ` | ${geography.warning}` : ""}`
          : geographyError || "Loading Laguna city and municipality boundaries"}
      </div>
    </div>
  );
}
