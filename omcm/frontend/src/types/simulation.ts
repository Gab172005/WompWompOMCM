export interface RoadDisruption {
  id: string;
  name: string;
  corridor: string;
  coordinates: [number, number][];
  closed: boolean;
}
export interface SimulationScenario {
  floodOverrides: Record<string, FloodSeverity>;
  morbiditySpikes: Record<string, number>;
  closedRoadIds: string[];
}
export type FloodSeverity = "none" | "low" | "moderate" | "severe";
