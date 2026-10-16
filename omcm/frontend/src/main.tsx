import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  HeartPulse,
  LayoutDashboard,
  Map,
  Crosshair,
  CloudRain,
  CalendarDays,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  Globe,
  LogOut,
  LogIn,
  Menu,
  X,
  RefreshCw,
  ChevronRight,
  CircleHelp,
} from "lucide-react";
import { Provider, useOMCM } from "./services/store";
import { Dashboard } from "./components/Dashboard";
import { Risk } from "./pages/Risk";
import { AdminDashboard } from "./pages/AdminDashboard";
import { DriverTracking } from "./pages/DriverTracking";
import { Schedules } from "./pages/Schedules";
import { Analytics } from "./pages/Analytics";
import { Settings } from "./pages/Settings";
import { PublicDashboard } from "./pages/PublicDashboard";
import "leaflet/dist/leaflet.css";
import "./styles/app.css";
const links = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/risk", label: "Healthcare Risk Map", icon: Map },
  { path: "/optimization", label: "Clinic Optimization", icon: Crosshair },
  { path: "/simulator", label: "Disaster Simulator", icon: CloudRain },
  { path: "/schedules", label: "Clinic Schedules", icon: CalendarDays },
  {
    path: "/analytics",
    label: "Data and Analytics",
    icon: ChartNoAxesCombined,
  },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
];
function Layout() {
  const {
    municipalities,
    username,
    signOut,
    requireAdmin,
    today,
    metadata,
    error,
    message,
    setError,
    setMessage,
    loading,
    refresh,
    browserDemo,
  } = useOMCM();
  const [open, setOpen] = React.useState(false);
  const location = useLocation();
  const label =
    links.find((x) => x.path === location.pathname)?.label ?? "Page not found";
  return (
    <div className="app-layout">
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link className="brand" to="/" onClick={() => setOpen(false)}>
          <div className="brand-mark">
            <HeartPulse size={28} />
          </div>
          <div>
            <strong>OMCM</strong>
            <small>Optimized Mobile Clinic Mapper</small>
          </div>
        </Link>
        <div className="workspace-label">LGU PLANNING WORKSPACE</div>
        <nav aria-label="Main navigation">
          {links.map((l) => (
            <NavLink
              key={l.path}
              to={l.path}
              end={l.path === "/"}
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
              onClick={() => setOpen(false)}
            >
              <l.icon size={19} />
              {l.label}
              <ChevronRight size={13} />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="pilot-label">
            <span className="live-dot" />
            <strong>Laguna pilot</strong>
            <small>
              {municipalities.length} cities / municipalities with data · demo
              health data
            </small>
          </div>
          <Link className="nav-item" to="/public" target="_blank">
            <Globe size={18} />
            Public dashboard
            <ChevronRight size={13} />
          </Link>
          <div className="sidebar-note">
            <CircleHelp size={17} />
            <span>Decision support for better community healthcare.</span>
          </div>
          <span className="sidebar-version">OMCM v1.0 · Demo environment</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-root">Workspace</span>
            <ChevronRight size={14} />
            <strong>{label}</strong>
          </div>
          <div className="topbar-right">
            <span className="current-date">
              <CalendarDays size={14} />
              {today
                ? new Date(`${today}T12:00:00`).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Connecting…"}
            </span>
            <span className="demo-badge">Demo Data</span>
            <button
              className="profile-button"
              onClick={() => (username ? signOut() : requireAdmin())}
              disabled={browserDemo}
            >
              <div className="avatar">
                {username ? username.slice(0, 2).toUpperCase() : "LG"}
              </div>
              <span>
                <strong>
                  {browserDemo ? "Browser demo" : username || "LGU planner"}
                </strong>
                <small>
                  {browserDemo
                    ? "Local rehearsal only"
                    : username
                      ? "Demo admin · sign out"
                      : "Demo mode · sign in"}
                </small>
              </span>
              {username ? <LogOut size={15} /> : <LogIn size={15} />}
            </button>
          </div>
        </header>
        <main className="main-content">
          <nav className="operations-nav" aria-label="Product modes">
            <NavLink to="/optimization">Operations</NavLink>
            <NavLink to="/simulator">Simulator</NavLink>
            <Link to="/public">Public View</Link>
            <NavLink to="/settings">Data & Methods</NavLink>
          </nav>
          {browserDemo && (
            <div className="browser-demo-banner">
              Browser-only demo · Plans are saved on this browser and origin.
              Local approval rehearses publication; it does not publish an LGU
              service.
            </div>
          )}
          {error && (
            <div className="error global-alert" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {message && (
            <div className="success global-alert" role="status">
              <span>{message}</span>
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setMessage("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-state">
              <HeartPulse size={36} />
              <h2>Loading community intelligence…</h2>
            </div>
          ) : error && !metadata ? (
            <div className="empty-state">
              <h2>Backend connection unavailable</h2>
              <p>Start the FastAPI backend and check the API configuration.</p>
              <button className="primary" onClick={() => void refresh()}>
                <RefreshCw size={16} />
                Retry connection
              </button>
            </div>
          ) : (
            <Outlet />
          )}
          <footer className="app-footer">
            <span>OMCM · Laguna pilot · Synthetic demonstration data</span>
            <span>
              Dataset: {metadata?.generated_at ?? "unavailable"} · No live feeds
              connected
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="empty-state">
        <h1>Unable to display this page</h1>
        <p>
          An unexpected interface error occurred. Reload to reconnect with the
          backend.
        </p>
        <button className="primary" onClick={() => window.location.reload()}>
          Reload application
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <Provider>
        <Routes>
          <Route path="/public" element={<PublicDashboard />} />
          <Route path="/clinics" element={<PublicDashboard />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="risk" element={<Risk />} />
            <Route path="optimization" element={<AdminDashboard />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="dashboard/admin" element={<AdminDashboard />} />
            <Route path="simulator" element={<DriverTracking />} />
            <Route path="driver" element={<DriverTracking />} />
            <Route path="schedules" element={<Schedules />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <h1>Page not found</h1>
                  <Link className="primary" to="/">
                    Return to overview
                  </Link>
                </div>
              }
            />
          </Route>
        </Routes>
      </Provider>
    </BrowserRouter>
  </ErrorBoundary>,
);
