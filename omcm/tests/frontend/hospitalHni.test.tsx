import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Marker } from "react-leaflet";
import { HospitalMarkers } from "../../frontend/src/features/map/components/HospitalMarkers";
import { heatmapStyle } from "../../frontend/src/features/map/components/HeatmapLayer";
import { MapLegend } from "../../frontend/src/features/map/components/MapLegend";
import { MunicipalityMetrics } from "../../frontend/src/features/municipalities/MunicipalityMetrics";
import { MunicipalityRanking } from "../../frontend/src/features/municipalities/MunicipalityRanking";
import { PublicSidePanel } from "../../frontend/src/features/public/PublicSidePanel";
import {
  HEALTHCARE_NEED_FACTORS,
  hospitalsByDistance,
  isEligibleHospital,
} from "../../frontend/src/services/healthcareNeed";
import {
  LAGUNA_BARANGAYS,
  MAPPED_HOSPITALS,
  MUNICIPALITY_HEALTHCARE_NEED,
  PROVIDED_HOSPITALS,
} from "../../frontend/src/services/providedData";
import { computeLagunaMunicipalities } from "../../frontend/src/services/lagunaData";
import { useAppStore } from "../../frontend/src/store/useAppStore";

vi.mock("react-leaflet", () => ({
  Marker: vi.fn(({ children }: { children?: ReactNode }) => children),
  Popup: ({ children }: { children?: ReactNode }) => children,
}));

const initialState = useAppStore.getState();
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useAppStore.setState(initialState, true);
});

describe("Hospital evidence and HNI map consistency", () => {
  it("uses the same hospital set for all 681 HNI scores and both care lists", () => {
    const ids = new Set(MAPPED_HOSPITALS.map((h) => h.id));
    expect(ids.size).toBe(56);
    for (const barangay of LAGUNA_BARANGAYS) {
      const nearest = hospitalsByDistance(barangay, PROVIDED_HOSPITALS)[0];
      expect(ids.has(barangay.nearestHospital!.id)).toBe(true);
      expect(barangay.nearestHospital).toEqual({
        id: nearest.id,
        name: nearest.name,
        distanceKm: nearest.distanceKm,
      });
    }
    const barangay = LAGUNA_BARANGAYS[0];
    useAppStore.setState({
      sidePanelOpen: true,
      selectedBarangayPsgc: barangay.psgc,
    });
    render(<PublicSidePanel />);
    const panel = screen.getByRole("complementary", {
      name: "Community care and schedules",
    });
    expect(panel).toHaveTextContent(barangay.nearestHospital!.name);
    expect(panel).toHaveTextContent(
      `${barangay.nearestHospital!.distanceKm.toFixed(2)} km straight line`,
    );
  });

  it("rejects invalid points, excludes unverified hospitals and stabilizes ties", () => {
    const point = { lat: 0, lng: 0 };
    const hospital = { ...MAPPED_HOSPITALS[0], ...point, id: "H2" };
    const excluded = [
      { ...hospital, verified: false },
      { ...hospital, lat: Number.NaN },
      { ...hospital, lng: Infinity },
      { ...hospital, lat: 91 },
      { ...hospital, lng: 181 },
      { ...hospital, lat: null },
    ];
    expect(excluded.some(isEligibleHospital)).toBe(false);
    expect(hospitalsByDistance(point, excluded)).toEqual([]);
    expect(
      hospitalsByDistance({ lat: Number.NaN, lng: 0 }, [hospital]),
    ).toEqual([]);
    expect(
      hospitalsByDistance(point, [hospital, { ...hospital, id: "H10" }])[0].id,
    ).toBe("H10");
  });

  it("renders only verified hospital markers and preserves source bed details", () => {
    const extra = { ...MAPPED_HOSPITALS[0], id: "excluded", verified: false };
    render(<HospitalMarkers hospitals={[...MAPPED_HOSPITALS, extra]} />);
    expect(vi.mocked(Marker)).toHaveBeenCalledTimes(56);
    expect(
      vi.mocked(Marker).mock.calls.map(([props]) => props.position),
    ).toEqual(MAPPED_HOSPITALS.map((h) => [h.lat, h.lng]));
    expect(screen.getAllByText(/80 beds/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/reported closed/)).not.toBeInTheDocument();
  });

  it("labels hospital layers consistently and keeps missing map values gray", () => {
    for (const viewMode of ["public", "admin"] as const) {
      useAppStore.setState({ viewMode, showHospitals: true, panel: null });
      render(<MapLegend />);
      expect(
        screen.getByRole("region", { name: "Map legend" }),
      ).toHaveTextContent("Verified hospital");
      cleanup();
    }
    expect(heatmapStyle(undefined, "score", false).fillColor).toBe("#cbd5e1");
    expect(heatmapStyle(undefined, "disasterRisk", false).fillColor).toBe(
      "#cbd5e1",
    );
  });
});

