import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  clearCredentials,
  setCredentials,
  enableBrowserDemo,
  isBrowserDemo,
} from "../services/api";
import { defaultConfig } from "../services/defaults";
import { useMunicipalities } from "../hooks/useMunicipalities";
import type { Municipality } from "../services/municipalities";
export { defaultWeights, defaultConfig } from "../services/defaults";
import type {
  Barangay,
  BoundaryData,
  Config,
  Hospital,
  Metadata,
  Plan,
  PublicData,
  Road,
  Site,
} from "../types";

interface State {
  browserDemo: boolean;
  setDraft: (plan: Plan) => void;
  barangays: Barangay[];
  municipalities: Municipality[];
  sites: Site[];
  roads: Road[];
  hospitals: Hospital[];
  boundaries: BoundaryData;
  metadata: Metadata | null;
  publicData: PublicData;
  config: Config;
  updateConfig: (changes: Partial<Config>) => void;
  plan: Plan | null;
  generate: () => Promise<void>;
  busy: boolean;
  loading: boolean;
  error: string;
  message: string;
  setError: (value: string) => void;
  setMessage: (value: string) => void;
  username: string;
  signOut: () => void;
  requireAdmin: (action?: () => Promise<void>) => void;
  refresh: () => Promise<void>;
  setBoundaries: (value: BoundaryData) => void;
  reloadSchedules: () => Promise<void>;
  today: string;
  adminConfigured: boolean;
}
const Context = createContext<State | null>(null);
export function useOMCM() {
  const state = useContext(Context);
  if (!state) throw new Error("Missing OMCM provider");
  return state;
}

export function Provider({ children }: { children: ReactNode }) {
  const [barangays, setBarangays] = useState<Barangay[]>([]),
    [sites, setSites] = useState<Site[]>([]),
    [roads, setRoads] = useState<Road[]>([]),
    [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [boundaries, setBoundaries] = useState<BoundaryData>({
      geojson: null,
      source: "",
    }),
    [metadata, setMetadata] = useState<Metadata | null>(null);
  const [publicData, setPublicData] = useState<PublicData>({
    schedules: [],
    notices: [],
    today: "",
    synthetic: true,
  });
  const [config, setConfig] = useState<Config>(defaultConfig),
    [plan, setPlan] = useState<Plan | null>(null);
  const { municipalities } = useMunicipalities(
    plan?.barangays ?? barangays,
    boundaries,
  );
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [username, setUsername] = useState(""),
    [loginOpen, setLoginOpen] = useState(false),
    [loginName, setLoginName] = useState(""),
    [loginPassword, setLoginPassword] = useState(""),
    [loginBusy, setLoginBusy] = useState(false),
    [loginError, setLoginError] = useState("");
  const [today, setToday] = useState(""),
    [adminConfigured, setAdminConfigured] = useState(false);
  const pending = useRef<(() => Promise<void>) | undefined>(undefined);
  const configVersion = useRef(0);
  const [browserDemo, setBrowserDemo] = useState(isBrowserDemo());
  async function reloadSchedules() {
    setPublicData(await api<PublicData>("/schedules"));
  }
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      if (!isBrowserDemo()) {
        try {
          await api("/health", undefined, AbortSignal.timeout(4000));
        } catch {
          enableBrowserDemo();
          setBrowserDemo(true);
          setMessage(
            "Backend unavailable: browser-only demo enabled. Plans stay in this browser; no public service is connected.",
          );
        }
      }
      const [bs, cs, hs, boundary, schedules, health] = await Promise.all([
        api<{ barangays: Barangay[]; metadata: Metadata }>("/barangays"),
        api<{ sites: Site[]; roads: Road[] }>("/clinics"),
        api<{ hospitals: Hospital[] }>("/hospitals"),
        api<BoundaryData>("/boundaries"),
        api<PublicData>("/schedules"),
        api<{ today: string; admin_configured: boolean }>("/health"),
      ]);
      setBarangays(bs.barangays);
      setMetadata(bs.metadata);
      setSites(cs.sites);
      setRoads(cs.roads);
      setHospitals(hs.hospitals);
      setBoundaries(boundary);
      setPublicData(schedules);
      setToday(health.today);
      setAdminConfigured(health.admin_configured);
      setConfig(defaultConfig);
      setPlan(null);
      configVersion.current++;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  // A cancelled request cannot overwrite scores after newer weights or plans arrive.
  useEffect(() => {
    if (!username && !browserDemo) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const value = await api<{ barangays: Barangay[] }>(
          "/risk/calculate",
          config.weights,
          controller.signal,
        );
        if (!controller.signal.aborted) setBarangays(value.barangays);
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [config.weights, username, browserDemo]);
  function updateConfig(changes: Partial<Config>) {
    configVersion.current++;
    setConfig((c) => ({ ...c, ...changes }));
    setPlan(null);
    setMessage("");
  }
  function requireAdmin(action?: () => Promise<void>) {
    if (username || browserDemo) {
      if (action) void action();
    } else {
      pending.current = action;
      setLoginError("");
      setLoginOpen(true);
    }
  }
  async function generate() {
    setBusy(true);
    setError("");
    setMessage("");
    const version = configVersion.current;
    try {
      const result = await api<Plan>("/optimize", config);
      if (version === configVersion.current) {
        setPlan(result);
        setMessage(
          "Draft placement generated. Review and approve it on Clinic Schedules.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function signOut() {
    clearCredentials();
    setUsername("");
    setPlan(null);
    configVersion.current++;
  }
  return (
    <Context.Provider
      value={{
        browserDemo,
        setDraft: (draft) => {
          configVersion.current++;
          setConfig(draft.inputs);
          setPlan(draft);
        },
        barangays,
        municipalities,
        sites,
        roads,
        hospitals,
        boundaries,
        metadata,
        publicData,
        config,
        updateConfig,
        plan,
        generate,
        busy,
        loading,
        error,
        message,
        setError,
        setMessage,
        username,
        signOut,
        requireAdmin,
        refresh,
        setBoundaries,
        reloadSchedules,
        today,
        adminConfigured,
      }}
    >
      {children}
      {loginOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!loginBusy) {
              setLoginOpen(false);
              pending.current = undefined;
            }
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="eyebrow">DEMO ADMINISTRATOR ACCESS</span>
            <h2 id="login-title">Sign in to plan care</h2>
            <p>
              Use the credentials configured in the backend environment. This
              prototype uses server-verified demo access.
            </p>
            {!adminConfigured && (
              <div className="notice">
                Administrator access is not configured. Run the setup script or
                set credentials in backend/.env.
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoginBusy(true);
                setLoginError("");
                try {
                  setCredentials(loginName, loginPassword);
                  const me = await api<{ username: string }>("/auth/me");
                  setUsername(me.username);
                  setLoginPassword("");
                  setLoginOpen(false);
                  const action = pending.current;
                  pending.current = undefined;
                  if (action) await action();
                } catch (e) {
                  clearCredentials();
                  setLoginError((e as Error).message);
                } finally {
                  setLoginBusy(false);
                }
              }}
            >
              <label>
                Username
                <input
                  autoFocus
                  required
                  autoComplete="username"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </label>
              {loginError && (
                <div role="alert" className="error">
                  {loginError}
                </div>
              )}
              <div className="button-row">
                <button className="primary" disabled={loginBusy}>
                  {loginBusy ? "Verifying…" : "Sign in"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={loginBusy}
                  onClick={() => {
                    setLoginOpen(false);
                    pending.current = undefined;
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </Context.Provider>
  );
}
