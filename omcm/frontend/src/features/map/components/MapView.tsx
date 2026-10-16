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
import { LagunaMask } from "../../../components/LagunaMask";
import { containsLagunaPoint } from "../../../services/maps";
import { useMunicipalities } from "../../../hooks/useMunicipalities";
import { coveredMunicipalities } from "../../../services/municipalities";
import { Hospital as HospitalIcon, MapPin, Navigation, X } from "lucide-react";
import { useOMCM } from "../../../store/LegacyProvider";
import { areaKm2, metricNames, type MapMetric } from "../../../components/mapMetrics";
import type { Barangay, Clinic } from "../../../types";
import { NeedBadge, number } from "../../../components/ui/LegacyUI";
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
  onMunicipalitySelect,
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
  onMunicipalitySelect?: (name: string) => void;
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
  const [filter, setFilter] = useState<MapMetric>("score"),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [tilesUnavailable, setTilesUnavailable] = useState(false);
  const [search, setSearch] = useState("");
  const [showHospitals, setShowHospitals] = useState(true);
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
  const layerName = metricNames[filter];
  const visibleTerritories = territoryData;
  const searchResults =
    territoryData?.features.filter((f) =>
      f.properties.name.toLowerCase().includes(search.trim().toLowerCase()),
    ) ?? [];
  function selectMunicipality(id: string) {
    setSelectedId(id);
    const feature = territoryData?.features.find(
      (f) => f.properties.area_id === id,
    );
    if (feature) onMunicipalitySelect?.(feature.properties.name);
    setSearch("");
  }
  const inside = (lat: number, lng: number) =>
    !!territoryData && containsLagunaPoint(territoryData, lng, lat);
  const densities = useMemo(
    () =>
      Object.fromEntries(
        (territoryData?.features ?? []).flatMap((f) => {
          const record = areaRecords[f.properties.area_id];
          const area = areaKm2(f.geometry);
          return record && area > 0
            ? [[f.properties.area_id, record.population / area]]
            : [];
        }),
      ),
    [territoryData, areaRecords],
  );
  const densityMax = Math.max(1, ...Object.values(densities));
  const layerKey = useMemo(
    () =>
      JSON.stringify([filter, municipalities, visibleTerritories, publicMode]),
    [filter, municipalities, visibleTerritories, publicMode],
  );
  return (
    <div className="map-shell">
      {!publicMode && (
        <div className="map-toolbar map-filter-card">
          <label>
            Municipality search
            <input
              type="search"
              aria-label="Municipality search"
              placeholder="Search municipality…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchResults[0])
                  selectMunicipality(searchResults[0].properties.area_id);
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={showHospitals}
              onChange={(e) => setShowHospitals(e.target.checked)}
            />{" "}
            Hospitals & medical facilities
          </label>
          {search.trim() && (
            <div
              className="municipality-results"
              role="group"
              aria-label="Municipality search results"
            >
              {searchResults.map((f) => (
                <button
                  key={f.properties.area_id}
                  onClick={() => selectMunicipality(f.properties.area_id)}
                >
                  {f.properties.name}
                </button>
              ))}
              {!searchResults.length && (
                <span role="status">No matching Laguna municipalities</span>
              )}
            </div>
          )}
          <span>
            <span className="live-dot" />
            Laguna · Cities & municipalities
          </span>
          <label className="sr-only" htmlFor="map-layer">
            Map layer
          </label>
          <button
            className="map-overlay-toggle"
            onClick={() => {
              setSelectedId(null);
              setRecenter((n) => n + 1);
            }}
          >
            Recenter
          </button>
          <div
            className="map-metric-chips"
            role="group"
            aria-label="Heatmap metric"
          >
            {(
              [
                ["density", "Population density"],
                ["flood", "Flood risk"],
                ["disease", "Morbidity"],
                ["score", "Overall need"],
              ] as const
            ).map(([metric, label]) => (
              <button
                key={metric}
                className="map-overlay-toggle"
                aria-pressed={filter === metric}
                onClick={() => setFilter(metric)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {territoryData && (
        <MapContainer
          center={[14.215, 121.208]}
          zoom={11}
          zoomSnap={0.1}
          zoomAnimation={false}
          markerZoomAnimation={false}
          scrollWheelZoom={true}
          maxBoundsViscosity={1}
          maxZoom={18}
          className={`risk-map ${publicMode ? "" : "choropleth-map"}`}
        >
          <TileLayer
            key={tileAttempt}
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            eventHandlers={{ tileerror: () => setTilesUnavailable(true) }}
          />
          {visibleTerritories && (
            <Heatmap
              fullData={territoryData!}
              data={visibleTerritories}
              densities={densities}
              densityMax={densityMax}
              records={areaRecords}
              filter={filter}
              layerName={layerName}
              layerKey={layerKey}
              selectedId={selectedId}
              onSelect={selectMunicipality}
              coverageIds={municipalityCoverage}
              needVisible={needVisible}
              publicMode={publicMode}
              recenter={recenter}
            />
          )}
          {showHospitals &&
            hospitals
              .filter((h) => inside(h.lat, h.lng))
              .map((h) => (
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
            showHospitals &&
            sites
              .filter(
                (s) =>
                  inside(s.lat, s.lng) &&
                  !shownClinics.some((c) => c.id === s.id),
              )
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
          {shownClinics
            .filter((c) => inside(c.lat, c.lng))
            .map((c) => (
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
                  SIMULATED · Proposed deployment
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
      )}
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
        <div
          className="map-geography-status"
          role={geographyError ? "alert" : "status"}
        >
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
              "Municipality need rank",
              "Top contributing factors",
            ].map((field) => (
              <div key={field}>
                {field}
                <strong>No data</strong>
              </div>
            ))}
          </div>
          <h4>Barangay list</h4>
          <p>No barangay records available.</p>
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
          <h4>Top contributing factors</h4>
          <p className="tiny">
            Population-weighted rollup of barangay score contributions.
          </p>
          {Object.entries(selected.contributions)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 3)
            .map(([key, value]) => (
              <div className="summary-line" key={key}>
                <span>
                  {key === "accessibility"
                    ? "Hospital access"
                    : key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
                <strong>{value.toFixed(1)} points</strong>
              </div>
            ))}
          <div className="detail-grid">
            <div>
              Municipality need rank
              <strong>
                {selected.rank} of {municipalities.length} areas with data
              </strong>
            </div>
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
          <h4>Barangay list</h4>
          {selected.aggregated ? (
            <ul className="municipality-barangays">
              {barangays
                .filter((b) => selected.source_ids.includes(b.id))
                .map((b) => (
                  <li key={b.id}>
                    <strong>{b.name}</strong>
                    <span>
                      {number(b.population)} residents · Need {b.score}/100
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p>
              No barangay records available; indicators use the municipal record
              (estimated).
            </p>
          )}
          <details>
            <summary>All score contributions</summary>
            {Object.entries(selected.contributions).map(([key, value]) => (
              <p className="tiny" key={key}>
                {key}: {value.toFixed(1)} points
              </p>
            ))}
          </details>
          <p className="tiny">
            Boundary: 2023 PSGC snapshot · Health inputs: 2026-10-15 ·
            Confidence: synthetic. Illustrative synthetic data — not reported
            disease cases.
          </p>
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
        {!publicMode && (
          <strong>
            {layerName}
            {filter === "density" ? "" : " · 0–100"}
          </strong>
        )}
        <span>
          <i className="municipality-border-key" /> City / municipality border
        </span>
        {!publicMode &&
          riskScale.map(({ label, color, range, min }, index) => (
            <span key={label}>
              <i style={{ background: color }} />
              {filter === "score" ? label : ""}{" "}
              <small>
                {filter === "density"
                  ? index === riskScale.length - 1
                    ? `≥${Math.round((min * densityMax) / 100)} people/km²`
                    : `${Math.round((min * densityMax) / 100)}–${Math.round(((riskScale[index + 1]?.min ?? 100) * densityMax) / 100)} people/km²`
                  : range}
              </small>
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
      <div className="map-caption">
        {territoryData
          ? `${uploadedGeometry ? "Bundled Laguna boundaries" : geography?.source} | ${territoryData.features.length} city / municipality borders${publicMode ? " | Approved demo deployments" : ` | ${matchedCount} areas with healthcare data | Gray: no data | Scores weighted by source population; totals cover available records only`}${municipalityCoverage.size ? " | Blue borders: contain assigned communities, not full municipal coverage" : ""} | Scroll to zoom; drag to pan${geography?.warning ? ` | ${geography.warning}` : ""}`
          : geographyError || "Loading Laguna city and municipality boundaries"}
      </div>
    </div>
  );
}
