import { ScenarioBuilder } from "./ScenarioBuilder";
import { SimulationResults } from "./SimulationResults";
import { useAppStore } from "../../store/useAppStore";
import { Button } from "../../components/ui/Button";
export function SimulationPanel() {
  return (
    <>
      <div className="warning">Simulation mode · Synthetic conditions</div>
      <p>Adjust conditions to compare need scores and fleet recommendations.</p>
      <ScenarioBuilder />
      <SimulationResults />
      <Button
        variant="secondary"
        onClick={useAppStore.getState().resetScenario}
      >
        Reset scenario
      </Button>
    </>
  );
}
