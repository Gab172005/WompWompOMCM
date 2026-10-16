import { Routes, Route, Outlet, Link } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { LegacyLayout } from "../components/layout/LegacyLayout";
import { Provider } from "../store/LegacyProvider";
import { Dashboard } from "../features/overview/Dashboard";
import { AdminDashboard } from "../features/optimization/AdminDashboard";
import { DriverTracking } from "../features/simulation/DriverTracking";
import { Schedules } from "../features/schedules/Schedules";
import { Analytics } from "../features/analytics/Analytics";
import { Settings } from "../features/settings/Settings";
import { PublicDashboard } from "../features/public/PublicDashboard";
/** Public routes stay read-only. API mutations retain server-side admin checks. */
export function AppRoutes() {
  return (
    <Routes>
      {["/", "/risk", "/optimization", "/simulator"].map((path) => (
        <Route key={path} path={path} element={<AppLayout />} />
      ))}
      <Route
        element={
          <Provider>
            <Outlet />
          </Provider>
        }
      >
        <Route path="/public" element={<PublicDashboard />} />
        <Route path="/clinics" element={<PublicDashboard />} />
        <Route element={<LegacyLayout />}>
          <Route path="/overview" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/dashboard/admin" element={<AdminDashboard />} />
          <Route path="/driver" element={<DriverTracking />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <div className="empty-state">
            <h1>Page not found</h1>
            <Link className="primary" to="/">
              Return to map
            </Link>
          </div>
        }
      />
    </Routes>
  );
}
