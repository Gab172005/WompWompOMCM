// Municipality-level illustrative fixtures and testing branch's planning heuristic.
// These inputs are separate from the server-backed barangay pilot.
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

// 30 Authentic Laguna Municipalities with official PSA 2020 Census populations and GeoJSON area
export const LAGUNA_BASE_DATA: MunicipalityRecord[] = [
  {
    psgc: "403401000",
    name: "Alaminos",
    level: "Mun",
    area_km2: 59,
    population: 51619,
    lat: 14.0432,
    lng: 121.2473,
    flood: 28,
    morbidity: 36,
    vulnerability: 46,
    hospital_minutes: 24,
    nearest_hospital: "San Pablo City District Hospital",
  },
  {
    psgc: "403402000",
    name: "Bay",
    level: "Mun",
    area_km2: 38,
    population: 67182,
    lat: 14.1447,
    lng: 121.2612,
    flood: 72,
    morbidity: 44,
    vulnerability: 52,
    hospital_minutes: 15,
    nearest_hospital: "Global Care Medical Center of Bay",
  },
  {
    psgc: "403403000",
    name: "City of Biñan",
    level: "City",
    area_km2: 37,
    population: 407437,
    lat: 14.3071,
    lng: 121.0692,
    flood: 64,
    morbidity: 58,
    vulnerability: 62,
    hospital_minutes: 10,
    nearest_hospital: "Biñan Doctors Hospital",
  },
  {
    psgc: "403404000",
    name: "City of Cabuyao",
    level: "City",
    area_km2: 47,
    population: 355330,
    lat: 14.239,
    lng: 121.1114,
    flood: 55,
    morbidity: 54,
    vulnerability: 58,
    hospital_minutes: 12,
    nearest_hospital: "Cabuyao City Hospital",
  },
  {
    psgc: "403405000",
    name: "City of Calamba",
    level: "City",
    area_km2: 139,
    population: 539671,
    lat: 14.1872,
    lng: 121.1203,
    flood: 50,
    morbidity: 60,
    vulnerability: 65,
    hospital_minutes: 8,
    nearest_hospital: "Calamba Medical Center",
  },
  {
    psgc: "403406000",
    name: "Calauan",
    level: "Mun",
    area_km2: 74,
    population: 87893,
    lat: 14.133,
    lng: 121.2968,
    flood: 48,
    morbidity: 40,
    vulnerability: 48,
    hospital_minutes: 20,
    nearest_hospital: "Global Care Medical Center of Bay",
  },
  {
    psgc: "403407000",
    name: "Cavinti",
    level: "Mun",
    area_km2: 116,
    population: 23980,
    lat: 14.2465,
    lng: 121.5528,
    flood: 22,
    morbidity: 26,
    vulnerability: 38,
    hospital_minutes: 35,
    nearest_hospital: "Laguna Provincial Hospital",
  },
  {
    psgc: "403408000",
    name: "Famy",
    level: "Mun",
    area_km2: 33,
    population: 16791,
    lat: 14.4813,
    lng: 121.4742,
    flood: 45,
    morbidity: 30,
    vulnerability: 44,
    hospital_minutes: 28,
    nearest_hospital: "General Cailles Memorial District Hospital",
  },
  {
    psgc: "403409000",
    name: "Kalayaan",
    level: "Mun",
    area_km2: 53,
    population: 24754,
    lat: 14.3331,
    lng: 121.5319,
    flood: 35,
    morbidity: 28,
    vulnerability: 42,
    hospital_minutes: 30,
    nearest_hospital: "General Cailles Memorial District Hospital",
  },
  {
    psgc: "403410000",
    name: "Liliw",
    level: "Mun",
    area_km2: 42,
    population: 39491,
    lat: 14.1417,
    lng: 121.4365,
    flood: 18,
    morbidity: 32,
    vulnerability: 35,
    hospital_minutes: 25,
    nearest_hospital: "Nagcarlan District Hospital",
  },
  {
    psgc: "403411000",
    name: "Los Baños",
    level: "Mun",
    area_km2: 55,
    population: 115353,
    lat: 14.1532,
    lng: 121.2244,
    flood: 68,
    morbidity: 48,
    vulnerability: 50,
    hospital_minutes: 10,
    nearest_hospital: "HealthServ Los Baños Medical Center",
  },
  {
    psgc: "403412000",
    name: "Luisiana",
    level: "Mun",
    area_km2: 74,
    population: 20859,
    lat: 14.1882,
    lng: 121.5278,
    flood: 16,
    morbidity: 24,
    vulnerability: 34,
    hospital_minutes: 38,
    nearest_hospital: "Majayjay Medicare Community Hospital",
  },
  {
    psgc: "403413000",
    name: "Lumban",
    level: "Mun",
    area_km2: 83,
    population: 32427,
    lat: 14.2983,
    lng: 121.5157,
    flood: 58,
    morbidity: 38,
    vulnerability: 45,
    hospital_minutes: 22,
    nearest_hospital: "Laguna Provincial Hospital",
  },
  {
    psgc: "403414000",
    name: "Mabitac",
    level: "Mun",
    area_km2: 47,
    population: 21275,
    lat: 14.4298,
    lng: 121.4022,
    flood: 62,
    morbidity: 34,
    vulnerability: 47,
    hospital_minutes: 32,
    nearest_hospital: "General Cailles Memorial District Hospital",
  },
  {
    psgc: "403415000",
    name: "Magdalena",
    level: "Mun",
    area_km2: 32,
    population: 27816,
    lat: 14.2067,
    lng: 121.4359,
    flood: 25,
    morbidity: 30,
    vulnerability: 38,
    hospital_minutes: 18,
    nearest_hospital: "Laguna Provincial Hospital",
  },
  {
    psgc: "403416000",
    name: "Majayjay",
    level: "Mun",
    area_km2: 60,
    population: 27893,
    lat: 14.1393,
    lng: 121.4804,
    flood: 15,
    morbidity: 28,
    vulnerability: 36,
    hospital_minutes: 20,
    nearest_hospital: "Majayjay Medicare Community Hospital",
  },
  {
    psgc: "403417000",
    name: "Nagcarlan",
    level: "Mun",
    area_km2: 75,
    population: 64866,
    lat: 14.1342,
    lng: 121.4045,
    flood: 20,
    morbidity: 35,
    vulnerability: 40,
    hospital_minutes: 15,
    nearest_hospital: "Nagcarlan District Hospital",
  },
  {
    psgc: "403418000",
    name: "Paete",
    level: "Mun",
    area_km2: 48,
    population: 24945,
    lat: 14.3747,
    lng: 121.5349,
    flood: 42,
    morbidity: 32,
    vulnerability: 41,
    hospital_minutes: 18,
    nearest_hospital: "General Cailles Memorial District Hospital",
  },
  {
    psgc: "403419000",
    name: "Pagsanjan",
    level: "Mun",
    area_km2: 28,
    population: 44327,
    lat: 14.252,
    lng: 121.4487,
    flood: 60,
    morbidity: 42,
    vulnerability: 46,
    hospital_minutes: 12,
    nearest_hospital: "Laguna Provincial Hospital",
  },
  {
    psgc: "403420000",
    name: "Pakil",
    level: "Mun",
    area_km2: 47,
    population: 23495,
    lat: 14.3881,
    lng: 121.4484,
    flood: 52,
    morbidity: 33,
    vulnerability: 43,
    hospital_minutes: 10,
    nearest_hospital: "General Cailles Memorial District Hospital",
  },
  {
    psgc: "403421000",
    name: "Pangil",
    level: "Mun",
    area_km2: 50,
    population: 25026,
    lat: 14.4231,
    lng: 121.4883,
    flood: 48,
    morbidity: 31,
    vulnerability: 42,
    hospital_minutes: 20,
    nearest_hospital: "General Cailles Memorial District Hospital",
  },
  {
    psgc: "403422000",
    name: "Pila",
    level: "Mun",
    area_km2: 25,
    population: 54613,
    lat: 14.231,
    lng: 121.3653,
    flood: 65,
    morbidity: 40,
    vulnerability: 47,
    hospital_minutes: 16,
    nearest_hospital: "Laguna Provincial Hospital",
  },
  {
    psgc: "403423000",
    name: "Rizal",
    level: "Mun",
    area_km2: 23,
    population: 18332,
    lat: 14.0952,
    lng: 121.4033,
    flood: 18,
    morbidity: 27,
    vulnerability: 36,
    hospital_minutes: 26,
    nearest_hospital: "San Pablo City District Hospital",
  },
  {
    psgc: "403424000",
    name: "City of San Pablo",
    level: "City",
    area_km2: 186,
    population: 285348,
    lat: 14.0503,
    lng: 121.3302,
    flood: 30,
    morbidity: 52,
    vulnerability: 56,
    hospital_minutes: 10,
    nearest_hospital: "San Pablo City District Hospital",
  },
  {
    psgc: "403425000",
    name: "City of San Pedro",
    level: "City",
    area_km2: 24,
    population: 326001,
    lat: 14.3492,
    lng: 121.0404,
    flood: 70,
    morbidity: 62,
    vulnerability: 66,
    hospital_minutes: 8,
    nearest_hospital: "San Pedro Doctors Hospital",
  },
  {
    psgc: "403426000",
    name: "Santa Cruz",
    level: "Mun",
    area_km2: 37,
    population: 123574,
    lat: 14.2606,
    lng: 121.4016,
    flood: 75,
    morbidity: 55,
    vulnerability: 60,
    hospital_minutes: 5,
    nearest_hospital: "Laguna Provincial Hospital",
  },
  {
    psgc: "403427000",
    name: "Santa Maria",
    level: "Mun",
    area_km2: 108,
    population: 34511,
    lat: 14.5108,
    lng: 121.4261,
    flood: 38,
    morbidity: 29,
    vulnerability: 44,
    hospital_minutes: 36,
    nearest_hospital: "General Cailles Memorial District Hospital",
  },
  {
    psgc: "403428000",
    name: "City of Santa Rosa",
    level: "City",
    area_km2: 56,
    population: 414812,
    lat: 14.272,
    lng: 121.0917,
    flood: 58,
    morbidity: 56,
    vulnerability: 63,
    hospital_minutes: 9,
    nearest_hospital: "The Medical City South Luzon",
  },
  {
    psgc: "403429000",
    name: "Siniloan",
    level: "Mun",
    area_km2: 54,
    population: 39460,
    lat: 14.477,
    lng: 121.4948,
    flood: 54,
    morbidity: 36,
    vulnerability: 48,
    hospital_minutes: 25,
    nearest_hospital: "General Cailles Memorial District Hospital",
  },
  {
    psgc: "403430000",
    name: "Victoria",
    level: "Mun",
    area_km2: 29,
    population: 43408,
    lat: 14.2053,
    lng: 121.3342,
    flood: 78,
    morbidity: 42,
    vulnerability: 50,
    hospital_minutes: 18,
    nearest_hospital: "Laguna Provincial Hospital",
  },
];