describe("Municipality summaries of the barangay HNI heatmap", () => {
  it("weights scores and contributions by population, preserving provisional inputs and ties", () => {
    expect(MUNICIPALITY_HEALTHCARE_NEED.size).toBe(30);
    for (const summary of MUNICIPALITY_HEALTHCARE_NEED.values()) {
      const rows = LAGUNA_BARANGAYS.filter(
        (b) => b.municipalityPsgc === summary.psgc,
      );
      const population = rows.reduce((sum, b) => sum + b.population, 0);
      const expected =
        rows.reduce((sum, b) => sum + b.needScore * b.population, 0) /
        population;
      expect(summary.needScore).toBe(Math.round(expected * 10) / 10);
      expect(summary.provisionalBarangays).toBe(
        rows.filter((b) => b.disasterRisk === null).length,
      );
      const total = Object.values(summary.needContributions).reduce<number>(
        (sum, value) => sum + (value ?? 0),
        0,
      );
      expect(Math.abs(total - expected)).toBeLessThanOrEqual(0.05);
      expect(summary.needRank).toBe(
        1 +
          [...MUNICIPALITY_HEALTHCARE_NEED.values()].filter(
            (s) => s.needScore > summary.needScore,
          ).length,
      );
    }
  });

  it("shows the canonical rollup and flags municipalities with unresolved barangay inputs", () => {
    const municipality = computeLagunaMunicipalities().find(
      (m) => m.name === "Pangil",
    )!;
    const summary = MUNICIPALITY_HEALTHCARE_NEED.get(municipality.psgc)!;
    render(<MunicipalityMetrics municipality={municipality} />);
    const detail = screen.getByRole("region", {
      name: "Municipality healthcare need",
    });
    expect(detail).toHaveTextContent(summary.needScore.toFixed(1));
    expect(detail).toHaveTextContent(
      `Municipality rank #${summary.needRank} of 30`,
    );
    expect(detail).toHaveTextContent(
      "Provisional score and rank: 2 barangay scores",
    );
    for (const factor of Object.values(HEALTHCARE_NEED_FACTORS))
      expect(detail).toHaveTextContent(factor.label);
    expect(
      screen
        .getByText("Municipal allocation estimate · separate heuristic")
        .closest("details"),
    ).not.toHaveAttribute("open");
  });

  it("ranks municipality rollups independently of the legacy allocation estimate", () => {
    render(
      <MunicipalityRanking
        municipalities={computeLagunaMunicipalities().reverse()}
      />,
    );
    const items = screen.getAllByRole("listitem");
    const top = [...MUNICIPALITY_HEALTHCARE_NEED.values()][0];
    const name = LAGUNA_BARANGAYS.find(
      (b) => b.municipalityPsgc === top.psgc,
    )!.municipality;
    expect(within(items[0]).getByRole("button")).toHaveTextContent(name);
    expect(items[0]).toHaveTextContent(top.needScore.toFixed(1));
    for (const [index, summary] of [
      ...MUNICIPALITY_HEALTHCARE_NEED.values(),
    ].entries()) {
      const municipality = computeLagunaMunicipalities().find(
        (m) => m.psgc === summary.psgc,
      )!;
      expect(items[index]).toHaveTextContent(municipality.name);
    }
  });
});
