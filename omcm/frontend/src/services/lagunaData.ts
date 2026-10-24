import { MAPPED_HOSPITALS, municipalityDataset } from "./providedData";
import { isDeploymentRestricted } from "./mapLandmarks";
// Supplied barangay data aggregated for the municipality planning heuristic.
// Vulnerability, staging sites and route estimates remain illustrative.
import type {
  MunicipalityRecord,
  ComputedMunicipality,
  HospitalFacility,
} from "../types/municipality";
import type { StagingSite } from "../types/clinic";
import type { RoadDisruption, SimulationScenario } from "../types/simulation";
export type {
  MunicipalityRecord,
  ComputedMunicipality,
  HospitalFacility,
} from "../types/municipality";
export type { StagingSite } from "../types/clinic";
export type { RoadDisruption, SimulationScenario } from "../types/simulation";

export const LAGUNA_BOUNDS = {
  north: 14.62,
  south: 13.95,
  west: 121.0,
  east: 121.65,
};

export const LAGUNA_CENTER = {
  lat: 14.28,
  lng: 121.32,
};

// Municipality locations, areas and illustrative vulnerability inputs.
// Population, morbidity and risk are joined from the supplied barangay CSVs.
const MUNICIPALITY_CONTEXT = [
  {
    psgc: "403401000",
    name: "Alaminos",
    level: "Mun",
    area_km2: 59,
    lat: 14.0432,
    lng: 121.2473,
    vulnerability: 46,
  },
  {
    psgc: "403402000",
    name: "Bay",
    level: "Mun",
    area_km2: 38,
    lat: 14.1447,
    lng: 121.2612,
    vulnerability: 52,
  },
  {
    psgc: "403403000",
    name: "City of Biñan",
    level: "City",
    area_km2: 37,
    lat: 14.3071,
    lng: 121.0692,
    vulnerability: 62,
  },
  {
    psgc: "403404000",
    name: "City of Cabuyao",
    level: "City",
    area_km2: 47,
    lat: 14.239,
    lng: 121.1114,
    vulnerability: 58,
  },
  {
    psgc: "403405000",
    name: "City of Calamba",
    level: "City",
    area_km2: 139,
    lat: 14.1872,
    lng: 121.1203,
    vulnerability: 65,
  },
  {
    psgc: "403406000",
    name: "Calauan",
    level: "Mun",
    area_km2: 74,
    lat: 14.133,
    lng: 121.2968,
    vulnerability: 48,
  },
  {
    psgc: "403407000",
    name: "Cavinti",
    level: "Mun",
    area_km2: 116,
    lat: 14.2465,
    lng: 121.5528,
    vulnerability: 38,
  },
  {
    psgc: "403408000",
    name: "Famy",
    level: "Mun",
    area_km2: 33,
    lat: 14.4813,
    lng: 121.4742,
    vulnerability: 44,
  },
  {
    psgc: "403409000",
    name: "Kalayaan",
    level: "Mun",
    area_km2: 53,
    lat: 14.3331,
    lng: 121.5319,
    vulnerability: 42,
  },
  {
    psgc: "403410000",
    name: "Liliw",
    level: "Mun",
    area_km2: 42,
    lat: 14.1417,
    lng: 121.4365,
    vulnerability: 35,
  },
  {
    psgc: "403411000",
    name: "Los Baños",
    level: "Mun",
    area_km2: 55,
    lat: 14.1532,
    lng: 121.2244,
    vulnerability: 50,
  },
  {
    psgc: "403412000",
    name: "Luisiana",
    level: "Mun",
    area_km2: 74,
    lat: 14.1882,
    lng: 121.5278,
    vulnerability: 34,
  },
  {
    psgc: "403413000",
    name: "Lumban",
    level: "Mun",
    area_km2: 83,
    lat: 14.2983,
    lng: 121.5157,
    vulnerability: 45,
  },
  {
    psgc: "403414000",
    name: "Mabitac",
    level: "Mun",
    area_km2: 47,
    lat: 14.4298,
    lng: 121.4022,
    vulnerability: 47,
  },
  {
    psgc: "403415000",
    name: "Magdalena",
    level: "Mun",
    area_km2: 32,
    lat: 14.2067,
    lng: 121.4359,
    vulnerability: 38,
  },
  {
    psgc: "403416000",
    name: "Majayjay",
    level: "Mun",
    area_km2: 60,
    lat: 14.1393,
    lng: 121.4804,
    vulnerability: 36,
  },
  {
    psgc: "403417000",
    name: "Nagcarlan",
    level: "Mun",
    area_km2: 75,
    lat: 14.1342,
    lng: 121.4045,
    vulnerability: 40,
  },
  {
    psgc: "403418000",
    name: "Paete",
    level: "Mun",
    area_km2: 48,
    lat: 14.3747,
    lng: 121.5349,
    vulnerability: 41,
  },
  {
    psgc: "403419000",
    name: "Pagsanjan",
    level: "Mun",
    area_km2: 28,
    lat: 14.252,
    lng: 121.4487,
    vulnerability: 46,
  },
  {
    psgc: "403420000",
    name: "Pakil",
    level: "Mun",
    area_km2: 47,
    lat: 14.3881,
    lng: 121.4484,
    vulnerability: 43,
  },
  {
    psgc: "403421000",
    name: "Pangil",
    level: "Mun",
    area_km2: 50,
    lat: 14.4231,
    lng: 121.4883,
    vulnerability: 42,
  },
  {
    psgc: "403422000",
    name: "Pila",
    level: "Mun",
    area_km2: 25,
    lat: 14.231,
    lng: 121.3653,
    vulnerability: 47,
  },
  {
    psgc: "403423000",
    name: "Rizal",
    level: "Mun",
    area_km2: 23,
    lat: 14.0952,
    lng: 121.4033,
    vulnerability: 36,
  },
  {
    psgc: "403424000",
    name: "City of San Pablo",
    level: "City",
    area_km2: 186,
    lat: 14.0503,
    lng: 121.3302,
    vulnerability: 56,
  },
  {
    psgc: "403425000",
    name: "City of San Pedro",
    level: "City",
    area_km2: 24,
    lat: 14.3492,
    lng: 121.0404,
    vulnerability: 66,
  },
  {
    psgc: "403426000",
    name: "Santa Cruz",
    level: "Mun",
    area_km2: 37,
    lat: 14.2606,
    lng: 121.4016,
    vulnerability: 60,
  },
  {
    psgc: "403427000",
    name: "Santa Maria",
    level: "Mun",
    area_km2: 108,
    lat: 14.5108,
    lng: 121.4261,
    vulnerability: 44,
  },
  {
    psgc: "403428000",
    name: "City of Santa Rosa",
    level: "City",
    area_km2: 56,
    lat: 14.272,
    lng: 121.0917,
    vulnerability: 63,
  },
  {
    psgc: "403429000",
    name: "Siniloan",
    level: "Mun",
    area_km2: 54,
    lat: 14.477,
    lng: 121.4948,
    vulnerability: 48,
  },
  {
    psgc: "403430000",
    name: "Victoria",
    level: "Mun",
    area_km2: 29,
    lat: 14.2053,
    lng: 121.3342,
    vulnerability: 50,
  },
];