// Verified Hospitals & Medical Facilities strictly within Laguna Province
export const LAGUNA_HOSPITALS: HospitalFacility[] = [
  {
    id: "H-SC-01",
    name: "Laguna Provincial Hospital",
    municipality: "Santa Cruz",
    lat: 14.2812,
    lng: 121.4153,
    type: "Provincial Government Tertiary Hospital",
    services: [
      "Emergency Trauma",
      "Pediatrics",
      "Internal Medicine",
      "Surgery",
      "ICU",
    ],
    capacity: 250,
    verified: true,
  },
  {
    id: "H-CAL-01",
    name: "Calamba Medical Center",
    municipality: "City of Calamba",
    lat: 14.2081,
    lng: 121.1554,
    type: "Tertiary Private Hospital",
    services: ["Emergency Care", "Cardiology", "Diagnostics", "Maternity"],
    capacity: 200,
    verified: true,
  },
  {
    id: "H-SP-01",
    name: "San Pablo City District Hospital",
    municipality: "City of San Pablo",
    lat: 14.0682,
    lng: 121.3251,
    type: "District Level II Hospital",
    services: ["Emergency Room", "General Medicine", "Pediatrics"],
    capacity: 120,
    verified: true,
  },
  {
    id: "H-BAY-01",
    name: "Global Care Medical Center of Bay",
    municipality: "Bay",
    lat: 14.1802,
    lng: 121.2851,
    type: "Community Level II Hospital",
    services: ["Primary Care", "Emergency Assessment", "Pediatrics"],
    capacity: 80,
    verified: true,
  },
  {
    id: "H-LB-01",
    name: "HealthServ Los Baños Medical Center",
    municipality: "Los Baños",
    lat: 14.1751,
    lng: 121.2402,
    type: "Tertiary Medical Center",
    services: [
      "Emergency Assessment",
      "Internal Medicine",
      "Radiology",
      "Surgical",
    ],
    capacity: 150,
    verified: true,
  },
  {
    id: "H-BIN-01",
    name: "Biñan Doctors Hospital",
    municipality: "City of Biñan",
    lat: 14.3382,
    lng: 121.0821,
    type: "Secondary Hospital",
    services: ["Emergency Room", "Outpatient Clinic", "Diagnostics"],
    capacity: 100,
    verified: true,
  },
  {
    id: "H-SR-01",
    name: "The Medical City South Luzon",
    municipality: "City of Santa Rosa",
    lat: 14.2781,
    lng: 121.1052,
    type: "Tertiary Medical Center",
    services: ["Comprehensive Emergency", "Specialty Clinics", "ICU"],
    capacity: 180,
    verified: true,
  },
  {
    id: "H-SPD-01",
    name: "San Pedro Doctors Hospital",
    municipality: "City of San Pedro",
    lat: 14.3581,
    lng: 121.0553,
    type: "Secondary Hospital",
    services: ["Emergency", "General Care", "Maternity"],
    capacity: 90,
    verified: true,
  },
  {
    id: "H-CAB-01",
    name: "Cabuyao City Hospital",
    municipality: "City of Cabuyao",
    lat: 14.2752,
    lng: 121.1251,
    type: "City Government Hospital",
    services: ["Emergency Room", "Primary Health", "Maternal Care"],
    capacity: 100,
    verified: true,
  },
  {
    id: "H-PAK-01",
    name: "General Cailles Memorial District Hospital",
    municipality: "Pakil",
    lat: 14.3821,
    lng: 121.4812,
    type: "District Hospital (Northeastern Laguna)",
    services: ["Emergency Care", "Primary Ward", "First Aid"],
    capacity: 60,
    verified: true,
  },
  {
    id: "H-NAG-01",
    name: "Nagcarlan District Hospital",
    municipality: "Nagcarlan",
    lat: 14.1352,
    lng: 121.4181,
    type: "District Hospital (Upland Laguna)",
    services: ["Primary Care", "Outpatient Consultation"],
    capacity: 50,
    verified: true,
  },
  {
    id: "H-MAJ-01",
    name: "Majayjay Medicare Community Hospital",
    municipality: "Majayjay",
    lat: 14.1423,
    lng: 121.4552,
    type: "Medicare Community Hospital",
    services: ["Outpatient Consultation", "Emergency Triage"],
    capacity: 40,
    verified: true,
  },
];

