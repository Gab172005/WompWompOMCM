import { useAppStore } from "../../store/useAppStore";
import { usePlanningResults } from "../optimization/usePlanningResults";
import { MunicipalityMetrics } from "./MunicipalityMetrics";
import { MunicipalityRanking } from "./MunicipalityRanking";
import { Button } from "../../components/ui/Button";
export function MunicipalityPanel() {
  const { selectedPsgc, selectMunicipality, openPanel } = useAppStore();
  const { municipalities } = usePlanningResults();
  const selected = municipalities.find((m) => m.psgc === selectedPsgc);
  return (
    <>
      <div className="eyebrow">LAGUNA PLANNING WORKSPACE</div>
      <h1>{selected?.name ?? "Healthcare where it matters."}</h1>
      {selected ? (
        <>
          <button
            className="workspace-text-button"
            onClick={() => selectMunicipality(null)}
          >
            ← Province overview
          </button>
          <MunicipalityMetrics municipality={selected} />
        </>
      ) : (
        <>
          <p>
            Explore community need and plan mobile clinic placements across
            Laguna.
          </p>
          <div className="workspace-metrics">
            <div>
              <strong>{municipalities.length}</strong>
              <span>Cities / municipalities</span>
            </div>
            <div>
              <strong>
                {(
                  municipalities.reduce((s, m) => s + m.population, 0) / 1e6
                ).toFixed(2)}
                M
              </strong>
              <span>Illustrative population total</span>
            </div>
          </div>
        </>
      )}
      <div className="workspace-button-row">
        <Button onClick={() => openPanel("optimization")}>
          Plan deployment
        </Button>
        <Button variant="secondary" onClick={() => openPanel("simulation")}>
          Test scenario
        </Button>
      </div>
      <MunicipalityRanking municipalities={municipalities} />
      <p className="workspace-note">
        PSGC boundary geometry. Health indicators, facility information, routes
        and deployment estimates are illustrative fixtures; no live feeds are
        connected.
      </p>
    </>
  );
}
