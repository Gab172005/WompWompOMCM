import { useAppStore } from "../../store/useAppStore";
export function LayerToggles() {
  const { showHospitals, showClinics } = useAppStore();
  return (
    <div className="workspace-layer-toggles">
      <label>
        <input
          type="checkbox"
          checked={showHospitals}
          onChange={(e) =>
            useAppStore.setState({ showHospitals: e.target.checked })
          }
        />{" "}
        Hospitals
      </label>
      <label>
        <input
          type="checkbox"
          checked={showClinics}
          onChange={(e) =>
            useAppStore.setState({ showClinics: e.target.checked })
          }
        />{" "}
        Clinics
      </label>
    </div>
  );
}
