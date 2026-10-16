import { useState } from "react";
import {
  CalendarCheck,
  Check,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { WorkspaceLink as Link } from "../components/WorkspaceLink";
import { useOMCM } from "../services/store";
import { api } from "../services/api";
import { Card, PageHeader } from "../components/ui";
import { PlanningControls } from "../components/PlanningControls";
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
const allServices = [
  "Primary care",
  "Blood pressure screening",
  "Child health",
  "Vaccination",
  "Diabetes screening",
  "Health education",
];
export function Schedules() {
  const {
    plan,
    config,
    updateConfig,
    sites,
    publicData,
    today,
    username,
    browserDemo,
    requireAdmin,
    reloadSchedules,
    setError,
    setMessage,
  } = useOMCM();
  const [selectedDate, setDate] = useState(""),
    [start, setStart] = useState("08:00"),
    [end, setEnd] = useState("17:00"),
    [services, setServices] = useState(allServices.slice(0, 3)),
    [emergency, setEmergency] = useState(false),
    [notice, setNotice] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false);
  const date = selectedDate || (today ? addDays(today, 1) : "");
  async function publish() {
    if (!plan?.plan_id) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(
        emergency ? "/schedules/emergency-override" : "/schedules/approve",
        {
          plan_id: plan.plan_id,
          deployment_date: date,
          start_time: start,
          end_time: end,
          services,
          ...(emergency ? { notice, confirmed } : {}),
        },
      );
      await reloadSchedules();
      setMessage(
        `Deployment ${emergency ? "revised with a public notice" : "approved"} for ${date}. The public dashboard now shows it.`,
      );
      setConfirmed(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="LGU REVIEW & APPROVAL"
        title="From recommendation to deployment"
        description="Review tomorrow’s draft, apply a manual placement if needed, then approve the public schedule."
        action={
          <Link className="secondary" to="/public" target="_blank">
            Open public view
            <ExternalLink size={15} />
          </Link>
        }
      />
      <PlanningControls />
      <div className="two-grid">
        <Card>
          <div className="card-title">
            <h3>Manual staging override</h3>
            <span className="badge">OPTIONAL</span>
          </div>
          <p>
            Keep the recommendation or override its sites. Start with the
            recommended hubs, change any selection, then generate again.
            Capacity, eligibility, flood, and travel restrictions still apply.
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={config.manual_sites !== null}
              onChange={(e) =>
                updateConfig({ manual_sites: e.target.checked ? [] : null })
              }
            />
            Use manually selected sites
          </label>
          {config.manual_sites !== null && (
            <div className="checkbox-grid">
              {sites.map((s) => (
                <label className="checkbox" key={s.id}>
                  <input
                    type="checkbox"
                    checked={config.manual_sites!.includes(s.id)}
                    onChange={(e) =>
                      updateConfig({
                        manual_sites: e.target.checked
                          ? [...config.manual_sites!, s.id]
                          : config.manual_sites!.filter((x) => x !== s.id),
                      })
                    }
                  />
                  {s.name}
                </label>
              ))}
            </div>
          )}
          <h4>
            Draft plan for tomorrow · {today ? addDays(today, 1) : "Loading…"}
          </h4>
          <p className="notice">
            Today’s active plan stays locked. Generating or editing a draft does
            not change published schedules. Final deployment decisions belong to
            LGU health officers.
          </p>
          {plan ? (
            <>
              <p className="tiny">
                DRAFT · Plan {plan.plan_id?.slice(0, 8)} ·{" "}
                {plan.optimized.solver_status}
              </p>
              {config.manual_sites === null && (
                <button
                  className="secondary"
                  type="button"
                  onClick={() =>
                    updateConfig({
                      manual_sites: plan.optimized.clinics.map((c) => c.id),
                    })
                  }
                >
                  Override recommended sites
                </button>
              )}
              {plan.optimized.clinics.map((c) => (
                <div className="draft-site" key={c.id}>
                  <CalendarCheck size={20} />
                  <div>
                    <strong>{c.name}</strong>
                    <small>
                      {c.served} estimated appointments · {c.assignments.length}{" "}
                      assigned barangays
                    </small>
                  </div>
                </div>
              ))}
              {!plan.optimized.clinics.length && (
                <p>
                  No clinics selected. An empty deployment cannot be approved.
                </p>
              )}
            </>
          ) : (
            <div className="empty-state">
              <CalendarCheck size={30} />
              <h3>No draft yet</h3>
              <p>Generate a placement to begin your review.</p>
            </div>
          )}
        </Card>
        <Card>
          <div className="card-title">
            <h3>Approve clinic schedule</h3>
            <span className="badge">DEMO ADMIN</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              requireAdmin(publish);
            }}
          >
            <label>
              Deployment date
              <input
                type="date"
                required
                min={
                  today ? (emergency ? today : addDays(today, 1)) : undefined
                }
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <div className="two-inputs">
              <label>
                Opening time
                <input
                  type="time"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                Closing time
                <input
                  type="time"
                  required
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            <h4>Services offered</h4>
            <div className="checkbox-grid">
              {allServices.map((s) => (
                <label className="checkbox" key={s}>
                  <input
                    type="checkbox"
                    checked={services.includes(s)}
                    onChange={(e) =>
                      setServices(
                        e.target.checked
                          ? [...services, s]
                          : services.filter((x) => x !== s),
                      )
                    }
                  />
                  {s}
                </label>
              ))}
            </div>
            <hr />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={emergency}
                onChange={(e) => {
                  setEmergency(e.target.checked);
                  setConfirmed(false);
                }}
              />
              <span>Emergency schedule override</span>
            </label>
            {emergency && (
              <div className="emergency-box">
                <p>
                  <AlertTriangle size={17} />
                  This replaces the published schedule for the selected date and
                  creates a visible public notice.
                </p>
                <label>
                  Public emergency notice
                  <textarea
                    required
                    minLength={10}
                    maxLength={500}
                    value={notice}
                    onChange={(e) => setNotice(e.target.value)}
                    placeholder="Describe the revised service arrangements. This is a demo announcement."
                  />
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    required
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  I confirm this emergency revision and public notice.
                </label>
              </div>
            )}
            <button
              className={emergency ? "danger" : "primary"}
              disabled={
                busy ||
                !plan?.plan_id ||
                !plan?.optimized.clinics.length ||
                !services.length ||
                (!confirmed && emergency)
              }
            >
              <Check size={16} />
              {busy
                ? "Publishing…"
                : emergency
                  ? "Confirm emergency revision"
                  : "Approve and publish"}
            </button>
            <p className="tiny">
              {browserDemo
                ? "Local browser approval rehearsal · no server authentication"
                : username
                  ? `Signed in as ${username} · demo-only access`
                  : "Server-verified administrator sign-in required."}{" "}
              Normal approval is for tomorrow or later and cannot replace an
              existing published schedule.
            </p>
          </form>
        </Card>
      </div>
      <Card>
        <div className="card-title">
          <h3>Published schedules</h3>
          <span className="badge">
            {browserDemo ? "SAVED IN THIS BROWSER" : "PERSISTED IN SQLITE"}
          </span>
        </div>
        {publicData.schedules.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Hours (Philippine time)</th>
                  <th>Clinics</th>
                  <th>Services</th>
                </tr>
              </thead>
              <tbody>
                {publicData.schedules.map((s) => (
                  <tr key={s.date}>
                    <td>{s.date}</td>
                    <td>
                      <span className="badge">{s.status}</span>
                    </td>
                    <td>
                      {s.start_time}–{s.end_time}
                    </td>
                    <td>{s.clinics.length}</td>
                    <td>{s.services.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No schedule has been approved yet.</p>
          </div>
        )}
        {publicData.notices.map((n) => (
          <div className="notice" key={n.id}>
            <strong>{n.date} · Demo emergency notice</strong>
            <p>{n.text}</p>
          </div>
        ))}
      </Card>
    </>
  );
}