export const LAGUNA_BASE_DATA: MunicipalityRecord[] = MUNICIPALITY_CONTEXT.map(
  (m) => ({
    ...m,
    level: m.level as "City" | "Mun",
    ...municipalityDataset(m.psgc),
  }),
);

export const LAGUNA_HOSPITALS: HospitalFacility[] = MAPPED_HOSPITALS;

export const LAGUNA_CANDIDATE_SITES: StagingSite[] = [
  {
    id: "SITE-01",
    name: "Santa Cruz Provincial Capitol Grounds Hub",
    municipality: "Santa Cruz",
    psgc: "403426000",
    lat: 14.2681,
    lng: 121.4112,
    capacity: 220,
    eligible: true,
    status: "Active Staging Site",
  },
  {
    id: "SITE-02",
    name: "Calamba City Evacuation & Health Plaza",
    municipality: "City of Calamba",
    psgc: "403405000",
    lat: 14.2112,
    lng: 121.1623,
    capacity: 250,
    eligible: true,
    status: "Active Staging Site",
  },
  {
    id: "SITE-03",
    name: "San Pablo City Plaza Community Health Hub",
    municipality: "City of San Pablo",
    psgc: "403424000",
    lat: 14.0712,
    lng: 121.3241,
    capacity: 200,
    eligible: true,
    status: "Active Staging Site",
  },
  {
    id: "SITE-04",
    name: "Siniloan Municipal Multi-Purpose Center",
    municipality: "Siniloan",
    psgc: "403429000",
    lat: 14.4791,
    lng: 121.4982,
    capacity: 180,
    eligible: true,
    status: "Active Staging Site",
  },
  {
    id: "SITE-05",
    name: "Bay Municipal Rural Health Unit Grounds",
    municipality: "Bay",
    psgc: "403402000",
    lat: 14.1802,
    lng: 121.2843,
    capacity: 190,
    eligible: true,
    status: "Active Staging Site",
  },
  {
    id: "SITE-06",
    name: "Biñan People's Center & Health Grounds",
    municipality: "City of Biñan",
    psgc: "403403000",
    lat: 14.3321,
    lng: 121.0852,
    capacity: 240,
    eligible: true,
    status: "Active Staging Site",
  },
  {
    id: "SITE-07",
    name: "Nagcarlan Covered Court Staging Site",
    municipality: "Nagcarlan",
    psgc: "403417000",
    lat: 14.1362,
    lng: 121.4172,
    capacity: 160,
    eligible: true,
    status: "Active Staging Site",
  },
  {
    id: "SITE-08",
    name: "Paete Lakeside Health Complex",
    municipality: "Paete",
    psgc: "403418000",
    lat: 14.3721,
    lng: 121.5312,
    capacity: 170,
    eligible: true,
    status: "Active Staging Site",
  },
].map((site) =>
  isDeploymentRestricted(site)
    ? {
        ...site,
        eligible: false,
        status: "No mobile clinic deployment — forest land",
      }
    : site,
);

