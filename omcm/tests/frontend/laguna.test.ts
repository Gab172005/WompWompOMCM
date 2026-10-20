import { describe, it, expect } from "vitest";
import {
  LAGUNA_BASE_DATA,
  LAGUNA_HOSPITALS,
  LAGUNA_CANDIDATE_SITES,
  LAGUNA_BOUNDS,
  computeLagunaMunicipalities,
  getMetricColor,
  runClinicOptimizer,
} from "../../frontend/src/services/lagunaData";

describe("Laguna Province Geographic and Data Integrity", () => {
  it("contains exactly 30 authentic municipalities and cities of Laguna", () => {
    expect(LAGUNA_BASE_DATA.length).toBe(30);
    const names = LAGUNA_BASE_DATA.map((m) => m.name);
    expect(names).toContain("Santa Cruz"); // Provincial capital
    expect(names).toContain("City of Calamba");
    expect(names).toContain("City of San Pablo");
    expect(names).toContain("City of Biñan");
    expect(names).toContain("Los Baños");
    expect(names).toContain("Bay");
  });

  it("all municipalities have positive population and valid area within bounds", () => {
    expect(LAGUNA_BASE_DATA.reduce((sum, m) => sum + m.population, 0)).toBe(3687345);
    LAGUNA_BASE_DATA.forEach((m) => {
      expect(m.population).toBeGreaterThan(10000);
      expect(m.area_km2).toBeGreaterThan(10);
      // Verify geographic coordinates are strictly within Laguna Province bounds
      expect(m.lat).toBeGreaterThanOrEqual(LAGUNA_BOUNDS.south);
      expect(m.lat).toBeLessThanOrEqual(LAGUNA_BOUNDS.north);
      expect(m.lng).toBeGreaterThanOrEqual(LAGUNA_BOUNDS.west);
      expect(m.lng).toBeLessThanOrEqual(LAGUNA_BOUNDS.east);
    });
  });

  it("all hospitals are strictly located within Laguna Province bounds", () => {
    expect(LAGUNA_HOSPITALS.length).toBeGreaterThanOrEqual(10);
    LAGUNA_HOSPITALS.forEach((h) => {
      expect(h.lat).toBeGreaterThanOrEqual(LAGUNA_BOUNDS.south);
      expect(h.lat).toBeLessThanOrEqual(LAGUNA_BOUNDS.north);
      expect(h.lng).toBeGreaterThanOrEqual(LAGUNA_BOUNDS.west);
      expect(h.lng).toBeLessThanOrEqual(LAGUNA_BOUNDS.east);
      expect(h.verified).toBe(true);
    });
  });

  it("all candidate staging sites are within Laguna Province bounds", () => {
    expect(LAGUNA_CANDIDATE_SITES.length).toBe(8);
    LAGUNA_CANDIDATE_SITES.forEach((s) => {
      expect(s.lat).toBeGreaterThanOrEqual(LAGUNA_BOUNDS.south);
      expect(s.lat).toBeLessThanOrEqual(LAGUNA_BOUNDS.north);
      expect(s.lng).toBeGreaterThanOrEqual(LAGUNA_BOUNDS.west);
      expect(s.lng).toBeLessThanOrEqual(LAGUNA_BOUNDS.east);
      expect(s.eligible).toBe(true);
      expect(s.capacity).toBeGreaterThan(100);
    });
  });
});

describe("Heatmap Metrics and Legend Scales", () => {
  const municipalities = computeLagunaMunicipalities();

  it("computes need score, density, and ranks 1 through 30", () => {
    expect(municipalities.length).toBe(30);
    expect(municipalities[0].rank).toBe(1);
    expect(municipalities[29].rank).toBe(30);

    municipalities.forEach((m) => {
      expect(m.needScore).toBeGreaterThanOrEqual(0);
      expect(m.needScore).toBeLessThanOrEqual(100);
      expect(m.density).toBe(Math.round(m.population / m.area_km2));
      expect(["Critical", "High", "Moderate", "Low"]).toContain(m.levelCategory);
    });
  });

  it("returns appropriate hex colors for each metric", () => {
    // Score colors (red scale)
    expect(getMetricColor("score", 75)).toBe("#7f1d1d");
    expect(getMetricColor("score", 10)).toBe("#fee2e2");

    // Density colors (purple scale)
    expect(getMetricColor("density", 9000)).toBe("#4c1d95");
    expect(getMetricColor("density", 300)).toBe("#ede9fe");

    // Flood colors (sky blue scale)
    expect(getMetricColor("flood", 80)).toBe("#075985");
    expect(getMetricColor("flood", 10)).toBe("#e0f2fe");

    // Morbidity colors (amber scale)
    expect(getMetricColor("morbidity", 80)).toBe("#78350f");
    expect(getMetricColor("morbidity", 15)).toBe("#fef3c7");
  });
});

