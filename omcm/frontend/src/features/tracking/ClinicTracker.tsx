import { Modal } from "../../components/ui/Modal";
import { useAppStore } from "../../store/useAppStore";
import { usePlanningResults } from "../optimization/usePlanningResults";
import { ClinicDetails } from "./ClinicDetails";
export function ClinicTracker() {
  const {
    selectedClinicId,
    progress,
    panel,
    viewMode,
    selectedScheduleDate,
    publishedSchedules,
  } = useAppStore();
  const { plan } = usePlanningResults();
  const publicSchedule = publishedSchedules[selectedScheduleDate] ?? null;
  const clinics =
    viewMode === "public" ? (publicSchedule?.plan.clinics ?? []) : plan.clinics;
  const clinic = clinics.find((c) => c.clinicId === selectedClinicId);
  return clinic ? (
    <Modal
      title={clinic.clinicId}
      onClose={() => useAppStore.setState({ selectedClinicId: null })}
    >
      <ClinicDetails
        clinic={clinic}
        progress={progress}
        simulation={viewMode === "admin" && panel === "simulation"}
        publicSchedule={viewMode === "public" ? publicSchedule : null}
      />
    </Modal>
  ) : null;
}
