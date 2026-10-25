import { Building2, Hospital, Truck } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
/** Independent visibility controls retain the existing map/store contract. */
export function LayerToggles() {
  const { showHospitals, showClinics, showOsmClinics, viewMode } =
    useAppStore();
  const layers = [
    {
      field: "showHospitals",
      checked: showHospitals,
      title: "Hospitals",
      detail: "Verified, located facility records",
      icon: Hospital,
      className: "is-hospital",
    },
    {
      field: "showClinics",
      checked: showClinics,
      title: "Mobile clinics",
      detail:
        viewMode === "public"
          ? "Published visit locations only"
          : "Draft and deployed clinic locations",
      icon: Truck,
      className: "is-mobile",
    },
    {
      field: "showOsmClinics",
      checked: showOsmClinics,
      title: "Fixed clinics (OpenStreetMap)",
      detail: "Mapped facilities; opening status unverified",
      icon: Building2,
      className: "is-fixed",
    },
  ] as const;
  return (
    <fieldset className="map-facility-options">
      <legend>Facility layers</legend>
      <div className="workspace-layer-toggles">
        {layers.map(
          ({ field, checked, title, detail, icon: Icon, className }) => (
            <label className={`map-layer-row ${className}`} key={field}>
              <span className="map-layer-symbol">
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="map-layer-copy">
                <strong>{title}</strong>
                <small>{detail}</small>
              </span>
              <input
                type="checkbox"
                aria-label={title}
                checked={checked}
                onChange={(event) =>
                  useAppStore.setState({ [field]: event.target.checked })
                }
              />
            </label>
          ),
        )}
      </div>
    </fieldset>
  );
}
