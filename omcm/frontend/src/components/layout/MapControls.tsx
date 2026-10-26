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
import { useAssistantStore } from "../../store/useAssistantStore";
import { MapFilterChips } from "../../features/filters/MapFilterChips";
import { MapActionButton } from "../ui/MapActionButton";

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
  const assistantOpen = useAssistantStore((state) => state.open);
  const isPublic = viewMode === "public";
  const schedule = publishedSchedules[selectedScheduleDate];
  const clinicCount = schedule?.plan.clinics.length ?? 0;

  return (
    <>
      <div className="map-search-card">
        <MapActionButton
          className="map-icon-button"
          aria-label="Show or hide community details"
          aria-expanded={sidePanelOpen && !panel}
          hint={
            sidePanelOpen && !panel
              ? "Hide community details"
              : "Show community details"
          }
          hintSide="below-start"
          onClick={() => {
            if (panel) openPanel(null);
            useAppStore.setState({
              sidePanelOpen: panel ? true : !sidePanelOpen,
            });
          }}
        >
          <Menu size={21} aria-hidden="true" />
        </MapActionButton>
        <MunicipalitySearch />
        {isPublic ? (
          <MapActionButton
            type="button"
            className="map-icon-button map-public-button"
            aria-label="Admin View"
            hint={
              adminUser
                ? "Switch to Admin View"
                : "Sign in to use planning tools"
            }
            aria-haspopup={adminUser ? undefined : "dialog"}
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
          </MapActionButton>
        ) : (
          <>
            <MapActionButton
              type="button"
              className="map-icon-button map-public-button"
              aria-label="Public View"
              hint="View published community visits"
              onClick={() => {
                setViewMode("public");
                navigate("/public");
              }}
            >
              <Globe size={20} aria-hidden="true" />
            </MapActionButton>
            <MapActionButton
              type="button"
              className="map-icon-button map-signout-button"
              aria-label="Sign out"
              hint={`Sign out of ${adminUser ?? "Admin View"}`}
              onClick={() => {
                clearCredentials();
                signOutAdmin();
                navigate("/");
              }}
            >
              <LogOut size={18} aria-hidden="true" />
            </MapActionButton>
          </>
        )}
      </div>

      <MapSelectionStatus />
      <MapFilterChips />

      {isPublic ? (
        <nav className="map-tool-buttons" aria-label="Public view controls">
          <button
            type="button"
            aria-pressed={sidePanelOpen}
            aria-label={
              schedule
                ? `${schedule.status === "Emergency Override" ? "Emergency Notice" : "Approved Schedule"} · ${clinicCount} ${clinicCount === 1 ? "Clinic" : "Clinics"}`
                : "Schedules & Advisories"
            }
            onClick={() =>
              useAppStore.setState({ sidePanelOpen: !sidePanelOpen })
            }
          >
            {schedule?.status === "Emergency Override" ? (
              <AlertTriangle size={17} aria-hidden="true" />
            ) : (
              <CalendarDays size={17} aria-hidden="true" />
            )}
            <span className="tool-label-full">
              {schedule
                ? `${schedule.status === "Emergency Override" ? "Emergency Notice" : "Approved Schedule"} · ${clinicCount} ${clinicCount === 1 ? "Clinic" : "Clinics"}`
                : "Schedules & Advisories"}
            </span>
            <span className="tool-label-compact" aria-hidden="true">
              {schedule?.status === "Emergency Override"
                ? "Visit alert"
                : "Clinic visits"}
              {clinicCount > 0 && (
                <span className="tool-count">{clinicCount}</span>
              )}
            </span>
          </button>
          <button
            type="button"
            aria-label="Ask OMCM"
            aria-pressed={assistantOpen}
            onClick={() => useAssistantStore.getState().setOpen(!assistantOpen)}
          >
            <Bot size={17} aria-hidden="true" />
            <span>Ask OMCM</span>
          </button>
        </nav>
      ) : (
        <nav className="map-tool-buttons" aria-label="Planning tools">
          {(
            [
              { id: "optimization", label: "Plan clinics", icon: Crosshair },
              { id: "simulation", label: "30-day simulation", icon: CloudRain },
              { id: "chatbot", label: "Planning help", icon: Bot },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={id === "chatbot" ? assistantOpen : panel === id}
              title={
                id === "optimization"
                  ? "Choose and review mobile clinic locations"
                  : id === "simulation"
                    ? "Compare clinic plans using estimated daily outcomes"
                    : "Get help understanding scores and clinic plans"
              }
              onClick={() =>
                id === "chatbot"
                  ? useAssistantStore.getState().setOpen(!assistantOpen)
                  : openPanel(panel === id ? null : id)
              }
            >
              <Icon size={18} aria-hidden="true" />
              <span className="tool-label-full">{label}</span>
              <span className="tool-label-compact" aria-hidden="true">
                {id === "optimization"
                  ? "Plan clinics"
                  : id === "simulation"
                    ? "Simulate"
                    : "Ask OMCM"}
              </span>
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
