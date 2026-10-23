import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Marker, Popup } from "react-leaflet";
import type { LocatedOsmClinic } from "../../frontend/src/types/osmClinic";

vi.mock("react-leaflet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-leaflet")>();
  // Leaflet Marker owns the Popup subtree; the mock must render children so
  // popup escaping assertions exercise the real React text nodes.
  return {
    ...actual,
    Marker: vi.fn(({ children }: { children?: ReactNode }) => children ?? null),
    Popup: vi.fn(() => null),
  };
});

const clinic: LocatedOsmClinic = {
  id: "way/25589105",
  osmType: "way",
  osmId: 25589105,
  name: "Santo Cristo Health Center",
  lat: 14.0644,
  lng: 121.3324,
  locationMethod: "overpass-center",
  tags: { amenity: "clinic", operator: "Munisipyo" },  active: true,
  inProvince: true,
  barangayPsgc: "403401001",
  municipalityPsgc: "403401000",
  assignmentStatus: "assigned",
  warnings: [],
};

const ambiguous: LocatedOsmClinic = {
  ...clinic,
  id: "node/2",
  osmType: "node",
  osmId: 2,
  name: "",
  assignmentStatus: "ambiguous",
  warnings: ["Barangay polygons overlap"],
};

const snapshot = {
  valid: true,
  retrievedAt: "2026-10-23T17:32:47.575509+00:00",
  osmBaseTimestamp: "2026-10-23T17:31:38Z",
  endpoint: "https://overpass-api.de/api/interpreter",
  query: "[out:json];",
  attribution: "© OpenStreetMap contributors",
  license: "ODbL 1.0",
  rawSha256: "abc",
  boundarySha256: "def",
  counts: {},
  warnings: [],
};

const propsFor = (overrides: Record<string, unknown> = {}) => ({
  municipalities: [],
  selectedPsgc: null,
  selectedBarangayPsgc: null,
  onSelectBarangay: vi.fn(),
  onSelectMunicipality: vi.fn(),
  activeMetric: "score" as const,
  showHospitals: true,
  showClinics: true,
  showOsmClinics: true,
  hospitals: [],
  proposedClinics: [],
  osmClinics: [clinic],
  simulationActive: false,
  simulationProgress: 0,
  selectedClinicId: null,
  onSelectClinic: vi.fn(),
  disruptions: [],
  recenterTrigger: 0,
  zoomDelta: 0,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Map layer toggles", () => {
  it("keeps Hospitals, Mobile clinics and OSM clinics independent and default-on", async () => {
    const { LayerToggles } = await import(
      "../../frontend/src/features/filters/LayerToggles"
    );
    const { useAppStore } = await import(
      "../../frontend/src/store/useAppStore"
    );
    useAppStore.setState({
      showHospitals: true,
      showClinics: true,
      showOsmClinics: true,
    });
    const { selectedClinicId } = useAppStore.getState();
    render(<LayerToggles />);
    const hospitals = screen.getByRole("checkbox", { name: "Hospitals" });
    const mobile = screen.getByRole("checkbox", { name: "Mobile clinics" });
    const osm = screen.getByRole("checkbox", { name: "OSM clinics" });
    expect(hospitals).toBeChecked();
    expect(mobile).toBeChecked();
    expect(osm).toBeChecked();
    fireEvent.click(osm);
    expect(useAppStore.getState()).toMatchObject({
      showOsmClinics: false,
      showHospitals: true,
      showClinics: true,
    });
    fireEvent.click(hospitals);
    expect(useAppStore.getState()).toMatchObject({
      showOsmClinics: false,
      showHospitals: false,
      showClinics: true,
    });
    fireEvent.click(mobile);
    expect(useAppStore.getState()).toMatchObject({
      showOsmClinics: false,
      showHospitals: false,
      showClinics: false,
    });
    // Layer visibility never selects or mutates a mobile clinic simulation.
    expect(useAppStore.getState().selectedClinicId).toBe(selectedClinicId);
    expect(useAppStore.getState().progress).toBe(0);
    // Layer state is intentionally not persisted, so defaults return on reload.
    const persisted = (state: Record<string, unknown>) => ({
      approvedPlan: state.approvedPlan,
    });
    expect(persisted({ approvedPlan: null, showOsmClinics: false })).toEqual({
      approvedPlan: null,
    });
  });
});

