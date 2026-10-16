import type { ClinicPlan } from "../../types/clinic";
import { useAppStore } from "../../store/useAppStore";
import { Button } from "../../components/ui/Button";
export function DeploymentApproval({ plan }: { plan: ClinicPlan }) {
  const { approvedPlan, approve } = useAppStore();
  const matches =
    approvedPlan && JSON.stringify(approvedPlan) === JSON.stringify(plan);
  return (
    <div className="workspace-subcard">
      <Button
        disabled={!!matches || !plan.clinics.length}
        onClick={() => approve(plan)}
      >
        {matches
          ? "Saved local approval rehearsal"
          : "Accept local deployment draft"}
      </Button>
      <p className="workspace-note" role="status">
        {approvedPlan
          ? `Saved snapshot: ${approvedPlan.clinics.length} clinics. `
          : ""}
        Local rehearsal saved in this browser. Publish connected plans through
        Clinic Schedules.
      </p>
    </div>
  );
}
