import {
  AlertTriangle,
  Clock,
  HeartPulse,
  MapPin,
  ShieldAlert,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { BARANGAYS_BY_PSGC, distanceKm } from "../../services/providedData";
import { LAGUNA_BASE_DATA } from "../../services/lagunaData";
import {
  NearbyCare,
  PanelExpandButton,
  PlaceHeader,
} from "../municipalities/PlaceDetails";
import { PublicVisitSummary } from "./PublicVisitSummary";
import {
  assignedCommunities,
  usePublicScheduleStore,
} from "../../store/usePublicScheduleStore";

export function PublicSidePanel() {
  const [expanded, setExpanded] = useState(false);
  const {
    sidePanelOpen,
    selectedPsgc,
    selectedBarangayPsgc,
    selectedScheduleDate,
    publishedSchedules,
    selectedClinicId,
    selectMunicipality,
  } = useAppStore();

  const publicData = usePublicScheduleStore((s) => s.data);

  if (!sidePanelOpen) return null;

  const schedule = publishedSchedules[selectedScheduleDate] ?? null;
  const clinics = schedule?.plan.clinics ?? [];

  const selectedBarangay = selectedBarangayPsgc
    ? (BARANGAYS_BY_PSGC.get(selectedBarangayPsgc) ?? null)
    : null;
  const selectedMunicipality = selectedPsgc
    ? (LAGUNA_BASE_DATA.find((m) => m.psgc === selectedPsgc) ?? null)
    : null;

  const targetPoint = selectedBarangay
    ? { lat: selectedBarangay.lat, lng: selectedBarangay.lng }
    : selectedMunicipality
      ? { lat: selectedMunicipality.lat, lng: selectedMunicipality.lng }
      : null;

  const targetMunicipalityName =
    selectedBarangay?.municipality ?? selectedMunicipality?.name ?? null;

  const clinicsByDistance = targetPoint
    ? clinics
        .map((c) => ({
          ...c,
          distance: distanceKm(targetPoint, { lat: c.lat, lng: c.lng }),
        }))
        .sort((a, b) => a.distance - b.distance)
    : [];

  const nearestClinic = clinicsByDistance[0] ?? null;

  return (
    <aside
      className={`workspace-panel intelligence-panel public-care-panel card ${expanded ? "is-expanded" : ""}`}
      aria-label="Community care and schedules"
    >
      <div className="workspace-panel-heading">
        <h2>
          <HeartPulse size={17} aria-hidden="true" /> Community care & schedules
        </h2>
        <PanelExpandButton
          expanded={expanded}
          onToggle={() => setExpanded((value) => !value)}
        />
        <button
          className="icon-button"
          aria-label="Close community details"
          onClick={() => useAppStore.setState({ sidePanelOpen: false })}
        >
          <X size={17} />
        </button>
      </div>
      <div
        className="workspace-panel-body"
        key={selectedBarangayPsgc ?? selectedPsgc ?? selectedScheduleDate}
      >
        {(selectedBarangay || selectedMunicipality) && (
          <PlaceHeader
            title={
              selectedBarangay?.name ??
              selectedMunicipality?.name ??
              "Care near you"
            }
            kind="Public care guide"
            subtitle={
              selectedBarangay
                ? `${selectedBarangay.municipality}, Laguna`
                : "Approved clinic visits and nearby care across Laguna."
            }
          />
        )}
        <PublicVisitSummary />
        <p className="place-intro">
          Search for your community to find nearby care. Clinic locations and
          services are listed below.
        </p>

        {schedule?.status === "Emergency Override" &&
          schedule.emergencyNotice && (
            <div
              className="workspace-alert emergency-override-banner"
              role="alert"
            >
              <div className="emergency-override-heading">
                <AlertTriangle size={17} aria-hidden="true" />
                <strong>Emergency Schedule Notice ({schedule.date})</strong>
              </div>
              <p>{schedule.emergencyNotice}</p>
              <small>
                Updated{" "}
                {new Date(schedule.updatedAt).toLocaleString("en-PH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </small>
            </div>
          )}

        {(selectedBarangay || selectedMunicipality) && (
          <section
            className="workspace-subcard public-community-card"
            aria-label="Selected community care"
          >
            <div className="eyebrow">
              {selectedBarangay
                ? `BARANGAY · PSGC ${selectedBarangay.psgc}`
                : `MUNICIPALITY · PSGC ${selectedMunicipality?.psgc}`}
            </div>
            <h3>
              {selectedBarangay
                ? `${selectedBarangay.name}, ${selectedBarangay.municipality}`
                : selectedMunicipality?.name}
            </h3>
            <p className="workspace-note">
              Population:{" "}
              {(
                selectedBarangay?.population ??
                selectedMunicipality?.population ??
                0
              ).toLocaleString()}{" "}
              residents
              {selectedBarangay
                ? ` · ${selectedBarangay.households.toLocaleString()} households`
                : ""}
            </p>
            <button
              type="button"
              className="workspace-text-button"
              onClick={() => selectMunicipality(null)}
            >
              ← Clear community selection
            </button>

            <h4>Nearest approved mobile clinic</h4>
            {nearestClinic && schedule ? (
              <div className="public-nearest-clinic">
                <strong>
                  {nearestClinic.clinicId} · {nearestClinic.siteName}
                </strong>
                <span>
                  {nearestClinic.municipality} ·{" "}
                  {nearestClinic.distance.toFixed(1)} km straight-line distance
                </span>
                {targetMunicipalityName === nearestClinic.municipality && (
                  <span className="badge">Located in your municipality</span>
                )}
                <small>
                  Hours: {schedule.startTime}–{schedule.endTime} PH Time ·{" "}
                  {nearestClinic.capacity} daily appointments
                </small>
                <div className="public-service-tags">
                  {schedule.services.map((service) => (
                    <span className="public-service-tag" key={service}>
                      {service}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="workspace-text-button"
                  onClick={() =>
                    useAppStore.setState({
                      selectedClinicId: nearestClinic.clinicId,
                    })
                  }
                >
                  Inspect {nearestClinic.clinicId} on map
                </button>
              </div>
            ) : (
              <p className="workspace-note">
                No approved mobile clinic is scheduled for{" "}
                {selectedScheduleDate}.
              </p>
            )}

            {targetPoint && targetMunicipalityName && (
              <NearbyCare
                point={targetPoint}
                municipality={targetMunicipalityName}
                origin={selectedBarangay ? "barangay" : "municipality"}
              />
            )}
          </section>
        )}

        <section aria-label="Approved mobile clinics">
          <h3>
            <MapPin size={16} aria-hidden="true" /> Approved Mobile Clinics (
            {clinics.length})
          </h3>
          {schedule && clinics.length > 0 ? (
            clinics.map((clinic) => {
              const communities = assignedCommunities(
                publicData,
                selectedScheduleDate,
                clinic.siteId,
              );
              return (
                <article
                  key={clinic.clinicId}
                  className={`workspace-subcard public-clinic-card ${selectedClinicId === clinic.clinicId ? "is-active" : ""}`}
                >
                  <div className="public-clinic-header">
                    <strong>
                      {clinic.clinicId} · {clinic.siteName}
                    </strong>
                    <span
                      className={`badge ${schedule.status === "Emergency Override" ? "badge-danger" : ""}`}
                    >
                      {schedule.status}
                    </span>
                  </div>
                  <p className="public-clinic-location">
                    {clinic.municipality}, Laguna
                  </p>
                  <p className="public-clinic-hours">
                    <Clock size={14} aria-hidden="true" />
                    <span>
                      {schedule.startTime}–{schedule.endTime} · Philippine time
                    </span>
                  </p>
                  <div className="public-service-tags">
                    {schedule.services.map((service) => (
                      <span className="public-service-tag" key={service}>
                        {service}
                      </span>
                    ))}
                  </div>
                  <p className="workspace-note">
                    {communities.length
                      ? `Planned service area: ${communities.join(", ")}.`
                      : "Service-area details will be confirmed by the LGU."}{" "}
                    Daily capacity: {clinic.capacity} appointments.
                  </p>
                  <button
                    type="button"
                    className="workspace-text-button"
                    onClick={() =>
                      useAppStore.setState({
                        selectedClinicId: clinic.clinicId,
                      })
                    }
                  >
                    View clinic details
                  </button>
                </article>
              );
            })
          ) : (
            <div className="workspace-subcard public-empty-schedule">
              <strong>
                No mobile clinics announced for {selectedScheduleDate}
              </strong>
              <p className="workspace-note">
                Only administrator-approved deployments appear here. Unapproved
                planning drafts and disaster simulations are never shown as
                public schedules.
              </p>
            </div>
          )}
        </section>

        <section
          className="workspace-subcard public-advisories-card"
          aria-label="Public health advisories"
        >
          <h3>
            <ShieldAlert size={16} aria-hidden="true" /> Public Health
            Advisories
          </h3>
          <span className="badge">DEMO ADVISORIES · NOT LIVE ALERTS</span>
          <ul className="public-advisory-list">
            <li>
              <strong>Before visiting:</strong> Check the published date,
              opening hours, and available services for your community’s
              assigned mobile clinic.
            </li>
            <li>
              <strong>Weather & flood disruptions:</strong> Monitor official LGU
              and PDRRMO channels during heavy rainfall for safe road access and
              revised staging sites.
            </li>
            <li>
              <strong>Preventive care:</strong> Ask the mobile health team about
              blood pressure checks, maternal and child health, and dengue or
              leptospirosis prevention.
            </li>
          </ul>
          <p className="workspace-note">
            Demonstration only. These schedules and advisories are synthetic
            decision-support examples, not live DOH or LGU emergency feeds.
          </p>
        </section>
      </div>
    </aside>
  );
}
