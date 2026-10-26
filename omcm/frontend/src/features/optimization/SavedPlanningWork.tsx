import { useEffect, useRef, useState } from "react";
import {
  CalendarCheck,
  ChevronRight,
  FileText,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { backendApi } from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import { useOptimizationStore } from "../../store/useOptimizationStore";
import { usePublicScheduleStore } from "../../store/usePublicScheduleStore";
import { Button } from "../../components/ui/Button";

interface SavedPlans {
  plans: {
    plan_id: string;
    created_at: string;
    status: string;
    clinic_count: number;
    locations: string[];
  }[];
  total: number;
  storage: { engine: string; temporary: boolean };
}
const PAGE_SIZE = 5;
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(date.length === 10 ? `${date}T00:00:00+08:00` : date));

export function SavedPlanningWork() {
  const adminUser = useAppStore((s) => s.adminUser);
  const { result, deployment, busy, reopen, showDeployment } =
    useOptimizationStore();
  const {
    data,
    refresh,
    error: scheduleError,
    busy: schedulesBusy,
  } = usePublicScheduleStore();
  const [tab, setTab] = useState<"deployments" | "plans">("deployments");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [saved, setSaved] = useState<SavedPlans | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const deploymentDate = deployment?.date;
  useEffect(() => {
    if (!adminUser) return;
    const controller = new AbortController();
    setLoading(true);
    void backendApi<SavedPlans>(
      `/planning/plans?limit=${PAGE_SIZE}&offset=${offset}`,
      undefined,
      AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    )
      .then((next) => {
        if (!controller.signal.aborted) {
          setSaved(next);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Saved plans could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [adminUser, offset, revision, result?.plan_id, data]);
  useEffect(() => {
    if (!deploymentDate || !data) return;
    const latest = data.schedules.find(
      (schedule) => schedule.date === deploymentDate,
    );
    if (latest) useOptimizationStore.setState({ deployment: latest });
  }, [data, deploymentDate]);
  const schedules = [...(data?.schedules ?? [])].sort((a, b) => {
    const today = data?.today ?? "";
    const aUpcoming = a.date >= today;
    const bUpcoming = b.date >= today;
    return aUpcoming === bUpcoming
      ? aUpcoming
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date)
      : aUpcoming
        ? -1
        : 1;
  });
  return (
    <section className="saved-planning-work" aria-label="Your saved work">
      <header>
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h3>Saved plans & deployments</h3>
        </div>
        <Button
          variant="secondary"
          className="saved-work-refresh"
          aria-label="Refresh saved work"
          disabled={loading || schedulesBusy}
          onClick={() => {
            setRevision((value) => value + 1);
            void refresh();
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
        </Button>
      </header>
      <p>
        Reopen a plan or see where clinics are scheduled. Drafts stay private
        until published.
      </p>
      <div className="saved-work-tabs" aria-label="Saved work type">
        <button
          type="button"
          aria-pressed={tab === "deployments"}
          onClick={() => setTab("deployments")}
        >
          <CalendarCheck size={15} aria-hidden="true" /> Deployments{" "}
          <span>{schedules.length}</span>
        </button>
        <button
          type="button"
          aria-pressed={tab === "plans"}
          onClick={() => setTab("plans")}
        >
          <FileText size={15} aria-hidden="true" /> Plans{" "}
          <span>{saved?.total ?? "—"}</span>
        </button>
      </div>
      {saved?.storage.temporary && (
        <p className="saved-work-storage" role="note">
          Temporary server storage. Connect a persistent database to keep work
          across Vercel restarts and devices.
        </p>
      )}
      {(tab === "plans" ? error : scheduleError) && (
        <div className="workspace-alert error" role="alert">
          {tab === "plans" ? error : scheduleError} Use Refresh saved work to
          retry.
        </div>
      )}
      {tab === "deployments" ? (
        <div aria-label="Saved deployments">
          {!data && schedulesBusy ? (
            <p role="status">Loading deployments…</p>
          ) : schedules.length ? (
            <ul className="saved-work-list">
              {schedules.map((schedule) => (
                <li key={schedule.date}>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={deploymentDate === schedule.date}
                    onClick={() => showDeployment(schedule)}
                  >
                    <span className="saved-work-symbol">
                      <CalendarCheck size={18} aria-hidden="true" />
                    </span>
                    <span className="saved-work-copy">
                      <strong>{dateLabel(schedule.date)}</strong>
                      <small>
                        {schedule.start_time}–{schedule.end_time} PH ·{" "}
                        {schedule.clinics.length} clinics
                      </small>
                      <small>
                        {schedule.status} ·{" "}
                        {schedule.clinics
                          .map((clinic) => clinic.name)
                          .join("; ")}
                      </small>
                    </span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="saved-work-empty">
              No deployments published yet. Generate a plan below, then approve
              a visit.
            </p>
          )}
        </div>
      ) : (
        <div aria-label="Saved clinic plans" aria-busy={loading}>
          {loading && <p role="status">Loading saved plans…</p>}
          {saved?.plans.length ? (
            <ul className="saved-work-list">
              {saved.plans.map((plan) => (
                <li key={plan.plan_id}>
                  <button
                    type="button"
                    disabled={busy || loading}
                    aria-pressed={result?.plan_id === plan.plan_id}
                    onClick={() => void reopen(plan.plan_id)}
                    aria-label={`Open ${plan.clinic_count}-clinic plan saved ${dateLabel(plan.created_at)} ${plan.plan_id}`}
                  >
                    <span className="saved-work-symbol">
                      <FileText size={18} aria-hidden="true" />
                    </span>
                    <span className="saved-work-copy">
                      <strong>
                        {plan.clinic_count}-clinic plan{" "}
                        <span className="saved-work-badge">
                          {plan.status === "published" ? "Published" : "Draft"}
                        </span>
                      </strong>
                      <small>Saved {dateLabel(plan.created_at)}</small>
                      <small>
                        {plan.locations.join("; ") ||
                          "No eligible clinic placements"}
                      </small>
                    </span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !loading &&
            !error && (
              <p className="saved-work-empty">
                No saved plans yet. Recommendations are saved automatically when
                the backend returns them.
              </p>
            )
          )}
          {saved && saved.total > PAGE_SIZE && (
            <nav
              className="saved-work-pagination"
              aria-label="Saved plan pages"
            >
              <Button
                variant="secondary"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span>
                {offset + 1}–{Math.min(offset + PAGE_SIZE, saved.total)} of{" "}
                {saved.total}
              </span>
              <Button
                variant="secondary"
                disabled={offset + PAGE_SIZE >= saved.total || loading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}

export function SavedDeploymentDetails() {
  const { deployment, reopen, busy } = useOptimizationStore();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.scrollIntoView?.({ block: "nearest" });
    heading.current?.focus({ preventScroll: true });
  }, [deployment?.date, deployment?.plan_id]);
  if (!deployment) return null;
  return (
    <section
      className="saved-deployment-detail workspace-subcard"
      aria-label="Selected deployment"
    >
      <span className="eyebrow">
        <CalendarCheck size={15} aria-hidden="true" /> PUBLISHED DEPLOYMENT
      </span>
      <h3 ref={heading} tabIndex={-1}>
        {dateLabel(deployment.date)}
      </h3>
      <p>
        {deployment.start_time}–{deployment.end_time} Philippine time ·{" "}
        {deployment.status}
      </p>
      <ul>
        {deployment.clinics.map((clinic) => (
          <li key={clinic.id}>
            <MapPin size={16} aria-hidden="true" />
            <span>{clinic.name}</span>
          </li>
        ))}
      </ul>
      <p>
        <strong>Services:</strong> {deployment.services.join(", ")}
      </p>
      <p className="workspace-note">
        These are the published clinic locations shown on the map. Reopening the
        original plan does not change this schedule.
      </p>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => void reopen(deployment.plan_id)}
      >
        Review original plan
      </Button>
    </section>
  );
}
