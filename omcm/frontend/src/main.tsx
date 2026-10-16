import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AdminWorkspace } from "./components/AdminWorkspace";
import { Provider, useOMCM } from "./services/store";
import { PublicDashboard } from "./pages/PublicDashboard";
import "leaflet/dist/leaflet.css";
import "./styles/app.css";
function Layout() {
  const {
    username,
    signOut,
    requireAdmin,
    error,
    message,
    setError,
    setMessage,
    loading,
    browserDemo,
  } = useOMCM();
  return (
    <div className="workspace-layout">
      <div className="workspace-account">
        <Link className="secondary" to="/public" target="_blank">
          Public View
        </Link>
        <button
          className="secondary"
          disabled={browserDemo}
          onClick={() => (username ? signOut() : requireAdmin())}
        >
          {browserDemo
            ? "Browser demo · local rehearsal"
            : username
              ? `${username} · Sign out`
              : "Administrator sign in"}
        </button>
      </div>
      <div className="workspace-alerts">
        {browserDemo && (
          <div className="browser-demo-banner">
            Browser-only demo · Local approval rehearses publication; it does
            not publish an LGU service.
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setError("")}>Dismiss error</button>
          </div>
        )}
        {message && (
          <div className="success" role="status">
            {message}
            <button onClick={() => setMessage("")}>Dismiss notification</button>
          </div>
        )}
      </div>
      {loading ? (
        <div className="loading-state">Loading community intelligence…</div>
      ) : (
        <AdminWorkspace />
      )}
      <footer className="workspace-footer">
        Synthetic demonstration data · Decision-support only. Final deployment
        is decided by LGU health officers.
      </footer>
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
          <Route path="*" element={<Layout />} />
        </Routes>
      </Provider>
    </BrowserRouter>
  </ErrorBoundary>,
);
