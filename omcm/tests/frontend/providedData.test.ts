import { describe, expect, it } from "vitest";
import { BARANGAYS_BY_PSGC, LAGUNA_BARANGAYS, PROVIDED_HOSPITALS, MAPPED_HOSPITALS, municipalityDataset, barangayMetric } from "../../frontend/src/services/providedData";
import { computeLagunaMunicipalities, getMetricColor } from "../../frontend/src/services/lagunaData";
import { useAppStore } from "../../frontend/src/store/useAppStore";

describe("Supplied Laguna datasets", () => {
  it("joins all barangays to unique PSGC boundaries, including spelling aliases", () => {
    expect(LAGUNA_BARANGAYS).toHaveLength(681);
    expect(BARANGAYS_BY_PSGC.size).toBe(681);
    expect(LAGUNA_BARANGAYS.reduce((sum, b) => sum + b.population, 0)).toBe(3687345);
    expect(LAGUNA_BARANGAYS.find((b) => b.name === "Cabuyao" && b.municipality === "Liliw")?.boundaryName).toBe("Cabuyew");
    expect(LAGUNA_BARANGAYS.find((b) => b.name === "Pook" && b.municipality === "Santa Rosa")?.boundaryName).toBe("Pooc");
  });

  it("preserves unresolved risk values separately from zero-valued screening results", () => {
    const unresolved = LAGUNA_BARANGAYS.filter((b) => b.disasterRisk === null);
    expect(unresolved.map((b) => b.name)).toEqual(["Dambo", "Natividad", "Coralan", "Masinao"]);
    expect(getMetricColor("disasterRisk", null)).not.toBe(getMetricColor("disasterRisk", 0));
    expect(unresolved.every((b) => b.riskUpper === 100 && b.indexStatus === "unresolved_code")).toBe(true);
    expect(LAGUNA_BARANGAYS.filter((b) => b.disasterRisk === 0)).toHaveLength(356);
  });

  it("uses population-weighted supplied risk and morbidity in municipal planning", () => {
    const alaminos = municipalityDataset("403401000");
    expect(alaminos.population).toBe(53589);
    const records = LAGUNA_BARANGAYS.filter((b) => b.municipalityPsgc === "403401000");
    const risk = records.reduce((sum, b) => sum + b.disasterRisk! * b.population, 0) / 53589;
    expect(alaminos.disasterRisk).toBe(Math.round(risk * 100) / 100);
    const municipality = computeLagunaMunicipalities().find((m) => m.psgc === "403401000")!;
    expect(municipality.adjustedDisasterRisk).toBe(alaminos.disasterRisk);
    expect(municipality.scoreContributions.disasterRisk).toBe(Math.round(alaminos.disasterRisk! * 2) / 10);
    expect(barangayMetric(records[0], "score")).toBeNull();
  });

  it("retains all hospital records without making up missing locations or beds", () => {
    expect(PROVIDED_HOSPITALS).toHaveLength(66);
    expect(MAPPED_HOSPITALS).toHaveLength(61);
    expect(PROVIDED_HOSPITALS.filter((h) => h.capacity === null)).toHaveLength(9);
    expect(PROVIDED_HOSPITALS.find((h) => h.name.includes("SAN JOSE HOSPITAL"))?.verified).toBe(false);
  });

  it("opens barangay details, changes the selection and clears it for municipality overview", () => {
    const [a, b] = LAGUNA_BARANGAYS;
    useAppStore.setState({ panel: "optimization", sidePanelOpen: false });
    useAppStore.getState().selectBarangay(a.psgc, a.municipalityPsgc);
    expect(useAppStore.getState()).toMatchObject({ selectedBarangayPsgc: a.psgc, selectedPsgc: a.municipalityPsgc, sidePanelOpen: true, panel: null });
    useAppStore.getState().selectBarangay(b.psgc, b.municipalityPsgc);
    expect(useAppStore.getState().selectedBarangayPsgc).toBe(b.psgc);
    useAppStore.getState().selectMunicipality(null);
    expect(useAppStore.getState().selectedBarangayPsgc).toBeNull();
  });
});