describe("Clinic Optimization Panel Logic", () => {
  const municipalities = computeLagunaMunicipalities();
  const emptyScenario = { floodOverrides: {}, morbiditySpikes: {}, closedRoadIds: [] };

  it("configures K mobile clinics and returns K recommended sites", () => {
    [1, 2, 3, 4, 5].forEach((k) => {
      const result = runClinicOptimizer(k, municipalities, emptyScenario);
      expect(result.clinicCount).toBe(k);
      expect(result.clinics.length).toBe(k);
      expect(result.metrics.coveredPopulation).toBeGreaterThan(0);
      expect(result.metrics.totalCapacity).toBeGreaterThan(0);
    });
  });

  it("supports manual site overrides", () => {
    const k = 3;
    const manualOverrides = ["SITE-04", "SITE-07", "SITE-08"]; // Siniloan, Nagcarlan, Paete
    const result = runClinicOptimizer(k, municipalities, emptyScenario, manualOverrides);
    expect(result.clinics.length).toBe(3);
    const assignedSiteIds = result.clinics.map((c) => c.siteId);
    expect(assignedSiteIds).toEqual(manualOverrides);
  });
});

describe("Simulation Mode Scenario Builder", () => {
  it("adjusts flood severity and recalculates need score for target municipality", () => {
    const bayPsgc = "403402000";
    const baseline = computeLagunaMunicipalities();
    const bayBase = baseline.find((m) => m.psgc === bayPsgc)!;

    const severeScenario = {
      floodOverrides: { [bayPsgc]: "severe" as const },
      morbiditySpikes: {},
      closedRoadIds: [],
    };
    const simulated = computeLagunaMunicipalities(severeScenario);
    const baySimulated = simulated.find((m) => m.psgc === bayPsgc)!;

    expect(baySimulated.adjustedFlood).toBeGreaterThan(bayBase.adjustedFlood);
    expect(baySimulated.needScore).toBeGreaterThanOrEqual(bayBase.needScore);
  });

  it("adjusts morbidity surge and dynamically elevates municipality rank", () => {
    const piraPsgc = "403422000"; // Pila
    const spikeScenario = {
      floodOverrides: {},
      morbiditySpikes: { [piraPsgc]: 2.5 }, // +150% outbreak spike
      closedRoadIds: [],
    };
    const simulated = computeLagunaMunicipalities(spikeScenario);
    const pilaSimulated = simulated.find((m) => m.psgc === piraPsgc)!;

    expect(pilaSimulated.adjustedMorbidity).toBe(Math.round(pilaSimulated.morbidity * 2.5));
    expect(pilaSimulated.needScore).toBeGreaterThan(pilaSimulated.morbidity);
  });

  it("ensures all mobile clinic deployment routes stay strictly within Laguna bounds and follow road waypoints", () => {
    const municipalities = computeLagunaMunicipalities();
    const result = runClinicOptimizer(5, municipalities, {
      floodOverrides: {},
      morbiditySpikes: {},
      closedRoadIds: [],
    });

    result.clinics.forEach((c) => {
      expect(c.route.length).toBeGreaterThan(1);
      c.route.forEach(([lng, lat]) => {
        expect(lng).toBeGreaterThanOrEqual(LAGUNA_BOUNDS.west);
        expect(lng).toBeLessThanOrEqual(LAGUNA_BOUNDS.east);
        expect(lat).toBeGreaterThanOrEqual(LAGUNA_BOUNDS.south);
        expect(lat).toBeLessThanOrEqual(LAGUNA_BOUNDS.north);
      });
    });
  });
});

