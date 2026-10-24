import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarCheck, Check, Globe } from "lucide-react";
import type { ClinicPlan } from "../../types/clinic";
import {
  DEFAULT_CLINIC_SERVICES,
  addIsoDays,
  getManilaToday,
  useAppStore,
} from "../../store/useAppStore";
import { Button } from "../../components/ui/Button";

export function DeploymentApproval({ plan }: { plan: ClinicPlan }) {
  const {
    approvedPlan,
    adminUser,
    publishedSchedules,
    publishSchedule,
    requestAdminView,
    setViewMode,
  } = useAppStore();
  const navigate = useNavigate();
  const today = getManilaToday();
  const tomorrow = addIsoDays(today, 1);

  const [date, setDate] = useState(tomorrow);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [services, setServices] = useState<string[]>([
    ...DEFAULT_CLINIC_SERVICES.slice(0, 4),
  ]);
  const [emergency, setEmergency] = useState(false);
  const [emergencyNotice, setEmergencyNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [publishedMessage, setPublishedMessage] = useState("");

  const activeSchedule = publishedSchedules[date];
  const matches =
    approvedPlan &&
    activeSchedule &&
    JSON.stringify(activeSchedule.plan) === JSON.stringify(plan) &&
    activeSchedule.startTime === startTime &&
    activeSchedule.endTime === endTime &&
    JSON.stringify(activeSchedule.services) === JSON.stringify(services) &&
    (activeSchedule.status === "Emergency Override") === emergency;

  function toggleService(service: string, checked: boolean) {
    setServices((prev) =>
      checked ? [...prev, service] : prev.filter((item) => item !== service),
    );
    setPublishedMessage("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!adminUser) {
      requestAdminView("optimization");
      return;
    }
    if (!plan.clinics.length || !services.length) return;
    if (emergency && (!confirmed || emergencyNotice.trim().length < 10)) return;

    const result = publishSchedule(plan, {
      date,
      startTime,
      endTime,
      services,
      emergency,
      emergencyNotice,
    });
    setPublishedMessage(
      `Published ${result.status.toLowerCase()} schedule for ${result.date} (${result.plan.clinics.length} clinics). Public View now displays this deployment.`,
    );
  }

  return (
    <form className="workspace-subcard approval-form" onSubmit={handleSubmit}>
      <div className="public-clinic-header">
        <h3>
          <CalendarCheck size={16} aria-hidden="true" /> Approve & Publish
          Schedule
        </h3>
        <span className="badge">ADMIN PUBLICATION</span>
      </div>
      <p className="workspace-note">
        Publishing a schedule makes these clinic locations, operating hours, and
        services visible to residents in Public View. Unapproved drafts and
        simulations remain private.
      </p>

      <label className="workspace-field">
        Deployment date
        <input
          type="date"
          aria-label="Deployment date"
          required
          min={emergency ? today : tomorrow}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setPublishedMessage("");
          }}
        />
      </label>

      <div className="approval-time-grid">
        <label className="workspace-field">
          Opening time
          <input
            type="time"
            aria-label="Opening time"
            required
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              setPublishedMessage("");
            }}
          />
        </label>
        <label className="workspace-field">
          Closing time
          <input
            type="time"
            aria-label="Closing time"
            required
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
              setPublishedMessage("");
            }}
          />
        </label>
      </div>

      <fieldset className="approval-services-fieldset">
        <legend>Services offered</legend>
        <div className="approval-services-grid">
          {DEFAULT_CLINIC_SERVICES.map((service) => (
            <label key={service} className="approval-checkbox">
              <input
                type="checkbox"
                checked={services.includes(service)}
                onChange={(e) => toggleService(service, e.target.checked)}
              />
              <span>{service}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="approval-checkbox emergency-toggle">
        <input
          type="checkbox"
          checked={emergency}
          onChange={(e) => {
            const next = e.target.checked;
            setEmergency(next);
            setConfirmed(false);
            if (next && date !== today) setDate(today);
            if (!next && date < tomorrow) setDate(tomorrow);
            setPublishedMessage("");
          }}
        />
        <span>Replace a published schedule for an emergency</span>
      </label>

      {emergency && (
        <div className="workspace-subcard emergency-override-box">
          <p className="workspace-note">
            <AlertTriangle size={15} aria-hidden="true" /> Replaces the
            published schedule for {date} and displays an emergency alert banner
            in Public View.
          </p>
          <label className="workspace-field">
            Public emergency notice
            <textarea
              aria-label="Public emergency notice"
              required
              minLength={10}
              maxLength={400}
              rows={3}
              value={emergencyNotice}
              onChange={(e) => setEmergencyNotice(e.target.value)}
              placeholder="Describe the revised clinic locations or weather disruption for residents (min 10 characters)."
            />
          </label>
          <label className="approval-checkbox">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>I confirm this emergency revision and public notice.</span>
          </label>
        </div>
      )}

      <div className="workspace-button-row">
        <Button
          type="submit"
          disabled={
            Boolean(matches) ||
            !plan.clinics.length ||
            !services.length ||
            (emergency && (!confirmed || emergencyNotice.trim().length < 10))
          }
        >
          <Check size={16} aria-hidden="true" />
          {matches
            ? "Schedule published"
            : emergency
              ? "Confirm emergency schedule change"
              : "Approve & publish schedule"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setViewMode("public");
            useAppStore.setState({ sidePanelOpen: true });
            navigate("/public");
          }}
        >
          <Globe size={15} aria-hidden="true" /> Preview Public View
        </Button>
      </div>

      <p className="workspace-note" role="status">
        {publishedMessage ||
          (activeSchedule
            ? `Published for ${date}: ${activeSchedule.plan.clinics.length} clinics (${activeSchedule.status}).`
            : `No schedule published yet for ${date}.`)}
      </p>
    </form>
  );
}
