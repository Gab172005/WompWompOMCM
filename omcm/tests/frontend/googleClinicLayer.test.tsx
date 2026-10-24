import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { LagunaGoogleMap } from "../../frontend/src/features/map/components/LagunaGoogleMap";
import {
  LAGUNA_HOSPITALS,
  runClinicOptimizer,
} from "../../frontend/src/services/lagunaData";
import { MAPPED_OSM_CLINICS } from "../../frontend/src/services/providedData";
import type { LocatedOsmClinic } from "../../frontend/src/types/osmClinic";
import type { MapProps } from "../../frontend/src/features/map/components/mapTypes";
import {
  clinicMarkerSvg,
  hospitalMarkerSvg,
  svgDataUrl,
} from "../../frontend/src/features/map/components/facilityIcons";

type Handler = () => void;

class MockListener {
  removed = false;
  constructor(
    private owner: { handlers: Handler[] },
    handler: Handler,
  ) {
    owner.handlers.push(handler);
    this.handler = handler;
  }
  private handler: Handler;
  remove() {
    if (this.removed) return;
    this.removed = true;
    const index = this.owner.handlers.indexOf(this.handler);
    if (index >= 0) this.owner.handlers.splice(index, 1);
  }
}

const instances = {
  markers: [] as MockMarker[],
  listeners: [] as MockListener[],
  windows: [] as MockInfoWindow[],
  maps: [] as MockMap[],
};

class MockMap {
  data = {
    addGeoJson: vi.fn(),
    setStyle: vi.fn(),
    forEach: vi.fn(),
    addListener: () => ({ remove: vi.fn() }),
    overrideStyle: vi.fn(),
    revertStyle: vi.fn(),
    remove: vi.fn(),
  };
  fitBounds = vi.fn();
  getZoom = () => 11;
  setZoom = vi.fn();
  handlers: Handler[] = [];
  constructor() {
    instances.maps.push(this);
  }
}

class MockMarker {
  handlers: Handler[] = [];
  map: unknown = null;
  title: string | undefined;
  icon: { url?: string } | undefined;
  position: { lat: number; lng: number };
  constructor(options: {
    map?: unknown;
    title?: string;
    icon?: { url?: string };
    position: { lat: number; lng: number };
  }) {
    this.map = options.map ?? null;
    this.title = options.title;
    this.icon = options.icon;
    this.position = options.position;
    instances.markers.push(this);
  }
  setMap(map: unknown) {
    this.map = map;
  }
  addListener(event: string, handler: Handler) {
    const listener = new MockListener(this, handler);
    instances.listeners.push(listener);
    return listener;
  }
  click() {
    [...this.handlers].forEach((handler) => handler());
  }
}

class MockInfoWindow {
  content: unknown;
  position: unknown;
  map: unknown = null;
  closed = false;
  constructor(options: { content?: unknown; position?: unknown }) {
    this.content = options.content;
    this.position = options.position;
    instances.windows.push(this);
  }
  open({ map }: { map: unknown }) {
    this.map = map;
  }
  close() {
    this.closed = true;
    this.map = null;
  }
}

function installGoogleMock() {
  (window as any).google = {
    maps: {
      Map: MockMap,
      Marker: MockMarker,
      InfoWindow: MockInfoWindow,
      Size: class {
        constructor(
          public width: number,
          public height: number,
        ) {}
      },
      Point: class {
        constructor(
          public x: number,
          public y: number,
        ) {}
      },
      LatLngBounds: class {
        extend = vi.fn();
      },
      Polygon: class {
        setMap = vi.fn();
      },
      Polyline: class {
        setMap = vi.fn();
      },
      SymbolPath: { CIRCLE: 0, FORWARD_CLOSED_ARROW: 1 },
      event: {
        removeListener: (listener: { remove: () => void }) => listener.remove(),
      },
    },
  };
}

const malicious: LocatedOsmClinic = {
  id: "node/9001",
  osmType: "node",
  osmId: 9001,
  name: '<img src=x onerror="window.__osmClinicXss=1">Clinic',
  lat: 14.2,
  lng: 121.2,
  locationMethod: "node",
  tags: {
    amenity: "clinic",
    "healthcare:speciality": "<b>general</b>",
    operator: "<script>window.__osmClinicXss=1</script>",
  },
  active: true,
  inProvince: true,
  barangayPsgc: "403401001",
  municipalityPsgc: "403401000",
  assignmentStatus: "assigned",
  warnings: ["<img src=x onerror=alert(1)>"],
};

const props: MapProps = {
  municipalities: [],
  selectedPsgc: null,
  selectedBarangayPsgc: null,
  onSelectBarangay: vi.fn(),
  onSelectMunicipality: vi.fn(),
  activeMetric: "score",
  showHospitals: false,
  showClinics: false,
  showOsmClinics: true,
  hospitals: LAGUNA_HOSPITALS,
  proposedClinics: runClinicOptimizer(1, [], {
    floodOverrides: {},
    morbiditySpikes: {},
    closedRoadIds: [],
  }).clinics,
  osmClinics: [malicious],
  simulationActive: false,
  simulationProgress: 0,
  selectedClinicId: null,
  onSelectClinic: vi.fn(),
  disruptions: [],
  recenterTrigger: 0,
  zoomDelta: 0,
};

