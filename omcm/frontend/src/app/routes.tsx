import { Routes, Route, Navigate, Link } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
/** Public routes stay read-only. API mutations retain server-side admin checks. */
export function AppRoutes() {
  return (
    <Routes>
      {["/", "/public", "/admin"].map((path) => (
        <Route key={path} path={path} element={<AppLayout />} />
      ))}
      {["/clinics", "/public/legacy"].map((path) => (
        <Route key={path} path={path} element={<Navigate to="/public" replace />} />
      ))}
      {[
        ["/dashboard/admin", null],
        ["/admin/legacy", "optimization"],
        ["/optimization", "optimization"],
        ["/analytics", "optimization"],
        ["/settings", "optimization"],
        ["/risk", null],
        ["/simulator", "simulation"],
        ["/driver", "simulation"],
        ["/workspace/*", "optimization"],
      ].map(([path, panel]) => (
        <Route key={path} path={path!} element={<Navigate to="/admin" replace state={{ panel }} />} />
      ))}
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
