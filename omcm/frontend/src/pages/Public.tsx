import { useState } from "react";
import {
  HeartPulse,
  MapPin,
  Clock,
  CalendarDays,
  Hospital,
  RefreshCw,
} from "lucide-react";
import { useOMCM } from "../services/store";
import { Card } from "../components/ui";
import { RiskMap } from "../components/RiskMap";
export function Public() {
  const {
    publicData,
    today,
    hospitals,
    reloadSchedules,
    setError,
    error,
    loading,
  } = useOMCM();
  const [date, setDate] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  const current = date || today;
  const schedule = publicData.schedules.find((s) => s.date === current);
  return (
    <div className="public-app">
      <header className="public-header">
        <div className="brand">
          <div className="brand-mark">
            <HeartPulse size={27} />
          </div>
          <div>
            <strong>OMCM</strong>
            <small>Community care, closer to you</small>
          </div>
        </div>
        <span className="demo-badge">Demo Data</span>
      </header>
      <main className="public-main">
        <div className="public-hero">
          <span className="eyebrow">LAGUNA · COMMUNITY HEALTHCARE</span>
          <h1>
            Your next care visit,
            <br />
            <span>a little closer to home.</span>
          </h1>
          <p>
            Find approved mobile clinic locations, opening hours, and available
            services.
          </p>
          <div className="notice">
            Demonstration only. These are synthetic clinics and schedules, not
            actual health services or emergency alerts.
          </div>
        </div>
        {error && (
          <div className="error" role="alert">
            Could not load clinic information: {error}
          </div>
        )}
        <div className="public-date">
          <label>
            <CalendarDays size={18} />
            Schedule date
            <input
              type="date"
              value={current}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button
            className="secondary"
            disabled={refreshing || loading}
            onClick={async () => {
              setRefreshing(true);
              try {
                await reloadSchedules();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setRefreshing(false);
              }
            }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <span>
            {schedule
              ? schedule.status
              : loading
                ? "Loading…"
                : "No schedule published"}
          </span>
        </div>
        {publicData.notices
          .filter((n) => n.date === current)
          .map((n) => (
            <div className="emergency-box" role="status" key={n.id}>
              <strong>Demo emergency schedule notice</strong>
              <p>{n.text}</p>
            </div>
          ))}
        <div className="public-grid">
          <Card className="map-card">
            <div className="card-title">
              <h3>
                <MapPin size={18} />
                Clinic locations
              </h3>
              <span className="badge">APPROVED SCHEDULES</span>
            </div>
            <RiskMap
              clinics={schedule?.clinics ?? []}
              publicMode
              scheduleInfo={
                schedule
                  ? `${schedule.date} · ${schedule.start_time}–${schedule.end_time} Philippine time · ${schedule.status}`
                  : ""
              }
              services={schedule?.services ?? []}
            />
          </Card>
          <div className="stack">
            {schedule ? (
              schedule.clinics.map((c) => (
                <Card key={c.id} className="public-clinic">
                  <span className="badge">{schedule.status}</span>
                  <h2>{c.name}</h2>
                  <p>
                    <Clock size={16} />
                    {schedule.start_time}–{schedule.end_time} · Philippine time
                  </p>
                  <div className="service-tags">
                    {schedule.services.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                  <details>
                    <summary>Clinic details & assigned communities</summary>
                    <p>
                      Demo clinic daily capacity: {c.daily_capacity}{" "}
                      appointments.
                    </p>
                    <p>{c.assignments.map((a) => a.name).join(", ")}</p>
                  </details>
                  <span className="tiny">Synthetic demonstration location</span>
                </Card>
              ))
            ) : (
              <Card className="empty-state">
                <CalendarDays size={36} />
                <h2>
                  {loading
                    ? "Loading clinic schedules…"
                    : "No clinics announced for this date"}
                </h2>
                <p>
                  Only administrator-approved deployments appear here. Check
                  another date or return after a schedule is published.
                </p>
              </Card>
            )}
          </div>
        </div>
        <div className="two-grid">
          <Card>
            <h3>Public health information</h3>
            <p>
              No verified public health advisories or live emergency feeds are
              connected to this demonstration. Check official LGU and DOH
              channels for current guidance.
            </p>
            <p className="tiny">
              Clinic services and opening hours are displayed only when an
              administrator publishes them.
            </p>
          </Card>
          <Card>
            <h3>
              <Hospital size={18} />
              Participating hospital examples
            </h3>
            {hospitals.map((h) => (
              <div className="summary-line" key={h.id}>
                <span>{h.name}</span>
                <span className="badge">SYNTHETIC</span>
              </div>
            ))}
          </Card>
        </div>
      </main>
      <footer className="public-footer">
        OMCM · Optimized Mobile Clinic Mapper · Laguna pilot demonstration
      </footer>
    </div>
  );
}
