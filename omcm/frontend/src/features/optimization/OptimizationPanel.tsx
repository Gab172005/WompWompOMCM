import { useAppStore } from "../../store/useAppStore";
import { usePlanningResults } from "./usePlanningResults";
import { ClinicCountInput } from "./ClinicCountInput";
import { PlacementRecommendations } from "./PlacementRecommendations";
import { DeploymentApproval } from "./DeploymentApproval";
import { Button } from "../../components/ui/Button";
export function OptimizationPanel() {
  const { plan } = usePlanningResults();
  return (
    <>
      <p>
        Allocate the fleet using the separate municipal allocation heuristic
        and illustrative candidate sites. This estimate uses a different formula
        from the barangay HNI heatmap.
      </p>
      <ClinicCountInput />
      <Button onClick={useAppStore.getState().regenerate}>
        Generate recommendations
      </Button>
      <PlacementRecommendations plan={plan} />
      <DeploymentApproval plan={plan} />
    </>
  );
}
