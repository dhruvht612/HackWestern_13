import { Link, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { adminMeQuery } from "@/lib/adminSession";
import { ApiError } from "@/lib/api";

/** Convenience gate only: FastAPI checks the role (and two-factor) on every admin request. */
export function RequireAdmin() {
  const me = useQuery(adminMeQuery);

  if (me.isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <PageSkeleton />
      </div>
    );
  }
  if (me.error) {
    const err = me.error;
    if (err instanceof ApiError && err.status === 403 && /two-factor/i.test(err.message)) {
      return (
        <div className="grain min-h-screen px-4 py-16 text-fg">
          <div className="sheet mx-auto max-w-lg p-6 sm:p-8">
            <h1 className="display text-[2rem] font-extrabold leading-none">Two-factor needed</h1>
            <p className="mt-3 text-sm text-fg-soft">
              Admin access requires a two-factor session. Confirm it&apos;s you, then come back.
            </p>
            <Link to="/account/security" className="btn-primary mt-6 py-2">
              Go to account security
            </Link>
          </div>
        </div>
      );
    }
    // Non-admins get the ordinary 404: the portal's existence isn't advertised.
    if (err instanceof ApiError && [401, 403, 404].includes(err.status)) return <NotFoundPage />;
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8">
        <p role="alert">Couldn&apos;t check admin access: {err.message}</p>
        <button className="btn-primary" onClick={() => void me.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  return <Outlet context={me.data} />;
}