// Simulated Road Disruptions
export const LAGUNA_DISRUPTIONS: RoadDisruption[] = [
  {
    id: "ROAD-DISRUPT-01",
    name: "Manila South Road / Bay–Los Baños Shoreline Corridor",
    corridor: "Route 1 / MSR Junction",
    coordinates: [
      [121.2402, 14.1751],
      [121.2562, 14.1764],
      [121.2751, 14.1792],
      [121.2852, 14.1812],
    ],
    closed: false,
  },
  {
    id: "ROAD-DISRUPT-02",
    name: "Santa Cruz – Pila Provincial Highway Bridge",
    corridor: "National Highway KM 87",
    coordinates: [
      [121.3653, 14.2312],
      [121.3821, 14.2452],
      [121.4016, 14.2606],
    ],
    closed: false,
  },
  {
    id: "ROAD-DISRUPT-03",
    name: "Calamba–Cabuyao Arterial Bypass",
    corridor: "South Luzon Expressway Link",
    coordinates: [
      [121.1203, 14.1872],
      [121.1154, 14.2121],
      [121.1114, 14.2392],
    ],
    closed: false,
  },
];

// Road coordinates for mobile clinic deployment routes from Central Depot (Santa Cruz PDRRMO) to Staging Sites
// All routes follow verified land-based highway corridors (National Highway / Manila South Road / Manila East Road)
// and strictly circumnavigate Laguna de Bay without crossing the lake or provincial boundaries.
export const CLINIC_DEPLOYMENT_ROUTES: Record<string, [number, number][]> = {
  // Santa Cruz Depot -> Site 1 (Santa Cruz Provincial Capitol Hub)
  "SITE-01": [
    [121.415, 14.278],
    [121.414, 14.274],
    [121.4125, 14.271],
    [121.4112, 14.2681],
  ],
  // Santa Cruz Depot -> Site 2 (Calamba Evacuation Plaza) via Manila South Road
  "SITE-02": [
    [121.415, 14.278], // Santa Cruz Depot
    [121.405, 14.268], // Santa Cruz Exit
    [121.395, 14.252], // Labuin
    [121.378, 14.24], // Pila Entry
    [121.365, 14.233], // Pila Town Center
    [121.355, 14.23], // Masico
    [121.345, 14.225], // Victoria Entry
    [121.332, 14.22], // Nanhaya
    [121.32, 14.208], // San Roque
    [121.305, 14.195], // Maitim
    [121.29, 14.183], // Bay Junction
    [121.2843, 14.1802], // Bay Poblacion
    [121.272, 14.179], // San Antonio
    [121.258, 14.177], // Maahas
    [121.245, 14.176], // Batong Malake
    [121.232, 14.178], // Los Baños Crossing
    [121.218, 14.182], // Los Baños Junction
    [121.205, 14.185], // Bagong Kalsada
    [121.192, 14.187], // Pansol
    [121.182, 14.192], // Bucal
    [121.172, 14.198], // Calamba Halang
    [121.165, 14.205], // Real
    [121.1623, 14.2112], // Calamba Plaza
  ],
  // Santa Cruz Depot -> Site 3 (San Pablo City Plaza) via Magdalena & Nagcarlan
  "SITE-03": [
    [121.415, 14.278], // Santa Cruz Depot
    [121.425, 14.26], // Santa Cruz South
    [121.428, 14.23], // Magdalena North
    [121.43, 14.205], // Magdalena Center
    [121.428, 14.18], // Maravilla
    [121.422, 14.155], // Nagcarlan North
    [121.4172, 14.1362], // Nagcarlan Center
    [121.405, 14.12], // Rizal
    [121.392, 14.11], // San Diego
    [121.365, 14.095], // San Pablo East
    [121.345, 14.082], // Schetelig Ave
    [121.332, 14.075], // Rizal St
    [121.3241, 14.0712], // San Pablo City Plaza
  ],
  // Santa Cruz Depot -> Site 4 (Siniloan Multi-Purpose Center) via Manila East Road
  "SITE-04": [
    [121.415, 14.278], // Santa Cruz Depot
    [121.43, 14.274], // Pagsanjan Highway
    [121.445, 14.27], // Pagsanjan Arc
    [121.455, 14.272], // Pagsanjan Center
    [121.458, 14.278], // Lumban Bridge
    [121.462, 14.29], // Lumban Shore
    [121.465, 14.3], // Lumban North
    [121.472, 14.32], // Kalayaan South
    [121.478, 14.345], // Kalayaan Shore
    [121.482, 14.36], // San Antonio
    [121.485, 14.368], // Paete Junction
    [121.485, 14.382], // Pakil Shore
    [121.482, 14.395], // Pakil Town
    [121.478, 14.41], // Pangil South
    [121.472, 14.425], // Pangil Poblacion
    [121.468, 14.45], // Siniloan South
    [121.475, 14.47], // G. Redor St
    [121.4982, 14.4791], // Siniloan Center
  ],
  // Santa Cruz Depot -> Site 5 (Bay RHU Grounds) via National Highway
  "SITE-05": [
    [121.415, 14.278], // Santa Cruz Depot
    [121.405, 14.268], // Santa Cruz Exit
    [121.395, 14.252], // Labuin
    [121.378, 14.24], // Pila Entry
    [121.365, 14.233], // Pila Town Center
    [121.355, 14.23], // Masico
    [121.345, 14.225], // Victoria
    [121.332, 14.22], // Nanhaya
    [121.32, 14.208], // San Roque
    [121.305, 14.195], // Maitim
    [121.29, 14.183], // Bay Junction
    [121.2843, 14.1802], // Bay RHU Grounds
  ],
  // Santa Cruz Depot -> Site 6 (Biñan People's Center) via South Shore & Western Highway
  "SITE-06": [
    [121.415, 14.278], // Santa Cruz Depot
    [121.405, 14.268], // Santa Cruz Exit
    [121.395, 14.252], // Labuin
    [121.378, 14.24], // Pila Entry
    [121.365, 14.233], // Pila Town Center
    [121.355, 14.23], // Masico
    [121.345, 14.225], // Victoria
    [121.332, 14.22], // Nanhaya
    [121.32, 14.208], // San Roque
    [121.305, 14.195], // Maitim
    [121.29, 14.183], // Bay Junction
    [121.2843, 14.1802], // Bay Poblacion
    [121.272, 14.179], // San Antonio
    [121.258, 14.177], // Maahas
    [121.245, 14.176], // Batong Malake
    [121.232, 14.178], // Los Baños Crossing
    [121.218, 14.182], // Los Baños Junction
    [121.205, 14.185], // Bagong Kalsada
    [121.192, 14.187], // Pansol
    [121.182, 14.192], // Bucal
    [121.172, 14.198], // Calamba Halang
    [121.165, 14.205], // Real
    [121.155, 14.225], // Parian
    [121.145, 14.245], // Banlic
    [121.132, 14.265], // Mamatid
    [121.125, 14.278], // Cabuyao Poblacion
    [121.115, 14.295], // Santa Rosa South
    [121.108, 14.31], // Santa Rosa Poblacion
    [121.098, 14.318], // Tagapo
    [121.092, 14.325], // Biñan San Antonio
    [121.0852, 14.3321], // Biñan People's Center
  ],
  // Santa Cruz Depot -> Site 7 (Nagcarlan Covered Court) via Magdalena
  "SITE-07": [
    [121.415, 14.278], // Santa Cruz Depot
    [121.425, 14.26], // Santa Cruz South
    [121.428, 14.23], // Magdalena North
    [121.43, 14.205], // Magdalena Center
    [121.428, 14.18], // Maravilla
    [121.422, 14.155], // Nagcarlan North
    [121.4172, 14.1362], // Nagcarlan Covered Court
  ],
  // Santa Cruz Depot -> Site 8 (Paete Lakeside Health Complex) via East Coast
  "SITE-08": [
    [121.415, 14.278], // Santa Cruz Depot
    [121.43, 14.274], // Pagsanjan Highway
    [121.445, 14.27], // Pagsanjan Arc
    [121.455, 14.272], // Pagsanjan Center
    [121.458, 14.278], // Lumban Bridge
    [121.462, 14.29], // Lumban Shore
    [121.465, 14.3], // Lumban North
    [121.472, 14.32], // Kalayaan South
    [121.478, 14.345], // Kalayaan Shore
    [121.482, 14.36], // San Antonio
    [121.485, 14.368], // Paete Shore Road
    [121.5312, 14.3721], // Paete Health Complex
  ],
};

