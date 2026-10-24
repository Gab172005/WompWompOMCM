import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { usePlanningResults } from "./usePlanningResults";
import { ClinicCountInput } from "./ClinicCountInput";
import { PlacementRecommendations } from "./PlacementRecommendations";
import { DeploymentApproval } from "./DeploymentApproval";
import { Button } from "../../components/ui/Button";
export function OptimizationPanel() {
  const { plan } = usePlanningResults();
  const [refreshed, setRefreshed] = useState(false);
  return (
    <>
      <p>
        Choose how many mobile clinics are available, review the suggested
        locations, then approve a schedule when ready. Locations and capacity
        are demonstration estimates.
      </p>
      <p className="workspace-note">
        Recommendations use a separate municipal planning score. It differs from
        the barangay Healthcare Need Score shown by the map colors.
      </p>
      <ClinicCountInput />
      <Button
        onClick={() => {
          useAppStore.getState().regenerate();
          setRefreshed(true);
        }}
      >
        Generate recommendations
      </Button>
      {refreshed && (
        <p role="status">
          Suggested locations refreshed. Review them below before publishing a
          schedule.
        </p>
      )}
      <PlacementRecommendations plan={plan} />
      <DeploymentApproval plan={plan} />
    </>
  );
}
