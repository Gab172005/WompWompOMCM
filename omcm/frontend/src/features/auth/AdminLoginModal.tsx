import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { useAppStore } from "../../store/useAppStore";
import {
  api,
  BackendApiError,
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
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const browserDemo = isBrowserDemo();

  if (!loginModalOpen) return null;

  function handleCancel() {
    if (busy) return;
    setError("");
    setShowPassword(false);
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
        browserDemo &&
        trimmedUser === DEMO_ADMIN_USERNAME &&
        password === DEMO_ADMIN_PASSWORD
      ) {
        setCredentials(trimmedUser, password);
        signInAdmin(trimmedUser);
        setPassword("");
        setShowPassword(false);
        if (!ADMIN_PATHS.has(pathname)) {
          navigate("/admin");
        }
        return;
      }

      if (!browserDemo) {
        setCredentials(trimmedUser, password);
        const me = await api<{ username: string }>(
          "/auth/me",
          undefined,
          AbortSignal.timeout(15000),
        );
        signInAdmin(me.username);
        setPassword("");
        setShowPassword(false);
        if (!ADMIN_PATHS.has(pathname)) {
          navigate("/admin");
        }
        return;
      }

      clearCredentials();
      setError(
        "We could not sign you in. Check the username and password and try again.",
      );
    } catch (error) {
      clearCredentials();
      if (error instanceof BackendApiError && error.status === 401) {
        setError(
          "The username or password is incorrect for this workspace. Check your configured administrator account and try again.",
        );
      } else if (error instanceof BackendApiError && error.status === 503) {
        setError(
          "Administrator sign-in is unavailable on the server. Contact the workspace administrator to check the sign-in settings.",
        );
      } else if (
        (error instanceof Error || error instanceof DOMException) &&
        error.name === "TimeoutError"
      ) {
        setError(
          "The sign-in server took too long to respond. Please try again.",
        );
      } else {
        setError(
          "Administrator sign-in is unavailable. Check the server connection and try again.",
        );
      }
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
        {browserDemo ? (
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
        ) : (
          <div className="workspace-subcard admin-connected-hint">
            <strong>Connected administrator sign-in</strong>
            <p>
              Use the administrator account configured for this workspace.
              Browser demo credentials cannot sign in to the connected
              workspace.
            </p>
          </div>
        )}
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
            <div className="field-input-affix">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
              <button
                type="button"
                className="icon-button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </label>
          {error && (
            <div className="workspace-alert error" role="alert">
              {error}
            </div>
          )}
          <div className="workspace-button-row">
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {busy && <LoaderCircle size={16} aria-hidden="true" />}
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