// Detour routes when critical corridors are disrupted
export const CLINIC_DETOUR_ROUTES: Record<string, [number, number][]> = {
  // Calamba detour when Manila South Road / Los Baños shoreline is closed (ROAD-DISRUPT-01)
  // Re-routes via Magdalena -> Nagcarlan -> San Pablo -> Alaminos -> Calamba
  "SITE-02_DETOUR_01": [
    [121.415, 14.278], // Santa Cruz Depot
    [121.425, 14.26], // Santa Cruz South
    [121.428, 14.23], // Magdalena North
    [121.43, 14.205], // Magdalena Center
    [121.428, 14.18], // Maravilla
    [121.422, 14.155], // Nagcarlan North
    [121.4172, 14.1362], // Nagcarlan Center
    [121.405, 14.12], // Rizal
    [121.392, 14.11], // San Diego
    [121.365, 14.095], // San Pablo East
    [121.345, 14.082], // San Pablo City Proper
    [121.305, 14.068], // Alaminos East
    [121.245, 14.062], // Alaminos West
    [121.185, 14.125], // Turbina Link
    [121.165, 14.185], // Calamba South
    [121.1623, 14.2112], // Calamba Health Plaza
  ],
  // Biñan detour when Los Baños / Manila South Road is closed
  "SITE-06_DETOUR_01": [
    [121.415, 14.278], // Santa Cruz Depot
    [121.425, 14.26], // Santa Cruz South
    [121.428, 14.23], // Magdalena North
    [121.43, 14.205], // Magdalena Center
    [121.428, 14.18], // Maravilla
    [121.422, 14.155], // Nagcarlan North
    [121.4172, 14.1362], // Nagcarlan Center
    [121.405, 14.12], // Rizal
    [121.392, 14.11], // San Diego
    [121.365, 14.095], // San Pablo East
    [121.345, 14.082], // San Pablo City Proper
    [121.305, 14.068], // Alaminos
    [121.245, 14.062], // Alaminos West
    [121.185, 14.125], // Turbina
    [121.165, 14.185], // Calamba South
    [121.155, 14.225], // Parian
    [121.145, 14.245], // Banlic
    [121.132, 14.265], // Mamatid
    [121.125, 14.278], // Cabuyao
    [121.115, 14.295], // Santa Rosa South
    [121.108, 14.31], // Santa Rosa Poblacion
    [121.098, 14.318], // Tagapo
    [121.0852, 14.3321], // Biñan People's Center
  ],
};

