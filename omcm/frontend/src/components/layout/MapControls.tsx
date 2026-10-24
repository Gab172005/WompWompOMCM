import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CloudRain,
  Crosshair,
  Globe,
  LogOut,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../store/useAppStore";
import { clearCredentials } from "../../services/api";
import { MunicipalitySearch } from "../../features/municipalities/MunicipalitySearch";
import { MapSelectionStatus } from "../../features/municipalities/MapSelectionStatus";

export function MapControls() {
  const {
    viewMode,
    adminUser,
    panel,
    openPanel,
    sidePanelOpen,
    selectedScheduleDate,
    publishedSchedules,
    requestAdminView,
    setViewMode,
    signOutAdmin,
  } = useAppStore();
  const navigate = useNavigate();
  const isPublic = viewMode === "public";
  const schedule = publishedSchedules[selectedScheduleDate];
  const clinicCount = schedule?.plan.clinics.length ?? 0;

  return (
    <>
      <div className="map-search-card">
        <button
          className="map-icon-button"
          aria-label="Toggle intelligence panel"
          aria-expanded={sidePanelOpen && !panel}
          title={
            isPublic
              ? "Community care & schedules"
              : "Community intelligence"
          }
          onClick={() => {
            if (panel) openPanel(null);
            useAppStore.setState({
              sidePanelOpen: panel ? true : !sidePanelOpen,
            });
          }}
        >
          <Menu size={21} aria-hidden="true" />
        </button>
        <MunicipalitySearch />
        {isPublic ? (
          <button
            type="button"
            className="map-icon-button map-public-button"
            aria-label="Admin View"
            title="Switch to Admin View"
            onClick={() => {
              if (adminUser) {
                setViewMode("admin");
                navigate("/admin");
              } else {
                requestAdminView();
              }
            }}
          >
            <ShieldCheck size={20} aria-hidden="true" />
          </button>
        ) : (
          <>
            <button
              type="button"
              className="map-icon-button map-public-button"
              aria-label="Public View"
              title="Switch to Public View"
              onClick={() => {
                setViewMode("public");
                navigate("/public");
              }}
            >
              <Globe size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="map-icon-button map-signout-button"
              aria-label="Sign out"
              title={`Sign out (${adminUser})`}
              onClick={() => {
                clearCredentials();
                signOutAdmin();
                navigate("/");
              }}
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <MapSelectionStatus />

      {isPublic ? (
        <nav className="map-tool-buttons" aria-label="Public view controls">
          <button
            type="button"
            aria-pressed={sidePanelOpen}
            onClick={() =>
              useAppStore.setState({ sidePanelOpen: !sidePanelOpen })
            }
          >
            {schedule?.status === "Emergency Override" ? (
              <AlertTriangle size={17} aria-hidden="true" />
            ) : (
              <CalendarDays size={17} aria-hidden="true" />
            )}
            <span>
              {schedule
                ? `${schedule.status === "Emergency Override" ? "Emergency Notice" : "Approved Schedule"} · ${clinicCount} ${clinicCount === 1 ? "Clinic" : "Clinics"}`
                : "Schedules & Advisories"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (adminUser) {
                setViewMode("admin");
                navigate("/admin");
              } else {
                requestAdminView();
              }
            }}
          >
            <ShieldCheck size={17} aria-hidden="true" />
            <span>Admin View</span>
          </button>
        </nav>
      ) : (
        <nav className="map-tool-buttons" aria-label="Planning tools">
          {(
            [
              { id: "optimization", label: "Optimize", icon: Crosshair },
              { id: "simulation", label: "Simulate", icon: CloudRain },
              { id: "chatbot", label: "Assistant", icon: Bot },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={panel === id}
              onClick={() => openPanel(panel === id ? null : id)}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </button>
          ))}
          <span
            className="map-mode-pill"
            role="status"
            aria-label={`Admin View active (${adminUser})`}
          >
            <ShieldCheck size={15} aria-hidden="true" />
            <span>Admin · {adminUser}</span>
          </span>
        </nav>
      )}
    </>
  );
}
