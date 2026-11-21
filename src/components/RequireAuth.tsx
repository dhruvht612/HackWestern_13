import { Navigate, Outlet, useLocation } from "react-router-dom";
import { apiConfig } from "@/lib/api";
import { useSession } from "@/lib/session";

/** Gate for every /projects route. Demo (mock) mode has no accounts. */
export function RequireAuth() {
  const current = useSession();
  const location = useLocation();
  if (!apiConfig.USE_MOCKS && !current) {
    return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <Outlet />;
}