/** Get the real, optimized route for a staging site, adapting dynamically if roads are blocked */
export function getOptimizedClinicRoute(
  siteId: string,
  scenario: SimulationScenario,
): [number, number][] {
  // If ROAD-DISRUPT-01 (Bay-Los Baños Corridor) is closed, use inland detour for Calamba and Biñan
  if (scenario.closedRoadIds.includes("ROAD-DISRUPT-01")) {
    if (siteId === "SITE-02" && CLINIC_DETOUR_ROUTES["SITE-02_DETOUR_01"]) {
      return CLINIC_DETOUR_ROUTES["SITE-02_DETOUR_01"];
    }
    if (siteId === "SITE-06" && CLINIC_DETOUR_ROUTES["SITE-06_DETOUR_01"]) {
      return CLINIC_DETOUR_ROUTES["SITE-06_DETOUR_01"];
    }
  }

  return (
    CLINIC_DEPLOYMENT_ROUTES[siteId] ?? [
      [121.415, 14.278],
      [121.4112, 14.2681],
    ]
  );
}

/** Interpolate a mobile clinic vehicle along the exact road waypoints */
export function interpolateRoutePosition(
  route: [number, number][],
  progress: number,
): { lat: number; lng: number } {
  if (!route || route.length === 0) {
    return { lat: 14.278, lng: 121.415 };
  }
  if (route.length === 1 || progress <= 0) {
    return { lat: route[0][1], lng: route[0][0] };
  }
  if (progress >= 1) {
    const last = route[route.length - 1];
    return { lat: last[1], lng: last[0] };
  }

  // Calculate cumulative segment Euclidean lengths
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const dx = route[i + 1][0] - route[i][0];
    const dy = route[i + 1][1] - route[i][1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    segmentLengths.push(dist);
    totalLength += dist;
  }

  if (totalLength === 0) {
    return { lat: route[0][1], lng: route[0][0] };
  }

  const targetDist = progress * totalLength;
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i];
    if (accumulated + segLen >= targetDist || i === segmentLengths.length - 1) {
      const segT = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      const lng = route[i][0] + (route[i + 1][0] - route[i][0]) * segT;
      const lat = route[i][1] + (route[i + 1][1] - route[i][1]) * segT;
      return { lat, lng };
    }
    accumulated += segLen;
  }

  const last = route[route.length - 1];
  return { lat: last[1], lng: last[0] };
}

