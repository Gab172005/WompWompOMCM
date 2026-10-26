import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarCheck, Check, Globe } from "lucide-react";
import type { Plan, Schedule } from "../../types";
import { backendApi } from "../../services/api";
import { publicSchedules } from "../../services/optimization";
import {
  DEFAULT_CLINIC_SERVICES,
  addIsoDays,
  getManilaToday,
  useAppStore,
} from "../../store/useAppStore";
import { Button } from "../../components/ui/Button";
import { usePublicScheduleStore } from "../../store/usePublicScheduleStore";
export const SCHEDULE_WINDOW_DAYS = 7;

export function DeploymentApproval({ plan }: { plan: Plan }) {
  const { adminUser, publishedSchedules, requestAdminView, setViewMode } =
    useAppStore();
  const navigate = useNavigate();
  const today = getManilaToday();
  const tomorrow = addIsoDays(today, 1);
  const latestDate = addIsoDays(today, SCHEDULE_WINDOW_DAYS);
  const requirementsId = useId();
  const noticeHelpId = useId();

  const forecastTarget = plan.notes
    .find((note) => note.startsWith("Forecast target date: "))
    ?.slice("Forecast target date: ".length);
  const [date, setDate] = useState(forecastTarget ?? tomorrow);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [services, setServices] = useState<string[]>([
    ...DEFAULT_CLINIC_SERVICES.slice(0, 4),
  ]);
  const [emergency, setEmergency] = useState(false);
  const [emergencyNotice, setEmergencyNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [publishedMessage, setPublishedMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const activeSchedule = publishedSchedules[date];
  const matches = Boolean(publishedMessage);
  const noticeLength = emergencyNotice.trim().length;
  const blockers = [
    ...(!plan.plan_id || !plan.optimized.clinics.length
      ? ["Generate a clinic plan first."]
      : []),
    ...(!services.length ? ["Select at least one service."] : []),
    ...(!date || date < (emergency ? today : tomorrow) || date > latestDate
      ? [`Choose a date from ${emergency ? today : tomorrow} to ${latestDate}.`]
      : []),
    ...(!startTime || !endTime || endTime <= startTime
      ? ["Choose a closing time after the opening time."]
      : []),
    ...(forecastTarget && forecastTarget !== tomorrow
      ? [
          "This forecast is out of date. Generate a fresh plan before publishing.",
        ]
      : []),
    ...(emergency && noticeLength < 10
      ? ["Write a public emergency notice of at least 10 characters."]
      : []),
    ...(emergency && !confirmed
      ? ["Check the emergency revision confirmation box."]
      : []),
  ];

  function toggleService(service: string, checked: boolean) {
    setServices((prev) =>
      checked ? [...prev, service] : prev.filter((item) => item !== service),
    );
    setPublishedMessage("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!adminUser) {
      requestAdminView("optimization");
      return;
    }
    if (publishing || matches) return;
    if (blockers.length) {
      setError(blockers.join(" "));
      return;
    }

    setPublishing(true);
    setError("");
    try {
      const result = await backendApi<Schedule>(
        emergency ? "/schedules/emergency-override" : "/schedules/approve",
        {
          plan_id: plan.plan_id,
          deployment_date: date,
          start_time: startTime,
          end_time: endTime,
          services,
          ...(emergency ? { notice: emergencyNotice.trim(), confirmed } : {}),
        },
        AbortSignal.timeout(15000),
      );
      const schedules = publicSchedules({
        schedules: [result],
        notices: [],
        today,
        synthetic: true,
      });
      if (emergency)
        schedules[result.date].emergencyNotice = emergencyNotice.trim();
      useAppStore.setState((state) => ({
        selectedScheduleDate: result.date,
        publishedSchedules: { ...state.publishedSchedules, ...schedules },
      }));
      setPublishedMessage(
        `Published ${result.status.toLowerCase()} schedule for ${result.date} (${result.clinics.length} clinics). Public View now displays this deployment.`,
      );
      void usePublicScheduleStore.getState().refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Schedule publication failed.",
      );
    } finally {
      setPublishing(false);
    }
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
      {error && (
        <div className="workspace-alert error" role="alert">
          {error}
        </div>
      )}
      <fieldset className="optimizer-approval-fields" disabled={publishing}>
        <label className="workspace-field">
          Deployment date
          <input
            type="date"
            aria-label="Deployment date"
            required
            min={emergency ? today : tomorrow}
            max={latestDate}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPublishedMessage("");
            }}
          />
          {forecastTarget && (
            <p className="workspace-note">
              Latest demand estimate: {forecastTarget}. You may book this plan
              through {latestDate}; later bookings use this same estimate, not a
              forecast for their date. Review conditions before deployment.
            </p>
          )}
          {!forecastTarget && (
            <p className="workspace-note">
              Choose a booking date within the next 7 days.
            </p>
          )}
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
          <span>Emergency schedule override (same-day / public alert)</span>
        </label>

        {emergency && (
          <div className="workspace-subcard emergency-override-box">
            <p className="workspace-note">
              <AlertTriangle size={15} aria-hidden="true" /> Publishes emergency
              clinic arrangements for {date}, replacing any existing schedule.
              Residents will see the notice in Public View.
            </p>
            <label className="workspace-field">
              Public emergency notice
              <textarea
                aria-label="Public emergency notice"
                aria-describedby={noticeHelpId}
                required
                minLength={10}
                maxLength={400}
                rows={3}
                value={emergencyNotice}
                onChange={(e) => {
                  setEmergencyNotice(e.target.value);
                  setPublishedMessage("");
                }}
                placeholder="Describe the revised clinic locations or weather disruption for residents (min 10 characters)."
              />
              <small id={noticeHelpId} aria-live="polite">
                {noticeLength < 10
                  ? `${noticeLength}/10 characters minimum. Describe what changed and where residents should go.`
                  : `${noticeLength} characters · Minimum met.`}
              </small>
            </label>
            <label className="approval-checkbox">
              <input
                type="checkbox"
                required
                checked={confirmed}
                onChange={(e) => {
                  setConfirmed(e.target.checked);
                  setPublishedMessage("");
                }}
              />
              <span>I confirm this emergency revision and public notice.</span>
            </label>
          </div>
        )}

        {!matches && blockers.length > 0 && (
          <div
            id={requirementsId}
            className="approval-requirements"
            role="status"
          >
            <strong>Before you can publish</strong>
            <ul>
              {blockers.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="workspace-button-row">
          <Button
            type="submit"
            disabled={Boolean(matches) || publishing || blockers.length > 0}
            aria-describedby={blockers.length > 0 ? requirementsId : undefined}
            aria-busy={publishing}
          >
            <Check size={16} aria-hidden="true" />
            {publishing
              ? "Publishing…"
              : matches
                ? "Schedule published"
                : emergency
                  ? "Confirm emergency override"
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
      </fieldset>
      <p className="workspace-note" role="status">
        {publishedMessage ||
          (activeSchedule
            ? `Published for ${date}: ${activeSchedule.plan.clinics.length} clinics (${activeSchedule.status}).`
            : `No schedule published yet for ${date}.`)}
      </p>
    </form>
  );
}
