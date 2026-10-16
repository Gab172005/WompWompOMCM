import { Modal } from "../../components/ui/Modal";
import { useAppStore } from "../../store/useAppStore";
import { usePlanningResults } from "../optimization/usePlanningResults";
import { ClinicDetails } from "./ClinicDetails";
export function ClinicTracker() {
  const { selectedClinicId, progress, panel } = useAppStore();
  const { plan } = usePlanningResults();
  const clinic = plan.clinics.find((c) => c.clinicId === selectedClinicId);
  return clinic ? (
    <Modal
      title={clinic.clinicId}
      onClose={() => useAppStore.setState({ selectedClinicId: null })}
    >
      <ClinicDetails
        clinic={clinic}
        progress={progress}
        simulation={panel === "simulation"}
      />
    </Modal>
  ) : null;
}