/** Compute live metrics for all 30 municipalities based on baseline + simulation scenario */
export function computeLagunaMunicipalities(
  scenario: SimulationScenario = {
    floodOverrides: {},
    morbiditySpikes: {},
    closedRoadIds: [],
  },
): ComputedMunicipality[] {
  const records = LAGUNA_BASE_DATA.map((base) => {
    const density = Math.round(base.population / base.area_km2);

    // Simulated flood stress modifies the baseline disaster risk component.
    let disasterRisk = base.disasterRisk;
    const floodSetting = scenario.floodOverrides[base.psgc];
    if (disasterRisk !== null && floodSetting === "severe")
      disasterRisk = Math.min(100, Math.round(base.disasterRisk! * 1.5 + 20));
    else if (disasterRisk !== null && floodSetting === "moderate")
      disasterRisk = Math.min(100, Math.round(base.disasterRisk! * 1.25 + 10));
    else if (disasterRisk !== null && floodSetting === "low")
      disasterRisk = Math.round(base.disasterRisk! * 0.9);
    else if (disasterRisk !== null && floodSetting === "none")
      disasterRisk = Math.round(base.disasterRisk! * 0.6);

    // Morbidity spike
    const spike = scenario.morbiditySpikes[base.psgc] ?? 1.0;
    const adjustedMorbidity = Math.round(base.morbidity * spike);

    // Density factor normalized (cap at 100 for high urban density like Biñan/San Pedro)
    const densityScore = Math.min(100, Math.round(density / 75));

    // Transparent weighted formula
    const wMorbidity = 0.35;
    const wVulnerability = 0.25;
    const wDisasterRisk = 0.2;
    const wDensity = 0.2;

    const contribMorbidity =
      Math.round(adjustedMorbidity * wMorbidity * 10) / 10;
    const contribVulnerability =
      Math.round(base.vulnerability * wVulnerability * 10) / 10;
    const contribDisasterRisk =
      Math.round((disasterRisk ?? 0) * wDisasterRisk * 10) / 10;
    const contribDensity = Math.round(densityScore * wDensity * 10) / 10;

    const needScore = Math.min(
      100,
      Math.max(
        5,
        Math.round(
          contribMorbidity +
            contribVulnerability +
            contribDisasterRisk +
            contribDensity,
        ),
      ),
    );

    let levelCategory: "Critical" | "High" | "Moderate" | "Low" = "Low";
    if (needScore >= 70) levelCategory = "Critical";
    else if (needScore >= 50) levelCategory = "High";
    else if (needScore >= 30) levelCategory = "Moderate";

    // Explanatory sentence
    const highestDriver =
      contribMorbidity >= contribDisasterRisk &&
      contribMorbidity >= contribVulnerability
        ? `sample illness rate (${adjustedMorbidity} cases per 1,000 residents; not reported cases)`
        : contribDisasterRisk >= contribDensity
          ? `mapped disaster risk (${disasterRisk}/100; coverage unverified)`
          : `people living close together (${density.toLocaleString()} per square kilometre)`;

    const explanation = `This municipal planning score reflects ${highestDriver} and a sample estimate of residents needing extra support (${base.vulnerability}/100). It is not a confirmed illness count.`;

    return {
      ...base,
      density,
      adjustedDisasterRisk: disasterRisk,
      adjustedMorbidity,
      needScore,
      levelCategory,
      rank: 0,
      scoreContributions: {
        morbidity: contribMorbidity,
        vulnerability: contribVulnerability,
        disasterRisk: contribDisasterRisk,
        density: contribDensity,
      },
      explanation,
    };
  });

  // Sort by needScore descending to determine rank 1..30
  records.sort(
    (a, b) => b.needScore - a.needScore || b.population - a.population,
  );
  return records.map((m, idx) => ({ ...m, rank: idx + 1 }));
}

