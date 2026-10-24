import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { useAppStore } from "../../store/useAppStore";
import {
  api,
  clearCredentials,
  isBrowserDemo,
  setCredentials,
} from "../../services/api";

export const DEMO_ADMIN_USERNAME =
  import.meta.env.VITE_ADMIN_USERNAME || "admin";
export const DEMO_ADMIN_PASSWORD =
  import.meta.env.VITE_ADMIN_PASSWORD || "laguna-lgu-2026";

const ADMIN_PATHS = new Set([
  "/admin",
  "/dashboard/admin",
  "/risk",
  "/optimization",
  "/simulator",
]);

export function AdminLoginModal() {
  const { loginModalOpen, closeLoginModal, signInAdmin } = useAppStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!loginModalOpen) return null;

  function handleCancel() {
    if (busy) return;
    setError("");
    closeLoginModal();
    if (ADMIN_PATHS.has(pathname)) {
      navigate("/");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setError("Enter both username and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (
        trimmedUser === DEMO_ADMIN_USERNAME &&
        password === DEMO_ADMIN_PASSWORD
      ) {
        setCredentials(trimmedUser, password);
        signInAdmin(trimmedUser);
        setPassword("");
        if (!ADMIN_PATHS.has(pathname)) {
          navigate("/admin");
        }
        return;
      }

      if (!isBrowserDemo()) {
        setCredentials(trimmedUser, password);
        const me = await api<{ username: string }>(
          "/auth/me",
          undefined,
          AbortSignal.timeout(3000),
        );
        signInAdmin(me.username);
        setPassword("");
        if (!ADMIN_PATHS.has(pathname)) {
          navigate("/admin");
        }
        return;
      }

      clearCredentials();
      setError(
        "We could not sign you in. Check the username and password and try again.",
      );
    } catch {
      clearCredentials();
      setError(
        "We could not sign you in. Check the username and password and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Administrator Sign-In" onClose={handleCancel}>
      <div className="admin-login-modal">
        <div className="eyebrow">
          <ShieldCheck size={15} aria-hidden="true" /> LGU OPERATIONS ACCESS
        </div>
        <p>
          Sign in to review healthcare needs, plan mobile clinic locations, try
          practice scenarios, and publish approved schedules for residents.
        </p>
        <div className="workspace-subcard admin-demo-hint">
          <strong>Demo sign-in details</strong>
          <p>
            Username: <code>{DEMO_ADMIN_USERNAME}</code> · Password:{" "}
            <code>{DEMO_ADMIN_PASSWORD}</code>
          </p>
          <button
            type="button"
            className="workspace-text-button"
            onClick={() => {
              setUsername(DEMO_ADMIN_USERNAME);
              setPassword(DEMO_ADMIN_PASSWORD);
              setError("");
            }}
          >
            Use demo sign-in details
          </button>
        </div>
        <form onSubmit={handleSubmit} className="admin-login-form">
          <label className="workspace-field">
            Administrator username
            <input
              type="text"
              required
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
            />
          </label>
          <label className="workspace-field">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </label>
          {error && (
            <div className="workspace-alert error" role="alert">
              {error}
            </div>
          )}
          <div className="workspace-button-row">
            <Button type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Sign in to Admin View"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={handleCancel}
            >
              Stay in Public View
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
