import { useAppStore } from "../../store/useAppStore";
import { usePlanningResults } from "../optimization/usePlanningResults";
import { MunicipalityMetrics } from "./MunicipalityMetrics";
import { MunicipalityRanking } from "./MunicipalityRanking";
import { Button } from "../../components/ui/Button";
import { BarangayRanking } from "./BarangayRanking";
import { PlaceHeader } from "./PlaceDetails";
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
      <PlaceHeader
        title={selected?.name ?? "Explore Laguna"}
        kind={
          selected?.level === "City"
            ? "City"
            : selected
              ? "Municipality"
              : "Province overview"
        }
        subtitle={
          selected
            ? `Laguna Province · ${selected.barangayCount} barangays`
            : "Find communities that may need more healthcare support."
        }
        onBack={selected ? () => selectMunicipality(null) : undefined}
        backLabel="Province overview"
      />
      {selected ? (
        <>
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
            hospital records. Click a barangay on the map or search by name.
            Click a hospital symbol for facility information.
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
          Try a 30-day plan
        </Button>
      </div>
      <details className="place-disclosure">
        <summary>Compare municipality healthcare needs</summary>
        <MunicipalityRanking municipalities={municipalities} />
      </details>
      <p className="workspace-note">
        Uses supplied population, disaster risk and hospital records. Illness
        rates are sample data. Estimates of residents needing extra support,
        routes and clinic plans are for demonstration only.
      </p>
    </>
  );
}
