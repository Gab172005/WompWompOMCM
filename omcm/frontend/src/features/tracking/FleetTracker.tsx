import { Fragment, useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  GeoJSON,
  Marker,
  Polyline,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import { divIcon, latLngBounds } from "leaflet";
import type { Config, Plan } from "../../types";
import { activeHazards, type Pilot } from "../../services/pilot";
import { fleetVehicleAt, type FleetRun } from "../../services/fleet";
export interface MapLayers {
  need: boolean;
  hazards: boolean;
  routes: boolean;
  trails: boolean;
  candidates: boolean;
  coverage: boolean;
  eta: boolean;
}
export function ClinicTracker({
  pilot,
  plan,
  config,
  runs,
  elapsed,
  selected,
  setSelected,
  follow,
  fitRequest,
  layers,
  onToggleRoad,
}: {
  pilot: Pilot;
  plan: Plan | null;
  config: Config;
  runs: FleetRun[];
  elapsed: number;
  selected: string;
  setSelected: (id: string) => void;
  follow: boolean;
  fitRequest: number;
  layers: MapLayers;
  onToggleRoad?: (id: string) => void;
}) {
  const map = useMap(),
    lastPan = useRef(0);
  const blocked = activeHazards(pilot, config);
  useEffect(() => {
    if (!fitRequest || !runs.length) return;
    const points = runs.flatMap((r) =>
      r.route.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    );
    map.fitBounds(latLngBounds(points), {
      padding: [35, 55],
      maxZoom: 14,
      animate: false,
    });
  }, [fitRequest, map, runs]);
  useEffect(() => {
    const run = runs.find((r) => r.clinicId === selected);
    if (!run || !follow || performance.now() - lastPan.current < 400) return;
    const { position } = fleetVehicleAt(run, elapsed);
    map.panTo([position[1], position[0]], { animate: true, duration: 0.3 });
    lastPan.current = performance.now();
  }, [elapsed, selected, follow, map, runs]);
  const icons = useMemo(
    () =>
      Object.fromEntries(
        runs.map((run, i) => [
          run.clinicId,
          divIcon({
            className: "fleet-marker",
            iconSize: [44, 44],
            iconAnchor: [22, 22],
            html: `<div class="van ${selected === run.clinicId ? "selected" : ""}" style="--vehicle-color:${run.color}"><svg viewBox="0 0 32 26" aria-hidden="true"><path d="M3 6h17l8 8v8H3z" fill="white"/><path d="M20 8v7h7" fill="#dceaff"/><path d="M10 9v9m-4-4h8" stroke="${run.color}" stroke-width="3"/><circle cx="9" cy="22" r="3" fill="#243044"/><circle cx="24" cy="22" r="3" fill="#243044"/></svg><span>${i + 1}</span></div>`,
          }),
        ]),
      ),
    [runs, selected],
  );
  return (
    <>
      {layers.hazards &&
        pilot.hazards.features
          .filter((f) => blocked.has(f.properties.id))
          .map((f) => (
            <GeoJSON
              key={f.properties.id}
              data={f}
              style={{
                color: "#b91c1c",
                weight: 2,
                dashArray: "6 5",
                fillColor: "#dc2626",
                fillOpacity: 0.2,
              }}
            >
              <Popup>
                {f.properties.name} · Entire barangay footprint assumed
                inundated for this demo; not an official flood map.
              </Popup>
            </GeoJSON>
          ))}
      {(layers.hazards || onToggleRoad) &&
        pilot.closures
          .filter((c) => onToggleRoad || config.closed_roads.includes(c.id))
          .map((c) => (
            <Polyline
              key={c.id}
              className="simulation-road"
              positions={c.coordinates.map(([lng, lat]) => [lat, lng])}
              eventHandlers={{ click: () => onToggleRoad?.(c.id) }}
              pathOptions={{
                color: config.closed_roads.includes(c.id)
                  ? "#dc2626"
                  : "#2563eb",
                weight: 9,
                dashArray: "4 4",
              }}
            >
              <Tooltip permanent>
                {config.closed_roads.includes(c.id)
                  ? "SIMULATED CLOSURE"
                  : "CLICK TO BLOCK ROAD"}
              </Tooltip>
              <Popup>
                {c.name}. Intersecting fixture routes excluded; reroute
                unverified.
              </Popup>
            </Polyline>
          ))}
      {layers.candidates &&
        pilot.sites.map((site) => (
          <CircleMarker
            key={site.id}
            center={[site.lat, site.lng]}
            radius={
              plan?.optimized.clinics.some((c) => c.id === site.id) ? 8 : 5
            }
            pathOptions={{
              color: "#475569",
              weight: 2,
              fillColor: "white",
              fillOpacity: 1,
            }}
            eventHandlers={{
              click: () => {
                const run = runs.find((r) => r.siteId === site.id);
                if (run) setSelected(run.clinicId);
              },
            }}
          >
            <Tooltip>
              {site.id} · {site.name}
            </Tooltip>
            <Popup>
              {site.name}
              <br />
              OSRM-snapped road location. Facility suitability unverified.
              <br />
              Site capacity: {site.capacity} demo appointments/day.
            </Popup>
          </CircleMarker>
        ))}
      <CircleMarker
        center={[pilot.depot.lat, pilot.depot.lng]}
        radius={6}
        pathOptions={{ color: "#0f172a", fillColor: "white", fillOpacity: 1 }}
      >
        <Tooltip>{pilot.depot.name}</Tooltip>
      </CircleMarker>
      {runs.map((run) => {
        const state = fleetVehicleAt(run, elapsed);
        return (
          <Fragment key={run.clinicId}>
            {layers.routes && run.route.length > 0 && (
              <Polyline
                interactive={false}
                positions={run.route.coordinates.map(([lng, lat]) => [
                  lat,
                  lng,
                ])}
                pathOptions={{
                  color: run.color,
                  weight: selected === run.clinicId ? 5 : 3,
                  opacity: selected === run.clinicId ? 0.9 : 0.55,
                }}
              >
                <Tooltip>{run.clinicId} · SIMULATED OSRM road route</Tooltip>
              </Polyline>
            )}
            {layers.trails && state.trail.length > 1 && (
              <Polyline
                interactive={false}
                positions={state.trail.map(([lng, lat]) => [lat, lng])}
                pathOptions={{ color: run.color, weight: 6, opacity: 0.95 }}
              />
            )}
            <Marker
              position={[state.position[1], state.position[0]]}
              icon={icons[run.clinicId]}
              zIndexOffset={selected === run.clinicId ? 1500 : 1000}
              title={`${run.clinicId}: simulated vehicle position`}
              eventHandlers={{ click: () => setSelected(run.clinicId) }}
            >
              <Tooltip permanent={layers.eta} direction="top" offset={[0, -20]}>
                {run.clinicId} · SIMULATED · {state.status}
                {!run.blockedReason && ` · ${Math.ceil(state.eta / 60)} min`}
              </Tooltip>
              <Popup>
                {run.clinicId} · Simulated vehicle position
                {run.blockedReason && <p>{run.blockedReason}</p>}
                <br />
                {state.status} · {(state.remaining / 1000).toFixed(2)} km
                remaining
                <br />
                Heading {Math.round(state.heading)}° · Modeled{" "}
                {Math.round(state.speed)} km/h
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </>
  );
}