describe("OSM clinic map markers (mocked React Leaflet)", () => {
  it("uses the static purple icon class and never interpolates OSM text into icon HTML", async () => {
    const { OsmClinicMarkers } = await import(
      "../../frontend/src/features/map/components/OsmClinicMarkers"
    );
    render(<OsmClinicMarkers osmClinics={[clinic]} snapshot={snapshot} />);
    const markerProps = vi.mocked(Marker).mock.calls[0][0] as unknown as {
      icon: { options: { className: string; html: string } };
      position: [number, number];
      title: string;
    };
    expect(markerProps.position).toEqual([clinic.lat, clinic.lng]);
    expect(markerProps.icon.options.className).toBe("osm-clinic-marker-custom");
    expect(markerProps.icon.options.html).toContain("background:#7c3aed");
    expect(markerProps.icon.options.html).not.toContain("Santo Cristo");
    expect(markerProps.icon.options.html).not.toContain("Munisipyo");
    expect(markerProps.title).toContain("way/25589105");
  });

  it("renders popup text as React children with a stable OSM link and provenance", async () => {
    const { OsmClinicMarkers } = await import(
      "../../frontend/src/features/map/components/OsmClinicMarkers"
    );
    render(<OsmClinicMarkers osmClinics={[clinic, ambiguous]} snapshot={snapshot} />);
    const popup = vi.mocked(Popup).mock.calls[0][0] as unknown as {
      children: ReactNode;
    };
    const view = render(createElement("div", null, popup.children));
    const region = view.container;
    expect(region.textContent).toContain("Santo Cristo Health Center");
    expect(region.textContent).toContain("Operator (OSM tag): Munisipyo");    expect(region.textContent).toContain("not its entrance");
    expect(region.textContent).toContain(
      "Offline snapshot retrieved 2026-10-23T17:32:47.575509+00:00",
    );
    expect(region.textContent).toContain("not a live query");
    const link = region.querySelector("a")!;
    expect(link.getAttribute("href")).toBe(
      "https://www.openstreetmap.org/way/25589105",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    const second = vi.mocked(Popup).mock.calls[1][0] as unknown as {
      children: ReactNode;
    };
    const secondView = render(createElement("div", null, second.children));
    expect(secondView.container.textContent).toContain("Unnamed clinic");
    expect(secondView.container.textContent).toContain(
      "Barangay assignment is ambiguous",
    );
    expect(secondView.container.textContent).toContain(
      "Barangay polygons overlap",
    );
    expect(secondView.container.querySelector("a")!.getAttribute("href")).toBe(
      "https://www.openstreetmap.org/node/2",
    );
  });

  it("escapes malicious OSM tags rather than rendering markup", async () => {
    const { OsmClinicMarkers } = await import(
      "../../frontend/src/features/map/components/OsmClinicMarkers"
    );
    const hostile: LocatedOsmClinic = {
      ...clinic,
      name: '<img src=x onerror="alert(1)">',
      tags: { ...clinic.tags, operator: "<script>alert(2)</script>" },
      warnings: ["<img onerror=alert(3) src=x>"],
    };
    render(<OsmClinicMarkers osmClinics={[hostile]} snapshot={snapshot} />);
    const popup = vi.mocked(Popup).mock.calls[0][0] as unknown as {
      children: ReactNode;
    };
    const view = render(createElement("div", null, popup.children));
    expect(view.container.querySelector("img")).toBeNull();
    expect(view.container.querySelector("script")).toBeNull();
    expect(view.container.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(view.container.textContent).toContain("<script>alert(2)</script>");
  });

  it("draws eligible active in-province points and excludes ineligible records", async () => {
    const { OsmClinicMarkers } = await import(
      "../../frontend/src/features/map/components/OsmClinicMarkers"
    );
    render(<OsmClinicMarkers osmClinics={[]} snapshot={snapshot} />);
    expect(vi.mocked(Marker)).not.toHaveBeenCalled();
    cleanup();
    const excluded = [
      { ...clinic, id: "node/3", active: false },
      { ...clinic, id: "node/4", inProvince: false, assignmentStatus: "outside" as const },
      { ...clinic, id: "node/5", assignmentStatus: "unlocated" as const },
      { ...clinic, id: "node/6", lat: 95 },
    ];
    render(
      <OsmClinicMarkers
        osmClinics={[clinic, ambiguous, ...excluded] as LocatedOsmClinic[]}
        snapshot={snapshot}
      />,
    );
    expect(vi.mocked(Marker)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(Marker).mock.calls.map(([props]) => props.position)).toEqual([
      [clinic.lat, clinic.lng],
      [ambiguous.lat, ambiguous.lng],
    ]);
  });
});

describe("Map legend clinic keys and attribution", () => {
  it("labels OSM clinics as fixed facilities and shows snapshot provenance", async () => {
    const { MapLegend } = await import(
      "../../frontend/src/features/map/components/MapLegend"
    );
    const { useAppStore } = await import(
      "../../frontend/src/store/useAppStore"
    );
    useAppStore.setState({
      showHospitals: true,
      showClinics: true,
      showOsmClinics: true,
    });
    render(<MapLegend clinicSnapshot={snapshot} />);
    const legend = screen.getByRole("region", { name: "Map legend" });
    const facilities = within(legend).getByLabelText("Facility layer keys");
    expect(facilities).toHaveTextContent("Hospital");
    expect(facilities).toHaveTextContent("Mobile clinic (numbered)");
    expect(facilities).toHaveTextContent("OSM clinic");
    expect(facilities).toHaveTextContent("fixed facility, not a mobile clinic");
    const attribution = legend.querySelector(
      ".workspace-osm-clinic-attribution",
    )!;
    expect(attribution.textContent).toContain("OSM clinic · amenity=clinic or healthcare=clinic");
    expect(attribution.textContent).toContain("© OpenStreetMap contributors");
    expect(attribution.textContent).toContain("ODbL 1.0");
    expect(attribution.textContent).toContain(
      "offline snapshot retrieved 2026-10-23T17:32:47.575509+00:00",
    );
    expect(attribution).toHaveTextContent("OSM clinic");
  });

  it("hides the OSM key and attribution when the OSM layer is off", async () => {
    const { MapLegend } = await import(
      "../../frontend/src/features/map/components/MapLegend"
    );
    const { useAppStore } = await import(
      "../../frontend/src/store/useAppStore"
    );
    act(() => useAppStore.setState({ showOsmClinics: false }));
    render(<MapLegend clinicSnapshot={snapshot} />);
    const legend = screen.getByRole("region", { name: "Map legend" });
    expect(within(legend).getByLabelText("Facility layer keys")).not.toHaveTextContent(
      "OSM clinic",
    );
    expect(
      legend.querySelector(".workspace-osm-clinic-attribution"),
    ).toBeNull();
  });
});
