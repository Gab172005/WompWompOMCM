import {
  CalendarDays,
  CalendarClock,
  Check,
  Clock,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { isBrowserDemo } from "../../services/api";
import { getManilaToday, useAppStore } from "../../store/useAppStore";
import { usePublicScheduleStore } from "../../store/usePublicScheduleStore";

function visitDate(day: string) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
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
  const days = [today, ...futureDays];
  // A selected historical visit can still be inspected until the next server refresh.
  if (
    !days.includes(selectedScheduleDate) &&
    publishedSchedules[selectedScheduleDate]
  )
    days.unshift(selectedScheduleDate);
  const schedule = publishedSchedules[selectedScheduleDate];
  const clinics = schedule?.plan.clinics.length ?? 0;
  return (
    <section
      className="public-visit-summary"
      aria-label="Published clinic visits"
    >
      <div className="public-visit-heading">
        <div>
          <span className="care-kicker">PUBLISHED VISITS</span>
          <h3>
            {selectedScheduleDate === today
              ? "Clinics today"
              : selectedScheduleDate < today
                ? "Past clinic visit"
                : "Upcoming clinic visit"}
          </h3>
        </div>
        {!isBrowserDemo() && (
          <button
            type="button"
            className="icon-button"
            aria-label="Refresh published visits"
            title="Refresh published visits"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void refresh()}
          >
            <RefreshCw
              size={17}
              className={busy ? "is-refreshing" : ""}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
      {days.length > 1 && (
        <div
          className="public-date-rail"
          role="group"
          aria-label="Choose published visit"
        >
          {days.map((day) => (
            <button
              key={day}
              type="button"
              aria-label={
                day === today
                  ? "Today"
                  : `${day === futureDays[0] ? "Next clinic day · " : ""}${visitDate(day)}`
              }
              aria-pressed={selectedScheduleDate === day}
              onClick={() => setSelectedScheduleDate(day)}
            >
              <span>
                {day === today
                  ? "Today"
                  : new Intl.DateTimeFormat("en-PH", {
                      weekday: "short",
                      timeZone: "Asia/Manila",
                    }).format(new Date(`${day}T12:00:00+08:00`))}
              </span>
              <strong>{Number(day.slice(-2))}</strong>
              <small>
                {new Intl.DateTimeFormat("en-PH", {
                  month: "short",
                  timeZone: "Asia/Manila",
                }).format(new Date(`${day}T12:00:00+08:00`))}
              </small>
              {Boolean(publishedSchedules[day]?.plan.clinics.length) && (
                <span className="public-date-dot" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
      {days.length === 1 && !schedule && (
        <p className="public-current-date">
          <CalendarDays size={15} aria-hidden="true" />
          {visitDate(today)} · Philippine time
        </p>
      )}
      <div className="public-visit-details" role="status">
        {error && !lastSynced ? (
          <p>Published visits could not be checked. Refresh when connected.</p>
        ) : !isBrowserDemo() && !lastSynced && !schedule ? (
          <p>Checking published clinic visits…</p>
        ) : schedule ? (
          <>
            <div className="public-confirmed-heading">
              <span className="care-confirmation-icon">
                <Check size={17} aria-hidden="true" />
              </span>
              <div>
                <strong>
                  {clinics} {clinics === 1 ? "clinic" : "clinics"} announced
                </strong>
                <span>
                  {schedule.status === "Emergency Override"
                    ? "Emergency update"
                    : "LGU approved"}
                </span>
              </div>
            </div>
            <div className="public-visit-meta">
              <span>
                <CalendarDays size={15} aria-hidden="true" />
                {visitDate(schedule.date)}
              </span>
              <span>
                <Clock size={15} aria-hidden="true" />
                {schedule.startTime}–{schedule.endTime} Philippine time
              </span>
            </div>
            <p>Choose a location below to see it on the map.</p>
          </>
        ) : (
          <div className="care-empty-visit">
            <span className="care-empty-icon">
              <CalendarClock size={20} aria-hidden="true" />
            </span>
            <div>
              <strong>
                No clinic visits announced for{" "}
                {selectedScheduleDate === today
                  ? "today"
                  : visitDate(selectedScheduleDate)}
              </strong>
              <p>
                {futureDays.length
                  ? "Choose an announced date above, or explore nearby hospitals below."
                  : "An approved visit will appear here when published. Nearby hospitals are still listed on the map."}
              </p>
            </div>
          </div>
        )}
      </div>
      {error && (
        <div className="care-sync-feedback" role="alert">
          <WifiOff size={14} aria-hidden="true" />
          <p>
            {lastSynced
              ? "Updates are delayed. Showing the last confirmed published schedule."
              : "Published visits are unavailable. Refresh when connected."}
          </p>
        </div>
      )}
      {lastSynced && !isBrowserDemo() && (
        <small className="public-sync-status">
          Last checked{" "}
          {new Date(lastSynced).toLocaleTimeString("en-PH", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Asia/Manila",
          })}{" "}
          PH time · {error ? "Update delayed" : "Updates automatically"}
        </small>
      )}
    </section>
  );
}
