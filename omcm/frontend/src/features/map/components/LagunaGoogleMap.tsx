import { simulationMetricLabels } from "../../../services/planningLanguage";
import { COVERAGE_RADIUS_KM } from "../../../services/forecasting/interventions";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useMemo } from "react";
import {
  LAGUNA_BOUNDS,
  LAGUNA_CENTER,
  getMetricColor,
  getSimulationNeedColor,
  interpolateRoutePosition,
} from "../../../services/lagunaData";

import type { MapProps } from "./mapTypes";
import {
  clinicMarkerSvg,
  hospitalMarkerSvg,
  mobileClinicSvg,
  svgDataUrl,
} from "./facilityIcons";
import {
  BARANGAYS_BY_PSGC,
  OSM_CLINIC_SNAPSHOT,
  barangayMetric,
  barangayMetricLabel,
} from "../../../services/providedData";
import type { LocatedOsmClinic } from "../../../types/osmClinic";
import { isEligibleHospital } from "../../../services/healthcareNeed";
import {
  FOREST_LAND_GEOMETRY,
  FOREST_LAND_RESTRICTION,
  PAETE_FOREST_LAND,
} from "../../../services/mapLandmarks";
import {
  osmClinicLink,
  osmClinicPopupText,
  osmClinicReference,
  isDrawableOsmClinic,
} from "./osmClinicPopup";
interface LagunaGoogleMapProps extends MapProps {
  onAuthFailure?: (message: string) => void;
}

/**
 * Builds popup content from DOM nodes and `textContent` only, so facility names,
 * operators and warnings can never inject markup into the Google Maps DOM.
 */
function osmClinicContent(
  clinic: LocatedOsmClinic,
  snapshot?: { retrievedAt: string | null } | null,
): HTMLElement {
  const text = osmClinicPopupText(clinic, snapshot);
  const root = document.createElement("div");
  root.className = "osm-clinic-info-window";
  root.style.color = "#0f172a";
  root.style.fontFamily = "sans-serif";
  root.style.padding = "6px";
  root.style.maxWidth = "260px";
  const title = document.createElement("strong");
  title.style.fontSize = "14px";
  title.style.color = "#6d28d9";
  title.textContent = text.title;
  root.appendChild(title);
  for (const row of text.rows) {
    const line = document.createElement("div");
    line.style.fontSize = "12px";
    line.style.marginTop = "4px";
    line.textContent = row;
    root.appendChild(line);
  }
  for (const warning of text.warnings) {
    const line = document.createElement("div");
    line.style.fontSize = "11px";
    line.style.color = "#b45309";
    line.style.marginTop = "4px";
    line.textContent = `Warning: ${warning}`;
    root.appendChild(line);
  }
  const link = document.createElement("a");
  link.href = osmClinicLink(clinic);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "inline-block";
  link.style.marginTop = "6px";
  link.style.fontSize = "12px";
  link.textContent = `OpenStreetMap ${osmClinicReference(clinic)}`;
  root.appendChild(link);
  return root;
}