/** Color scale generator for heatmaps */
export function getMetricColor(
  metric: "score" | "density" | "disasterRisk" | "morbidity",
  value: number | null,
): string {
  if (value === null || !Number.isFinite(value)) return "#cbd5e1";
  if (metric === "score") {
    // Red-orange palette for Healthcare Need
    if (value >= 70) return "#7f1d1d"; // Critical
    if (value >= 50) return "#b91c1c"; // High
    if (value >= 35) return "#ef4444"; // Moderate-high
    if (value >= 20) return "#f87171"; // Low-moderate
    return "#fee2e2"; // Very low
  }

  if (metric === "density") {
    // Purple-indigo palette for Population Density (residents/km²)
    if (value >= 8000) return "#4c1d95"; // Ultra dense (San Pedro)
    if (value >= 4000) return "#6d28d9"; // Dense (Biñan, Cabuyao)
    if (value >= 1500) return "#8b5cf6"; // Moderate (Calamba, Santa Cruz)
    if (value >= 500) return "#c4b5fd"; // Low (Bay, Pila)
    return "#ede9fe"; // Sparse rural
  }

  if (metric === "disasterRisk") {
    // Blue-cyan palette for supplied disaster risk screening (0-100)
    if (value >= 100) return "#075985";
    if (value >= 66.67) return "#0284c7";
    if (value >= 33.33) return "#7dd3fc";
    return "#e0f2fe"; // No mapped hazard at the supplied query point
  }

  // Morbidity (cases/1,000)
  if (value >= 70) return "#78350f"; // Outbreak
  if (value >= 50) return "#b45309"; // Severe
  if (value >= 35) return "#d97706"; // High
  if (value >= 25) return "#f59e0b"; // Moderate
  return "#fef3c7"; // Low
}

