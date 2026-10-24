import { useAppStore } from "../../store/useAppStore";
import { usePlanningResults } from "../optimization/usePlanningResults";
import { MunicipalityMetrics } from "./MunicipalityMetrics";
import { MunicipalityRanking } from "./MunicipalityRanking";
import { Button } from "../../components/ui/Button";
import { BarangayRanking } from "./BarangayRanking";
import {
  LAGUNA_BARANGAYS,
  PROVIDED_HOSPITALS,
} from "../../services/providedData";
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
              <span>Supplied population total</span>
            </div>
          </div>
          <p>
            {LAGUNA_BARANGAYS.length} barangays · {PROVIDED_HOSPITALS.length}{" "}
            hospital records. Select a barangay on the map or search by name.
          </p>
        </>
      )}
      <BarangayRanking
        key={selectedPsgc ?? "province"}
        municipalityPsgc={selectedPsgc ?? undefined}
      />
      <div className="workspace-button-row">
        <Button onClick={() => openPanel("optimization")}>
          Plan deployment
        </Button>
        <Button variant="secondary" onClick={() => openPanel("simulation")}>
          Test scenario
        </Button>
      </div>
      <details>
        <summary>Municipality HNI ranking</summary>
        <MunicipalityRanking municipalities={municipalities} />
      </details>
      <p className="workspace-note">
        Supplied barangay population, disaster screening and hospital records
        with PSGC boundary geometry. Morbidity is synthetic; vulnerability,
        routes and deployment estimates remain illustrative.
      </p>
    </>
  );
}
