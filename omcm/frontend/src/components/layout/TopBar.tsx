import {
  HeartPulse,
  Crosshair,
  CloudRain,
  Bot,
  LocateFixed,
  PanelLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAppStore } from "../../store/useAppStore";
import { MunicipalitySearch } from "../../features/municipalities/MunicipalitySearch";
export function TopBar() {
  const { panel, openPanel, sidePanelOpen } = useAppStore();
  return (
    <header className="workspace-topbar">
      <Link to="/" className="workspace-brand">
        <span className="brand-mark">
          <HeartPulse size={25} />
        </span>
        <span>
          <strong>OMCM</strong>
          <small>Optimized Mobile Clinic Mapper</small>
        </span>
      </Link>
      <MunicipalitySearch />
      <nav className="workspace-actions" aria-label="Planning tools">
        <button
          aria-label="Toggle intelligence panel"
          aria-expanded={sidePanelOpen}
          onClick={() =>
            useAppStore.setState({ sidePanelOpen: !sidePanelOpen })
          }
        >
          <PanelLeft size={18} />
        </button>
        <button
          aria-label="Optimize"
          aria-pressed={panel === "optimization"}
          onClick={() =>
            openPanel(panel === "optimization" ? null : "optimization")
          }
        >
          <Crosshair size={17} />
          <span>Optimize</span>
        </button>
        <button
          aria-label="Simulate"
          aria-pressed={panel === "simulation"}
          onClick={() =>
            openPanel(panel === "simulation" ? null : "simulation")
          }
        >
          <CloudRain size={17} />
          <span>Simulate</span>
        </button>
        <button
          aria-label="Assistant"
          aria-pressed={panel === "chatbot"}
          onClick={() => openPanel(panel === "chatbot" ? null : "chatbot")}
        >
          <Bot size={17} />
          <span>Assistant</span>
        </button>
        <button
          aria-label="Recenter Laguna map"
          onClick={() =>
            useAppStore.setState((s) => ({
              recenterTrigger: s.recenterTrigger + 1,
              selectedPsgc: null,
            }))
          }
        >
          <LocateFixed size={18} />
        </button>
      </nav>
      <nav className="workspace-links" aria-label="Other pages">
        <Link to="/overview">Overview</Link>
        <Link to="/schedules">Schedules</Link>
        <Link to="/public">Public View</Link>
      </nav>
    </header>
  );
}
