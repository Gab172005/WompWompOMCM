import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  CloudRain,
  Users,
  HeartPulse,
  MapPin,
  ShieldAlert,
  X,
} from "lucide-react";
import { useState } from "react";
import { isBrowserDemo } from "../../services/api";
import { SheetHandle } from "../../components/ui/SheetHandle";
import { useAppStore } from "../../store/useAppStore";
import { BARANGAYS_BY_PSGC, distanceKm } from "../../services/providedData";
import { LAGUNA_BASE_DATA } from "../../services/lagunaData";
import {
  NearbyCare,
  PanelExpandButton,
  PlaceHeader,
} from "../municipalities/PlaceDetails";
import { DisclosureCard } from "../../components/ui/DisclosureCard";
import { PublicClinicCard } from "./PublicClinicCard";
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
      <SheetHandle
        expanded={expanded}
        onExpand={() => setExpanded(true)}
        onReduce={() => setExpanded(false)}
      />
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
        {!targetPoint && (
          <p className="place-intro">
            Search for your community to find nearby care and approved clinic
            visits.
          </p>
        )}

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
            className="public-community-card"
            aria-label="Selected community care"
          >
            <div className="care-community-heading">
              <div>
                <span className="care-kicker">YOUR COMMUNITY</span>
                <h3>
                  Care near{" "}
                  {selectedBarangay?.name ?? selectedMunicipality?.name}
                </h3>
              </div>
              <button
                type="button"
                className="icon-button"
                title="Clear community selection"
                aria-label="Clear community selection"
                onClick={() => selectMunicipality(null)}
              >
                <ArrowLeft size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="care-community-facts">
              <span>
                <Users size={14} aria-hidden="true" />
                {(
                  selectedBarangay?.population ??
                  selectedMunicipality?.population ??
                  0
                ).toLocaleString()}{" "}
                residents
              </span>
              {selectedBarangay && (
                <span>
                  {selectedBarangay.households.toLocaleString()} households
                </span>
              )}
            </div>
            <h4 className="care-subheading">Nearest scheduled mobile clinic</h4>

            {nearestClinic && schedule ? (
              <button
                type="button"
                className="care-nearest-location"
                aria-haspopup="dialog"
                onClick={() =>
                  useAppStore.setState({
                    selectedClinicId: nearestClinic.clinicId,
                  })
                }
              >
                <span className="care-location-icon">
                  <MapPin size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong>{nearestClinic.siteName}</strong>
                  <small>
                    {nearestClinic.municipality} ·{" "}
                    {nearestClinic.distance.toFixed(1)} km straight line
                  </small>
                  {targetMunicipalityName === nearestClinic.municipality && (
                    <small className="care-local-context">
                      In your municipality
                    </small>
                  )}
                </span>
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            ) : (
              <p className="workspace-note">
                {!publicData && !isBrowserDemo()
                  ? "Published locations have not been confirmed yet. Check the visit updates above."
                  : `No approved mobile clinic is scheduled for ${selectedScheduleDate}.`}
              </p>
            )}
          </section>
        )}

        {schedule && clinics.length > 0 && (
          <section
            className="care-clinic-list"
            aria-label="Approved mobile clinics"
          >
            <div className="care-list-heading">
              <div>
                <span className="care-kicker">CLINIC LOCATIONS</span>
                <h3>Approved mobile clinics</h3>
              </div>
              <span className="care-count">{clinics.length}</span>
            </div>
            {clinics.map((clinic) => {
              const communities = assignedCommunities(
                publicData,
                selectedScheduleDate,
                clinic.siteId,
              );
              return (
                <PublicClinicCard
                  key={clinic.clinicId}
                  clinic={clinic}
                  schedule={schedule}
                  communities={communities}
                />
              );
            })}
          </section>
        )}

        {targetPoint && targetMunicipalityName && (
          <NearbyCare
            point={targetPoint}
            municipality={targetMunicipalityName}
            origin={selectedBarangay ? "barangay" : "municipality"}
          />
        )}

        <section aria-label="Public health advisories">
          <DisclosureCard
            title="Before your visit"
            description="Hours, services and weather updates"
            icon={<ShieldAlert size={18} />}
          >
            <ul className="care-checklist">
              <li>
                <Check size={17} aria-hidden="true" />
                <div>
                  <strong>Check the visit details</strong>
                  <p>
                    Confirm the date, opening hours and listed services before
                    leaving.
                  </p>
                </div>
              </li>
              <li>
                <CloudRain size={17} aria-hidden="true" />
                <div>
                  <strong>Watch for local updates</strong>
                  <p>
                    Follow official LGU and PDRRMO channels for weather
                    disruptions and location changes.
                  </p>
                </div>
              </li>
            </ul>
            <p className="map-evidence-note">
              Demonstration information, not a live health advisory or emergency
              feed. Clinic schedules here are prototype examples.
            </p>
          </DisclosureCard>
        </section>
      </div>
    </aside>
  );
}
