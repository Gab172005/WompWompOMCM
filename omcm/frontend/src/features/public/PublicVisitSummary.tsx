import { CalendarDays, Clock, MapPin, RefreshCw } from "lucide-react";
import { isBrowserDemo } from "../../services/api";
import { getManilaToday, useAppStore } from "../../store/useAppStore";
import { usePublicScheduleStore } from "../../store/usePublicScheduleStore";

function visitDate(day: string) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${day}T12:00:00+08:00`));
}

export function PublicVisitSummary() {
  const { selectedScheduleDate, publishedSchedules, setSelectedScheduleDate } =
    useAppStore();
  const { data, busy, error, lastSynced, refresh } = usePublicScheduleStore();
  const today = data?.today ?? getManilaToday();
  const futureDays = Object.keys(publishedSchedules)
    .filter((day) => day > today)
    .sort();
  const nextDay = futureDays[0];
  const schedule = publishedSchedules[selectedScheduleDate];
  const clinics = schedule?.plan.clinics.length ?? 0;
  return (
    <section
      className="public-visit-summary"
      aria-label="Published clinic visits"
    >
      <div className="public-visit-heading">
        <div>
          <span className="eyebrow">APPROVED CLINIC VISITS</span>
          <h3>
            {selectedScheduleDate === today
              ? "Clinics today"
              : "Upcoming clinic visit"}
          </h3>
        </div>
        {!isBrowserDemo() && (
          <button
            type="button"
            className="map-icon-button"
            aria-label="Refresh published visits"
            disabled={busy}
            onClick={() => void refresh()}
          >
            <RefreshCw size={17} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="public-visit-options" aria-label="Choose published visit">
        <button
          type="button"
          aria-pressed={selectedScheduleDate === today}
          onClick={() => setSelectedScheduleDate(today)}
        >
          Today
        </button>
        {nextDay && (
          <button
            type="button"
            aria-pressed={selectedScheduleDate === nextDay}
            onClick={() => setSelectedScheduleDate(nextDay)}
          >
            Next clinic day · {visitDate(nextDay)}
          </button>
        )}
      </div>
      <div className="public-visit-details" role="status">
        {error && !lastSynced ? (
          <p>Published visits could not be checked. Refresh when connected.</p>
        ) : !isBrowserDemo() && !lastSynced && !schedule ? (
          <p>Checking published clinic visits…</p>
        ) : schedule ? (
          <>
            <strong>
              <MapPin size={17} aria-hidden="true" /> {clinics}{" "}
              {clinics === 1 ? "clinic" : "clinics"} announced
            </strong>
            <span>
              <CalendarDays size={15} aria-hidden="true" />{" "}
              {visitDate(schedule.date)} ·{" "}
              {schedule.status === "Emergency Override"
                ? "Emergency update"
                : "LGU approved"}
            </span>
            <span>
              <Clock size={15} aria-hidden="true" /> {schedule.startTime}–
              {schedule.endTime} Philippine time
            </span>
            <p>Locations and available services are listed below.</p>
          </>
        ) : (
          <>
            <strong>No clinic visits announced for today</strong>
            <p>
              {nextDay
                ? "A future visit has been approved. Select the next clinic day to see its locations."
                : "Check back for an LGU-approved visit. Nearby verified hospitals remain available on the map."}
            </p>
          </>
        )}
      </div>
      {error && (
        <p className="workspace-note" role="alert">
          {lastSynced
            ? "Updates are delayed. Showing the last confirmed published schedule."
            : "Published visits are unavailable. Refresh when connected."}
        </p>
      )}
      {futureDays.length > 1 && (
        <details className="public-upcoming-visits">
          <summary>More announced clinic days</summary>
          <div>
            {futureDays.slice(1).map((day) => (
              <button
                key={day}
                type="button"
                aria-pressed={selectedScheduleDate === day}
                onClick={() => setSelectedScheduleDate(day)}
              >
                {visitDate(day)}
              </button>
            ))}
          </div>
        </details>
      )}
      {lastSynced && !isBrowserDemo() && (
        <small className="workspace-note">
          Last checked{" "}
          {new Date(lastSynced).toLocaleTimeString("en-PH", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Asia/Manila",
          })}{" "}
          PH time{error ? " · Update delayed" : " · Updates automatically"}
        </small>
      )}
    </section>
  );
}
