import { useAppStore } from "../../store/useAppStore";
import { usePlanningResults } from "../optimization/usePlanningResults";
import { MunicipalityMetrics } from "./MunicipalityMetrics";
import { MunicipalityRanking } from "./MunicipalityRanking";
import { Button } from "../../components/ui/Button";
import {
  LAGUNA_BARANGAYS,
  PROVIDED_HOSPITALS,
} from "../../services/providedData";
export function MunicipalityPanel() {
  const { selectedPsgc, selectMunicipality, selectBarangay, openPanel } =
    useAppStore();
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
          <h3>Barangays ({selected.barangayCount})</h3>
          <div className="barangay-list">
            {LAGUNA_BARANGAYS.filter(
              (b) => b.municipalityPsgc === selectedPsgc,
            ).map((b) => (
              <button
                key={b.psgc}
                className="workspace-text-button"
                onClick={() => selectBarangay(b.psgc, b.municipalityPsgc)}
              >
                {b.name}
                <small>
                  {b.population.toLocaleString()} residents · Risk{" "}
                  {b.disasterRisk === null
                    ? "needs review"
                    : `${b.disasterRisk}/100`}
                </small>
              </button>
            ))}
          </div>
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
              <span>Supplied population total</span>
            </div>
          </div>
          <p>
            {LAGUNA_BARANGAYS.length} barangays · {PROVIDED_HOSPITALS.length}{" "}
            hospital records. Select a barangay on the map or search by name.
          </p>
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
        Supplied barangay population, disaster screening and hospital records
        with PSGC boundary geometry. Morbidity is synthetic; vulnerability,
        routes and deployment estimates remain illustrative.
      </p>
    </>
  );
}