/** Optimizer: generates recommendations for placement of K mobile clinics */
export function runClinicOptimizer(
  k: number,
  municipalities: ComputedMunicipality[],
  scenario: SimulationScenario,
  manualSiteIds: string[] | null = null,
) {
  // If manual site selection is provided, use those
  const candidatePool = LAGUNA_CANDIDATE_SITES.filter(
    (site) => site.eligible && !isDeploymentRestricted(site),
  );

  // Evaluate candidate sites: score each candidate site by the need of its host and surrounding areas
  const scoredSites = candidatePool.map((site) => {
    const hostMun = municipalities.find((m) => m.psgc === site.psgc);
    const need = hostMun?.needScore ?? 50;
    const pop = hostMun?.population ?? 50000;

    // Check if route is affected by closed roads
    let isDisrupted = false;
    if (scenario.closedRoadIds.length > 0) {
      if (
        (site.id === "SITE-02" || site.id === "SITE-05") &&
        scenario.closedRoadIds.includes("ROAD-DISRUPT-01")
      ) {
        isDisrupted = true;
      }
      if (
        (site.id === "SITE-01" || site.id === "SITE-08") &&
        scenario.closedRoadIds.includes("ROAD-DISRUPT-02")
      ) {
        isDisrupted = true;
      }
    }

    const priorityScore = Math.round(need * 0.7 + (pop / 10000) * 0.3);
    return {
      site,
      hostMun,
      priorityScore: isDisrupted
        ? Math.round(priorityScore * 0.5)
        : priorityScore,
      isDisrupted,
    };
  });

  // Sort candidate sites by priority
  scoredSites.sort((a, b) => b.priorityScore - a.priorityScore);

  let selectedSites: StagingSite[];
  if (manualSiteIds && manualSiteIds.length > 0) {
    selectedSites = manualSiteIds
      .map((id) => candidatePool.find((s) => s.id === id))
      .filter((s): s is StagingSite => s !== undefined)
      .slice(0, k);
    // Replace obsolete or restricted overrides with eligible recommendations.
    selectedSites = [
      ...new Map(selectedSites.map((site) => [site.id, site])).values(),
    ];
    for (const { site } of scoredSites) {
      if (selectedSites.length >= k) break;
      if (!selectedSites.some((selected) => selected.id === site.id))
        selectedSites.push(site);
    }
  } else {
    selectedSites = scoredSites
      .slice(0, Math.min(k, scoredSites.length))
      .map((s) => s.site);
  }

  // Calculate plan metrics
  const totalCapacity = selectedSites.reduce((sum, s) => sum + s.capacity, 0);
  const coveredMuns = selectedSites
    .map((s) => municipalities.find((m) => m.psgc === s.psgc))
    .filter(Boolean);
  const totalCoveredPopulation = coveredMuns.reduce(
    (sum, m) => sum + (m?.population ?? 0),
    0,
  );
  const avgNeedCovered =
    coveredMuns.length > 0
      ? Math.round(
          coveredMuns.reduce((sum, m) => sum + (m?.needScore ?? 0), 0) /
            coveredMuns.length,
        )
      : 0;

  const clinicProposals = selectedSites.map((site, index) => {
    const mun = municipalities.find((m) => m.psgc === site.psgc);
    const clinicId = `MC-00${index + 1}`;
    const route = getOptimizedClinicRoute(site.id, scenario);

    return {
      clinicId,
      siteId: site.id,
      siteName: site.name,
      municipality: site.municipality,
      lat: site.lat,
      lng: site.lng,
      capacity: site.capacity,
      servedEstimate: Math.round(site.capacity * 0.88),
      utilizationPct: 88,
      route,
      reason: `Suggested to help ${site.municipality}, with a municipal planning score of ${mun?.needScore ?? 60}/100 and ${mun?.population.toLocaleString()} residents. This demonstration estimate uses a separate score from the barangay map. Local access and clinic readiness need review.`,
    };
  });

  return {
    clinicCount: k,
    clinics: clinicProposals,
    metrics: {
      coveredPopulation: totalCoveredPopulation,
      totalCapacity,
      averageNeedScore: avgNeedCovered,
      capacityUtilization: 88,
      status: "Calculated",
    },
  };
}
