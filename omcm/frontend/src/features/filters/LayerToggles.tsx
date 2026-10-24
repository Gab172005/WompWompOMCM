import { useAppStore } from "../../store/useAppStore";
/** Three independent layers: hospitals, proposed mobile clinics, fixed OSM clinics. */
export function LayerToggles() {
  const { showHospitals, showClinics, showOsmClinics } = useAppStore();
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
        Mobile clinics
      </label>
      <label>
        <input
          type="checkbox"
          checked={showOsmClinics}
          onChange={(e) =>
            useAppStore.setState({ showOsmClinics: e.target.checked })
          }
        />{" "}
        Clinics
      </label>
    </div>
  );
}