const osmMarkers = () =>
  instances.markers.filter(
    (marker) => marker.icon?.url === svgDataUrl(clinicMarkerSvg),
  );

const hospitalMarkers = () =>
  instances.markers.filter(
    (marker) => marker.icon?.url === svgDataUrl(hospitalMarkerSvg),
  );

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  instances.markers = [];
  instances.listeners = [];
  instances.windows = [];
  instances.maps = [];
  installGoogleMock();
  (window as any).__osmClinicXss = undefined;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (window as any).google;
});

describe("Google Maps fixed OSM clinic layer (mocked, no live key)", () => {
  it("emphasizes the selected municipality above barangay shading", async () => {
    const geometry = {
      type: "Polygon",
      coordinates: [
        [
          [121.4, 14.4],
          [121.5, 14.4],
          [121.5, 14.5],
          [121.4, 14.4],
        ],
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { adm3_psgc: "403421000" },
              geometry,
            },
          ],
        }),
      })),
    );
    render(
      <LagunaGoogleMap
        {...props}
        selectedPsgc="403421000"
        showOsmClinics={false}
      />,
    );
    await waitFor(() =>
      expect(instances.maps[0].data.setStyle).toHaveBeenCalled(),
    );
    const calls = instances.maps[0].data.setStyle.mock.calls as unknown as [
      (feature: {
        getProperty: (key: string) => string | undefined;
      }) => Record<string, unknown>,
    ][];
    const style = calls.at(-1)![0];
    expect(
      style({
        getProperty: (key) => (key === "adm3_psgc" ? "403421000" : undefined),
      }),
    ).toMatchObject({
      strokeColor: "#1a73e8",
      strokeWeight: 5,
      zIndex: 4,
      fillOpacity: 0,
    });
    expect(
      style({
        getProperty: (key) => (key === "adm3_psgc" ? "403402000" : undefined),
      }),
    ).toMatchObject({ strokeColor: "#334155", strokeWeight: 1.8, zIndex: 1 });
  });

  it("draws the HNI-eligible hospital set and removes it when toggled off", () => {
    const view = render(
      <LagunaGoogleMap {...props} showHospitals showOsmClinics={false} />,
    );
    const active = hospitalMarkers().filter((marker) => marker.map !== null);
    expect(active).toHaveLength(56);
    expect(active.map((marker) => marker.position)).toEqual(
      LAGUNA_HOSPITALS.map((hospital) => ({
        lat: hospital.lat,
        lng: hospital.lng,
      })),
    );
    expect(
      active.some((marker) => marker.title?.includes("SAN JOSE HOSPITAL")),
    ).toBe(false);
    act(() => active[0].click());
    const popup = instances.windows.at(-1)!;
    expect((popup.content as HTMLElement).textContent).toContain(
      LAGUNA_HOSPITALS[0].verificationStatus,
    );
    act(() =>
      view.rerender(
        <LagunaGoogleMap
          {...props}
          showHospitals={false}
          showOsmClinics={false}
        />,
      ),
    );
    expect(
      active.every(
        (marker) => marker.map === null && marker.handlers.length === 0,
      ),
    ).toBe(true);
    expect(popup.closed).toBe(true);
  });

  it("draws purple, unnumbered markers separately from hospitals and mobile clinics", () => {
    render(<LagunaGoogleMap {...props} />);
    expect(osmMarkers()).toHaveLength(1);
    expect(osmMarkers()[0].position).toEqual({ lat: 14.2, lng: 121.2 });
    expect(hospitalMarkers().filter((marker) => marker.map !== null)).toEqual(
      [],
    );
    expect(
      instances.markers.filter(
        (marker) => marker.map !== null && marker.title?.startsWith("MC-"),
      ),
    ).toEqual([]);
  });

  it("keeps fixed, hospital and mobile map layers independently switchable", () => {
    const mobileProps = runClinicOptimizer(1, [], {
      floodOverrides: {},
      morbiditySpikes: {},
      closedRoadIds: [],
    }).clinics;
    const view = render(
      <LagunaGoogleMap
        {...props}
        showHospitals
        showClinics
        proposedClinics={mobileProps}
      />,
    );
    const activeOsm = () =>
      osmMarkers().filter((marker) => marker.map !== null);
    const activeHospitals = () =>
      hospitalMarkers().filter((marker) => marker.map !== null);
    const activeMobile = () =>
      instances.markers.filter(
        (marker) => marker.map !== null && marker.title?.startsWith("MC-"),
      );
    expect(activeOsm()).toHaveLength(1);
    expect(activeHospitals()).toHaveLength(LAGUNA_HOSPITALS.length);
    expect(activeMobile()).toHaveLength(1);

    act(() =>
      view.rerender(
        <LagunaGoogleMap
          {...props}
          showOsmClinics={false}
          showHospitals
          showClinics
          proposedClinics={mobileProps}
        />,
      ),
    );
    expect(activeOsm()).toHaveLength(0);
    expect(activeHospitals()).toHaveLength(LAGUNA_HOSPITALS.length);
    expect(activeMobile()).toHaveLength(1);
  });

  it("draws only eligible active in-province OSM records", () => {
    const excluded = [
      { ...malicious, id: "node/9002", active: false },
      {
        ...malicious,
        id: "node/9003",
        inProvince: false,
        assignmentStatus: "outside" as const,
      },
      { ...malicious, id: "node/9004", assignmentStatus: "unlocated" as const },
      { ...malicious, id: "node/9005", lat: 95 },
    ];
    render(
      <LagunaGoogleMap
        {...props}
        osmClinics={[malicious, ...excluded] as LocatedOsmClinic[]}
      />,
    );
    expect(osmMarkers()).toHaveLength(1);
    expect(osmMarkers()[0].title).toBe(malicious.name);
  });

  it("renders popup text with DOM nodes so malicious tags stay inert text", async () => {
    render(<LagunaGoogleMap {...props} />);
    act(() => osmMarkers()[0].click());
    const info = instances.windows.at(-1)!;
    const content = info.content as HTMLElement;
    expect(content).toBeInstanceOf(HTMLElement);
    expect(content.querySelector("img")).toBeNull();
    expect(content.querySelector("script")).toBeNull();
    expect(content.querySelector("b")).toBeNull();
    expect(content.textContent).toContain("<img src=x onerror=");
    expect(content.textContent).toContain("<script>");
    expect(content.textContent).toContain("<b>general</b>");
    // Provenance and known link are present as safe text/attributes.
    expect(content.textContent).toContain("Offline snapshot retrieved");
    expect(content.textContent).toContain("not a live query");
    expect(content.textContent).toContain(
      "retrieved 2026-10-23T17:32:47.575509+00:00",
    );
    expect(content.textContent).toContain(
      "Healthcare speciality (OSM tag): <b>general</b>",
    );
    expect(content.textContent).toContain(
      "Operator (OSM tag): <script>window.__osmClinicXss=1</script>",
    );
    expect(content.textContent).toContain("Placed at the mapped node");
    const link = content.querySelector("a")!;
    expect(link.getAttribute("href")).toBe(
      "https://www.openstreetmap.org/node/9001",
    );
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.textContent).toContain("node/9001");
    expect((window as any).__osmClinicXss).toBeUndefined();
  });

  it("closes the window, removes listeners and hides markers when toggled off", () => {
    const view = render(<LagunaGoogleMap {...props} />);
    const marker = osmMarkers()[0];
    act(() => marker.click());
    const info = instances.windows.at(-1)!;
    expect(info.map).not.toBeNull();
    const listenersBefore = instances.listeners.filter((l) => !l.removed);
    expect(marker.handlers).toHaveLength(1);
    act(() => {
      view.rerender(<LagunaGoogleMap {...props} showOsmClinics={false} />);
    });
    expect(marker.map).toBeNull();
    expect(info.closed).toBe(true);
    expect(marker.handlers).toHaveLength(0);
    expect(instances.listeners.filter((l) => !l.removed)).toHaveLength(
      listenersBefore.length - 1,
    );
  });

  it("replaces markers on data change without leaking the previous layer", () => {
    const view = render(<LagunaGoogleMap {...props} />);
    const first = osmMarkers()[0];
    act(() => first.click());
    const firstInfo = instances.windows.at(-1)!;
    const replacement = {
      ...MAPPED_OSM_CLINICS[0],
      id: "way/123",
      osmType: "way" as const,
      osmId: 123,
    };
    act(() => {
      view.rerender(<LagunaGoogleMap {...props} osmClinics={[replacement]} />);
    });
    expect(first.map).toBeNull();
    expect(firstInfo.closed).toBe(true);
    expect(
      osmMarkers()
        .filter((m) => m.map !== null)
        .map((m) => m.title),
    ).toEqual([replacement.name || "Clinic"]);
    expect(first.handlers).toHaveLength(0);
  });

  it("cleans up markers, listeners and the auth handler on unmount", () => {
    const original = vi.fn();
    (window as any).gm_authFailure = original;
    const view = render(<LagunaGoogleMap {...props} />);
    const marker = osmMarkers()[0];
    act(() => marker.click());
    const info = instances.windows.at(-1)!;
    expect((window as any).gm_authFailure).not.toBe(original);
    view.unmount();
    expect(marker.map).toBeNull();
    expect(info.closed).toBe(true);
    expect(instances.listeners.filter((l) => !l.removed)).toHaveLength(0);
    // The pre-existing handler is restored, not a chained leftover.
    expect((window as any).gm_authFailure).toBe(original);
  });

  it("accepts fixed clinic data after an empty layer without opening a popup", () => {
    const view = render(
      <LagunaGoogleMap {...props} osmClinics={[]} showOsmClinics />,
    );
    expect(osmMarkers()).toHaveLength(0);
    view.rerender(<LagunaGoogleMap {...props} osmClinics={[malicious]} />);
    expect(osmMarkers()).toHaveLength(1);
    expect(instances.windows.every((w) => w.map === null)).toBe(true);
  });
});