export function LagunaGoogleMap({
  municipalities,
  selectedPsgc,
  selectedBarangayPsgc,
  selectionRevision = 0,
  onSelectBarangay,
  activeMetric,
  showHospitals,
  showClinics,
  showOsmClinics,
  hospitals,
  proposedClinics,
  osmClinics,
  simulationActive,
  forecastOverlay,
  simulationProgress,
  selectedClinicId,
  onSelectClinic,
  disruptions,
  recenterTrigger,
  zoomDelta,
  publicMode = false,
  onAuthFailure,
}: LagunaGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const previousZoom = useRef(zoomDelta);
  useEffect(() => {
    const change = zoomDelta - previousZoom.current;
    previousZoom.current = zoomDelta;
    const map = mapInstanceRef.current;
    if (map && change)
      map.setZoom(Math.max(10, Math.min(15, (map.getZoom() ?? 11) + change)));
  }, [zoomDelta]);
  const maskPolygonRef = useRef<google.maps.Polygon | null>(null);
  const hospitalMarkersRef = useRef<google.maps.Marker[]>([]);
  const hospitalInfoRef = useRef<google.maps.InfoWindow | null>(null);
  const hospitalListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const osmClinicMarkersRef = useRef<google.maps.Marker[]>([]);
  const osmClinicListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const osmClinicInfoRef = useRef<google.maps.InfoWindow | null>(null);
  const clinicMarkersRef = useRef<google.maps.Marker[]>([]);
  const animatedMarkersRef = useRef<google.maps.Marker[]>([]);
  const disruptionPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const clinicRoutePolylinesRef = useRef<google.maps.Polyline[]>([]);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [geoError, setGeoError] = useState<string>("");
  const [hoveredInfo, setHoveredInfo] = useState<{
    name: string;
    value: string;
    x: number;
    y: number;
  } | null>(null);

  // Map of municipalities by PSGC for fast metric lookups
  const byPsgc = useMemo(
    () => new Map(municipalities.map((m) => [m.psgc, m])),
    [municipalities],
  );

  // Load official Laguna Municipalities GeoJSON
  useEffect(() => {
    let isMounted = true;
    Promise.all(
      ["laguna_municipalities", "laguna_barangays"].map(async (name) => {
        const response = await fetch(
          `${import.meta.env.BASE_URL}assets/geo/${name}.geojson`,
        );
        if (!response.ok)
          throw new Error("Laguna boundary file missing or unreadable");
        return response.json();
      }),
    )
      .then((collections) => ({
        type: "FeatureCollection",
        features: [
          ...collections.flatMap((c) => c.features),
          ...FOREST_LAND_GEOMETRY.features,
        ],
      }))
      .then((data) => {
        if (isMounted) setGeoJsonData(data);
      })
      .catch((err) => {
        if (isMounted) setGeoError(err.message);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Report Google Maps authentication failures without leaking a window handler
  const authFailureHandlerRef = useRef<((message: string) => void) | undefined>(
    undefined,
  );
  authFailureHandlerRef.current = onAuthFailure;
  useEffect(() => {
    const target = window as any;
    // A handler left by this component's earlier mount is ours to replace, not chain.
    const previous = target.gm_authFailure;
    const handler = () => {
      console.warn("Google Maps authentication failed.");
      authFailureHandlerRef.current?.(
        "Google Maps API authentication failed. Verify API key and billing on Google Cloud Platform.",
      );
      // Forward only to a handler another owner installed.
      if (typeof previous === "function") previous();
    };
    target.gm_authFailure = handler;
    return () => {
      // Restore the pre-existing handler (or remove ours) so a mock or another
      // script is not left chained to this unmounted component.
      if (target.gm_authFailure === handler)
        target.gm_authFailure = previous ?? undefined;
    };
  }, []);

  // Initialize Google Maps instance
  useEffect(() => {
    if (!containerRef.current || !window.google?.maps || mapInstanceRef.current)
      return;

    const bounds = new google.maps.LatLngBounds(
      { lat: LAGUNA_BOUNDS.south, lng: LAGUNA_BOUNDS.west },
      { lat: LAGUNA_BOUNDS.north, lng: LAGUNA_BOUNDS.east },
    );

    const map = new google.maps.Map(containerRef.current, {
      center: LAGUNA_CENTER,
      zoom: 11,
      minZoom: 10,
      maxZoom: 15,
      restriction: {
        latLngBounds: bounds,
        strictBounds: true,
      },
      mapTypeId: "roadmap",
      disableDefaultUI: true,
      zoomControl: false,
      styles: [
        {
          featureType: "administrative.province",
          elementType: "geometry.stroke",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "administrative.neighborhood",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "water",
          elementType: "geometry.fill",
          stylers: [{ color: "#0ea5e9" }, { lightness: -20 }],
        },
      ],
    });

    mapInstanceRef.current = map;
    map.fitBounds(bounds, { top: 30, right: 30, bottom: 30, left: 30 });
  }, []);

  // Recenter trigger
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;
    const bounds = new google.maps.LatLngBounds(
      { lat: LAGUNA_BOUNDS.south, lng: LAGUNA_BOUNDS.west },
      { lat: LAGUNA_BOUNDS.north, lng: LAGUNA_BOUNDS.east },
    );
    mapInstanceRef.current.fitBounds(bounds, {
      top: 40,
      right: 40,
      bottom: 40,
      left: 40,
    });
  }, [recenterTrigger]);

  // Load and apply Laguna Mask Polygon to completely obscure areas outside Laguna
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    fetch(`${import.meta.env.BASE_URL}assets/geo/laguna_province.geojson`)
      .then((r) => r.json())
      .then((provData) => {
        if (!mapInstanceRef.current) return;
        if (maskPolygonRef.current) {
          maskPolygonRef.current.setMap(null);
        }

        const feature = provData.features[0];
        if (!feature) return;

        // Extract outer coordinates of Laguna province
        let lagunaCoords: Array<{ lat: number; lng: number }> = [];
        const geom = feature.geometry;
        if (geom.type === "Polygon") {
          lagunaCoords = geom.coordinates[0].map(
            ([lng, lat]: [number, number]) => ({
              lat,
              lng,
            }),
          );
        } else if (geom.type === "MultiPolygon") {
          lagunaCoords = geom.coordinates[0][0].map(
            ([lng, lat]: [number, number]) => ({
              lat,
              lng,
            }),
          );
        }

        // World outer ring (covers the earth)
        const worldOuter = [
          { lat: 85, lng: -180 },
          { lat: 85, lng: 180 },
          { lat: -85, lng: 180 },
          { lat: -85, lng: -180 },
        ];

        // Mask polygon: Outer world ring + Laguna boundary as cutout hole
        const maskPolygon = new google.maps.Polygon({
          paths: [worldOuter, lagunaCoords],
          strokeColor: "#0284c7",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#eaf0f4",
          fillOpacity: 0.97, // Light mask for surrounding provinces
          clickable: false,
          zIndex: 10,
          map,
        });

        maskPolygonRef.current = maskPolygon;
      })
      .catch((err) => console.warn("Failed to load Laguna mask:", err));

    return () => {
      if (maskPolygonRef.current) {
        maskPolygonRef.current.setMap(null);
      }
    };
  }, []);


  // Render municipality polygons into Google Maps Data Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geoJsonData || !window.google?.maps) return;

    // Clear existing data layer features
    map.data.forEach((f) => map.data.remove(f));

    // Add GeoJSON features
    map.data.addGeoJson(geoJsonData);

    // Style data layer
    map.data.setStyle((feature) => {
      if (feature.getProperty("restriction") === "no_mobile_clinic_deployment")
        return {
          fillColor: "#d1d5db",
          fillOpacity: 0.9,
          strokeColor: "#9ca3af",
          strokeWeight: 0.7,
          clickable: true,
          cursor: "not-allowed",
          zIndex: 3,
        };
      const code = String(feature.getProperty("adm3_psgc") || "");
      const barangayCode = String(feature.getProperty("adm4_psgc") || "");
      const barangay = BARANGAYS_BY_PSGC.get(barangayCode);
      const mun = byPsgc.get(code);
      const isBarangay = Boolean(barangayCode);
      const isSelected = isBarangay && selectedBarangayPsgc === barangayCode;
      const isSelectedMunicipality = !isBarangay && code === selectedPsgc;
      const projected = forecastOverlay?.records.get(barangayCode);
      const value = projected
        ? forecastOverlay!.metric === "hni"
          ? projected.scenarioHni
          : projected.uhni
        : barangay
          ? barangayMetric(barangay, activeMetric)
          : mun
            ? {
                score: mun.needScore,
                density: mun.density,
                disasterRisk: mun.adjustedDisasterRisk,
                morbidity: mun.adjustedMorbidity,
              }[activeMetric]
            : null;
      return {
        fillColor: isSelected && !forecastOverlay
          ? "#facc15"
          : publicMode
            ? "#f8fafc"
            : forecastOverlay
              ? getSimulationNeedColor(value)
              : getMetricColor(activeMetric, value),
        fillOpacity: isSelected
          ? 0.7
          : isBarangay
            ? publicMode
              ? 0.45
              : 0.62
            : 0,
        strokeColor: isSelected
          ? "#102c43"
          : isSelectedMunicipality
            ? "#1a73e8"
            : isBarangay
              ? "#64748b"
              : "#334155",
        strokeWeight: isSelected
          ? 3.5
          : isSelectedMunicipality
            ? 5
            : isBarangay
              ? 0.7
              : 1.8,
        strokeOpacity: 0.95,
        clickable: isBarangay,
        cursor: "pointer",
        zIndex: isSelected
          ? 5
          : isSelectedMunicipality
            ? 4
            : isBarangay
              ? 2
              : 1,
      };
    });

    // Add listeners
    const mouseOverListener = map.data.addListener(
      "mouseover",
      (event: any) => {
        if (
          event.feature.getProperty("restriction") ===
          "no_mobile_clinic_deployment"
        ) {
          setHoveredInfo({
            name: `${PAETE_FOREST_LAND.name}, Paete`,
            value: FOREST_LAND_RESTRICTION,
            x: event.domEvent?.clientX || 200,
            y: event.domEvent?.clientY || 200,
          });
          return;
        }
        const barangay = BARANGAYS_BY_PSGC.get(
          String(event.feature.getProperty("adm4_psgc")),
        );
        if (!barangay) return;
        const name = `${barangay.name}, ${barangay.municipality}`;
        const metric = activeMetric;
        const value = barangayMetric(barangay, metric);
        const projected = forecastOverlay?.records.get(barangay.psgc);
        const simulationValue = projected
          ? forecastOverlay!.metric === "hni"
            ? projected.scenarioHni
            : projected.uhni
          : null;
        const valDisplay = projected
          ? `Day ${forecastOverlay!.day} · ${simulationMetricLabels[forecastOverlay!.metric]}: ${simulationValue!.toFixed(1)}/100${forecastOverlay!.metric === "hni" ? ` · Baseline ${projected.hni.toFixed(1)}` : ""} · Estimate${projected.provisional ? " · Some data missing" : ""}`
          : publicMode
            ? `Population: ${barangay.population.toLocaleString()} · Click for nearby clinics & hospitals`
            : `${barangayMetricLabel(metric)}: ${value === null ? "Information unavailable" : value + (metric === "density" ? "/km²" : metric === "morbidity" ? " / 1,000" : "/100")}${metric === "score" ? ` · Healthcare need rank #${barangay.needRank} of 681${barangay.needProvisional ? " · Some data missing" : ""}` : ""}`;

        setHoveredInfo({
          name,
          value: valDisplay,
          x: event.domEvent?.clientX || 200,
          y: event.domEvent?.clientY || 200,
        });

        map.data.overrideStyle(event.feature, {
          strokeColor: "#facc15",
          strokeWeight: 3,
          fillOpacity: 0.85,
        });
      },
    );

    const mouseOutListener = map.data.addListener("mouseout", (event: any) => {
      setHoveredInfo(null);
      map.data.revertStyle(event.feature);
    });

    const clickListener = map.data.addListener("click", (event: any) => {
      if (
        event.feature.getProperty("restriction") ===
        "no_mobile_clinic_deployment"
      ) {
        return;
      }
      const barangay = BARANGAYS_BY_PSGC.get(
        String(event.feature.getProperty("adm4_psgc")),
      );
      if (!barangay) return;
      if (forecastOverlay) forecastOverlay.select(barangay.psgc);
      else onSelectBarangay(barangay.psgc, barangay.municipalityPsgc);
    });

    return () => {
      google.maps.event.removeListener(mouseOverListener);
      google.maps.event.removeListener(mouseOutListener);
      google.maps.event.removeListener(clickListener);
    };
  }, [
    geoJsonData,
    forecastOverlay,
    activeMetric,
    byPsgc,
    selectedPsgc,
    selectedBarangayPsgc,
    onSelectBarangay,
    publicMode,
  ]);

  // Zoom to selected municipality when selection changes externally
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !(selectedBarangayPsgc || selectedPsgc) || !window.google?.maps)
      return;

    let targetFeature: google.maps.Data.Feature | null = null;
    map.data.forEach((f) => {
      if (
        selectedBarangayPsgc
          ? String(f.getProperty("adm4_psgc")) === selectedBarangayPsgc
          : !f.getProperty("adm4_psgc") &&
            String(f.getProperty("adm3_psgc")) === selectedPsgc
      ) {
        targetFeature = f;
      }
    });

    if (targetFeature) {
      const bounds = new google.maps.LatLngBounds();
      (targetFeature as any).getGeometry().forEachLatLng((latLng: any) => {
        bounds.extend(latLng);
      });
      const width = containerRef.current?.clientWidth ?? 1440;
      const height = containerRef.current?.clientHeight ?? 1000;
      const mobileTop = Math.min(264, height * 0.32);
      const mobileBottom = Math.max(
        0,
        Math.min(height * 0.32 + 148, height - mobileTop - 96),
      );
      map.fitBounds(
        bounds,
        width <= 760
          ? {
              top: mobileTop,
              right: 24,
              bottom: mobileBottom,
              left: 24,
            }
          : { top: 80, right: 50, bottom: 100, left: 420 },
      );
    }
  }, [selectedPsgc, selectedBarangayPsgc, selectionRevision, geoJsonData]);

  // Render Hospital Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const clearHospitalLayer = () => {
      hospitalMarkersRef.current.forEach((marker) => marker.setMap(null));
      hospitalMarkersRef.current = [];
      hospitalListenersRef.current.forEach((listener) => listener.remove());
      hospitalListenersRef.current = [];
      hospitalInfoRef.current?.close();
      hospitalInfoRef.current = null;
    };
    clearHospitalLayer();

    if (!map || !showHospitals || !window.google?.maps) return;

    const markers = hospitals.filter(isEligibleHospital).map((h) => {
      const marker = new google.maps.Marker({
        position: { lat: h.lat, lng: h.lng },
        map,
        title: `${h.name} (${h.municipality})`,
        icon: {
          url: svgDataUrl(hospitalMarkerSvg),
          scaledSize: new google.maps.Size(16, 16),
          anchor: new google.maps.Point(8, 8),
        },
        zIndex: 15,
      });

      hospitalListenersRef.current.push(
        marker.addListener("click", () => {
          // Same fields and layout as before, assembled as text, not HTML.
          const root = document.createElement("div");
          root.style.color = "#0f172a";
          root.style.fontFamily = "sans-serif";
          root.style.padding = "6px";
          const name = document.createElement("strong");
          name.style.fontSize = "14px";
          name.style.color = "#b91c1c";
          name.textContent = h.name;
          const where = document.createElement("small");
          where.style.color = "#64748b";
          where.textContent = `${h.municipality} · ${h.type}`;
          const detail = document.createElement("div");
          detail.style.marginTop = "6px";
          detail.style.fontSize = "12px";
          detail.textContent = `${h.capacity === null ? "Beds unverified" : `${h.capacity} beds`} · ${h.verificationStatus || ""}`;
          root.append(name, document.createElement("br"), where, detail);
          hospitalInfoRef.current?.close();
          const info = new google.maps.InfoWindow({
            content: root,
            position: { lat: h.lat, lng: h.lng },
          });
          hospitalInfoRef.current = info;
          info.open({ map });
        }),
      );

      return marker;
    });

    hospitalMarkersRef.current = markers;
    return clearHospitalLayer;
  }, [hospitals, showHospitals]);

  // Render Fixed OSM Clinic Markers (reference layer; independent of mobile clinics)
  useEffect(() => {
    const map = mapInstanceRef.current;
    // Hide and release the previous layer and its window for every outcome,
    // including toggling off, replacement, an unready map and unmount.
    osmClinicListenersRef.current.forEach((listener) => listener.remove());
    osmClinicListenersRef.current = [];
    osmClinicMarkersRef.current.forEach((m) => m.setMap(null));
    osmClinicMarkersRef.current = [];
    osmClinicInfoRef.current?.close();
    osmClinicInfoRef.current = null;

    const drawableClinics = osmClinics.filter(isDrawableOsmClinic);
    if (
      !map ||
      !showOsmClinics ||
      !window.google?.maps ||
      !drawableClinics.length
    )
      return;

    osmClinicMarkersRef.current = drawableClinics.map((clinic) => {
      const marker = new google.maps.Marker({
        position: { lat: clinic.lat, lng: clinic.lng },
        map,
        title: clinic.name || "Clinic",
        icon: {
          url: svgDataUrl(clinicMarkerSvg),
          scaledSize: new google.maps.Size(15, 15),
          anchor: new google.maps.Point(7.5, 7.5),
        },
        zIndex: 12,
      });
      osmClinicListenersRef.current.push(
        marker.addListener("click", () => {
          osmClinicInfoRef.current?.close();
          const info = new google.maps.InfoWindow({
            content: osmClinicContent(clinic, OSM_CLINIC_SNAPSHOT),
            position: { lat: clinic.lat, lng: clinic.lng },
          });
          osmClinicInfoRef.current = info;
          info.open({ map });
        }),
      );
      return marker;
    });

    return () => {
      osmClinicListenersRef.current.forEach((listener) => listener.remove());
      osmClinicListenersRef.current = [];
      osmClinicMarkersRef.current.forEach((m) => m.setMap(null));
      osmClinicMarkersRef.current = [];
      osmClinicInfoRef.current?.close();
      osmClinicInfoRef.current = null;
    };
  }, [osmClinics, showOsmClinics]);

  // Render Proposed Clinic Staging Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    clinicMarkersRef.current.forEach((m) => m.setMap(null));
    clinicMarkersRef.current = [];

    if (!map || !showClinics || !window.google?.maps) return;

    const markers = proposedClinics.map((c, i) => {
      const marker = new google.maps.Marker({
        position: { lat: c.lat, lng: c.lng },
        map,
        title: `${c.clinicId}: ${c.siteName}`,
        icon: {
          url: svgDataUrl(mobileClinicSvg(i + 1)),
          scaledSize: new google.maps.Size(20, 18),
          anchor: new google.maps.Point(8.5, 9.5),
        },
        zIndex: 20,
      });

      marker.addListener("click", () => {
        onSelectClinic(c.clinicId);
      });

      return marker;
    });

    clinicMarkersRef.current = markers;
  }, [proposedClinics, showClinics, onSelectClinic]);

  // Independent recommendation, active deployment and geographic service layers.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps || !forecastOverlay || !showClinics)
      return;
    const markers: google.maps.Marker[] = [];
    const circles: google.maps.Circle[] = [];
    for (const kind of ["active", "recommended"] as const) {
      for (const a of forecastOverlay[kind]) {
        markers.push(
          new google.maps.Marker({
            map,
            position: { lat: a.lat, lng: a.lng },
            title: `${kind === "active" ? "Active clinic" : "Recommendation (not deployed)"}: ${a.clinicId} · ${a.name} · PSGC ${a.psgc}`,
            label: {
              text: a.clinicId,
              color: kind === "active" ? "#047857" : "#6d28d9",
              fontSize: "10px",
            },
            icon: {
              url: svgDataUrl(
                mobileClinicSvg(
                  Number(a.clinicId.match(/\d+$/)?.[0] ?? 0) || undefined,
                  kind,
                ),
              ),
              scaledSize: new google.maps.Size(20, 18),
              anchor: new google.maps.Point(8.5, 9.5),
              labelOrigin: new google.maps.Point(8.5, 22),
            },
            zIndex: kind === "active" ? 40 : 39,
          }),
        );
        if (kind === "active")
          circles.push(
            new google.maps.Circle({
              map,
              center: { lat: a.lat, lng: a.lng },
              radius: COVERAGE_RADIUS_KM * 1000,
              strokeColor: "#059669",
              strokeWeight: 1,
              fillColor: "#059669",
              fillOpacity: 0.08,
              clickable: false,
            }),
          );
      }
    }
    return () => {
      markers.forEach((m) => m.setMap(null));
      circles.forEach((c) => c.setMap(null));
    };
  }, [forecastOverlay, showClinics]);

  // Render Simulated Road Disruptions
  useEffect(() => {
    const map = mapInstanceRef.current;
    disruptionPolylinesRef.current.forEach((p) => p.setMap(null));
    disruptionPolylinesRef.current = [];

    if (!map || !window.google?.maps) return;

    const polylines = disruptions.map((d) => {
      const path = d.coordinates.map(([lng, lat]) => ({ lat, lng }));
      return new google.maps.Polyline({
        path,
        strokeColor: d.closed ? "#dc2626" : "#64748b",
        strokeOpacity: d.closed ? 0.9 : 0.4,
        strokeWeight: d.closed ? 6 : 3,
        map,
        zIndex: 12,
      });
    });

    disruptionPolylinesRef.current = polylines;
  }, [disruptions]);

  // Animated Mobile Clinics along Real, Optimized Road Routes during Simulation
  useEffect(() => {
    const map = mapInstanceRef.current;
    // Clean up previous markers and route polylines
    animatedMarkersRef.current.forEach((m) => m.setMap(null));
    animatedMarkersRef.current = [];
    clinicRoutePolylinesRef.current.forEach((p) => p.setMap(null));
    clinicRoutePolylinesRef.current = [];

    if (!map || !simulationActive || !window.google?.maps) return;

    const animMarkers: google.maps.Marker[] = [];
    const routePolylines: google.maps.Polyline[] = [];

    proposedClinics.forEach((clinic, idx) => {
      // Use the verified, real highway route from Central Depot (Santa Cruz) to destination
      const routeCoords: [number, number][] =
        clinic.route && clinic.route.length > 1
          ? clinic.route
          : [
              [121.415, 14.278],
              [clinic.lng, clinic.lat],
            ];

      const isSelected = selectedClinicId === clinic.clinicId;

      // Draw real road route polyline
      const path = routeCoords.map(([lng, lat]) => ({ lat, lng }));
      const polyline = new google.maps.Polyline({
        path,
        geodesic: false,
        strokeColor: isSelected ? "#38bdf8" : "#0284c7",
        strokeOpacity: 0.85,
        strokeWeight: isSelected ? 4.5 : 3.5,
        map,
        zIndex: 25,
      });
      routePolylines.push(polyline);

      // Exact interpolation along the highway curves
      const pos = interpolateRoutePosition(routeCoords, simulationProgress);

      const marker = new google.maps.Marker({
        position: { lat: pos.lat, lng: pos.lng },
        map,
        title: `${clinic.clinicId} (${clinic.municipality} Deployment)`,
        icon: {
          url: svgDataUrl(
            mobileClinicSvg(idx + 1, isSelected ? "selected" : "active"),
          ),
          scaledSize: new google.maps.Size(20, 18),
          anchor: new google.maps.Point(8.5, 9.5),
        },
        zIndex: 35,
      });

      marker.addListener("click", () => {
        onSelectClinic(clinic.clinicId);
      });

      animMarkers.push(marker);
    });

    animatedMarkersRef.current = animMarkers;
    clinicRoutePolylinesRef.current = routePolylines;

    return () => {
      routePolylines.forEach((p) => p.setMap(null));
    };
  }, [
    simulationActive,
    simulationProgress,
    proposedClinics,
    selectedClinicId,
    onSelectClinic,
    byPsgc,
  ]);

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden select-none bg-slate-100">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: "100%" }}
      />

      {/* Floating Hover Tooltip */}
      {hoveredInfo && (
        <div
          className="fixed pointer-events-none z-50 px-3 py-1.5 rounded-lg bg-white text-slate-800 shadow-xl backdrop-blur-md border border-slate-700/80 text-xs font-medium transform -translate-x-1/2 -translate-y-12"
          style={{ left: hoveredInfo.x, top: hoveredInfo.y }}
        >
          <div className="font-semibold text-teal-700">{hoveredInfo.name}</div>
          <div className="text-slate-700">{hoveredInfo.value}</div>
        </div>
      )}

      {/* Error notification if boundary files fail to load */}
      {geoError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 text-white px-4 py-2 rounded-lg text-sm shadow-xl flex items-center gap-2">
          <span>⚠️ {geoError}</span>
        </div>
      )}
    </div>
  );
}