// Candidate Mobile Clinic Staging Sites across Laguna
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
];

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

    // Flood override
    let floodLevel = base.flood;
    const floodSetting = scenario.floodOverrides[base.psgc];
    if (floodSetting === "severe")
      floodLevel = Math.min(100, Math.round(base.flood * 1.5 + 20));
    else if (floodSetting === "moderate")
      floodLevel = Math.min(100, Math.round(base.flood * 1.25 + 10));
    else if (floodSetting === "low") floodLevel = Math.round(base.flood * 0.9);
    else if (floodSetting === "none") floodLevel = Math.round(base.flood * 0.6);

    // Morbidity spike
    const spike = scenario.morbiditySpikes[base.psgc] ?? 1.0;
    const adjustedMorbidity = Math.round(base.morbidity * spike);

    // Density factor normalized (cap at 100 for high urban density like Biñan/San Pedro)
    const densityScore = Math.min(100, Math.round(density / 75));

    // Transparent weighted formula
    const wMorbidity = 0.35;
    const wVulnerability = 0.25;
    const wFlood = 0.2;
    const wDensity = 0.2;

    const contribMorbidity =
      Math.round(adjustedMorbidity * wMorbidity * 10) / 10;
    const contribVulnerability =
      Math.round(base.vulnerability * wVulnerability * 10) / 10;
    const contribFlood = Math.round(floodLevel * wFlood * 10) / 10;
    const contribDensity = Math.round(densityScore * wDensity * 10) / 10;

    const needScore = Math.min(
      100,
      Math.max(
        5,
        Math.round(
          contribMorbidity +
            contribVulnerability +
            contribFlood +
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
      contribMorbidity >= contribFlood &&
      contribMorbidity >= contribVulnerability
        ? `elevated disease incidence (${adjustedMorbidity} / 1,000 residents)`
        : contribFlood >= contribDensity
          ? `vulnerability to flood inundation (${floodLevel}/100 exposure)`
          : `high population density (${density.toLocaleString()} residents/km²)`;

    const explanation = `Score driven primarily by ${highestDriver} and ${base.vulnerability}% vulnerable population index.`;

    return {
      ...base,
      density,
      adjustedFlood: floodLevel,
      adjustedMorbidity,
      needScore,
      levelCategory,
      rank: 0,
      scoreContributions: {
        morbidity: contribMorbidity,
        vulnerability: contribVulnerability,
        flood: contribFlood,
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
  metric: "score" | "density" | "flood" | "morbidity",
  value: number,
): string {
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

  if (metric === "flood") {
    // Blue-cyan palette for Flood Vulnerability (0-100)
    if (value >= 70) return "#075985"; // Severe
    if (value >= 50) return "#0284c7"; // High
    if (value >= 35) return "#38bdf8"; // Moderate
    if (value >= 20) return "#7dd3fc"; // Low
    return "#e0f2fe"; // Very low
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
  const candidatePool = [...LAGUNA_CANDIDATE_SITES];

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
      reason: `Prioritized to address ${mun?.needScore ?? 60}/100 need score in ${site.municipality} (${mun?.population.toLocaleString()} pop).`,
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
