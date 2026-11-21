import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, apiConfig } from "@/lib/api";
import { session, useSession } from "@/lib/session";

export function AccountMenu() {
  const current = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  if (apiConfig.USE_MOCKS) return <span className="mono text-[13px] text-fg-soft">demo mode</span>;
  if (!current) return null;

  const signOut = async () => {
    await api.signOut();
    session.set(null);
    qc.clear(); // never show the previous user's data to the next one
    navigate("/signin");
  };

  return (
    <div className="flex items-center gap-3">
      <span className="mono hidden max-w-[14rem] truncate text-[13px] text-fg-soft sm:inline" title={current.user.email ?? ""}>
        {current.user.email}
      </span>
      <button onClick={signOut} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-soft transition-colors hover:text-kiwi">
        <LogOut size={14} aria-hidden="true" /> Sign out
      </button>
    </div>
  );
}
