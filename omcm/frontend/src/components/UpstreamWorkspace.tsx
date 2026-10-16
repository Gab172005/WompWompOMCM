import { Link } from "react-router-dom";
import { AdminWorkspace } from "./AdminWorkspace";
import { useOMCM } from "../store/LegacyProvider";
export function UpstreamWorkspace() {
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
