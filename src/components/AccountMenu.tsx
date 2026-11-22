import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck, UserCog } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api, apiConfig } from "@/lib/api";
import { session, useSession } from "@/lib/session";
import { adminMeQuery } from "@/lib/adminSession";

export function AccountMenu() {
  const current = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const account = useQuery({
    queryKey: ["account-status", current?.user.id],
    queryFn: api.me,
    enabled: !apiConfig.USE_MOCKS && Boolean(current),
    refetchOnWindowFocus: true,
  });
  // Shown only when the API confirms an admin role; errors (non-admins) stay silent.
  const admin = useQuery({
    ...adminMeQuery,
    enabled: apiConfig.USE_MOCKS || Boolean(current),
    throwOnError: false,
  });
  const adminLink = admin.data ? (
    <Link
      to="/admin"
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-soft transition-colors hover:text-kiwi"
    >
      <UserCog size={14} aria-hidden="true" /> Admin
    </Link>
  ) : null;
  if (apiConfig.USE_MOCKS)
    return (
      <div className="flex items-center gap-3">
        {adminLink}
        <span className="mono text-[13px] text-fg-soft">demo mode</span>
      </div>
    );
  if (!current) return null;

  const signOut = async () => {
    await api.signOut();
    session.set(null);
    qc.clear(); // never show the previous user's data to the next one
    navigate("/signin");
  };

  return (
    <div className="flex items-center gap-3">
      <span
        className="mono hidden max-w-[14rem] truncate text-[13px] text-fg-soft sm:inline"
        title={current.user.email ?? ""}
      >
        {current.user.email}
      </span>
      {adminLink}
      {account.data?.status === "pending_review" && <span role="status" className="text-sm text-camel">Account under review</span>}
      <Link
        to="/account/security"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-soft transition-colors hover:text-kiwi"
      >
        <ShieldCheck size={14} aria-hidden="true" /> Security
      </Link>
      <button
        onClick={signOut}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-soft transition-colors hover:text-kiwi"
      >
        <LogOut size={14} aria-hidden="true" /> Sign out
      </button>
    </div>
  );
}
